import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';
import { type ShotLogEntry, extractTendencies } from './lib/caddie';
import { COURSE_LIBRARY, type TeeBox } from './lib/courses';

const TEE_VALIDATOR = v.union(
  v.literal('championship'),
  v.literal('regular'),
  v.literal('forward'),
);

/** See convex/sessions.ts — every profileId from a client is ownership-checked. */
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

    // Scoring average only moves on full rounds — a 3-hole practice loop
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

type Differential = {
  date: string;
  courseName: string;
  grossScore: number;
  differential: number;
};

/**
 * WHS: how many of the best differentials count, by rounds available.
 * Straight from the World Handicap System table.
 */
function differentialsToUse(n: number): number {
  if (n <= 5) return 1;
  if (n <= 8) return 2;
  if (n <= 9) return 3;
  if (n <= 11) return 4;
  if (n <= 14) return 5;
  if (n <= 16) return 6;
  if (n <= 18) return 7;
  return 8;
}

function indexFrom(diffs: Differential[]): number {
  const n = diffs.length;
  const best = [...diffs].sort((a, b) => a.differential - b.differential).slice(0, differentialsToUse(n));
  const avg = best.reduce((s, d) => s + d.differential, 0) / best.length;
  return Math.round(avg * 0.96 * 10) / 10;
}

/**
 * WHS Handicap Index.
 *
 * Differential = (gross score − course rating) × 113 / slope, then the mean of
 * the best N differentials × 0.96.
 */
export const getHandicapData = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (
    ctx,
    args,
  ): Promise<{
    handicapIndex: number | null;
    trend: { date: string; index: number; courseName: string }[];
    contributingRounds: (Differential & { contributing: boolean })[];
    lowestIndex: number | null;
    roundsUsed: number;
  }> => {
    const empty = {
      handicapIndex: null,
      trend: [],
      contributingRounds: [],
      lowestIndex: null,
      roundsUsed: 0,
    };

    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return empty;

    const rounds: Doc<'roundScores'>[] = await ctx.db
      .query('roundScores')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(20);

    const completed = rounds.filter((r) => r.holes.length >= 18);
    if (completed.length === 0) return empty;

    const withDifferentials: Differential[] = completed.map((r) => ({
      date: r.date,
      courseName: r.courseName,
      grossScore: r.totalScore,
      differential:
        r.courseRating && r.courseSlope
          ? Math.round(((r.totalScore - r.courseRating) * 113) / r.courseSlope * 10) / 10
          : // No rating/slope on file: fall back to strokes vs par.
            Math.round(r.scoreDifferential * 10) / 10,
    }));

    const numBest = differentialsToUse(completed.length);
    const bestSet = new Set(
      [...withDifferentials]
        .sort((a, b) => a.differential - b.differential)
        .slice(0, numBest)
        .map((d) => d.date + d.courseName),
    );

    // Running index after each round, oldest first, for the trend chart.
    const chronological = [...withDifferentials].reverse();
    const trend: { date: string; index: number; courseName: string }[] = [];
    for (let i = 0; i < chronological.length; i++) {
      const slice = chronological.slice(0, i + 1);
      if (slice.length < 3) continue; // WHS needs a minimum history
      const last = slice[slice.length - 1];
      trend.push({ date: last.date, index: indexFrom(slice), courseName: last.courseName });
    }

    const handicapIndex = indexFrom(withDifferentials);

    return {
      handicapIndex,
      trend,
      contributingRounds: withDifferentials.map((r) => ({
        ...r,
        contributing: bestSet.has(r.date + r.courseName),
      })),
      lowestIndex: trend.length > 0 ? Math.min(...trend.map((t) => t.index)) : handicapIndex,
      roundsUsed: numBest,
    };
  },
});
