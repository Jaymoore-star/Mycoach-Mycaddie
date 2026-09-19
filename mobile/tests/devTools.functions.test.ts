/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api, internal } from '../convex/_generated/api';

import { signIn, testApp } from './helpers';

const CONFIRM = 'DELETE ALL ACCOUNTS AND DATA';
const TODAY = '2026-09-18';

describe('resetDeployment', () => {
  it('refuses without the exact confirmation phrase', async () => {
    const t = testApp();
    for (const confirm of ['', 'yes', 'delete all accounts and data', CONFIRM.slice(0, -1)]) {
      await expect(
        t.mutation(internal.devTools.resetDeployment, { confirm }),
      ).rejects.toThrow(/Refusing to wipe/);
    }
  });

  it('leaves everything in place when it refuses', async () => {
    const t = testApp();
    await signIn(t, 'a@example.com');

    await expect(
      t.mutation(internal.devTools.resetDeployment, { confirm: 'nope' }),
    ).rejects.toThrow();

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
  });

  it('clears a fully populated deployment', async () => {
    const t = testApp();
    await signIn(t, 'demo@dominusgolf.com');
    await t.mutation(internal.seed.demoGolfer, {
      email: 'demo@dominusgolf.com',
      today: TODAY,
    });

    // Confirm the seed really put something there, or the wipe proves nothing.
    const before = await t.run(async (ctx) => ({
      users: (await ctx.db.query('users').collect()).length,
      profiles: (await ctx.db.query('golferProfiles').collect()).length,
      rounds: (await ctx.db.query('roundScores').collect()).length,
      shots: (await ctx.db.query('shotLogs').collect()).length,
    }));
    expect(before.users).toBe(1);
    expect(before.profiles).toBe(1);
    expect(before.rounds).toBe(12);
    expect(before.shots).toBeGreaterThan(0);

    const result = await t.mutation(internal.devTools.resetDeployment, { confirm: CONFIRM });
    expect(result.total).toBeGreaterThan(before.rounds);

    const after = await t.run(async (ctx) => ({
      users: (await ctx.db.query('users').collect()).length,
      accounts: (await ctx.db.query('authAccounts').collect()).length,
      profiles: (await ctx.db.query('golferProfiles').collect()).length,
      rounds: (await ctx.db.query('roundScores').collect()).length,
      shots: (await ctx.db.query('shotLogs').collect()).length,
      sessions: (await ctx.db.query('trainingSessions').collect()).length,
      skills: (await ctx.db.query('skillsTests').collect()).length,
      launchSessions: (await ctx.db.query('launchSessions').collect()).length,
      launchShots: (await ctx.db.query('launchShots').collect()).length,
    }));
    for (const [table, count] of Object.entries(after)) {
      expect(count, table).toBe(0);
    }
  });

  it('takes the stored files with it, not just the rows', async () => {
    const t = testApp();
    const { userId } = await signIn(t, 'a@example.com');

    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert('golferProfiles', {
        userId,
        displayName: 'A',
        skillLevel: 'intermediate',
        currentDay: 1,
        currentPhase: 'putting',
        programStartDate: '2026-09-01T00:00:00.000Z',
        targetScore: 80,
        weeklyTasksCompleted: [],
        onboardingComplete: true,
      });
      await ctx.db.insert('swingVideos', {
        userId,
        profileId,
        storageId: await ctx.storage.store(new Blob(['clip'])),
        label: 'Driver',
        durationSeconds: 4,
        recordedAt: '2026-09-10T09:15:00.000Z',
        frameStorageIds: [await ctx.storage.store(new Blob(['frame']))],
      });
      await ctx.db.insert('voiceClips', {
        key: 'nova:abc',
        voice: 'nova',
        storageId: await ctx.storage.store(new Blob(['audio'])),
        createdAt: Date.now(),
      });
    });

    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toHaveLength(3);

    const result = await t.mutation(internal.devTools.resetDeployment, { confirm: CONFIRM });
    expect(result.storageFiles).toBe(3);

    // The point of the whole exercise: nothing billable survives the reset.
    expect(await t.run(async (ctx) => ctx.db.system.query('_storage').collect())).toHaveLength(0);
  });

  it('leaves the deployment usable - a golfer can sign up again after', async () => {
    const t = testApp();
    await signIn(t, 'old@example.com');
    await t.mutation(internal.devTools.resetDeployment, { confirm: CONFIRM });

    const { asUser } = await signIn(t, 'new@example.com');
    const profileId = await asUser.mutation(api.profiles.createProfile, {
      displayName: 'Fresh',
      skillLevel: 'intermediate',
    });
    expect(profileId).toBeTruthy();
  });

  it('is a no-op on an already empty deployment', async () => {
    const t = testApp();
    const result = await t.mutation(internal.devTools.resetDeployment, { confirm: CONFIRM });
    expect(result.total).toBe(0);
    expect(result.storageFiles).toBe(0);
  });
});
