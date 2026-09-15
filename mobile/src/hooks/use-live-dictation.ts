/**
 * Tap to talk, and watch the words appear.
 *
 * The microphone streams raw PCM straight to OpenAI's realtime transcription
 * socket, and the text arrives back in pieces while the golfer is still
 * speaking. `expo-audio`'s `useAudioStream` supplies the buffers and React
 * Native has WebSocket, so the only part of the web app's realtime setup that
 * could not be ported was its WebRTC transport - not the feature.
 *
 * It falls back on its own. If the token cannot be minted, the socket will not
 * open, or it drops mid-sentence, the recording carries on through
 * `useDictation` and the text lands in one piece at the end. The golfer's
 * interaction does not change either way: tap to start, tap to stop.
 */
import { useAction } from 'convex/react';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/convex/_generated/api';
import { encodeBase64 } from '@/lib/base64';

import {
  claimRecordingSession,
  useDictation,
  voiceErrorMessage,
  type DictationState,
} from './use-voice';

/** What the realtime transcription session expects: 24kHz mono PCM16. */
const SAMPLE_RATE = 24_000;

/**
 * The GA realtime socket.
 *
 * No `?intent=transcription` - that was the beta shape, alongside the
 * `/v1/realtime/sessions` endpoint that now answers "Invalid URL". What kind
 * of session this is comes from the client secret itself, and is reinforced by
 * the `session.update` sent on open.
 */
const SOCKET_URL = 'wss://api.openai.com/v1/realtime';

/** Long enough to survive a slow handshake, short enough not to feel stuck. */
const CONNECT_TIMEOUT_MS = 6000;

/**
 * How the server decides a sentence has ended.
 *
 * Transcription is turn-based: nothing comes back until the model decides the
 * golfer has stopped talking, so this number *is* the delay between saying a
 * thing and seeing it. 600ms was the reference app's setting for a
 * conversational agent, which wants to be sure you have finished before it
 * answers. Dictation wants the opposite - shorter segments, arriving sooner,
 * even at the cost of the occasional split at a natural pause.
 */
const VAD = {
  type: 'server_vad' as const,
  threshold: 0.5,
  prefix_padding_ms: 200,
  silence_duration_ms: 350,
};

/**
 * Microphone buffers held while the socket is still opening.
 *
 * Capture starts the instant the golfer taps, but the token mint and handshake
 * take a moment, and anything said in that window used to be dropped on the
 * floor - so the first few words of a quick question never arrived. About
 * eight seconds' worth at 24kHz, which is far more headroom than a handshake
 * needs and still bounded if the socket never opens at all.
 */
const MAX_QUEUED_CHUNKS = 120;

/** Longest wait for the final segment after the golfer taps stop. */
const FINAL_SEGMENT_TIMEOUT_MS = 1500;

/** The API refuses a commit below 100ms; a little margin over that. */
const MIN_COMMIT_MS = 150;

/**
 * Errors worth showing a golfer.
 *
 * A commit that races the server's own turn-taking is harmless - the words
 * still arrive - but the API says so out loud, and it used to land in red
 * under the composer as if something had broken. The race is now rare rather
 * than routine, but it cannot be closed entirely: `stop` decides from events
 * that were true a network hop ago.
 */
const BENIGN_ERROR = /buffer too small|commit_empty|buffer is empty/i;

/**
 * React Native's WebSocket takes a third argument that the DOM one does not.
 *
 * Headers are the whole reason this hook can talk to OpenAI at all - a browser
 * WebSocket cannot set `Authorization`, which is why the web app had to smuggle
 * its key through a subprotocol. The type here comes from the DOM lib, so the
 * extra parameter has to be declared.
 */
const NativeWebSocket = WebSocket as unknown as new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => WebSocket;

export type LiveDictationState = DictationState | 'connecting';

type RealtimeEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
};

export type LiveDictationOptions = {
  /**
   * Called with the complete text each time it changes, so the caller can put
   * it straight into an input. Always the whole value rather than a delta - a
   * text field is easier to drive from a value than a diff, and a dropped
   * frame cannot desynchronise the two.
   */
  onText?: (text: string) => void;
  /**
   * Called once, with the finished text, when the golfer stops.
   *
   * This is what a screen that *acts* on speech wants - asking the caddie a
   * question, filling in a shot. `onText` fires on every word, and a caddie
   * asked a fresh question per syllable is not a caddie.
   */
  onFinal?: (text: string) => void;
};

export function useLiveDictation(options: LiveDictationOptions) {
  const { onText, onFinal } = options;
  const mintToken = useAction(api.voice.realtimeToken);

  const [state, setState] = useState<LiveDictationState>('idle');
  const [error, setError] = useState<string | null>(null);
  /** True once this session has given up on the socket and is recording instead. */
  const [degraded, setDegraded] = useState(false);

  const socket = useRef<WebSocket | null>(null);
  /** Segments the model has finalised, plus the one still being spoken. */
  const settled = useRef('');
  const partial = useRef('');
  const alive = useRef(true);
  /** Audio captured before the socket was ready to take it. */
  const queued = useRef<string[]>([]);
  /** True once the session is configured and audio may flow. */
  const ready = useRef(false);
  /** Resolves the wait in `stop` as soon as the last segment comes back. */
  const finalSegment = useRef<(() => void) | null>(null);
  /**
   * True while the server has an unfinished speech turn.
   *
   * This is the only reliable answer to "is there anything in the buffer to
   * commit". Counting the audio *sent* is not: with server VAD the server
   * discards what is not speech, so the silence between the last word and the
   * tap on stop accumulates on the client and nowhere else. Committing on the
   * strength of that tally is what produced
   *
   *   buffer too small. Expected at least 100ms of audio, but buffer only
   *   has 0.00ms of audio.
   *
   * every time the golfer paused before stopping. The server's own
   * `speech_started` / `speech_stopped` events say what it actually holds.
   */
  const speechOpen = useRef(false);
  /** Audio appended since the current speech turn began, in milliseconds. */
  const uncommittedMs = useRef(0);
  /**
   * True once the server has taken a buffer whose transcript has not arrived.
   *
   * `stop` waits on this rather than closing immediately, so the last sentence
   * is not lost when VAD commits it a moment before the golfer taps stop.
   */
  const pendingTranscript = useRef(false);
  const [live, setLive] = useState(false);

  // The fallback path. Its recorder is only ever started if the socket fails,
  // but the hook has to be called unconditionally.
  const fallback = useDictation(
    useCallback(
      (text: string) => {
        settled.current = [settled.current, text].filter(Boolean).join(' ');
        onText?.(settled.current);
      },
      [onText],
    ),
  );

  const emit = useCallback(() => {
    const full = [settled.current, partial.current].filter(Boolean).join(' ');
    onText?.(full);
  }, [onText]);

  const closeSocket = useCallback(() => {
    const open = socket.current;
    socket.current = null;
    if (!open) return;
    try {
      open.close();
    } catch {
      // Already closing - nothing to do.
    }
  }, []);

  const { stream } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer: useCallback((buffer: { data: ArrayBuffer }) => {
      const audio = encodeBase64(buffer.data);
      const open = socket.current;

      // Not connected yet: hold it rather than lose it. The golfer starts
      // talking the moment they tap, not the moment the handshake finishes.
      if (!ready.current || !open || open.readyState !== 1) {
        if (queued.current.length < MAX_QUEUED_CHUNKS) queued.current.push(audio);
        return;
      }

      try {
        open.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
        // int16 mono: two bytes per sample.
        uncommittedMs.current += (buffer.data.byteLength / 2 / SAMPLE_RATE) * 1000;
      } catch {
        // A send on a socket that closed between the check and here. The
        // close handler deals with it; dropping one buffer is not worth
        // tearing the session down.
      }
    }, []),
  });

  const stopEverything = useCallback(() => {
    closeSocket();
    try {
      stream.stop();
    } catch {
      // Never started, or already stopped.
    }
  }, [closeSocket, stream]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopEverything();
    };
  }, [stopEverything]);

  /** Opens the socket and waits for it to be usable. Rejects on anything else. */
  const connect = useCallback(
    async (token: string) =>
      new Promise<WebSocket>((resolve, reject) => {
        // React Native's WebSocket takes headers, which browsers do not - so
        // the token goes in an Authorization header rather than smuggled
        // through a subprotocol.
        const open = new NativeWebSocket(SOCKET_URL, [], {
          headers: { Authorization: `Bearer ${token}` },
        });

        const timer = setTimeout(() => {
          try {
            open.close();
          } catch {
            // Closing a socket that never opened.
          }
          reject(new Error('Live transcription did not connect in time'));
        }, CONNECT_TIMEOUT_MS);

        open.onopen = () => {
          clearTimeout(timer);
          resolve(open);
        };
        open.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Live transcription could not connect'));
        };
      }),
    [],
  );

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case 'conversation.item.input_audio_transcription.delta':
          partial.current += event.delta ?? '';
          emit();
          break;

        case 'conversation.item.input_audio_transcription.completed': {
          // The completed event carries the authoritative text for the
          // segment, which can differ from the deltas once the model has
          // heard the end of the sentence.
          const finalText = (event.transcript ?? partial.current).trim();
          if (finalText) {
            settled.current = [settled.current, finalText].filter(Boolean).join(' ');
          }
          partial.current = '';
          uncommittedMs.current = 0;
          pendingTranscript.current = false;
          emit();

          // `stop` may be waiting on exactly this, rather than on a timer.
          finalSegment.current?.();
          finalSegment.current = null;
          break;
        }

        case 'input_audio_buffer.speech_started':
          // A turn is open, and the buffer fills from here.
          speechOpen.current = true;
          uncommittedMs.current = 0;
          if (alive.current) setState('recording');
          break;

        case 'input_audio_buffer.committed':
        case 'input_audio_buffer.speech_stopped':
          // The server has taken the buffer; there is nothing left to commit,
          // and a transcript for it is now on its way.
          speechOpen.current = false;
          uncommittedMs.current = 0;
          pendingTranscript.current = true;
          break;

        case 'error': {
          // Not fatal on its own: the session usually keeps going. Recorded
          // so a golfer whose words stop appearing is not left guessing - but
          // a lost commit race is not something to put in front of them.
          const message = event.error?.message ?? 'Live transcription hiccuped.';
          if (BENIGN_ERROR.test(message)) {
            console.warn('[useLiveDictation]', message);
            break;
          }
          if (alive.current) setError(message);
          break;
        }
      }
    },
    [emit],
  );

  const start = useCallback(async () => {
    if (state !== 'idle' && state !== 'error') return;

    setError(null);
    setDegraded(false);
    setLive(false);
    settled.current = '';
    partial.current = '';
    queued.current = [];
    ready.current = false;
    speechOpen.current = false;
    uncommittedMs.current = 0;
    pendingTranscript.current = false;
    setState('connecting');

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        if (alive.current) {
          setState('denied');
          setError('Microphone access is off. Turn it on in Settings to talk to your caddie.');
        }
        return;
      }

      // The microphone opens first, before the token and the handshake. Those
      // take a second or so, and a golfer starts talking when they tap, not
      // when the network is ready - so the audio is captured from the tap and
      // queued until there is somewhere to send it.
      //
      // Through the shared claim, not a bare `setAudioModeAsync`: a coach reply
      // played with "Hear it" still owns the iOS audio session, and starting
      // the stream under it fails with "Session activation failed". This path
      // used to take that as the socket being unavailable and drop to a plain
      // recording, so tapping the mic straight after listening silently cost
      // the golfer live transcription.
      //
      // The stop inside is what makes the retry worth anything. `claim` runs
      // this twice, and unlike preparing a recorder, starting a stream is not
      // idempotent - a first attempt that got far enough to take the microphone
      // before failing would leave it held, and the second attempt would fail
      // on that instead. On the first pass there is nothing to stop.
      await claimRecordingSession(async () => {
        try {
          stream.stop();
        } catch {
          // Not started - which is the ordinary case on the first attempt.
        }
        await stream.start();
      });
      if (alive.current) setState('recording');

      const { token, model } = await mintToken();
      if (!alive.current) return;

      const open = await connect(token);
      if (!alive.current) {
        open.close();
        return;
      }

      open.onmessage = (message) => {
        try {
          handleEvent(JSON.parse(String(message.data)) as RealtimeEvent);
        } catch {
          // A frame that is not JSON is not something to act on.
        }
      };

      open.onclose = () => {
        // A close during `stop` is the expected end of the session.
        socket.current = null;
        ready.current = false;
      };

      socket.current = open;

      // Restate the session on open. The client secret already carries this
      // configuration, but saying it again is what the transcription guide
      // shows and it costs one frame - worth it to be certain the audio format
      // matches what the microphone is already sending.
      open.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'transcription',
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: SAMPLE_RATE },
                transcription: { model, language: 'en' },
                turn_detection: VAD,
              },
            },
          },
        }),
      );

      // Everything said during the handshake, in order, before anything new.
      const backlog = queued.current;
      queued.current = [];
      ready.current = true;

      // No tally for these: the server has not opened a turn on them yet, and
      // `speech_started` is what starts counting.
      for (const audio of backlog) {
        open.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
      }

      if (alive.current) setLive(true);
    } catch (failure) {
      // Live transcription is the nicety; capturing what the golfer says is
      // the feature. Fall back to recording the whole thing and transcribing
      // it at the end rather than refusing to listen.
      stopEverything();
      if (!alive.current) return;

      console.warn('[useLiveDictation]', voiceErrorMessage(failure, 'socket failed'));
      setDegraded(true);
      await fallback.start();
    }
  }, [state, mintToken, connect, handleEvent, stream, stopEverything, fallback]);

  const stop = useCallback(async () => {
    if (degraded) {
      // `fallback.stop` resolves only once the clip has been transcribed, so
      // by here `settled` holds everything that was said.
      await fallback.stop();
      if (alive.current) setState('idle');
      if (settled.current.trim()) onFinal?.(settled.current.trim());
      return;
    }

    if (state !== 'recording' && state !== 'connecting') return;

    setLive(false);

    // Stop the microphone first: nothing said after the tap belongs in the
    // transcript, and it frees the audio session a moment sooner.
    try {
      stream.stop();
    } catch {
      // Already stopped.
    }

    const open = socket.current;
    const usable = !!open && open.readyState === 1;

    // Commit only mid-sentence - when the server has a turn open and enough of
    // it has gone in to clear the 100ms floor. Stopping during a pause needs no
    // commit at all: VAD took that buffer at the pause, and everything since is
    // silence the server discarded rather than kept.
    if (usable && speechOpen.current && uncommittedMs.current >= MIN_COMMIT_MS) {
      try {
        open!.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        pendingTranscript.current = true;
      } catch {
        // Closing anyway.
      }
    }

    // Wait whenever a transcript is owed, whether this commit asked for it or
    // VAD did a moment before the tap. Closing the socket while one is in
    // flight is how the last sentence used to go missing.
    if (usable && pendingTranscript.current) {
      if (alive.current) setState('transcribing');

      // Waits on the transcript rather than on a fixed timer, so a short tail
      // comes back immediately instead of always costing the worst case.
      await new Promise<void>((resolve) => {
        finalSegment.current = resolve;
        setTimeout(resolve, FINAL_SEGMENT_TIMEOUT_MS);
      });
      finalSegment.current = null;
    }

    closeSocket();
    ready.current = false;
    speechOpen.current = false;
    uncommittedMs.current = 0;
    pendingTranscript.current = false;
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    if (!alive.current) return;

    // Fold any uncommitted partial into the text rather than dropping it.
    if (partial.current.trim()) {
      settled.current = [settled.current, partial.current.trim()].filter(Boolean).join(' ');
      partial.current = '';
      emit();
    }

    setState('idle');
    if (settled.current.trim()) onFinal?.(settled.current.trim());
  }, [degraded, fallback, state, stream, closeSocket, emit, onFinal]);

  const reset = useCallback(() => {
    setError(null);
    setState('idle');
  }, []);

  // While degraded, the fallback owns the state the UI should show.
  const effectiveState: LiveDictationState = degraded ? fallback.state : state;

  return {
    start,
    stop,
    reset,
    state: effectiveState,
    error: degraded ? fallback.error : error,
    /** True once the words are going straight into the field as they are said. */
    isLive: !degraded && live,
    /**
     * True when the socket could not be used and this is a plain recording.
     *
     * Distinct from `!isLive`, which is also true for the second between the
     * microphone opening and the socket being ready - the screen should not
     * announce a downgrade that has not happened.
     */
    isDegraded: degraded,
    isRecording: effectiveState === 'recording' || effectiveState === 'connecting',
    isBusy:
      effectiveState === 'recording' ||
      effectiveState === 'connecting' ||
      effectiveState === 'transcribing',
  };
}
