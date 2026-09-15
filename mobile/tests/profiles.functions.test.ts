/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';
import { PROGRAM_DAYS } from '../convex/lib/program';

import { completeToday, localDate, signIn, signInWithProfile, testApp } from './helpers';

describe('getMyProfile', () => {
  it('returns null for a signed-out caller rather than throwing', () => {
    const t = testApp();
    // The app distinguishes "loading" from "no profile yet" by this exact
    // null, and routes to onboarding on it.
    return expect(t.query(api.profiles.getMyProfile, {})).resolves.toBeNull();
  });

  it('returns null when signed in without a profile', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    await expect(asUser.query(api.profiles.getMyProfile, {})).resolves.toBeNull();
  });

  it('never returns another golfer his profile', async () => {
    const t = testApp();
    await signInWithProfile(t, { email: 'a@example.com', displayName: 'Alex' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(asBob.query(api.profiles.getMyProfile, {})).resolves.toBeNull();
  });
});

describe('createProfile', () => {
  it('starts every golfer on day 1 of the putting phase', async () => {
    const t = testApp();
    const { asUser } = await signInWithProfile(t);

    const profile = await asUser.query(api.profiles.getMyProfile, {});

    expect(profile?.currentDay).toBe(1);
    expect(profile?.currentPhase).toBe('putting');
    expect(profile?.onboardingComplete).toBe(true);
    expect(profile?.targetScore).toBe(80);
  });

  it('is idempotent - a second call returns the first profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const again = await asUser.mutation(api.profiles.createProfile, {
      displayName: 'Someone Else',
      skillLevel: 'scratch',
    });

    expect(again).toBe(profileId);
    // The original wins: a duplicate onboarding must not overwrite progress.
    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.displayName).toBe('Alex');
    expect(profile?.skillLevel).toBe('intermediate');
  });

  it('refuses a signed-out caller', async () => {
    const t = testApp();

    await expect(
      t.mutation(api.profiles.createProfile, { displayName: 'Nobody', skillLevel: 'beginner' }),
    ).rejects.toThrow();
  });
});

describe('updateCoach', () => {
  it('switches the coach on the golfer own profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { coachId: 'que' });

    await asUser.mutation(api.profiles.updateCoach, { profileId, coachId: 'dom' });

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.coachId).toBe('dom');
  });

  it('refuses to touch a profile belonging to someone else', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    // A valid id is not permission: ids come from the client.
    await expect(
      asBob.mutation(api.profiles.updateCoach, { profileId, coachId: 'dom' }),
    ).rejects.toThrow();
  });
});

describe('advanceProgramDay', () => {
  it("refuses to advance until today's session is complete", async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const today = localDate();

    await expect(
      asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: today }),
    ).rejects.toThrow();

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.currentDay).toBe(1);
  });

  it('advances once the session is complete', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const today = localDate();

    await completeToday(t, profileId, 1, today);
    await asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: today });

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.currentDay).toBe(2);
    expect(profile?.lastAdvancedDate).toBe(today);
  });

  it('allows only one advance per calendar day', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const today = localDate();

    await completeToday(t, profileId, 1, today);
    await asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: today });

    // Day 2's session is complete too, but it is still the same day - the
    // whole 90-day programme could otherwise be cleared in one sitting.
    await completeToday(t, profileId, 2, today);
    await expect(
      asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: today }),
    ).rejects.toThrow();

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.currentDay).toBe(2);
  });

  it('advances again the next day', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const today = localDate();
    const tomorrow = localDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

    await completeToday(t, profileId, 1, today);
    await asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: today });

    await completeToday(t, profileId, 2, tomorrow);
    await asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: tomorrow });

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.currentDay).toBe(3);
  });

  it('moves the phase when a boundary is crossed', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    // Park the golfer on the last day of the putting phase, then advance.
    await t.run(async (ctx) => {
      await ctx.db.patch(profileId, { currentDay: 30, currentPhase: 'putting' });
    });

    const today = localDate();
    await completeToday(t, profileId, 30, today);
    await asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: today });

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.currentDay).toBe(31);
    expect(profile?.currentPhase).not.toBe('putting');
  });

  it('stops at the end of the programme instead of running past it', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(profileId, { currentDay: PROGRAM_DAYS });
    });

    const today = localDate();
    await completeToday(t, profileId, PROGRAM_DAYS, today);
    // Returns quietly rather than throwing - day 90 is finished, not an error.
    await asUser.mutation(api.profiles.advanceProgramDay, { profileId, date: today });

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.currentDay).toBe(PROGRAM_DAYS);
  });

  it('rejects a date that is not a local YYYY-MM-DD', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    // A UTC timestamp here is the bug the format check exists to catch.
    await expect(
      asUser.mutation(api.profiles.advanceProgramDay, {
        profileId,
        date: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });

  it("refuses to advance another golfer's programme", async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');
    const today = localDate();

    await completeToday(t, profileId, 1, today);

    await expect(
      asBob.mutation(api.profiles.advanceProgramDay, { profileId, date: today }),
    ).rejects.toThrow();
  });
});
