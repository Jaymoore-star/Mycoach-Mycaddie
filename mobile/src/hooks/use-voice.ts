/**
 * Talking to the app, and the app talking back.
 *
 * Two hooks, deliberately separate. `useSpeech` is for lines the app says on
 * its own - the caddie reading a shot brief, a session debrief - and nothing
 * about it needs a microphone or its permission prompt. `useDictation` is the
 * push-to-talk half. A screen that only speaks should not be asking for
 * microphone access on mount.
 *
 * The web app streamed the mic to OpenAI's realtime API over WebRTC and got
 * continuous, voice-activated transcription. React Native has no
 * `RTCPeerConnection`, so the mobile flow is hold-to-talk: record, upload,
 * transcribe. See the header of `convex/voice.ts` for why that trade was made
 * rather than pulling in `react-native-webrtc`.
 */
import { useAction, useMutation } from 'convex/react';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { CoachId } from '@/convex/lib/coachLevels';
import { errorMessage as messageOf } from '@/lib/errors';

/** Anything shorter than this is a mis-tap, not a sentence. */
const MIN_RECORDING_MS = 400;

/**
 * Every player this module has going, across all three hooks.
 *
 * iOS has one audio session for the whole app, and a player that is still
 * attached holds it in the playback category. Recording needs it switched to
 * play-and-record, and that switch fails outright while playback owns it:
 *
 *   AudioRecordingException: Failed to configure audio session:
 *   Session activation failed
 *
 * `useSpeech` and `useDictation` are separate hooks, often on separate
 * screens, so neither can reach the other's player through React. A module
 * registry is the smallest thing that lets the microphone clear the session
 * before it asks for it - which is exactly what a golfer does when they tap
 * "Hear it" and then reach for the mic.
 */
const livePlayers = new Set<AudioPlayer>();

/** Pause, release and forget a player. Safe to call on one already gone. */
function discard(player: AudioPlayer) {
  livePlayers.delete(player);
  try {
    // Pause first: `release` only detaches the JS object from its native
    // counterpart, and on its own is not a reliable way to silence audio.
    player.pause();
    player.release();
  } catch {
    // Already released - nothing left to silence.
  }
}

/** Silences everything this module is playing, whichever hook started it. */
function silenceAll() {
  for (const player of [...livePlayers]) discard(player);
}

/**
 * Hands the microphone the audio session, forcing it down first if it has to.
 *
 * Every path that opens the microphone goes through here - the one-shot
 * recorder and the live stream both - because the session is one thing for the
 * whole app and the failure is the same for either:
 *
 *   AudioRecordingException: Failed to configure audio session:
 *   Session activation failed
 *
 * Releasing every player is usually enough, but iOS does not always hand the
 * session back on the same turn - and something outside the app (a call just
 * ended, another app's audio fading out) can hold it too. The recovery is to
 * deactivate the session explicitly and ask again. One retry: if the second
 * attempt fails as well, something is genuinely holding the microphone and the
 * golfer needs to be told rather than kept waiting.
 *
 * `open` is whatever actually claims the microphone - preparing the recorder,
 * or starting the stream - and is retried with the session, since on iOS it is
 * the call that trips over the old one.
 */
export async function claimRecordingSession(open: () => Promise<unknown>) {
  // Anything still playing owns the iOS audio session, and the switch to
  // play-and-record fails while it does. This is the ordinary case, not an
  // edge one: tapping "Hear it" and then reaching for the mic.
  silenceAll();

  try {
    // Recording and playback want opposite audio session settings on iOS;
    // switching here rather than once at startup means a screen that both
    // speaks and listens does not have to fight over the session.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await open();
  } catch (first) {
    try {
      await setIsAudioActiveAsync(false);
      await setIsAudioActiveAsync(true);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await open();
    } catch {
      // Report the original failure: the retry's is a symptom of the same
      // thing and says less about what actually went wrong.
      throw first;
    }
  }
}

/** True of the audio-session failures that a golfer can actually act on. */
export function isAudioSessionFailure(raw: string): boolean {
  return /audio session|session activation|AudioRecordingException/i.test(raw);
}

/** A player that is registered, so the microphone can always find it. */
function openPlayer(url: string): AudioPlayer {
  const player = createAudioPlayer(url);
  livePlayers.add(player);
  return player;
}

/** Unwraps whichever shape the failure arrived in, for an alert or a caption. */
export function voiceErrorMessage(error: unknown, fallback: string): string {
  return messageOf(error, fallback);
}

// ─── Speaking ────────────────────────────────────────────────────────────────

export type SpeechState = 'idle' | 'loading' | 'speaking' | 'error';

/**
 * Plays a line in the golfer's coach's voice.
 *
 * `createAudioPlayer` rather than `useAudioPlayer`, because the source is not
 * known at render time - every line is a different URL, and re-rendering the
 * screen to hand the hook a source would restart playback on any unrelated
 * state change. The player is created per utterance and released when it
 * finishes, which is also what stops a half-played brief from holding the
 * audio session open on the walk to the next tee.
 */
export function useSpeech(coachId?: CoachId) {
  const speakAction = useAction(api.voice.speak);

  const [state, setState] = useState<SpeechState>('idle');
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  // Survives unmount so a late-resolving request cannot set state on a dead
  // screen or leave a player running after the golfer navigated away.
  const alive = useRef(true);
  /**
   * Bumped by every `stop` and every new `speak`.
   *
   * Synthesis takes a second or two, and the golfer can press stop inside that
   * window. Without this the audio would arrive afterwards and start playing
   * with nothing on screen still claiming to be speaking - a caddie that talks
   * over you after you told it to be quiet.
   */
  const generation = useRef(0);

  const release = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    if (player) discard(player);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
      release();
    };
  }, [release]);

  const stop = useCallback(() => {
    generation.current += 1;
    release();
    if (alive.current) setState('idle');
  }, [release]);

  /** Speak a line. Resolves when playback starts, not when it finishes. */
  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      release();
      setError(null);
      setState('loading');

      generation.current += 1;
      const mine = generation.current;
      const current = () => alive.current && generation.current === mine;

      try {
        const { url } = await speakAction({
          text,
          ...(coachId ? { coachId } : {}),
        });
        if (!current()) return;

        // A round is played outdoors with the ringer switched off more often
        // than not, and a caddie nobody can hear is not a caddie.
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        if (!current()) return;

        const player = openPlayer(url);
        playerRef.current = player;

        player.addListener('playbackStatusUpdate', (status) => {
          // Only this utterance may end itself; a stale listener calling stop
          // would silence whatever is playing now.
          if (status.didJustFinish && generation.current === mine) stop();
        });

        player.play();
        setState('speaking');
      } catch (err) {
        if (!current()) return;
        setError(messageOf(err, 'Your caddie could not speak just then.'));
        setState('error');
      }
    },
    [speakAction, coachId, release, stop],
  );

  return {
    speak,
    stop,
    state,
    error,
    isBusy: state === 'loading' || state === 'speaking',
    isSpeaking: state === 'speaking',
  };
}

/**
 * Plays audio the caller already has a URL for.
 *
 * `askCaddie` and `readAloudSession` answer and synthesise in one round trip,
 * so their audio arrives alongside the text and does not need `speak` to go
 * back out for it.
 */
export function usePlayback() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const alive = useRef(true);
  const generation = useRef(0);

  const stop = useCallback(() => {
    generation.current += 1;

    const player = playerRef.current;
    playerRef.current = null;
    if (player) discard(player);
    if (alive.current) setIsPlaying(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, [stop]);

  const play = useCallback(
    async (url: string) => {
      stop();

      const mine = generation.current;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      // Stopped, or the screen went away, while the audio session was being
      // configured - do not start playing into the void.
      if (!alive.current || generation.current !== mine) return;

      const player = openPlayer(url);
      playerRef.current = player;
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish && generation.current === mine) stop();
      });
      player.play();
      setIsPlaying(true);
    },
    [stop],
  );

  return { play, stop, isPlaying };
}

// ─── Listening ───────────────────────────────────────────────────────────────

export type DictationState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'denied'
  | 'error';

/**
 * Hold to talk, release to transcribe.
 *
 * The recording never touches the app's own storage: it goes straight to
 * Convex, is transcribed, and the server deletes the audio in the same call.
 * Nothing in the app plays a recording back, so keeping one would be storing
 * a golfer's voice for no feature at all.
 */
export function useDictation(onTranscript: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const generateUploadUrl = useMutation(api.voice.generateUploadUrl);
  const transcribe = useAction(api.voice.transcribe);

  const [state, setState] = useState<DictationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const alive = useRef(true);

  /**
   * The real state of the recorder, tracked in a ref rather than in `state`.
   *
   * `start` is asynchronous - a permission check, an audio session switch and
   * a prepare - and a finger can easily be up again before any of that
   * finishes. React state has not been committed by then, so a `stop` that
   * read it would decide nothing was recording, bail out, and leave the
   * recorder running with no way to stop it. This ref is written the instant
   * each step actually happens.
   */
  const phase = useRef<'idle' | 'starting' | 'recording' | 'working'>('idle');
  /** Set when the finger comes up during `starting`, and honoured on arrival. */
  const stopRequested = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Everything after the recorder is stopped: upload, transcribe, hand back. */
  const finish = useCallback(async () => {
    phase.current = 'working';

    const heldMs = Date.now() - startedAt.current;
    setState('transcribing');

    try {
      await recorder.stop();
      const uri = recorder.uri;

      // Hand the session back to playback. Left in play-and-record, iOS routes
      // audio to the earpiece rather than the speaker, so the coach's reply
      // comes back almost inaudible on a phone held at arm's length.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      // Too short to contain speech - a double tap, or a stop before the
      // microphone was really open. Saying so beats going quiet, which reads
      // as a broken button.
      if (!uri || heldMs < MIN_RECORDING_MS) {
        phase.current = 'idle';
        if (alive.current) {
          setError('That was too short to hear. Tap the mic, speak, then tap stop.');
          setState('idle');
        }
        return;
      }

      const uploadUrl = await generateUploadUrl();
      const read = await fetch(uri);
      const raw = await read.blob();

      // React Native derives the request's content-type from the blob, not
      // from the header, and a blob read off a file:// URI carries no type -
      // Convex rejects the empty header as BadHeader. Re-wrap so the type
      // travels with the body. Same fix as the swing video upload.
      const contentType = 'audio/m4a';
      const body = raw.type ? raw : new Blob([raw], { type: contentType });

      const upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      });
      if (!upload.ok) {
        throw new Error(`Upload failed: ${upload.status}`);
      }

      const { storageId } = (await upload.json()) as { storageId: Id<'_storage'> };
      const { transcript } = await transcribe({ storageId });

      phase.current = 'idle';
      if (!alive.current) return;
      setState('idle');

      const said = transcript.trim();
      if (said) onTranscript(said);
      else setError('Nothing came through - try again a little closer to the mic.');
    } catch (err) {
      phase.current = 'idle';
      if (!alive.current) return;
      setError(messageOf(err, 'Could not make out what you said.'));
      setState('error');
    }
  }, [recorder, generateUploadUrl, transcribe, onTranscript]);

  const start = useCallback(async () => {
    // A second press while one is already in flight is a double-tap, not a
    // new recording.
    if (phase.current !== 'idle') return;

    phase.current = 'starting';
    stopRequested.current = false;
    setError(null);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        phase.current = 'idle';
        if (alive.current) {
          setState('denied');
          setError('Microphone access is off. Turn it on in Settings to talk to your caddie.');
        }
        return;
      }

      await claimRecordingSession(() => recorder.prepareToRecordAsync());
      recorder.record();

      startedAt.current = Date.now();
      phase.current = 'recording';
      if (alive.current) setState('recording');

      // The finger came up while all of that was happening, or the screen
      // went away. Either way the recorder is live now and has to be stopped.
      if (stopRequested.current || !alive.current) await finish();
    } catch (err) {
      phase.current = 'idle';
      if (!alive.current) return;

      // The raw message here is a Swift stack trace. It tells the golfer
      // nothing and tells us nothing they could act on.
      const raw = messageOf(err, '');
      setError(
        isAudioSessionFailure(raw)
          ? 'Something else is using the microphone. Close other audio apps and try again.'
          : messageOf(err, 'Could not start recording.'),
      );
      setState('error');
    }
  }, [recorder, finish]);

  const stop = useCallback(async () => {
    // Still setting up: leave a note for `start` to act on when it gets there.
    if (phase.current === 'starting') {
      stopRequested.current = true;
      return;
    }
    if (phase.current !== 'recording') return;

    await finish();
  }, [finish]);

  /** Back to idle after a failure, so the mic is usable again without a remount. */
  const reset = useCallback(() => {
    setError(null);
    setState('idle');
  }, []);

  return {
    start,
    stop,
    reset,
    state,
    error,
    isRecording: state === 'recording',
    isBusy: state === 'recording' || state === 'transcribing',
  };
}
