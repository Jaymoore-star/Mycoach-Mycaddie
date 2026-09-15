/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';

import { localDate, signIn, signInWithProfile, testApp } from './helpers';

const TODAY = localDate();

/** Every challenge in a test, answered with the same number of passes. */
async function attempt(
  asUser: Awaited<ReturnType<typeof signInWithProfile>>['asUser'],
  profileId: Awaited<ReturnType<typeof signInWithProfile>>['profileId'],
  passes: number,
) {
  const current = await asUser.query(api.skillTests.getCurrentTest, { profileId });
  if (!current) throw new Error('No current test');

  return await asUser.mutation(api.skillTests.submitSkillTest, {
    profileId,
    phase: 'putting',
    week: current.week,
    date: TODAY,
    results: current.test.challenges.map((c) => ({ challengeId: c.id, passes })),
  });
}

describe('getCurrentTest', () => {
  it('resolves each requirement for the golfer own skill level', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { skillLevel: 'beginner' });

    const current = await asUser.query(api.skillTests.getCurrentTest, { profileId });
    expect(current?.skillLevel).toBe('beginner');
    expect(current?.requirements.length).toBeGreaterThan(0);

    // The UI is handed the bar rather than owning the threshold table.
    for (const requirement of current!.requirements) {
      expect(requirement.required).toBeLessThanOrEqual(requirement.totalAttempts);
    }
  });

  it('asks a tour pro for more than a beginner', async () => {
    const t = testApp();
    const { asUser: asBeginner, profileId: beginnerId } = await signInWithProfile(t, {
      email: 'a@example.com',
      skillLevel: 'beginner',
    });
    const { asUser: asPro, profileId: proId } = await signInWithProfile(t, {
      email: 'b@example.com',
      skillLevel: 'tour_pro',
    });

    const beginner = await asBeginner.query(api.skillTests.getCurrentTest, {
      profileId: beginnerId,
    });
    const pro = await asPro.query(api.skillTests.getCurrentTest, { profileId: proId });

    const beginnerBar = beginner!.requirements.reduce((n, r) => n + r.required, 0);
    const proBar = pro!.requirements.reduce((n, r) => n + r.required, 0);
    expect(proBar).toBeGreaterThan(beginnerBar);
  });

  it('starts with no attempts recorded', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const current = await asUser.query(api.skillTests.getCurrentTest, { profileId });
    expect(current?.attemptCount).toBe(0);
    expect(current?.lastAttempt).toBeNull();
    expect(current?.bestScore).toBeNull();
    expect(current?.passed).toBe(false);
  });

  it('carries the previous attempt back once one is made', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await attempt(asUser, profileId, 3);

    const current = await asUser.query(api.skillTests.getCurrentTest, { profileId });
    expect(current?.attemptCount).toBe(1);
    expect(current?.lastAttempt).not.toBeNull();
    expect(current?.bestScore).toBeGreaterThan(0);
  });

  it('returns nothing for a profile the caller does not own', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.query(api.skillTests.getCurrentTest, { profileId }),
    ).resolves.toBeNull();
  });
});

describe('submitSkillTest', () => {
  it('grades on the server rather than trusting a score from the client', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const perfect = await attempt(asUser, profileId, 99);
    // The score gates phase progression, so a client claiming more passes than
    // there were attempts must not score above 100.
    expect(perfect.score).toBe(100);
  });

  it('clamps a negative pass count to zero rather than a negative score', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const none = await attempt(asUser, profileId, -50);
    expect(none.score).toBe(0);
    expect(none.overallPass).toBe(false);
  });

  it('holds a tour pro to a higher bar on the same raw score', async () => {
    const t = testApp();
    const { asUser: asBeginner, profileId: beginnerId } = await signInWithProfile(t, {
      email: 'a@example.com',
      skillLevel: 'beginner',
    });
    const { asUser: asPro, profileId: proId } = await signInWithProfile(t, {
      email: 'b@example.com',
      skillLevel: 'tour_pro',
    });

    const beginner = await attempt(asBeginner, beginnerId, 99);
    const pro = await attempt(asPro, proId, 99);

    expect(beginner.passingScore).toBeLessThan(pro.passingScore);
  });

  it('clamps a week outside the three a phase has', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await asUser.mutation(api.skillTests.submitSkillTest, {
      profileId,
      phase: 'putting',
      week: 99,
      date: TODAY,
      results: [],
    });

    const tests = await asUser.query(api.skillTests.getSkillsTests, { profileId });
    expect(tests[0].weekNumber).toBe(3);
  });

  it('rejects a UTC timestamp where a local date belongs', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.mutation(api.skillTests.submitSkillTest, {
        profileId,
        phase: 'putting',
        week: 1,
        date: new Date().toISOString(),
        results: [],
      }),
    ).rejects.toThrow();
  });

  it('refuses to file an attempt against a profile the caller does not own', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.skillTests.submitSkillTest, {
        profileId,
        phase: 'putting',
        week: 1,
        date: TODAY,
        results: [],
      }),
    ).rejects.toThrow();
  });

  it('ignores a challenge id that is not in the test', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const graded = await asUser.mutation(api.skillTests.submitSkillTest, {
      profileId,
      phase: 'putting',
      week: 1,
      date: TODAY,
      results: [{ challengeId: 'not-a-real-challenge', passes: 100 }],
    });

    // Scoring walks the test's own challenges, so an invented id contributes
    // nothing rather than inflating the total.
    expect(graded.score).toBe(0);
  });
});

describe('getSkillsTests', () => {
  it('is closed to a caller who does not own the profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await attempt(asUser, profileId, 3);

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.query(api.skillTests.getSkillsTests, { profileId })).resolves.toEqual([]);
  });
});

describe('getBestTestPerPhase', () => {
  it('reports a row for every phase, attempted or not', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const ladder = await asUser.query(api.skillTests.getBestTestPerPhase, { profileId });
    expect(ladder).toHaveLength(6);
    expect(ladder.every((row) => row.attempts === 0 && row.bestScore === null)).toBe(true);
  });

  it('keeps the best score rather than the most recent', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await attempt(asUser, profileId, 99); // a perfect round
    await attempt(asUser, profileId, 0); // then a bad one

    const ladder = await asUser.query(api.skillTests.getBestTestPerPhase, { profileId });
    const putting = ladder.find((row) => row.phase === 'putting');
    expect(putting?.attempts).toBe(2);
    expect(putting?.bestScore).toBe(100);
    expect(putting?.passed).toBe(true);
  });

  it('is closed to a caller who does not own the profile', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.query(api.skillTests.getBestTestPerPhase, { profileId }),
    ).resolves.toEqual([]);
  });
});
