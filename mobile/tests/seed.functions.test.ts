/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api, internal } from '../convex/_generated/api';

import { signIn, testApp, useAuthSigningKey, type TestConvex } from './helpers';

/**
 * The seed exists to make the demo look like a real golfer's account, so what
 * is worth asserting is not that rows landed but that the screens they feed
 * have something to show: a handicap index, a live streak, clubs in the bag,
 * a scoring trend. A seed that writes 600 rows and still renders zeros is the
 * failure this guards against.
 */
useAuthSigningKey();

const TODAY = '2026-09-18';
const EMAIL = 'demo@dominusgolf.com';

async function seeded(t: TestConvex) {
  const { userId, asUser } = await signIn(t, EMAIL);
  const summary = await t.mutation(internal.seed.demoGolfer, { email: EMAIL, today: TODAY });
  return { userId, asUser, summary };
}

describe('demoGolfer', () => {
  it('refuses when no account exists for that address', async () => {
    const t = testApp();
    await expect(
      t.mutation(internal.seed.demoGolfer, { email: 'nobody@example.com', today: TODAY }),
    ).rejects.toThrow(/sign up in the app/i);
  });

  it('rejects a date that is not a local YYYY-MM-DD', async () => {
    const t = testApp();
    await signIn(t, EMAIL);
    await expect(
      t.mutation(internal.seed.demoGolfer, { email: EMAIL, today: '18/09/2026' }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  it('fills an account that has never been onboarded', async () => {
    const t = testApp();
    const { summary } = await seeded(t);

    expect(summary.rounds).toBe(12);
    expect(summary.practiceSessions).toBe(38);
    expect(summary.rangeShots).toBeGreaterThan(0);
    expect(summary.launchShots).toBeGreaterThan(0);
  });

  it('produces a handicap index a mid-handicapper would recognise', async () => {
    const t = testApp();
    const { asUser, summary } = await seeded(t);

    // Wide, because the scores are generated - but a demo showing +2 or 45
    // would undercut the whole pitch.
    expect(summary.handicapIndex).toBeGreaterThan(8);
    expect(summary.handicapIndex).toBeLessThan(20);

    const handicap = await asUser.query(api.rounds.getHandicapData, {
      profileId: summary.profileId,
    });
    expect(handicap.handicapIndex).not.toBeNull();
    expect(handicap.roundsUsed).toBeGreaterThanOrEqual(3);
    expect(handicap.trend.length).toBeGreaterThan(0);

    // The seed reports the number the screen will show, not a second estimate
    // of it. These disagreed while the seed averaged its own "best 8".
    expect(summary.handicapIndex).toBe(handicap.handicapIndex);

    // A scoring average has to be consistent with being that handicap.
    expect(summary.scoringAvg).toBeGreaterThan(82);
    expect(summary.scoringAvg).toBeLessThan(100);
  });

  it('leaves the streak alive as of the seeded today', async () => {
    const t = testApp();
    const { asUser, summary } = await seeded(t);

    const streak = await asUser.query(api.streaks.getStreakData, {
      profileId: summary.profileId,
      date: TODAY,
    });
    expect(streak.currentStreak).toBe(38);
    expect(streak.totalActiveDays).toBeGreaterThanOrEqual(38);
  });

  it('puts clubs in the bag with carry numbers behind them', async () => {
    const t = testApp();
    const { asUser, summary } = await seeded(t);

    const bag = await asUser.query(api.clubs.getClubProfile, { profileId: summary.profileId });
    expect(bag.length).toBeGreaterThan(5);
    expect(bag.every((c) => c.avgCarry > 0)).toBe(true);
  });

  it('is deterministic - the same inputs give the same golfer', async () => {
    const a = testApp();
    const b = testApp();
    const first = await seeded(a);
    const second = await seeded(b);

    expect(second.summary.handicapIndex).toBe(first.summary.handicapIndex);
    expect(second.summary.rangeShots).toBe(first.summary.rangeShots);
  });

  it('replaces its own output rather than stacking a second history on top', async () => {
    const t = testApp();
    const { summary } = await seeded(t);

    await t.mutation(internal.seed.demoGolfer, { email: EMAIL, today: TODAY });

    const counts = await t.run(async (ctx) => ({
      rounds: (
        await ctx.db
          .query('roundScores')
          .withIndex('by_profile', (q) => q.eq('profileId', summary.profileId))
          .collect()
      ).length,
      sessions: (
        await ctx.db
          .query('trainingSessions')
          .withIndex('by_profile', (q) => q.eq('profileId', summary.profileId))
          .collect()
      ).length,
      profiles: (await ctx.db.query('golferProfiles').collect()).length,
    }));

    expect(counts.rounds).toBe(12);
    expect(counts.sessions).toBe(38);
    expect(counts.profiles).toBe(1);
  });

  it('finds the account whatever case the email is given in', async () => {
    const t = testApp();
    await signIn(t, EMAIL);

    const summary = await t.mutation(internal.seed.demoGolfer, {
      email: 'Demo@DominusGolf.com',
      today: TODAY,
    });
    expect(summary.rounds).toBe(12);
  });
});

describe('demoAccount', () => {
  it('creates the account and fills it in one call', async () => {
    const t = testApp();

    const result = await t.action(internal.seed.demoAccount, {
      email: EMAIL,
      password: 'demo-password-123',
      today: TODAY,
    });

    expect(result.created).toBe(true);

    // The account it made must be one the sign-in screen can really use, so
    // the password has to have gone through the provider's own hashing.
    await expect(
      t.action(api.auth.signIn, {
        provider: 'password',
        params: { email: EMAIL, password: 'demo-password-123', flow: 'signIn' },
      }),
    ).resolves.toBeTruthy();

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(EMAIL);
  });

  it('refuses a password the sign-in screen would reject anyway', async () => {
    const t = testApp();
    await expect(
      t.action(internal.seed.demoAccount, { email: EMAIL, password: 'short', today: TODAY }),
    ).rejects.toThrow(/at least 8 characters/i);
  });

  it('re-seeds an account that already exists rather than failing', async () => {
    const t = testApp();
    await t.action(internal.seed.demoAccount, {
      email: EMAIL,
      password: 'demo-password-123',
      today: TODAY,
    });

    const again = await t.action(internal.seed.demoAccount, {
      email: EMAIL,
      password: 'demo-password-123',
      today: TODAY,
    });

    expect(again.created).toBe(false);
    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toHaveLength(1);
    expect(await t.run(async (ctx) => ctx.db.query('roundScores').collect())).toHaveLength(12);
  });
});

describe('demoGolfer round data', () => {
  it('scores every round against the real card for that course', async () => {
    const t = testApp();
    const { summary } = await seeded(t);

    const rounds = await t.run(async (ctx) =>
      ctx.db
        .query('roundScores')
        .withIndex('by_profile', (q) => q.eq('profileId', summary.profileId))
        .collect(),
    );

    for (const round of rounds) {
      expect(round.holes, round.courseName).toHaveLength(18);
      expect(round.totalPar).toBe(round.holes.reduce((s, h) => s + h.par, 0));
      expect(round.totalScore).toBe(round.holes.reduce((s, h) => s + h.score, 0));
      // A generated round still has to look like golf.
      expect(round.totalScore - round.totalPar).toBeGreaterThan(0);
      expect(round.totalScore - round.totalPar).toBeLessThan(40);
    }
  });
});
