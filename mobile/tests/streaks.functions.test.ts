/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

import { signIn, signInWithProfile, testApp, type TestConvex } from './helpers';

/**
 * A finished session on a given day.
 *
 * Written straight to the table rather than through `startSession`, because a
 * streak is about dates spread across weeks and the mutation always files
 * against the profile's current day.
 */
async function practisedOn(
  t: TestConvex,
  profileId: Id<'golferProfiles'>,
  dates: string[],
) {
  await t.run(async (ctx) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error('No such profile');

    for (const [index, date] of dates.entries()) {
      await ctx.db.insert('trainingSessions', {
        userId: profile.userId,
        profileId,
        date,
        day: index + 1,
        phase: 'putting',
        tasksCompleted: ['a'],
        tasksTotal: 1,
        sessionComplete: true,
        sessionType: 'practice',
      });
    }
  });
}

describe('getStreakData', () => {
  it('counts consecutive days up to today', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await practisedOn(t, profileId, ['2026-03-08', '2026-03-09', '2026-03-10']);

    const streak = await asUser.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });
    expect(streak.currentStreak).toBe(3);
  });

  it('breaks the streak when a day is missed', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    // 8th, then nothing on the 9th.
    await practisedOn(t, profileId, ['2026-03-08', '2026-03-10']);

    const streak = await asUser.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });
    expect(streak.currentStreak).toBe(1);
  });

  it('counts a round played as a day practised', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await practisedOn(t, profileId, ['2026-03-09']);

    // A round stores a full ISO timestamp where a session stores a plain date,
    // and the streak has to see through both. Inserted rather than started
    // through the mutation, which stamps the round with the server's own now.
    await t.run(async (ctx) => {
      const profile = await ctx.db.get(profileId);
      if (!profile) throw new Error('No such profile');

      await ctx.db.insert('roundScores', {
        userId: profile.userId,
        profileId,
        date: '2026-03-10T14:00:00.000Z',
        courseName: 'Pebble Beach',
        totalScore: 84,
        totalPar: 72,
        scoreDifferential: 0,
        holes: [],
      });
    });

    const streak = await asUser.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });
    expect(streak.currentStreak).toBe(2);
  });

  it('rejects a malformed date before it reaches an index range', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.query(api.streaks.getStreakData, { profileId, date: '10-03-2026' }),
    ).rejects.toThrow();
  });

  it('gives a caller who does not own the profile an empty streak', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await practisedOn(t, profileId, ['2026-03-08', '2026-03-09', '2026-03-10']);

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    const streak = await asBob.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });

    // Not an error - the screen renders an empty state rather than failing -
    // but it must not leak another golfer's practice history.
    expect(streak.currentStreak).toBe(0);
    expect(streak.weeklyGoal).toBe(4);
  });

  it('reports the goal the golfer set', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await asUser.mutation(api.streaks.setWeeklyGoal, { profileId, goal: 6 });

    const streak = await asUser.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });
    expect(streak.weeklyGoal).toBe(6);
  });
});

describe('setWeeklyGoal', () => {
  it('clamps a goal to a real week', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await asUser.mutation(api.streaks.setWeeklyGoal, { profileId, goal: 99 });
    let streak = await asUser.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });
    expect(streak.weeklyGoal).toBe(7);

    await asUser.mutation(api.streaks.setWeeklyGoal, { profileId, goal: -3 });
    streak = await asUser.query(api.streaks.getStreakData, { profileId, date: '2026-03-10' });
    expect(streak.weeklyGoal).toBe(1);
  });

  it('rounds a fractional goal to a whole day', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await asUser.mutation(api.streaks.setWeeklyGoal, { profileId, goal: 3.6 });

    const streak = await asUser.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });
    expect(streak.weeklyGoal).toBe(4);
  });

  it('refuses to rewrite a goal on a profile the caller does not own', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await asUser.mutation(api.streaks.setWeeklyGoal, { profileId, goal: 5 });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(
      asBob.mutation(api.streaks.setWeeklyGoal, { profileId, goal: 1 }),
    ).rejects.toThrow();

    const streak = await asUser.query(api.streaks.getStreakData, {
      profileId,
      date: '2026-03-10',
    });
    expect(streak.weeklyGoal).toBe(5);
  });
});
