import { v } from 'convex/values';

import { internalAction, internalMutation } from './_generated/server';
import { buildCoachSystemPrompt, type PlayerSnapshot } from './lib/coachContext';
import { getCoachProfile } from './lib/coachPersona';
import { manualForQuestion } from './lib/manual';

/**
 * Development helpers.
 *
 * These are `internalMutation`s on purpose: internal functions are NOT callable
 * from any client, only from the Convex dashboard or `npx convex run`, both of
 * which require deployment admin credentials. Exposing a gate-reset as a public
 * mutation would let anyone bypass the one-day-per-day rule.
 */

/** Unlocks today's drills again by clearing the advance gate. */
export const resetDailyGate = internalMutation({
  args: {
    profileId: v.id('golferProfiles'),
    /** When given, today's sessions for this date are deleted too. */
    clearSessionsOn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error('Profile not found');

    await ctx.db.patch(args.profileId, { lastAdvancedDate: undefined });

    let deleted = 0;
    if (args.clearSessionsOn) {
      const sessions = await ctx.db
        .query('trainingSessions')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .collect();

      // Only the session for the day the golfer is currently on - earlier
      // days' practice history is left untouched.
      for (const s of sessions) {
        if (s.date === args.clearSessionsOn && s.day === profile.currentDay) {
          await ctx.db.delete(s._id);
          deleted++;
        }
      }
    }

    return {
      displayName: profile.displayName,
      currentDay: profile.currentDay,
      gateCleared: true,
      sessionsDeleted: deleted,
    };
  },
});

/**
 * Deletes every account and everything belonging to one.
 *
 * For resetting the demo deployment between pitches: sign-ups accumulate, and
 * a stale account with half-finished onboarding is the thing that derails a
 * walkthrough. After this, sign up again and re-run `seed:demoGolfer`.
 *
 * Guarded three ways, because this is the only function in the app that can
 * destroy a deployment's contents and it is one `--prod` away from doing it to
 * the wrong one:
 *
 *   1. `internalMutation`, so no client can reach it at all.
 *   2. `confirm` must be the exact string below - a mistyped `npx convex run`
 *      does nothing rather than something irreversible.
 *   3. It reports what it deleted, per table, so the result is checkable
 *      against what was expected.
 *
 * `courseCache` is deliberately left alone: it is fetched reference data, not
 * anybody's account, and re-fetching costs an API call.
 */
const RESET_CONFIRMATION = 'DELETE ALL ACCOUNTS AND DATA';

export const resetDeployment = internalMutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    if (args.confirm !== RESET_CONFIRMATION) {
      throw new Error(
        `Refusing to wipe: pass confirm: "${RESET_CONFIRMATION}" to mean it.`,
      );
    }

    // Golf data first, then the auth tables the rows hang off, so a failure
    // part-way through cannot leave a signed-in account with no profile.
    const tables = [
      'launchShots',
      'launchSessions',
      'shotLogs',
      'trainingSessions',
      'skillsTests',
      'roundScores',
      'swingVideos',
      'customCourses',
      'coachDrafts',
      'coachThreads',
      'voiceClips',
      'golferProfiles',
      'authRateLimits',
      'authVerificationCodes',
      'authVerifiers',
      'authRefreshTokens',
      'authSessions',
      'authAccounts',
      'users',
    ] as const;

    const deleted: Record<string, number> = {};

    // Stored files first. Deleting only the rows that point at them would
    // leave the blobs behind - billable, and reachable by nothing, which is
    // the same trap `swingVideos.saveRecording` used to fall into.
    let files = 0;
    for (const video of await ctx.db.query('swingVideos').collect()) {
      for (const id of [video.storageId, ...(video.frameStorageIds ?? [])]) {
        await ctx.storage.delete(id).catch(() => undefined);
        files += 1;
      }
    }
    for (const clip of await ctx.db.query('voiceClips').collect()) {
      await ctx.storage.delete(clip.storageId).catch(() => undefined);
      files += 1;
    }

    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      if (rows.length > 0) deleted[table] = rows.length;
    }

    return {
      deleted,
      storageFiles: files,
      total: Object.values(deleted).reduce((a, b) => a + b, 0),
    };
  },
});

/**
 * Checks every external service the app depends on, against whichever
 * deployment it is run on.
 *
 * The unit tests cover the app's own logic thoroughly, and cover none of this:
 * whether `OPENAI_API_KEY` on *this* deployment is real, whether the account
 * may use these models, whether the endpoints still answer the shapes the code
 * expects. That gap is not theoretical - prod ran for an hour with a corrupted
 * key that broke chat, speech, transcription and swing analysis at once, while
 * every test stayed green.
 *
 * Deliberately cheap: a handful of tokens and one short sentence of speech,
 * a fraction of a cent per run. Nothing is written to the database.
 *
 *     npx convex run devTools:probeIntegrations --prod
 */
export const probeIntegrations = internalAction({
  args: {},
  handler: async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const results: { check: string; ok: boolean; detail: string }[] = [];
    const note = (check: string, ok: boolean, detail: string) =>
      results.push({ check, ok, detail });

    if (!apiKey) {
      return {
        ok: false,
        results: [{ check: 'OPENAI_API_KEY', ok: false, detail: 'not set on this deployment' }],
      };
    }
    note('OPENAI_API_KEY', true, `set, ${apiKey.length} chars`);

    const auth = { Authorization: `Bearer ${apiKey}` };
    const json = { ...auth, 'Content-Type': 'application/json' };

    /** Describes a failure the way the app's own error paths do. */
    const fail = async (r: Response) => `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;

    // ── Chat: the coach conversation and the swing analysis both use gpt-4o,
    //    the spoken caddie uses gpt-4o-mini. A tier may allow one and not the
    //    other, so both are asked.
    for (const model of [
      process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
      process.env.OPENAI_VOICE_CHAT_MODEL ?? 'gpt-4o-mini',
    ]) {
      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: json,
          body: JSON.stringify({
            model,
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
          }),
        });
        // Limits are per model and per account tier, so they are read off the
        // response rather than assumed - they decide how many golfers can
        // chat in the same minute.
        const tpm = r.headers.get('x-ratelimit-limit-tokens');
        const rpm = r.headers.get('x-ratelimit-limit-requests');
        note(
          `chat ${model}`,
          r.ok,
          r.ok ? `answers; limits ${tpm ?? '?'} tokens/min, ${rpm ?? '?'} requests/min` : await fail(r),
        );
      } catch (e) {
        note(`chat ${model}`, false, e instanceof Error ? e.message : 'threw');
      }
    }

    // ── Vision: what reads the swing frames. A 1x1 PNG proves the account may
    //    send images and that the model accepts the message shape; it cannot
    //    prove the analysis is any good.
    try {
      const pixel =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? 'gpt-4o',
          max_tokens: 5,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Reply with the single word: ok' },
                { type: 'image_url', image_url: { url: pixel, detail: 'low' } },
              ],
            },
          ],
        }),
      });
      note('vision (swing frames)', r.ok, r.ok ? 'accepts images' : await fail(r));
    } catch (e) {
      note('vision (swing frames)', false, e instanceof Error ? e.message : 'threw');
    }

    // ── Speech, then transcription of that same speech. A round trip tests
    //    both ends against each other rather than trusting either alone.
    let spoken: Blob | null = null;
    try {
      const r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
          voice: 'nova',
          input: 'Seven iron, one fifty to the pin.',
          response_format: 'mp3',
        }),
      });
      if (r.ok) {
        spoken = await r.blob();
        note('text to speech', true, `${spoken.size} bytes of mp3`);
      } else {
        note('text to speech', false, await fail(r));
      }
    } catch (e) {
      note('text to speech', false, e instanceof Error ? e.message : 'threw');
    }

    if (spoken) {
      try {
        const form = new FormData();
        form.append('file', new Blob([await spoken.arrayBuffer()], { type: 'audio/mpeg' }), 'clip.mp3');
        form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1');
        form.append('language', 'en');

        const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: auth,
          body: form,
        });
        if (r.ok) {
          const text = ((await r.json()) as { text?: string }).text ?? '';
          // Heard back what was said: the two halves of dictation agree.
          const heard = /iron/i.test(text);
          note('transcription', heard, heard ? `heard "${text.trim()}"` : `got "${text.trim()}"`);
        } else {
          note('transcription', false, await fail(r));
        }
      } catch (e) {
        note('transcription', false, e instanceof Error ? e.message : 'threw');
      }
    } else {
      note('transcription', false, 'skipped - no speech to transcribe');
    }

    // ── The realtime mint behind live dictation. Only the token is checked;
    //    the socket itself needs a device.
    try {
      const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: 60 },
          session: {
            type: 'transcription',
            audio: { input: { format: { type: 'audio/pcm', rate: 24000 } } },
          },
        }),
      });
      if (r.ok) {
        const value = ((await r.json()) as { value?: string }).value;
        note('realtime token', Boolean(value), value ? 'minted' : 'no `value` in response');
      } else {
        note('realtime token', false, await fail(r));
      }
    } catch (e) {
      note('realtime token', false, e instanceof Error ? e.message : 'threw');
    }

    return { ok: results.every((r) => r.ok), results };
  },
});

/**
 * What a coach would say to a golfer with no history, asked `question` -
 * with the manual passages it would be given - without touching any account.
 *
 * For checking that the coach actually teaches from the manual, not just that
 * the manual is in the prompt: the tests prove the second, only a real reply
 * proves the first. Costs one chat completion.
 *
 *     npx convex run devTools:previewCoachReply '{"question":"How far back for a 50 yard pitch?"}'
 */
export const previewCoachReply = internalAction({
  args: {
    question: v.string(),
    coachId: v.optional(
      v.union(v.literal('que'), v.literal('mason'), v.literal('sam'), v.literal('dom')),
    ),
    tourPure: v.optional(v.boolean()),
    phase: v.optional(v.string()),
    /** Which chat model to ask - for comparing them on the same questions. */
    model: v.optional(v.string()),
    /** Earlier turns, oldest first, for checking how a follow-up is answered. */
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal('user'), v.literal('assistant')),
          content: v.string(),
        }),
      ),
    ),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set on this deployment');

    const phase = (args.phase ?? 'putting') as PlayerSnapshot['currentPhase'];
    const snapshot: PlayerSnapshot = {
      displayName: 'Alex',
      skillLevel: 'intermediate',
      skillLabel: 'Intermediate',
      handicapIndex: null,
      currentDay: 1,
      currentPhase: phase,
      targetScore: 80,
      scoringAvg: null,
      weeklyGoal: null,
      tourPureActive: args.tourPure ?? false,
      recentRounds: [],
      recentSessions: [],
      latestSkillTest: null,
      tendencies: null,
      latestSwing: null,
      clubCarries: [],
    };
    const history = args.history ?? [];
    const earlier = history
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .reverse()
      .slice(0, 2);
    const passages = manualForQuestion(args.question, phase.replace(/_/g, ' '), earlier);
    const system = buildCoachSystemPrompt(
      getCoachProfile(args.coachId ?? 'mason'),
      snapshot,
      false,
      passages,
    );

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: args.model ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: args.question },
        ],
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const body = (await r.json()) as { choices?: { message?: { content?: string } }[] };

    return {
      passages: [...passages.matchAll(/^\[[^\]]+ - ([^\]]+)\]$/gm)].map((m) => m[1]),
      promptChars: system.length,
      reply: body.choices?.[0]?.message?.content ?? '',
    };
  },
});
