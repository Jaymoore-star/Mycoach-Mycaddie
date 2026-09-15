/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api, internal } from '../convex/_generated/api';
import { COURSE_LIBRARY } from '../convex/lib/courses';

import { localDate, signIn, signInWithProfile, testApp } from './helpers';

const COURSE = COURSE_LIBRARY[0];
const TODAY = localDate();
const PAGE = { numItems: 20, cursor: null };

/**
 * Asks a question and cancels the reply the mutation just queued.
 *
 * `sendMessage` schedules `generateReply`, which calls OpenAI. Left queued it
 * runs in the background partway through some later test, fails against a
 * thread that test has already torn down, and prints a stack trace that
 * belongs to neither. Worse, on a machine with OPENAI_API_KEY in the
 * environment it would not fail - it would spend real money running the suite.
 *
 * The scheduling itself is covered by its own test below, which reads the job
 * before cancelling it.
 */
async function ask(
  t: ReturnType<typeof testApp>,
  asUser: Awaited<ReturnType<typeof signInWithProfile>>['asUser'],
  profileId: Awaited<ReturnType<typeof signInWithProfile>>['profileId'],
  prompt: string,
) {
  await asUser.mutation(api.coachChat.sendMessage, { profileId, prompt });
  await cancelPending(t);
}

/** Drops every queued job, so nothing reaches the network after a test ends. */
async function cancelPending(t: ReturnType<typeof testApp>) {
  await t.run(async (ctx) => {
    for (const job of await ctx.db.system.query('_scheduled_functions').collect()) {
      await ctx.scheduler.cancel(job._id);
    }
  });
}

describe('listMessages', () => {
  it('renders an empty page before the first question', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    // An empty page rather than a throw: the screen shows its empty state on
    // first open instead of an error.
    const page = await asUser.query(api.coachChat.listMessages, {
      profileId,
      paginationOpts: PAGE,
    });
    expect(page.page).toEqual([]);
    expect(page.isDone).toBe(true);
  });

  it('is closed to a caller who does not own the profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await ask(t, asUser, profileId, 'Why do I slice?');

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    const page = await asBob.query(api.coachChat.listMessages, {
      profileId,
      paginationOpts: PAGE,
    });
    expect(page.page).toEqual([]);
  });
});

describe('sendMessage', () => {
  it('refuses an empty question', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.mutation(api.coachChat.sendMessage, { profileId, prompt: '   ' }),
    ).rejects.toThrow();
  });

  it('refuses a question longer than the model is briefed to take', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.mutation(api.coachChat.sendMessage, { profileId, prompt: 'x'.repeat(2001) }),
    ).rejects.toThrow();
  });

  it('accepts a question right at the limit', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.mutation(api.coachChat.sendMessage, { profileId, prompt: 'x'.repeat(2000) }),
    ).resolves.toBeNull();
    await cancelPending(t);
  });

  it('refuses to post into a profile the caller does not own', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.coachChat.sendMessage, { profileId, prompt: 'let me in' }),
    ).rejects.toThrow();
  });

  it('is closed to a caller who is not signed in', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t);

    await expect(
      t.mutation(api.coachChat.sendMessage, { profileId, prompt: 'hello' }),
    ).rejects.toThrow();
  });

  it('opens one thread and keeps using it', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await ask(t, asUser, profileId, 'First question');
    await ask(t, asUser, profileId, 'Second question');

    const threads = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());
    expect(threads).toHaveLength(1);
  });

  it('gives each coach their own conversation', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { coachId: 'que' });
    await ask(t, asUser, profileId, 'Asked of Que');

    await asUser.mutation(api.profiles.updateCoach, { profileId, coachId: 'dom' });
    await ask(t, asUser, profileId, 'Asked of Dom');

    // Switching coach should not drop the golfer into the middle of a
    // conversation they had with someone else.
    const threads = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());
    expect(threads).toHaveLength(2);
    expect(threads.map((row) => row.coachId).sort()).toEqual(['dom', 'que']);
  });

  it('schedules the reply rather than generating it inline', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    // Sent directly rather than through `ask`, which cancels the job - this is
    // the one test that has to see it still pending.
    await asUser.mutation(api.coachChat.sendMessage, { profileId, prompt: 'Why do I slice?' });

    // The message is stored and the reply queued, so it survives the app being
    // backgrounded mid-generation.
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    );
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].state.kind).toBe('pending');
    expect(scheduled[0].name).toContain('generateReply');

    await cancelPending(t);
  });
});

describe('clearConversation', () => {
  it('leaves nothing behind, draft included', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await ask(t, asUser, profileId, 'Why do I slice?');

    const [thread] = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());
    await t.mutation(internal.coachChat.startDraft, { threadId: thread.threadId, profileId });

    await asUser.mutation(api.coachChat.clearConversation, { profileId });

    expect(await t.run(async (ctx) => ctx.db.query('coachThreads').collect())).toEqual([]);
    // A reply may be mid-flight; its draft would otherwise reappear under an
    // empty conversation.
    expect(await t.run(async (ctx) => ctx.db.query('coachDrafts').collect())).toEqual([]);
  });

  it('does nothing when there is no conversation yet', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.mutation(api.coachChat.clearConversation, { profileId }),
    ).resolves.toBeNull();
  });

  it('refuses to wipe a conversation the caller does not own', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await ask(t, asUser, profileId, 'Why do I slice?');

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(
      asBob.mutation(api.coachChat.clearConversation, { profileId }),
    ).rejects.toThrow();

    expect(await t.run(async (ctx) => ctx.db.query('coachThreads').collect())).toHaveLength(1);
  });
});

describe('streamingReply', () => {
  it('is null when nothing is being written', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.query(api.coachChat.streamingReply, { profileId }),
    ).resolves.toBeNull();
  });

  it('reports an empty draft, which is the thinking indicator', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await ask(t, asUser, profileId, 'Why do I slice?');
    const [thread] = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());

    await t.mutation(internal.coachChat.startDraft, { threadId: thread.threadId, profileId });

    // A row with empty text means the request is away but no words have come
    // back yet - distinct from null, which means nothing is being written.
    await expect(asUser.query(api.coachChat.streamingReply, { profileId })).resolves.toEqual({
      text: '',
    });
  });

  it('carries the half-written reply as it grows', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await ask(t, asUser, profileId, 'Why do I slice?');
    const [thread] = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());

    await t.mutation(internal.coachChat.startDraft, { threadId: thread.threadId, profileId });
    await t.mutation(internal.coachChat.updateDraft, {
      threadId: thread.threadId,
      text: 'Your grip is',
    });

    await expect(asUser.query(api.coachChat.streamingReply, { profileId })).resolves.toEqual({
      text: 'Your grip is',
    });

    await t.mutation(internal.coachChat.clearDraft, { threadId: thread.threadId });
    await expect(asUser.query(api.coachChat.streamingReply, { profileId })).resolves.toBeNull();
  });

  it('does not leak a reply being written for someone else', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await ask(t, asUser, profileId, 'Why do I slice?');
    const [thread] = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());
    await t.mutation(internal.coachChat.startDraft, { threadId: thread.threadId, profileId });
    await t.mutation(internal.coachChat.updateDraft, {
      threadId: thread.threadId,
      text: 'Private coaching',
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.query(api.coachChat.streamingReply, { profileId })).resolves.toBeNull();
  });
});

describe('updateDraft', () => {
  it('writes nothing when the conversation was wiped mid-stream', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await ask(t, asUser, profileId, 'Why do I slice?');
    const [thread] = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());

    // No draft row exists - the generation is writing into a cleared thread.
    await expect(
      t.mutation(internal.coachChat.updateDraft, {
        threadId: thread.threadId,
        text: 'orphaned',
      }),
    ).resolves.toBeNull();

    expect(await t.run(async (ctx) => ctx.db.query('coachDrafts').collect())).toEqual([]);
  });

  it('replaces a draft left behind by an earlier failed generation', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await ask(t, asUser, profileId, 'Why do I slice?');
    const [thread] = await t.run(async (ctx) => ctx.db.query('coachThreads').collect());

    await t.mutation(internal.coachChat.startDraft, { threadId: thread.threadId, profileId });
    await t.mutation(internal.coachChat.updateDraft, {
      threadId: thread.threadId,
      text: 'half an answer that never finished',
    });
    await t.mutation(internal.coachChat.startDraft, { threadId: thread.threadId, profileId });

    // The stale text would otherwise show up under the new question.
    const drafts = await t.run(async (ctx) => ctx.db.query('coachDrafts').collect());
    expect(drafts).toHaveLength(1);
    expect(drafts[0].text).toBe('');
  });
});

describe('getChatContext', () => {
  it('returns nothing for a profile that does not exist', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t);
    await t.run(async (ctx) => ctx.db.delete(profileId));

    await expect(
      t.query(internal.coachChat.getChatContext, { profileId }),
    ).resolves.toBeNull();
  });

  it('briefs the coach on who they are talking to', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, {
      displayName: 'Jeet',
      skillLevel: 'beginner',
    });

    const snapshot = await t.query(internal.coachChat.getChatContext, { profileId });
    expect(snapshot?.displayName).toBe('Jeet');
    expect(snapshot?.skillLevel).toBe('beginner');
    expect(snapshot?.recentRounds).toEqual([]);
  });

  it('keeps an abandoned round out of the briefing', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    // Started on the first tee and never scored: no holes, total score 0.
    await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
      teeBox: 'regular',
      totalPar: 72,
    });

    // Handed to the coach it reads as a 72-under round, and the reply that
    // follows congratulates a golfer who never hit a shot.
    const snapshot = await t.query(internal.coachChat.getChatContext, { profileId });
    expect(snapshot?.recentRounds).toEqual([]);
  });

  it('includes a round that was actually played', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
      teeBox: 'regular',
      totalPar: 72,
    });
    for (let hole = 1; hole <= 18; hole++) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId,
        hole,
        par: 4,
        score: 5,
        putts: 2,
      });
    }

    const snapshot = await t.query(internal.coachChat.getChatContext, { profileId });
    expect(snapshot?.recentRounds).toHaveLength(1);
    expect(snapshot?.recentRounds[0].totalScore).toBe(90);
    expect(snapshot?.recentRounds[0].putts).toBe(36);
    // The coach needs the day, not the round's ISO timestamp.
    expect(snapshot?.recentRounds[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reads the golfer tendencies out of their logged shots', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    for (let i = 0; i < 5; i++) {
      await asUser.mutation(api.shots.logShot, {
        profileId,
        date: TODAY,
        sessionType: 'practice',
        club: '7-Iron',
        targetDistanceYards: 150,
        actualDistanceYards: 140,
        shotShape: 'fade',
        ballFlight: 'mid',
        missDirection: 'right',
      });
    }

    const snapshot = await t.query(internal.coachChat.getChatContext, { profileId });
    expect(snapshot?.tendencies).not.toBeNull();
  });

  it('has no tendencies to report before any shot is logged', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t);

    const snapshot = await t.query(internal.coachChat.getChatContext, { profileId });
    expect(snapshot?.tendencies).toBeNull();
  });
});
