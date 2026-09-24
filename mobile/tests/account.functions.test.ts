/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, components, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { swingAnalysisTarget } from '../convex/lib/reports';
import { MAX_REPORTS_PER_DAY } from '../convex/reports';

import { signIn, signInWithProfile, testApp, type TestConvex } from './helpers';

const TODAY = '2026-09-18';

/**
 * Deletion runs as a chain of scheduled batches, and the agent component
 * deletes conversations the same way, so every test drives the scheduler to
 * the end on fake timers rather than letting jobs fire at random later.
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function drain(t: TestConvex) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** Drops queued jobs - here, the OpenAI reply `sendMessage` schedules. */
async function cancelPending(t: TestConvex) {
  await t.run(async (ctx) => {
    for (const job of await ctx.db.system.query('_scheduled_functions').collect()) {
      if (job.state.kind === 'pending') await ctx.scheduler.cancel(job._id);
    }
  });
}

/** A conversation with one question and one coach reply, no network involved. */
async function converse(
  t: TestConvex,
  asUser: Awaited<ReturnType<typeof signInWithProfile>>['asUser'],
  profileId: Id<'golferProfiles'>,
) {
  await asUser.mutation(api.coachChat.sendMessage, { profileId, prompt: 'Why do I slice?' });
  await cancelPending(t);

  const thread = await t.run(async (ctx) =>
    ctx.db
      .query('coachThreads')
      .withIndex('by_profile', (q) => q.eq('profileId', profileId))
      .first(),
  );
  await t.action(internal.coachChat.saveFailureNotice, {
    threadId: thread!.threadId,
    text: 'Your grip is weak - rotate both hands to the right.',
  });

  const page = await asUser.query(api.coachChat.listMessages, {
    profileId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  const reply = page.page.find((m) => m.message?.role === 'assistant')!;
  const question = page.page.find((m) => m.message?.role === 'user')!;
  return { threadId: thread!.threadId, replyId: reply._id, questionId: question._id };
}

async function storeFile(t: TestConvex, body = 'bytes') {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([body])));
}

async function countRows(t: TestConvex, userId: Id<'users'>) {
  return await t.run(async (ctx) => {
    const mine = async (table: Parameters<typeof ctx.db.query>[0]) =>
      (await ctx.db.query(table).collect()).filter(
        (r) => (r as { userId?: string }).userId === userId,
      ).length;
    return {
      golferProfiles: await mine('golferProfiles'),
      trainingSessions: await mine('trainingSessions'),
      shotLogs: await mine('shotLogs'),
      skillsTests: await mine('skillsTests'),
      roundScores: await mine('roundScores'),
      customCourses: await mine('customCourses'),
      swingVideos: await mine('swingVideos'),
      launchSessions: await mine('launchSessions'),
      launchShots: await mine('launchShots'),
      coachThreads: await mine('coachThreads'),
      contentReports: await mine('contentReports'),
      authSessions: await mine('authSessions'),
      authAccounts: await mine('authAccounts'),
      voiceClips: (await ctx.db.query('voiceClips').collect()).filter((c) => c.ownerId === userId)
        .length,
      users: (await ctx.db.get(userId)) ? 1 : 0,
    };
  });
}

describe('deleteMyAccount', () => {
  it('refuses a signed-out caller', async () => {
    const t = testApp();
    await expect(t.mutation(api.account.deleteMyAccount, {})).rejects.toThrow(/Not signed in/);
  });

  it('removes the account and every way into it in the same transaction', async () => {
    const t = testApp();
    const { userId, asUser } = await signIn(t, 'gone@example.com');

    await t.run(async (ctx) => {
      await ctx.db.insert('authAccounts', {
        userId,
        provider: 'password',
        providerAccountId: 'gone@example.com',
        secret: 'hash',
      });
      await ctx.db.insert('authRateLimits', {
        identifier: 'gone@example.com',
        lastAttemptTime: 0,
        attemptsLeft: 3,
      });
      for (let i = 0; i < 2; i++) {
        const sessionId = await ctx.db.insert('authSessions', {
          userId,
          expirationTime: Date.now() + 60_000,
        });
        await ctx.db.insert('authRefreshTokens', { sessionId, expirationTime: Date.now() + 60_000 });
      }
    });

    await asUser.mutation(api.account.deleteMyAccount, {});

    // Before any scheduled batch has run: the golfer is already signed out
    // everywhere and cannot get back in.
    const left = await t.run(async (ctx) => ({
      users: (await ctx.db.query('users').collect()).length,
      accounts: (await ctx.db.query('authAccounts').collect()).length,
      sessions: (await ctx.db.query('authSessions').collect()).length,
      tokens: (await ctx.db.query('authRefreshTokens').collect()).length,
      limits: (await ctx.db.query('authRateLimits').collect()).length,
    }));
    expect(left).toEqual({ users: 0, accounts: 0, sessions: 0, tokens: 0, limits: 0 });

    await drain(t);
  });

  it('purges a fully used account - files and conversations included', async () => {
    const t = testApp();
    const { userId, asUser } = await signIn(t, 'demo@dominusgolf.com');
    await t.mutation(internal.seed.demoGolfer, { email: 'demo@dominusgolf.com', today: TODAY });
    const profile = (await asUser.query(api.profiles.getMyProfile, {}))!;

    await converse(t, asUser, profile._id);

    const videoId = await t.run(async (ctx) =>
      ctx.db.insert('swingVideos', {
        userId,
        profileId: profile._id,
        storageId: await ctx.storage.store(new Blob(['clip'])),
        frameStorageIds: [
          await ctx.storage.store(new Blob(['f1'])),
          await ctx.storage.store(new Blob(['f2'])),
        ],
        label: 'Driver',
        durationSeconds: 4,
        recordedAt: '2026-09-10T09:15:00.000Z',
        aiFeedback: {
          summary: 'Early extension.',
          strengths: [],
          improvements: ['Keep your hips back'],
          drills: [],
          analyzedAt: '2026-09-10T09:16:00.000Z',
        },
      }),
    );
    await asUser.mutation(api.reports.reportSwingAnalysis, { videoId, reason: 'inaccurate' });
    await t.mutation(internal.voice.saveClip, {
      key: 'nova:mine',
      voice: 'nova',
      storageId: await storeFile(t, 'my speech'),
      ownerId: userId,
    });

    const before = await countRows(t, userId);
    expect(before.roundScores).toBeGreaterThan(0);
    expect(before.coachThreads).toBe(1);
    expect(before.voiceClips).toBe(1);

    const threadsOf = async () =>
      (
        await t.run(async (ctx) =>
          ctx.runQuery(components.agent.threads.listThreadsByUserId, { userId }),
        )
      ).page;
    expect(await threadsOf()).toHaveLength(1);

    await asUser.mutation(api.account.deleteMyAccount, {});
    await drain(t);

    const after = await countRows(t, userId);
    for (const [table, count] of Object.entries(after)) {
      expect(count, table).toBe(0);
    }

    // Nothing billable is left behind: the clip, both frames and the speech.
    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toHaveLength(0);

    // The conversation itself, which lives in the agent component.
    expect(await threadsOf()).toHaveLength(0);
  });

  it('leaves every other golfer exactly as they were', async () => {
    const t = testApp();
    const leaving = await signInWithProfile(t, { email: 'leaving@example.com' });
    const staying = await signInWithProfile(t, { email: 'staying@example.com' });

    await converse(t, staying.asUser, staying.profileId);
    await t.mutation(internal.voice.saveClip, {
      key: 'nova:theirs',
      voice: 'nova',
      storageId: await storeFile(t),
      ownerId: staying.userId,
    });
    // A clip cached before clips had owners belongs to nobody, so it stays.
    await t.run(async (ctx) =>
      ctx.db.insert('voiceClips', {
        key: 'nova:legacy',
        voice: 'nova',
        storageId: await ctx.storage.store(new Blob(['old'])),
        createdAt: 0,
      }),
    );

    const before = await countRows(t, staying.userId);

    await leaving.asUser.mutation(api.account.deleteMyAccount, {});
    await drain(t);

    expect(await countRows(t, staying.userId)).toEqual(before);
    expect(await t.run(async (ctx) => ctx.db.query('voiceClips').collect())).toHaveLength(2);

    const page = await staying.asUser.query(api.coachChat.listMessages, {
      profileId: staying.profileId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page.length).toBeGreaterThan(0);
  });

  it('stops a second device, still holding a valid token, from starting over', async () => {
    const t = testApp();
    const { asUser } = await signInWithProfile(t);

    await asUser.mutation(api.account.deleteMyAccount, {});
    await drain(t);

    // The access token outlives the account by up to an hour. Onboarding
    // again with it would recreate a profile for a user who no longer exists.
    await expect(
      asUser.mutation(api.profiles.createProfile, {
        displayName: 'Ghost',
        skillLevel: 'beginner',
      }),
    ).rejects.toThrow(/Not signed in/);
    expect(await t.run(async (ctx) => ctx.db.query('golferProfiles').collect())).toHaveLength(0);
  });
});

describe('reportCoachMessage', () => {
  it('records the coach reply, copied in full', async () => {
    const t = testApp();
    const { asUser, profileId, userId } = await signInWithProfile(t);
    const { replyId } = await converse(t, asUser, profileId);

    await asUser.mutation(api.reports.reportCoachMessage, {
      profileId,
      messageId: replyId,
      reason: 'harmful',
    });

    const reports = await t.run(async (ctx) => ctx.db.query('contentReports').collect());
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      userId,
      kind: 'coach_message',
      targetId: replyId,
      reason: 'harmful',
      content: 'Your grip is weak - rotate both hands to the right.',
    });
  });

  it("will not let anyone report - and so read - another golfer's conversation", async () => {
    const t = testApp();
    const owner = await signInWithProfile(t, { email: 'owner@example.com' });
    const snoop = await signInWithProfile(t, { email: 'snoop@example.com' });
    const { replyId } = await converse(t, owner.asUser, owner.profileId);

    // With their own profile, and with the owner's.
    for (const profileId of [snoop.profileId, owner.profileId]) {
      await expect(
        snoop.asUser.mutation(api.reports.reportCoachMessage, {
          profileId,
          messageId: replyId,
          reason: 'inaccurate',
        }),
      ).rejects.toThrow(/not found/);
    }
    expect(await t.run(async (ctx) => ctx.db.query('contentReports').collect())).toHaveLength(0);
  });

  it("does not take the golfer's own message, or an id that is not a message", async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const { questionId } = await converse(t, asUser, profileId);

    for (const messageId of [questionId, 'not-an-id']) {
      await expect(
        asUser.mutation(api.reports.reportCoachMessage, {
          profileId,
          messageId,
          reason: 'inaccurate',
        }),
      ).rejects.toThrow(/not found/);
    }
  });
});

describe('reportSwingAnalysis', () => {
  async function video(t: TestConvex, userId: Id<'users'>, profileId: Id<'golferProfiles'>, analysed = true) {
    return await t.run(async (ctx) =>
      ctx.db.insert('swingVideos', {
        userId,
        profileId,
        storageId: await ctx.storage.store(new Blob(['clip'])),
        label: '7-iron',
        durationSeconds: 3,
        recordedAt: '2026-09-10T09:15:00.000Z',
        ...(analysed
          ? {
              aiFeedback: {
                summary: 'Steep at the top.',
                strengths: ['Balanced finish'],
                improvements: ['Shallow the club'],
                drills: ['Pump drill'],
                analyzedAt: '2026-09-10T09:16:00.000Z',
                observations: [{ position: 'Top', detail: 'Across the line' }],
              },
            }
          : {}),
      }),
    );
  }

  it('records the whole analysis the golfer was shown', async () => {
    const t = testApp();
    const { asUser, userId, profileId } = await signInWithProfile(t);
    const videoId = await video(t, userId, profileId);

    await asUser.mutation(api.reports.reportSwingAnalysis, { videoId, reason: 'inaccurate' });

    const [report] = await t.run(async (ctx) => ctx.db.query('contentReports').collect());
    expect(report.kind).toBe('swing_analysis');
    for (const part of ['Steep at the top.', 'Top: Across the line', 'Balanced finish', 'Shallow the club', 'Pump drill']) {
      expect(report.content).toContain(part);
    }
  });

  it("refuses another golfer's swing, and a swing with no analysis", async () => {
    const t = testApp();
    const owner = await signInWithProfile(t, { email: 'owner@example.com' });
    const other = await signInWithProfile(t, { email: 'other@example.com' });

    const theirs = await video(t, owner.userId, owner.profileId);
    const unanalysed = await video(t, other.userId, other.profileId, false);

    for (const videoId of [theirs, unanalysed]) {
      await expect(
        other.asUser.mutation(api.reports.reportSwingAnalysis, { videoId, reason: 'inaccurate' }),
      ).rejects.toThrow(/not found/);
    }
  });
});

describe('reportCaddieAnswer', () => {
  it('records the question and the answer the golfer was shown', async () => {
    const t = testApp();
    const { asUser, userId } = await signIn(t);

    await asUser.mutation(api.reports.reportCaddieAnswer, {
      question: 'Driver or three wood?',
      answer: 'Hit driver over the lake.',
      reason: 'harmful',
    });

    const [report] = await t.run(async (ctx) => ctx.db.query('contentReports').collect());
    expect(report).toMatchObject({
      userId,
      kind: 'caddie_answer',
      content: 'Q: Driver or three wood?\nA: Hit driver over the lake.',
    });
  });

  it('refuses a signed-out caller and an empty answer', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    await expect(
      t.mutation(api.reports.reportCaddieAnswer, { question: 'q', answer: 'a', reason: 'harmful' }),
    ).rejects.toThrow(/Not signed in/);
    await expect(
      asUser.mutation(api.reports.reportCaddieAnswer, { question: 'q', answer: '  ', reason: 'harmful' }),
    ).rejects.toThrow(/Nothing to report/);
  });
});

describe('one report per response', () => {
  const countReports = (t: TestConvex) =>
    t.run(async (ctx) => (await ctx.db.query('contentReports').collect()).length);

  it('stores a coach reply once, however often it is reported', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const { replyId } = await converse(t, asUser, profileId);

    const first = await asUser.mutation(api.reports.reportCoachMessage, {
      profileId,
      messageId: replyId,
      reason: 'harmful',
    });
    // A different reason is still the same response.
    const again = await asUser.mutation(api.reports.reportCoachMessage, {
      profileId,
      messageId: replyId,
      reason: 'inaccurate',
    });

    expect(first.alreadyReported).toBe(false);
    expect(again.alreadyReported).toBe(true);
    expect(await countReports(t)).toBe(1);
  });

  it('treats a re-analysed swing as new advice, and the same analysis as a repeat', async () => {
    const t = testApp();
    const { asUser, userId, profileId } = await signInWithProfile(t);
    const feedback = (analyzedAt: string) => ({
      summary: 'Steep.',
      strengths: [],
      improvements: [],
      drills: [],
      analyzedAt,
    });
    const videoId = await t.run(async (ctx) =>
      ctx.db.insert('swingVideos', {
        userId,
        profileId,
        storageId: await ctx.storage.store(new Blob(['clip'])),
        label: 'Driver',
        durationSeconds: 3,
        recordedAt: '2026-09-10T09:15:00.000Z',
        aiFeedback: feedback('2026-09-10T09:16:00.000Z'),
      }),
    );

    await asUser.mutation(api.reports.reportSwingAnalysis, { videoId, reason: 'inaccurate' });
    const repeat = await asUser.mutation(api.reports.reportSwingAnalysis, {
      videoId,
      reason: 'inaccurate',
    });
    expect(repeat.alreadyReported).toBe(true);

    await t.run(async (ctx) =>
      ctx.db.patch(videoId, { aiFeedback: feedback('2026-09-11T08:00:00.000Z') }),
    );
    const fresh = await asUser.mutation(api.reports.reportSwingAnalysis, {
      videoId,
      reason: 'inaccurate',
    });
    expect(fresh.alreadyReported).toBe(false);
    expect(await countReports(t)).toBe(2);
  });

  it('recognises the same caddie answer, and keeps a different one', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);
    const report = (answer: string) =>
      asUser.mutation(api.reports.reportCaddieAnswer, {
        question: 'Driver or three wood?',
        answer,
        reason: 'harmful',
      });

    expect((await report('Driver.')).alreadyReported).toBe(false);
    expect((await report('Driver.')).alreadyReported).toBe(true);
    expect((await report('Three wood.')).alreadyReported).toBe(false);
    expect(await countReports(t)).toBe(2);
  });

  it("does not let one golfer's report stand in for another's", async () => {
    const t = testApp();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');
    const args = { question: 'q', answer: 'Same words.', reason: 'harmful' as const };

    await a.asUser.mutation(api.reports.reportCaddieAnswer, args);
    const theirs = await b.asUser.mutation(api.reports.reportCaddieAnswer, args);

    expect(theirs.alreadyReported).toBe(false);
    expect(await countReports(t)).toBe(2);
  });

  it('caps how many reports one golfer can file in a day', async () => {
    const t = testApp();
    const { asUser, userId } = await signIn(t);
    const now = Date.now();

    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_REPORTS_PER_DAY; i++) {
        await ctx.db.insert('contentReports', {
          userId,
          kind: 'caddie_answer',
          targetId: `caddie:${i}`,
          content: `answer ${i}`,
          reason: 'harmful',
          createdAt: now - 1000,
        });
      }
    });

    await expect(
      asUser.mutation(api.reports.reportCaddieAnswer, {
        question: 'q',
        answer: 'one too many',
        reason: 'harmful',
      }),
    ).rejects.toThrow(/try again tomorrow/);
    expect(await countReports(t)).toBe(MAX_REPORTS_PER_DAY);

    // A day later the allowance is back.
    vi.setSystemTime(now + 24 * 60 * 60 * 1000 + 1);
    const later = await asUser.mutation(api.reports.reportCaddieAnswer, {
      question: 'q',
      answer: 'the next day',
      reason: 'harmful',
    });
    expect(later.alreadyReported).toBe(false);
  });
});

describe('myReportedTargets', () => {
  it("lists what this golfer reported, keyed the way the screens look it up, and nobody else's", async () => {
    const t = testApp();
    const { asUser, userId, profileId } = await signInWithProfile(t, { email: 'me@example.com' });
    const other = await signIn(t, 'other@example.com');
    const { replyId } = await converse(t, asUser, profileId);

    const analyzedAt = '2026-09-10T09:16:00.000Z';
    const videoId = await t.run(async (ctx) =>
      ctx.db.insert('swingVideos', {
        userId,
        profileId,
        storageId: await ctx.storage.store(new Blob(['clip'])),
        label: 'Driver',
        durationSeconds: 3,
        recordedAt: '2026-09-10T09:15:00.000Z',
        aiFeedback: { summary: 's', strengths: [], improvements: [], drills: [], analyzedAt },
      }),
    );

    await asUser.mutation(api.reports.reportCoachMessage, {
      profileId,
      messageId: replyId,
      reason: 'harmful',
    });
    await asUser.mutation(api.reports.reportSwingAnalysis, { videoId, reason: 'inaccurate' });
    await other.asUser.mutation(api.reports.reportCaddieAnswer, {
      question: 'q',
      answer: 'theirs',
      reason: 'harmful',
    });

    const mine = await asUser.query(api.reports.myReportedTargets, {});
    expect(new Set(mine)).toEqual(new Set([replyId, swingAnalysisTarget(videoId, analyzedAt)]));

    expect(await t.query(api.reports.myReportedTargets, {})).toEqual([]);
  });
});
