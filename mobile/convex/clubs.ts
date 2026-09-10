/**
 * Club distance profile - aggregates shot history into personal bag distances,
 * with manual overrides stored on `golferProfiles.clubDistances`.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';
import { BAG_ORDER } from './lib/bag';

export { BAG_ORDER, type ClubName } from './lib/bag';

export type ClubStats = {
  club: string;
  shotCount: number;
  /** The number the caddie uses - the override when set, else the measured mean. */
  avgCarry: number;
  /** Measured mean, kept separate so the UI can show both. */
  measuredCarry: number;
  minCarry: number;
  maxCarry: number;
  stdDev: number;
  /** 0-100; higher is tighter. */
  consistencyScore: number;
  manual: boolean;
  manualCarry?: number;
  manualTotal?: number;
  brand?: string;
  /** Where the measured distances came from, for the UI to attribute. */
  sources: { onCourse: number; launchMonitor: number };
};

async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

export const getClubProfile = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args): Promise<ClubStats[]> => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    // Two independent sources of carry data, both counted:
    //   shotLogs    - shots logged on the course or at practice
    //   launchShots - launch monitor sessions (Garmin R10 and similar)
    // The version this was ported from read only shotLogs, so launch monitor
    // work never reached the bag despite the UI claiming it did.
    const [onCourseShots, launchShots] = await Promise.all([
      ctx.db
        .query('shotLogs')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(500),
      ctx.db
        .query('launchShots')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(500),
    ]);

    const grouped: Record<string, number[]> = {};
    const sources: Record<string, { onCourse: number; launchMonitor: number }> = {};

    const add = (club: string, yards: number, from: 'onCourse' | 'launchMonitor') => {
      // Putter distances are meaningless here, and a zero-yard shot is a
      // mis-log rather than data.
      if (!club || club === 'Putter' || yards <= 0) return;
      (grouped[club] ??= []).push(yards);
      (sources[club] ??= { onCourse: 0, launchMonitor: 0 })[from]++;
    };

    for (const shot of onCourseShots) add(shot.club, shot.actualDistanceYards, 'onCourse');
    // carryYards is the comparable figure; totalYards includes roll.
    for (const shot of launchShots) {
      if (shot.carryYards != null) add(shot.club, shot.carryYards, 'launchMonitor');
    }

    const overrides = owned.profile.clubDistances ?? {};
    const results: ClubStats[] = [];

    for (const club of BAG_ORDER) {
      const distances = grouped[club] ?? [];
      const override = overrides[club];

      // A club with neither shots nor an override isn't in the bag yet.
      if (distances.length === 0 && !override) continue;

      let measuredCarry = 0;
      let minCarry = 0;
      let maxCarry = 0;
      let stdDev = 0;
      let consistencyScore = 0;

      if (distances.length > 0) {
        measuredCarry = Math.round(distances.reduce((a, b) => a + b, 0) / distances.length);
        minCarry = Math.min(...distances);
        maxCarry = Math.max(...distances);

        const variance =
          distances.reduce((sum, d) => sum + (d - measuredCarry) ** 2, 0) / distances.length;
        stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

        // 0 yards of spread scores 100; 30+ yards scores 0.
        consistencyScore = Math.max(0, Math.round(100 - (stdDev / 30) * 100));
      }

      results.push({
        club,
        shotCount: distances.length,
        avgCarry: override ? override.carry : measuredCarry,
        measuredCarry,
        minCarry,
        maxCarry,
        stdDev,
        consistencyScore,
        manual: !!override,
        manualCarry: override?.carry,
        manualTotal: override?.total,
        brand: override?.brand,
        sources: sources[club] ?? { onCourse: 0, launchMonitor: 0 },
      });
    }

    return results;
  },
});

export const saveClubOverride = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    club: v.string(),
    carry: v.number(),
    total: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    if (args.carry <= 0 || args.carry > 450) {
      throw new ConvexError({ message: 'Carry must be 1-450 yards', code: 'BAD_REQUEST' });
    }

    const existing = owned.profile.clubDistances ?? {};
    const prev = existing[args.club];

    await ctx.db.patch(args.profileId, {
      clubDistances: {
        ...existing,
        [args.club]: {
          carry: args.carry,
          // Total defaults to carry plus roll; keep any prior value if unset.
          total: args.total ?? prev?.total ?? args.carry,
          manual: true,
          brand: prev?.brand,
        },
      },
    });
  },
});

export const saveClubBrand = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    club: v.string(),
    brand: v.string(),
  },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    const existing = owned.profile.clubDistances ?? {};
    const prev = existing[args.club];

    await ctx.db.patch(args.profileId, {
      clubDistances: {
        ...existing,
        [args.club]: {
          carry: prev?.carry ?? 0,
          total: prev?.total ?? 0,
          manual: prev?.manual ?? false,
          brand: args.brand.trim() || undefined,
        },
      },
    });
  },
});

/** Drop the override so the club falls back to measured shot data. */
export const clearClubOverride = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    club: v.string(),
  },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    const existing = { ...(owned.profile.clubDistances ?? {}) };
    delete existing[args.club];

    await ctx.db.patch(args.profileId, { clubDistances: existing });
  },
});
