import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';

const PHASE_VALIDATOR = v.union(
  v.literal('putting'),
  v.literal('short_game'),
  v.literal('pitching'),
  v.literal('mid_irons'),
  v.literal('hybrids_woods'),
  v.literal('driver'),
);

/**
 * The client sends its own local YYYY-MM-DD, because Convex functions run in
 * UTC and cannot know the device's timezone. Validated here so a malformed or
 * hostile value can never reach an index range.
 */
const DATE_VALIDATOR = v.string();

function assertDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ConvexError({ message: 'Invalid date', code: 'BAD_REQUEST' });
  }
  return date;
}

/**
 * Loads a profile only if it belongs to the signed-in user.
 *
 * profileId arrives from the client, so ownership must be checked on every
 * call - otherwise anyone could read or mutate another golfer's program by
 * guessing an id.
 */
async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/** Today's session for a profile, if one has been started. */
export const getTodaysSession = query({
  args: { profileId: v.id('golferProfiles'), date: DATE_VALIDATOR },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return null;

    return await ctx.db
      .query('trainingSessions')
      .withIndex('by_profile_day', (q) =>
        q.eq('profileId', args.profileId).eq('day', owned.profile.currentDay),
      )
      .filter((q) => q.eq(q.field('date'), assertDate(args.date)))
      .first();
  },
});

/** Most recent sessions, newest first. */
export const getSessionHistory = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('trainingSessions')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(30);
  },
});

/** Start today's session for a phase, or return the existing one. */
export const startSession = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    phase: PHASE_VALIDATOR,
    date: DATE_VALIDATOR,
    /** Drill count for the session; the curriculum picks 3 by default. */
    tasksTotal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) {
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }
    const { userId, profile } = owned;
    const date = assertDate(args.date);

    const existing = await ctx.db
      .query('trainingSessions')
      .withIndex('by_profile_day', (q) =>
        q.eq('profileId', args.profileId).eq('day', profile.currentDay),
      )
      .filter((q) => q.and(q.eq(q.field('date'), date), q.eq(q.field('phase'), args.phase)))
      .first();

    if (existing) return existing._id;

    const sessionId = await ctx.db.insert('trainingSessions', {
      userId,
      profileId: args.profileId,
      day: profile.currentDay,
      phase: args.phase,
      date,
      tasksCompleted: [],
      tasksTotal: args.tasksTotal ?? 3,
      sessionComplete: false,
      sessionType: 'practice',
    });

    if (profile.currentPhase !== args.phase) {
      await ctx.db.patch(args.profileId, { currentPhase: args.phase });
    }

    return sessionId;
  },
});

/** Mark a drill complete. Completing the last one closes the session. */
export const completeDrill = mutation({
  args: {
    sessionId: v.id('trainingSessions'),
    drillId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new ConvexError({ message: 'Session not found', code: 'NOT_FOUND' });
    }

    if (session.tasksCompleted.includes(args.drillId)) return;

    const tasksCompleted = [...session.tasksCompleted, args.drillId];

    // The day is deliberately NOT advanced here. Advancing is an explicit
    // action from the Program screen, which calls advanceProgramDay.
    await ctx.db.patch(args.sessionId, {
      tasksCompleted,
      sessionComplete: tasksCompleted.length >= session.tasksTotal,
    });
  },
});

/** Undo a completed drill. */
export const uncompleteDrill = mutation({
  args: {
    sessionId: v.id('trainingSessions'),
    drillId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) return;

    await ctx.db.patch(args.sessionId, {
      tasksCompleted: session.tasksCompleted.filter((id) => id !== args.drillId),
      sessionComplete: false,
    });
  },
});

/** Save the golfer's notes against a session. */
export const saveCoachNotes = mutation({
  args: {
    sessionId: v.id('trainingSessions'),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) return;

    await ctx.db.patch(args.sessionId, { coachNotes: args.notes });
  },
});

const DAILY_TARGET = 175; // combined reps/day
const SWING_TARGET = 100;
const PUTT_TARGET = 75;

/** 30-day rep totals for the dashboard's vital-stats card. */
export const get30DaySnapshot = query({
  args: { profileId: v.id('golferProfiles'), date: DATE_VALIDATOR },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return null;

    // Window is anchored to the golfer's local date, not the server's.
    const cutoff = new Date(`${assertDate(args.date)}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    // Bounded read: 30 days x at most ~6 sessions/day.
    const sessions = await ctx.db
      .query('trainingSessions')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(200);

    const recent = sessions.filter((s) => s.date >= cutoffStr);

    let totalReps = 0;
    let swingReps = 0;
    let puttReps = 0;
    const completedDays = new Set<string>();

    for (const s of recent) {
      const reps = s.tasksCompleted.length;
      totalReps += reps;
      if (s.phase === 'putting') puttReps += reps;
      else swingReps += reps;
      if (s.sessionComplete) completedDays.add(s.date);
    }

    return {
      totalReps,
      swingReps,
      puttReps,
      completedDays: completedDays.size,
      totalGoal: 30 * DAILY_TARGET,
      swingGoal: 30 * SWING_TARGET,
      puttGoal: 30 * PUTT_TARGET,
      dailyTarget: DAILY_TARGET,
      avgDailyReps:
        recent.length > 0 ? Math.round(totalReps / Math.max(completedDays.size, 1)) : 0,
    };
  },
});
