import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import type { Id, TableNames } from './_generated/dataModel';
import { type MutationCtx, internalMutation, mutation } from './_generated/server';

/**
 * Deleting an account, from inside the app.
 *
 * Google Play requires any app that lets people create an account to let them
 * delete it, and everything attached to it, without contacting anyone. This is
 * that path; the web page in `http.ts` explains it to people who no longer
 * have the app installed.
 *
 * Two stages, because a golfer's history is unbounded and a mutation is not:
 *
 *   1. `deleteMyAccount` removes the account itself - the user row, every
 *      sign-in method and every session - in one transaction. From that
 *      moment the golfer is signed out everywhere and cannot sign back into
 *      the old data. Signing up again with the same address makes a new,
 *      empty account.
 *   2. `purgeUserData` deletes the golf data in batches, rescheduling itself
 *      until nothing is left. It needs only the old user id, which every row
 *      still carries.
 *
 * `voiceClips` rows the golfer caused are deleted with them (see the schema for
 * why speech is owned). `courseCache` is shared reference data and stays.
 */

/** Rows per batch. Small enough that a batch of swing videos, each with up to
 *  two dozen stored frames, stays well inside a mutation's limits. */
const BATCH = 50;

export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not signed in', code: 'UNAUTHENTICATED' });
    }

    const user = await ctx.db.get(userId);

    // Sessions and their refresh tokens: every device is signed out, and no
    // device can refresh its way back in.
    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }

    // Sign-in methods: the password hash, the Google link, any pending codes,
    // and the rate-limit counters keyed by the address.
    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query('authVerificationCodes')
        .withIndex('accountId', (q) => q.eq('accountId', account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);

      const limits = await ctx.db
        .query('authRateLimits')
        .withIndex('identifier', (q) => q.eq('identifier', account.providerAccountId))
        .collect();
      for (const limit of limits) await ctx.db.delete(limit._id);

      await ctx.db.delete(account._id);
    }

    if (user) await ctx.db.delete(userId);

    // The coach conversations live in the agent component, keyed by this
    // user id. It pages through them itself.
    await ctx.runMutation(components.agent.users.deleteAllForUserIdAsync, { userId });

    await ctx.scheduler.runAfter(0, internal.account.purgeUserData, { userId });
    return null;
  },
});

/**
 * Deletes one batch of a departed golfer's data, then schedules the next.
 *
 * One table at a time, children before the profile they hang off, so an
 * interrupted purge leaves nothing that points at a row already gone. Safe to
 * run again at any point - every step is "delete what is still there".
 */
export const purgeUserData = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args): Promise<{ done: boolean }> => {
    const more = await deleteNextBatch(ctx, args.userId);
    if (more) {
      await ctx.scheduler.runAfter(0, internal.account.purgeUserData, args);
    }
    return { done: !more };
  },
});

/** Deletes up to one batch from the first table that still has rows. */
async function deleteNextBatch(ctx: MutationCtx, userId: Id<'users'>): Promise<boolean> {
  const db = ctx.db;

  const profile = await db
    .query('golferProfiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();

  if (profile) {
    const byProfile = [
      () =>
        db
          .query('launchShots')
          .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
          .take(BATCH),
      () =>
        db
          .query('shotLogs')
          .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
          .take(BATCH),
      () =>
        db
          .query('skillsTests')
          .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
          .take(BATCH),
      () =>
        db
          .query('roundScores')
          .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
          .take(BATCH),
      () =>
        db
          .query('coachDrafts')
          .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
          .take(BATCH),
      () =>
        db
          .query('coachThreads')
          .withIndex('by_profile', (q) => q.eq('profileId', profile._id))
          .take(BATCH),
    ];
    for (const next of byProfile) {
      if (await deleteRows(ctx, await next())) return true;
    }
  }

  // Stored files go with the rows that point at them. Deleting only the row
  // would leave the blob billable and reachable by nothing.
  const videos = await db
    .query('swingVideos')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(BATCH);
  if (videos.length > 0) {
    for (const video of videos) {
      for (const id of [video.storageId, ...(video.frameStorageIds ?? [])]) {
        await ctx.storage.delete(id).catch(() => undefined);
      }
      await db.delete(video._id);
    }
    return true;
  }

  const clips = await db
    .query('voiceClips')
    .withIndex('by_owner', (q) => q.eq('ownerId', userId))
    .take(BATCH);
  if (clips.length > 0) {
    for (const clip of clips) {
      await ctx.storage.delete(clip.storageId).catch(() => undefined);
      await db.delete(clip._id);
    }
    return true;
  }

  const byUser = [
    () =>
      db
        .query('trainingSessions')
        .withIndex('by_user_date', (q) => q.eq('userId', userId))
        .take(BATCH),
    () =>
      db
        .query('launchSessions')
        .withIndex('by_user_date', (q) => q.eq('userId', userId))
        .take(BATCH),
    () =>
      db
        .query('customCourses')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(BATCH),
    () =>
      db
        .query('contentReports')
        .withIndex('by_user_and_created', (q) => q.eq('userId', userId))
        .take(BATCH),
  ];
  for (const next of byUser) {
    if (await deleteRows(ctx, await next())) return true;
  }

  // Last, once nothing refers to it. Looping back round covers the (should
  // be impossible) case of a user with more than one profile.
  if (profile) {
    await db.delete(profile._id);
    return true;
  }

  return false;
}

/** Deletes the rows; reports whether there were any. */
async function deleteRows(ctx: MutationCtx, rows: { _id: Id<TableNames> }[]): Promise<boolean> {
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length > 0;
}
