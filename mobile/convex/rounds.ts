import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';
import { type ShotLogEntry, extractTendencies } from './lib/caddie';
import { COURSE_LIBRARY, type TeeBox } from './lib/courses';
import {
  MIN_SCORES_FOR_INDEX,
  type ScoreDifferential,
  contributingRounds,
  handicapIndex,
  handicapTrend,
  scoreDifferential,
  scoresToUse,
} from './lib/handicap';

const TEE_VALIDATOR = v.union(
  v.literal('championship'),
  v.literal('regular'),
  v.literal('forward'),
);

/** See convex/sessions.ts - every profileId from a client is ownership-checked. */
async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

async function ownedRound(ctx: MutationCtx, roundId: Id<'roundScores'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }
  const round = await ctx.db.get(roundId);
  if (!round || round.userId !== userId) {
    throw new ConvexError({ message: 'Round not found', code: 'NOT_FOUND' });
  }
  return round;
}

export const startRound = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    courseName: v.string(),
    courseId: v.optional(v.string()),
    teeBox: v.optional(TEE_VALIDATOR),
    courseConditions: v.optional(v.string()),
    weatherConditions: v.optional(v.string()),
    windMph: v.optional(v.number()),
    temperature: v.optional(v.number()),
    totalPar: v.optional(v.number()),
    courseRating: v.optional(v.number()),
    courseSlope: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    // Reuse an unfinished round at the same course rather than creating a
    // second one. Otherwise tapping Start twice leaves duplicate scorecards
    // that are indistinguishable in the list.
    if (args.courseId) {
      const openRounds = await ctx.db
        .query('roundScores')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(10);

      const existing = openRounds.find(
        (r) => r.courseId === args.courseId && r.holes.length < 18,
      );
      if (existing) return existing._id;
    }

    // Rating and slope drive the WHS handicap, so fill them from the library
    // whenever a known course is picked and the caller didn't supply them.
    let courseRating = args.courseRating;
    let courseSlope = args.courseSlope;
    if (args.courseId && (!courseRating || !courseSlope)) {
      const libCourse = COURSE_LIBRARY.find((c) => c.id === args.courseId);
      if (libCourse) {
        const tee = (args.teeBox ?? 'regular') as TeeBox;
        courseRating = courseRating ?? libCourse.rating[tee];
        courseSlope = courseSlope ?? libCourse.slope[tee];
      }
    }

    return await ctx.db.insert('roundScores', {
      userId: owned.userId,
      profileId: args.profileId,
      date: new Date().toISOString(),
      courseName: args.courseName,
      courseId: args.courseId,
      teeBox: args.teeBox,
      courseConditions: args.courseConditions,
      weatherConditions: args.weatherConditions,
      windMph: args.windMph,
      temperature: args.temperature,
      courseRating,
      courseSlope,
      totalScore: 0,
      totalPar: args.totalPar ?? 72,
      scoreDifferential: 0,
      holes: [],
    });
  },
});

/** Write one hole, replacing any existing entry for that hole number. */
export const logHoleScore = mutation({
  args: {
    roundId: v.id('roundScores'),
    hole: v.number(),
    par: v.number(),
    score: v.number(),
    putts: v.number(),
    fairwayHit: v.optional(v.boolean()),
    girHit: v.optional(v.boolean()),
    distanceToPin: v.optional(v.number()),
    pinSide: v.optional(v.union(v.literal('left'), v.literal('center'), v.literal('right'))),
    pinDepth: v.optional(v.union(v.literal('front'), v.literal('middle'), v.literal('back'))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const round = await ownedRound(ctx, args.roundId);

    const holes = round.holes.filter((h) => h.hole !== args.hole);
    holes.push({
      hole: args.hole,
      par: args.par,
      score: args.score,
      putts: args.putts,
      fairwayHit: args.fairwayHit,
      girHit: args.girHit,
      distanceToPin: args.distanceToPin,
      pinSide: args.pinSide,
      pinDepth: args.pinDepth,
      notes: args.notes,
    });
    holes.sort((a, b) => a.hole - b.hole);

    const totalScore = holes.reduce((s, h) => s + h.score, 0);
    const totalPar = holes.reduce((s, h) => s + h.par, 0);
    const scoreDifferential = totalScore - totalPar;

    await ctx.db.patch(args.roundId, { holes, totalScore, totalPar, scoreDifferential });
    return { totalScore, scoreDifferential };
  },
});

export const finishRound = mutation({
  args: {
    roundId: v.id('roundScores'),
    caddieNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const round = await ownedRound(ctx, args.roundId);

    if (args.caddieNotes !== undefined) {
      await ctx.db.patch(args.roundId, { caddieNotes: args.caddieNotes });
    }

    // Scoring average only moves on full rounds - a 3-hole practice loop
    // would otherwise drag the number down.
    const profile = await ctx.db.get(round.profileId);
    if (profile && round.holes.length >= 18) {
      const existingAvg = profile.scoringAvg ?? round.totalScore;
      await ctx.db.patch(round.profileId, {
        scoringAvg: Math.round((existingAvg + round.totalScore) / 2),
      });
    }

    return { totalScore: round.totalScore, scoreDifferential: round.scoreDifferential };
  },
});

export const deleteRound = mutation({
  args: { roundId: v.id('roundScores') },
  handler: async (ctx, args) => {
    await ownedRound(ctx, args.roundId);
    await ctx.db.delete(args.roundId);
  },
});

export const getRounds = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('roundScores')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(10);
  },
});

export const getRound = query({
  args: { roundId: v.id('roundScores') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const round = await ctx.db.get(args.roundId);
    if (!round || round.userId !== userId) return null;
    return round;
  },
});

/** Miss patterns pulled from logged shots, used to bias club choice. */
export const getPlayerTendencies = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return null;

    const shots = await ctx.db
      .query('shotLogs')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(100);

    const entries: ShotLogEntry[] = shots.map((s) => ({
      club: s.club,
      missDirection: s.missDirection ?? null,
      distanceFromTargetYards: s.distanceFromTargetYards,
      shotShape: s.shotShape,
    }));

    return extractTendencies(entries);
  },
});

/**
 * WHS Handicap Index, trend and contributing rounds.
 *
 * All arithmetic lives in convex/lib/handicap.ts so it is unit tested and
 * shared with the client. Only 18-hole rounds that carry a course rating and
 * slope are eligible: without them there is no valid differential, and the
 * version this was ported from substituted strokes-vs-par, mixing two
 * incompatible scales into one average.
 */
export const getHandicapData = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (
    ctx,
    args,
  ): Promise<{
    handicapIndex: number | null;
    trend: { date: string; index: number; courseName: string }[];
    contributingRounds: (ScoreDifferential & { contributing: boolean })[];
    lowestIndex: number | null;
    /** How many differentials the index averaged (WHS Rule 5.2a). */
    roundsUsed: number;
    /** Eligible 18-hole rounds with rating and slope on file. */
    eligibleRounds: number;
    /** Rounds excluded for missing rating/slope, so the UI can explain why. */
    ineligibleRounds: number;
    /** Acceptable scores still needed before an index can be issued. */
    scoresNeeded: number;
  }> => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) {
      return {
        handicapIndex: null,
        trend: [],
        contributingRounds: [],
        lowestIndex: null,
        roundsUsed: 0,
        eligibleRounds: 0,
        ineligibleRounds: 0,
        scoresNeeded: MIN_SCORES_FOR_INDEX,
      };
    }

    // Read more than 20 because some rows will be filtered out below; the
    // helper still only uses the 20 most recent eligible scores.
    const rounds: Doc<'roundScores'>[] = await ctx.db
      .query('roundScores')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(60);

    const full = rounds.filter((r) => r.holes.length >= 18);
    const eligible = full.filter((r) => r.courseRating && r.courseSlope);

    const differentials: ScoreDifferential[] = eligible.slice(0, 20).map((r) => ({
      date: r.date,
      courseName: r.courseName,
      grossScore: r.totalScore,
      differential: scoreDifferential(r.totalScore, r.courseRating!, r.courseSlope!),
    }));

    const index = handicapIndex(differentials.map((d) => d.differential));
    const trend = handicapTrend(differentials);

    return {
      handicapIndex: index,
      trend,
      contributingRounds: contributingRounds(differentials),
      lowestIndex: trend.length > 0 ? Math.min(...trend.map((t) => t.index)) : index,
      roundsUsed: scoresToUse(differentials.length).count,
      eligibleRounds: differentials.length,
      ineligibleRounds: full.length - eligible.length,
      scoresNeeded: Math.max(0, MIN_SCORES_FOR_INDEX - differentials.length),
    };
  },
});
