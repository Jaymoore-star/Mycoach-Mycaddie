import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';
import { deriveAiInsight, getSkillTestResult } from './lib/shotInsight';

const SHOT_SHAPE = v.union(
  v.literal('straight'),
  v.literal('draw'),
  v.literal('fade'),
  v.literal('hook'),
  v.literal('slice'),
  v.literal('push'),
  v.literal('pull'),
);

const BALL_FLIGHT = v.union(
  v.literal('penetrating'),
  v.literal('mid'),
  v.literal('high'),
  v.literal('low'),
);

const MISS_DIRECTION = v.union(
  v.literal('left'),
  v.literal('right'),
  v.literal('short'),
  v.literal('long'),
  v.literal('center'),
);

const CONTACT_TYPE = v.union(
  v.literal('solid'),
  v.literal('fat'),
  v.literal('thin'),
  v.literal('toe'),
  v.literal('heel'),
  v.literal('top'),
);

async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/**
 * Records one shot and derives its coaching note and pass/fail.
 *
 * This is the writer for `shotLogs`, which My Bag and the caddie's tendency
 * analysis both read. Without it those features have no data to work from.
 */
export const logShot = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    sessionId: v.optional(v.id('trainingSessions')),
    sessionType: v.union(v.literal('practice'), v.literal('skills_test'), v.literal('round')),
    /** The golfer's local YYYY-MM-DD — see convex/sessions.ts. */
    date: v.string(),
    club: v.string(),
    targetDistanceYards: v.number(),
    actualDistanceYards: v.number(),
    shotShape: SHOT_SHAPE,
    ballFlight: BALL_FLIGHT,
    missDirection: v.optional(MISS_DIRECTION),
    carryYards: v.optional(v.number()),
    totalYards: v.optional(v.number()),
    ballSpeedMph: v.optional(v.number()),
    clubSpeedMph: v.optional(v.number()),
    smashFactor: v.optional(v.number()),
    spinRpm: v.optional(v.number()),
    launchAngleDeg: v.optional(v.number()),
    contactType: v.optional(CONTACT_TYPE),
    lieType: v.optional(v.string()),
    elevation: v.optional(v.number()),
    windSpeedMph: v.optional(v.number()),
    windDirection: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new ConvexError({ message: 'Invalid date', code: 'BAD_REQUEST' });
    }

    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    if (args.actualDistanceYards < 0 || args.actualDistanceYards > 500) {
      throw new ConvexError({ message: 'Distance must be 0-500 yards', code: 'BAD_REQUEST' });
    }

    // Derived rather than accepted from the client: it is the distance the
    // accuracy threshold is judged against, so the client must not set it.
    const distanceFromTargetYards = Math.abs(
      args.actualDistanceYards - args.targetDistanceYards,
    );

    const skillLevel = owned.profile.skillLevel;

    return await ctx.db.insert('shotLogs', {
      userId: owned.userId,
      profileId: args.profileId,
      sessionId: args.sessionId,
      sessionType: args.sessionType,
      date: args.date,
      club: args.club,
      targetDistanceYards: args.targetDistanceYards,
      actualDistanceYards: args.actualDistanceYards,
      distanceFromTargetYards,
      shotShape: args.shotShape,
      ballFlight: args.ballFlight,
      missDirection: args.missDirection,
      carryYards: args.carryYards,
      totalYards: args.totalYards,
      ballSpeedMph: args.ballSpeedMph,
      clubSpeedMph: args.clubSpeedMph,
      smashFactor: args.smashFactor,
      spinRpm: args.spinRpm,
      launchAngleDeg: args.launchAngleDeg,
      contactType: args.contactType,
      lieType: args.lieType,
      elevation: args.elevation,
      windSpeedMph: args.windSpeedMph,
      windDirection: args.windDirection,
      aiInsight: deriveAiInsight({
        club: args.club,
        targetDistanceYards: args.targetDistanceYards,
        actualDistanceYards: args.actualDistanceYards,
        distanceFromTargetYards,
        shotShape: args.shotShape,
        ballFlight: args.ballFlight,
        missDirection: args.missDirection,
        // contactType is deliberately absent: deriveAiInsight does not read
        // it. The original passed it via spread, so it was silently dropped.
        smashFactor: args.smashFactor,
        spinRpm: args.spinRpm,
        skillLevel,
      }),
      skillTestResult: getSkillTestResult(args.club, distanceFromTargetYards, skillLevel),
    });
  },
});

export const getRecentShots = query({
  args: { profileId: v.id('golferProfiles'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('shotLogs')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(Math.min(args.limit ?? 50, 500));
  },
});

export const deleteShot = mutation({
  args: { shotId: v.id('shotLogs') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const shot = await ctx.db.get(args.shotId);
    if (!shot || shot.userId !== userId) {
      throw new ConvexError({ message: 'Shot not found', code: 'NOT_FOUND' });
    }

    await ctx.db.delete(args.shotId);
  },
});

/** Per-club dispersion and contact quality, for My Stats. */
export const getShotStats = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return null;

    const shots = await ctx.db
      .query('shotLogs')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(500);

    if (shots.length === 0) return null;

    const misses: Record<string, number> = {};
    const shapes: Record<string, number> = {};
    const contacts: Record<string, number> = {};
    let totalOffTarget = 0;
    let passes = 0;
    let judged = 0;

    for (const s of shots) {
      if (s.missDirection) misses[s.missDirection] = (misses[s.missDirection] ?? 0) + 1;
      shapes[s.shotShape] = (shapes[s.shotShape] ?? 0) + 1;
      if (s.contactType) contacts[s.contactType] = (contacts[s.contactType] ?? 0) + 1;
      totalOffTarget += s.distanceFromTargetYards;
      if (s.skillTestResult) {
        judged++;
        if (s.skillTestResult === 'pass') passes++;
      }
    }

    const topOf = (counts: Record<string, number>) =>
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      shotCount: shots.length,
      avgOffTargetYards: Math.round((totalOffTarget / shots.length) * 10) / 10,
      passRate: judged > 0 ? Math.round((passes / judged) * 100) : null,
      judgedCount: judged,
      dominantMiss: topOf(misses),
      dominantShape: topOf(shapes),
      dominantContact: topOf(contacts),
      missBreakdown: misses,
      shapeBreakdown: shapes,
      contactBreakdown: contacts,
    };
  },
});
