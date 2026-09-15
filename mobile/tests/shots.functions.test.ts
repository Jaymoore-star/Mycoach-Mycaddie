/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';

import { localDate, signIn, signInWithProfile, testApp } from './helpers';

const SHOT = {
  sessionType: 'practice',
  club: '7-Iron',
  targetDistanceYards: 150,
  actualDistanceYards: 143,
  shotShape: 'fade',
  ballFlight: 'mid',
} as const;

describe('logShot', () => {
  it('derives the distance from target rather than trusting the client', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await asUser.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT });

    // This is the number the accuracy threshold is judged against, so the
    // client must not be able to set it.
    const shots = await asUser.query(api.shots.getRecentShots, { profileId });
    expect(shots[0].distanceFromTargetYards).toBe(7);
  });

  it('judges the shot against the skill level on the profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { skillLevel: 'beginner' });

    await asUser.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT });

    const shots = await asUser.query(api.shots.getRecentShots, { profileId });
    expect(shots[0].skillTestResult).toBeDefined();
    expect(shots[0].aiInsight).toBeTruthy();
  });

  it('rejects a UTC timestamp where a local date belongs', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    // A date computed with toISOString rolls over at the wrong local hour and
    // files shots under the wrong day.
    await expect(
      asUser.mutation(api.shots.logShot, {
        profileId,
        date: new Date().toISOString(),
        ...SHOT,
      }),
    ).rejects.toThrow();
  });

  it('rejects a distance no golf shot travels', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.mutation(api.shots.logShot, {
        profileId,
        date: localDate(),
        ...SHOT,
        actualDistanceYards: 900,
      }),
    ).rejects.toThrow();

    await expect(
      asUser.mutation(api.shots.logShot, {
        profileId,
        date: localDate(),
        ...SHOT,
        actualDistanceYards: -5,
      }),
    ).rejects.toThrow();
  });

  it("refuses to log against another golfer's profile", async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT }),
    ).rejects.toThrow();
  });
});

describe('getRecentShots', () => {
  it('returns nothing for a profile the caller does not own', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await asUser.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.query(api.shots.getRecentShots, { profileId })).resolves.toEqual([]);
  });

  it('caps the limit however large a number is asked for', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await asUser.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT });

    const shots = await asUser.query(api.shots.getRecentShots, { profileId, limit: 100000 });
    expect(shots).toHaveLength(1);
  });
});

describe('deleteShot', () => {
  it("refuses to delete another golfer's shot", async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await asUser.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT });
    const shots = await asUser.query(api.shots.getRecentShots, { profileId });

    const { asUser: asBob } = await signIn(t, 'b@example.com');

    // The original checked only that *a* user was signed in.
    await expect(asBob.mutation(api.shots.deleteShot, { shotId: shots[0]._id })).rejects.toThrow();
    await expect(asUser.query(api.shots.getRecentShots, { profileId })).resolves.toHaveLength(1);
  });

  it('removes the golfer own shot', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await asUser.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT });
    const shots = await asUser.query(api.shots.getRecentShots, { profileId });

    await asUser.mutation(api.shots.deleteShot, { shotId: shots[0]._id });

    await expect(asUser.query(api.shots.getRecentShots, { profileId })).resolves.toEqual([]);
  });
});

describe('getShotStats', () => {
  it('returns null before any shot is logged', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(asUser.query(api.shots.getShotStats, { profileId })).resolves.toBeNull();
  });

  it('is closed to a caller who does not own the profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await asUser.mutation(api.shots.logShot, { profileId, date: localDate(), ...SHOT });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.query(api.shots.getShotStats, { profileId })).resolves.toBeNull();
  });
});

describe('getPlayerTendencies', () => {
  it('reads the golfer own shots and nobody else', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    for (let i = 0; i < 3; i++) {
      await asUser.mutation(api.shots.logShot, {
        profileId,
        date: localDate(),
        ...SHOT,
        missDirection: 'right',
      });
    }

    const mine = await asUser.query(api.rounds.getPlayerTendencies, { profileId });
    expect(mine?.dominantMiss).toBe('right');

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.query(api.rounds.getPlayerTendencies, { profileId })).resolves.toBeNull();
  });
});
