import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';

async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/** Short-lived upload URL for the recorded file. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/** Records the metadata once the file itself is in storage. */
export const saveRecording = mutation({
  args: {
    storageId: v.id('_storage'),
    profileId: v.id('golferProfiles'),
    label: v.string(),
    notes: v.optional(v.string()),
    durationSeconds: v.number(),
    recordedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) {
      // Clean up the orphaned upload rather than leaving it billable forever.
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }

    return await ctx.db.insert('swingVideos', {
      userId: owned.userId,
      profileId: args.profileId,
      storageId: args.storageId,
      label: args.label,
      notes: args.notes,
      durationSeconds: args.durationSeconds,
      recordedAt: args.recordedAt,
    });
  },
});

/** Recordings newest first, each with a playable URL. */
export const listRecordings = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    const videos = await ctx.db
      .query('swingVideos')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(50);

    return await Promise.all(
      videos.map(async (v) => ({
        ...v,
        url: await ctx.storage.getUrl(v.storageId),
      })),
    );
  },
});

export const deleteRecording = mutation({
  args: { videoId: v.id('swingVideos') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const video = await ctx.db.get(args.videoId);
    if (!video || video.userId !== userId) {
      throw new ConvexError({ message: 'Recording not found', code: 'NOT_FOUND' });
    }

    // Storage first: a dangling file costs money and is unreachable once the
    // row is gone.
    await ctx.storage.delete(video.storageId);
    await ctx.db.delete(args.videoId);
  },
});

/** Rename or annotate an existing recording. */
export const updateRecording = mutation({
  args: {
    videoId: v.id('swingVideos'),
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const video = await ctx.db.get(args.videoId);
    if (!video || video.userId !== userId) {
      throw new ConvexError({ message: 'Recording not found', code: 'NOT_FOUND' });
    }

    await ctx.db.patch(args.videoId, {
      ...(args.label !== undefined ? { label: args.label } : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    });
  },
});
