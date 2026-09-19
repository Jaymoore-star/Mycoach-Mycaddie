/**
 * Voice: speech in, speech out.
 *
 * Ported from `reference/convex/voice.ts`, `voiceToken.ts` and
 * `launchMonitorVoice.ts`, with two deliberate departures.
 *
 * 1. **No realtime WebRTC.** The web app streamed the microphone to OpenAI's
 *    realtime API over `RTCPeerConnection`, which does not exist in React
 *    Native - `react-native-webrtc` would mean leaving Expo Go for a custom
 *    dev client. So `voiceToken.ts` has no port: the mobile flow is
 *    push-to-talk. The golfer holds the mic, the clip is uploaded, and
 *    `transcribe` sends it to the same Whisper model the realtime session was
 *    configured to use. Same words out, one round trip instead of a stream.
 *
 * 2. **No Hercules gateway.** Those actions called `ai-gateway.hercules.app`
 *    with a `HERCULES_API_KEY`. This deployment talks to OpenAI directly with
 *    `OPENAI_API_KEY`, via `fetch` rather than the `openai` SDK - the same
 *    approach `swingVideos.ts` already takes, which also sidesteps the SDK's
 *    https patching that forced the reference to split `voiceToken.ts` out
 *    into its own file.
 *
 * Audio comes back as a Convex storage URL rather than a base64 data URI.
 * A minute of speech is roughly a megabyte, and pushing that through a
 * function result to be re-decoded on the device is the slow way to do it;
 * `expo-audio` streams a URL natively.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  type ActionCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
} from './_generated/server';
import { SKILL_LABELS } from './lib/curriculum';
import { stripMarkdown } from './lib/markdown';
import {
  DEFAULT_COACH_ID,
  type CoachId,
} from './lib/coachLevels';
import { getCoachProfile } from './lib/coachPersona';
import {
  LIVE_VAD,
  SHOT_PARSE_SYSTEM_PROMPT,
  buildCaddieSystemPrompt,
  buildSessionSummary,
  normalizeParsedShot,
  ttsInstructionsFor,
  type ParsedShot,
} from './lib/voice';

const SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
/**
 * Where ephemeral realtime credentials come from.
 *
 * Not `/v1/realtime/sessions` - that is the beta endpoint the reference app
 * used, and it now answers "Invalid URL". The GA path is this one, and the
 * token comes back as a top-level `value` rather than nested under
 * `client_secret`.
 */
const REALTIME_CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/client_secrets';

/**
 * Transcription models to try, in order.
 *
 * Which of these an account can use varies, and a rejected model is a 400 that
 * looks exactly like a broken endpoint. Trying them in turn means live
 * transcription works wherever it can rather than only on the tier this was
 * written against. `OPENAI_LIVE_TRANSCRIBE_MODEL` jumps the queue.
 */
const LIVE_TRANSCRIBE_MODELS = [
  'gpt-4o-mini-transcribe',
  'gpt-realtime-whisper',
  'gpt-4o-transcribe',
  'whisper-1',
];

/** PCM16 at 24kHz mono - what `expo-audio`'s stream is configured to deliver. */
const LIVE_SAMPLE_RATE = 24_000;

/** A session outlives a long dictation without outliving a lost phone. */
const TOKEN_LIFETIME_SECONDS = 600;

/** The TTS model that accepts `instructions`, which is how a coach gets a manner. */
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts';
/**
 * Whisper rather than the newer transcribe models: it is on every account
 * regardless of tier, and it takes a `prompt`, which is what keeps "wedge"
 * from coming back as "wed" and "GIR" from becoming "gear". Override with
 * OPENAI_TRANSCRIBE_MODEL if the account supports something better.
 */
const DEFAULT_TRANSCRIBE_MODEL = 'whisper-1';
/** Short spoken answers - the cheap chat model is the right one, as in coachChat. */
const DEFAULT_VOICE_CHAT_MODEL = 'gpt-4o-mini';

/** OpenAI rejects anything longer; a caddie line is nowhere near it. */
const MAX_SPEECH_CHARS = 4096;
/** A held mic button, not a dictated essay. Roughly a minute of speech. */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/**
 * Golf vocabulary, fed to Whisper as context.
 *
 * Transcription is biased by the prompt, and these are the words the model
 * otherwise gets wrong in exactly this setting: club names that sound like
 * ordinary words, and scoring terms it has no reason to expect.
 */
const GOLF_PROMPT =
  'Golf. Driver, 3-wood, 5-wood, hybrid, 4-iron, 5-iron, 6-iron, 7-iron, 8-iron, 9-iron, ' +
  'pitching wedge, gap wedge, sand wedge, lob wedge, putter. Fairway, rough, bunker, fringe, ' +
  'green, pin, flag, tee box. Birdie, eagle, bogey, double bogey, par. Draw, fade, hook, slice, ' +
  'push, pull, thin, fat, chunked, topped, flushed. Carry, yardage, GIR, up and down.';

const coachIdValidator = v.union(
  v.literal('que'),
  v.literal('mason'),
  v.literal('sam'),
  v.literal('dom'),
);

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new ConvexError({
      message: 'Voice is not configured on this deployment yet',
      code: 'NOT_CONFIGURED',
    });
  }
  return key;
}

async function requireUser(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }
  return userId;
}

/** OpenAI's error body is JSON with the useful part nested; fall back to raw text. */
async function describeFailure(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON - the raw body is the best available description.
  }
  return body.slice(0, 200);
}

// ─── Speech out ──────────────────────────────────────────────────────────────

/** Stable cache key. The text is hashed so a long brief stays one index entry. */
async function clipKey(voice: string, text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${voice}:${hex}`;
}

export const findClip = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const clip = await ctx.db
      .query('voiceClips')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique();
    if (!clip) return null;

    const url = await ctx.storage.getUrl(clip.storageId);
    // A clip whose blob was swept out of storage is a miss, not a broken URL.
    return url ? { url } : null;
  },
});

/**
 * Records a clip, or reports that someone else got there first.
 *
 * Two golfers on the same hole can ask for the same sentence at the same
 * moment. Both synthesise, both arrive here; the second is told to drop its
 * copy rather than leaving an unreferenced blob in storage forever.
 */
export const saveClip = internalMutation({
  args: {
    key: v.string(),
    voice: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args): Promise<{ kept: boolean; storageId: Id<'_storage'> }> => {
    const existing = await ctx.db
      .query('voiceClips')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique();

    if (existing) return { kept: false, storageId: existing.storageId };

    await ctx.db.insert('voiceClips', {
      key: args.key,
      voice: args.voice,
      storageId: args.storageId,
      createdAt: Date.now(),
    });
    return { kept: true, storageId: args.storageId };
  },
});

/** Synthesise, store, and hand back a URL - the one path every spoken line takes. */
async function synthesise(
  ctx: ActionCtx,
  text: string,
  coachId: CoachId,
): Promise<{ url: string }> {
  const apiKey = requireApiKey();
  const coach = getCoachProfile(coachId);
  const voice = coach.ttsVoice;

  // Stripped here rather than at the caller so no path can reach the
  // synthesiser with markers in it: a coaching reply full of `**bold**` is
  // read out as "asterisk asterisk grip asterisk asterisk".
  const trimmed = stripMarkdown(text).slice(0, MAX_SPEECH_CHARS);
  if (trimmed.length === 0) {
    throw new ConvexError({ message: 'Nothing to say', code: 'BAD_REQUEST' });
  }

  const key = await clipKey(voice, trimmed);
  const cached = await ctx.runQuery(internal.voice.findClip, { key });
  if (cached) return cached;

  const response = await fetch(SPEECH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? DEFAULT_TTS_MODEL,
      voice,
      input: trimmed,
      instructions: ttsInstructionsFor(coach),
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    throw new ConvexError({
      message: `Could not generate speech: ${await describeFailure(response)}`,
      code: 'UPSTREAM_ERROR',
    });
  }

  const audio = await response.blob();
  const storageId = await ctx.storage.store(
    // The response blob carries no type on some runtimes, and a clip stored
    // without one plays as a download rather than audio on iOS.
    new Blob([await audio.arrayBuffer()], { type: 'audio/mpeg' }),
  );

  const saved = await ctx.runMutation(internal.voice.saveClip, { key, voice, storageId });
  if (!saved.kept) await ctx.storage.delete(storageId);

  const url = await ctx.storage.getUrl(saved.storageId);
  if (!url) {
    throw new ConvexError({ message: 'Speech was lost in storage', code: 'UPSTREAM_ERROR' });
  }
  return { url };
}

/**
 * Speak a line in a coach's voice.
 *
 * The caller supplies the text, because the caddie's script is already built
 * on the device from the recommendation it is showing. Sending the words
 * rather than recomputing them server-side is what keeps the audio and the
 * card on screen from ever disagreeing.
 */
export const speak = action({
  args: {
    text: v.string(),
    coachId: v.optional(coachIdValidator),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    await requireUser(ctx);
    return await synthesise(ctx, args.text, args.coachId ?? DEFAULT_COACH_ID);
  },
});

// ─── Speech in ───────────────────────────────────────────────────────────────

/** Upload slot for a recorded clip. Auth-gated so anonymous callers cannot fill storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Turn a recorded clip into text, then throw the audio away.
 *
 * The recording is deleted whatever happens. It is a means to a transcript,
 * nobody can play it back in the app, and a golfer's voice sitting in storage
 * indefinitely is a liability with no matching feature.
 */
export const transcribe = action({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args): Promise<{ transcript: string }> => {
    await requireUser(ctx);

    try {
      // Inside the try, not before it: the recording has already been
      // uploaded by this point, so every path out of here has to reach the
      // `finally` that deletes it. A deployment with no key would otherwise
      // leave a golfer's voice in storage with nothing to ever remove it.
      const apiKey = requireApiKey();

      const audio = await ctx.storage.get(args.storageId);
      if (!audio) {
        throw new ConvexError({ message: 'Recording not found', code: 'NOT_FOUND' });
      }
      if (audio.size > MAX_AUDIO_BYTES) {
        throw new ConvexError({
          message: 'That recording is too long - keep it under a minute',
          code: 'BAD_REQUEST',
        });
      }

      // The extension has to match the container or OpenAI rejects the upload,
      // and the device decides the container: m4a on Android, m4a on iOS too
      // under expo-audio's high-quality preset.
      const type = audio.type || 'audio/m4a';
      const extension = type.includes('wav')
        ? 'wav'
        : type.includes('webm')
          ? 'webm'
          : type.includes('mpeg') || type.includes('mp3')
            ? 'mp3'
            : 'm4a';

      const form = new FormData();
      form.append('file', audio, `clip.${extension}`);
      form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL ?? DEFAULT_TRANSCRIBE_MODEL);
      form.append('language', 'en');
      form.append('prompt', GOLF_PROMPT);

      const response = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!response.ok) {
        throw new ConvexError({
          message: `Could not transcribe that: ${await describeFailure(response)}`,
          code: 'UPSTREAM_ERROR',
        });
      }

      const parsed = (await response.json()) as { text?: string };
      return { transcript: parsed.text?.trim() ?? '' };
    } finally {
      await ctx.storage.delete(args.storageId);
    }
  },
});

/**
 * A short-lived token for a live transcription session.
 *
 * This is the port of `reference/convex/voiceToken.ts` after all. The header
 * above says the realtime API has no port, and for the web app's *WebRTC*
 * transport that is still true - React Native has no `RTCPeerConnection`. But
 * the same API is reachable over a plain WebSocket, which React Native does
 * have, and `expo-audio`'s `useAudioStream` supplies the raw PCM to feed it.
 * That is what lets the golfer watch their words appear as they speak.
 *
 * The key never leaves the server. What the device gets is a client secret
 * scoped to one session and valid for about a minute, which is the whole
 * reason this action exists rather than the app holding a key.
 */
export const realtimeToken = action({
  args: {},
  handler: async (ctx): Promise<{ token: string; model: string; sampleRate: number }> => {
    await requireUser(ctx);
    const apiKey = requireApiKey();

    const preferred = process.env.OPENAI_LIVE_TRANSCRIBE_MODEL;
    const candidates = preferred
      ? [preferred, ...LIVE_TRANSCRIBE_MODELS.filter((m) => m !== preferred)]
      : LIVE_TRANSCRIBE_MODELS;

    let lastFailure = 'no models were tried';

    for (const model of candidates) {
      const response = await fetch(REALTIME_CLIENT_SECRET_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: TOKEN_LIFETIME_SECONDS },
          session: {
            type: 'transcription',
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: LIVE_SAMPLE_RATE },
                transcription: {
                  model,
                  language: 'en',
                  // The same vocabulary bias the one-shot path uses, for the
                  // same reason: golf terms that sound like ordinary words.
                  prompt: GOLF_PROMPT,
                },
                // Server-side voice activity detection, so a pause between
                // sentences commits a segment without the golfer doing
                // anything. The client restates these on open; both read the
                // same constant so the two cannot disagree.
                turn_detection: LIVE_VAD,
              },
            },
          },
        }),
      });

      if (!response.ok) {
        lastFailure = `${model}: ${await describeFailure(response)}`;
        continue;
      }

      const parsed = (await response.json()) as {
        value?: string;
        client_secret?: { value?: string };
      };

      // GA returns the secret at the top level; the older shape nested it.
      const token = parsed.value ?? parsed.client_secret?.value;
      if (token) return { token, model, sampleRate: LIVE_SAMPLE_RATE };

      lastFailure = `${model}: no token in the response`;
    }

    throw new ConvexError({
      message: `Live transcription is unavailable (${lastFailure})`,
      code: 'UPSTREAM_ERROR',
    });
  },
});

// ─── Understanding what was said ─────────────────────────────────────────────

/** Pulls the JSON object out of a reply that may be fenced or prefixed. */
function parseJsonReply(content: string): unknown {
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function chat(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VOICE_CHAT_MODEL ?? DEFAULT_VOICE_CHAT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new ConvexError({
      message: `Your caddie could not answer: ${await describeFailure(response)}`,
      code: 'UPSTREAM_ERROR',
    });
  }

  const parsed = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return parsed.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Structured shot fields from a spoken sentence.
 *
 * Returns whatever it found, including nothing. An empty object means the
 * golfer said something the extractor could not use, which the screen shows
 * as the raw transcript with the fields left for them to fill in - better
 * than a guessed 7-iron landing in their averages.
 */
export const parseShot = action({
  args: { transcript: v.string() },
  handler: async (ctx, args): Promise<ParsedShot> => {
    await requireUser(ctx);
    const apiKey = requireApiKey();

    const transcript = args.transcript.trim();
    if (transcript.length === 0) return {};

    const reply = await chat(apiKey, SHOT_PARSE_SYSTEM_PROMPT, transcript, 200, 0);
    return normalizeParsedShot(parseJsonReply(reply));
  },
});

// ─── The spoken caddie ───────────────────────────────────────────────────────

/** The golfer's name and level, for grounding a spoken answer. */
export const getSpeaker = internalQuery({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.userId !== userId) return null;

    return {
      displayName: profile.displayName,
      skillLabel: SKILL_LABELS[profile.skillLevel],
      coachId: (profile.coachId ?? DEFAULT_COACH_ID) as CoachId,
    };
  },
});

/**
 * Answer a question asked out loud on the course, and speak the answer.
 *
 * One action rather than ask-then-speak so the round trip happens once: the
 * golfer is standing over a ball, and two sequential calls from a phone on
 * course data is a visible pause.
 */
export const askCaddie = action({
  args: {
    profileId: v.id('golferProfiles'),
    transcript: v.string(),
    holeNumber: v.optional(v.number()),
    par: v.optional(v.number()),
    distanceToPin: v.optional(v.number()),
    windMph: v.optional(v.number()),
    windDirection: v.optional(v.string()),
    lie: v.optional(v.string()),
    primaryClub: v.optional(v.string()),
    adjustedYardage: v.optional(v.number()),
    aimAdjustment: v.optional(v.string()),
    /**
     * Synthesise the answer as well as writing it.
     *
     * Off by default, and deliberately so. The answer used to be spoken the
     * moment it arrived, which is wrong twice over: a golfer reading a reply on
     * a quiet course does not want their phone talking, and every question paid
     * for a TTS clip whether or not anyone heard it. The screen offers "Hear
     * it" instead, which goes through `speak` and its cache.
     */
    speak: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ text: string; url: string | null }> => {
    await requireUser(ctx);
    const apiKey = requireApiKey();

    const transcript = args.transcript.trim();
    if (transcript.length === 0) {
      throw new ConvexError({ message: 'Nothing was said', code: 'BAD_REQUEST' });
    }

    // Ids arrive from the client, so a valid id is not permission.
    const speaker = await ctx.runQuery(internal.voice.getSpeaker, {
      profileId: args.profileId,
    });
    if (!speaker) {
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }

    const coach = getCoachProfile(speaker.coachId);
    const system = buildCaddieSystemPrompt(coach, {
      playerName: speaker.displayName,
      skillLabel: speaker.skillLabel,
      ...(args.holeNumber !== undefined ? { holeNumber: args.holeNumber } : {}),
      ...(args.par !== undefined ? { par: args.par } : {}),
      ...(args.distanceToPin !== undefined ? { distanceToPin: args.distanceToPin } : {}),
      ...(args.windMph !== undefined ? { windMph: args.windMph } : {}),
      ...(args.windDirection !== undefined ? { windDirection: args.windDirection } : {}),
      ...(args.lie !== undefined ? { lie: args.lie } : {}),
      ...(args.primaryClub !== undefined ? { primaryClub: args.primaryClub } : {}),
      ...(args.adjustedYardage !== undefined ? { adjustedYardage: args.adjustedYardage } : {}),
      ...(args.aimAdjustment !== undefined ? { aimAdjustment: args.aimAdjustment } : {}),
    });

    // 120 tokens is about three spoken sentences - past the two the prompt
    // asks for, so a sensible answer is never cut off mid-word.
    const text =
      (await chat(apiKey, system, transcript, 120, 0.6)) || 'Commit to the shot and swing.';

    if (!args.speak) return { text, url: null };

    const { url } = await synthesise(ctx, text, speaker.coachId);
    return { text, url };
  },
});

// ─── Reading a launch monitor session aloud ──────────────────────────────────

export const getSessionForReadAloud = internalQuery({
  args: { sessionId: v.id('launchSessions') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) return null;

    const shots = await ctx.db
      .query('launchShots')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();

    const profile = await ctx.db.get(session.profileId);

    return {
      session,
      shots,
      coachId: (profile?.coachId ?? DEFAULT_COACH_ID) as CoachId,
    };
  },
});

/**
 * The session debrief, spoken by the golfer's coach.
 *
 * The script is built by `buildSessionSummary`, which is pure and tested - no
 * model is involved. Range numbers are facts, and a caddie reading facts back
 * should say the same thing twice.
 */
export const readAloudSession = action({
  args: { sessionId: v.id('launchSessions') },
  handler: async (ctx, args): Promise<{ text: string; url: string }> => {
    await requireUser(ctx);

    const found = await ctx.runQuery(internal.voice.getSessionForReadAloud, {
      sessionId: args.sessionId,
    });
    if (!found) {
      throw new ConvexError({ message: 'Session not found', code: 'NOT_FOUND' });
    }

    const text = buildSessionSummary(
      {
        ...(found.session.label !== undefined ? { label: found.session.label } : {}),
        ...(found.session.club !== undefined ? { club: found.session.club } : {}),
        shotCount: found.session.shotCount,
        ...(found.session.avgCarryYards !== undefined
          ? { avgCarryYards: found.session.avgCarryYards }
          : {}),
        ...(found.session.avgBallSpeedMph !== undefined
          ? { avgBallSpeedMph: found.session.avgBallSpeedMph }
          : {}),
        ...(found.session.avgSmashFactor !== undefined
          ? { avgSmashFactor: found.session.avgSmashFactor }
          : {}),
        ...(found.session.avgSpinRpm !== undefined
          ? { avgSpinRpm: found.session.avgSpinRpm }
          : {}),
      },
      found.shots.map((s) => ({
        ...(s.carryYards !== undefined ? { carryYards: s.carryYards } : {}),
        ...(s.shotShape !== undefined ? { shotShape: s.shotShape } : {}),
        ...(s.contactType !== undefined ? { contactType: s.contactType } : {}),
      })),
    );

    const { url } = await synthesise(ctx, text, found.coachId);
    return { text, url };
  },
});
