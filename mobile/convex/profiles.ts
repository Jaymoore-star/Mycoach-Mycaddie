import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { PHASE_ORDER, type Phase } from './lib/curriculum';

/** 6 phases x 15 days = the 90-day program. */
const PHASE_DAY_START: Record<Phase, number> = {
  putting: 1,
  short_game: 16,
  pitching: 31,
  mid_irons: 46,
  hybrids_woods: 61,
  driver: 76,
};

export const PROGRAM_DAYS = 90;

function getPhaseForDay(day: number): Phase {
  let phase = PHASE_ORDER[0];
  for (const p of PHASE_ORDER) {
    if (day >= PHASE_DAY_START[p]) phase = p;
  }
  return phase;
}

/**
 * Returns the signed-in golfer's profile.
 *
 * Three distinct states the UI depends on:
 *   `undefined` — still loading
 *   `null`      — signed in but no profile yet, so send them to onboarding
 *   a document  — ready
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    return await ctx.db
      .query('golferProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
  },
});

export const createProfile = mutation({
  args: {
    displayName: v.string(),
    skillLevel: v.union(
      v.literal('beginner'),
      v.literal('intermediate'),
      v.literal('advanced'),
      v.literal('scratch'),
      v.literal('tour_pro'),
    ),
    handicap: v.optional(v.number()),
    targetScore: v.optional(v.number()),
    coachId: v.optional(
      v.union(v.literal('que'), v.literal('mason'), v.literal('sam'), v.literal('dom')),
    ),
    weeklyGoal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('Not signed in');

    const existing = await ctx.db
      .query('golferProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert('golferProfiles', {
      userId,
      displayName: args.displayName,
      skillLevel: args.skillLevel,
      handicap: args.handicap,
      currentDay: 1,
      currentPhase: 'putting',
      programStartDate: new Date().toISOString(),
      targetScore: args.targetScore ?? 80,
      weeklyTasksCompleted: [],
      onboardingComplete: true,
      coachId: args.coachId,
      weeklyGoal: args.weeklyGoal,
    });
  },
});

/** Switch the assigned coach. */
export const updateCoach = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    coachId: v.union(
      v.literal('que'),
      v.literal('mason'),
      v.literal('sam'),
      v.literal('dom'),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.userId !== userId) {
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }
    await ctx.db.patch(args.profileId, { coachId: args.coachId });
  },
});

/**
 * Advance to the next program day, moving phase when a boundary is crossed.
 *
 * Guarded by today's session being complete: without that check a golfer
 * could tap through all 90 days without practising.
 */
export const advanceProgramDay = mutation({
  // date is the golfer's local YYYY-MM-DD — see convex/sessions.ts.
  args: { profileId: v.id('golferProfiles'), date: v.string() },
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new ConvexError({ message: 'Invalid date', code: 'BAD_REQUEST' });
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }
    if (profile.userId !== userId) {
      throw new ConvexError({ message: 'Forbidden', code: 'FORBIDDEN' });
    }

    if (profile.currentDay >= PROGRAM_DAYS) return;

    const session = await ctx.db
      .query('trainingSessions')
      .withIndex('by_profile_day', (q) =>
        q.eq('profileId', args.profileId).eq('day', profile.currentDay),
      )
      .filter((q) => q.eq(q.field('date'), args.date))
      .first();

    if (!session || !session.sessionComplete) {
      throw new ConvexError({
        message: "Complete today's training session before advancing to the next day.",
        code: 'BAD_REQUEST',
      });
    }

    // One advance per calendar day. Without this the whole 90-day program can
    // be cleared in a single sitting, which makes the programme meaningless —
    // muscle memory needs days, not minutes. Enforced server-side so it cannot
    // be bypassed by a modified client.
    if (profile.lastAdvancedDate === args.date) {
      throw new ConvexError({
        message: `Day ${profile.currentDay} is done. Day ${
          profile.currentDay + 1
        } unlocks tomorrow — rest is part of the programme.`,
        code: 'RATE_LIMITED',
      });
    }

    const nextDay = profile.currentDay + 1;
    await ctx.db.patch(args.profileId, {
      currentDay: nextDay,
      currentPhase: getPhaseForDay(nextDay),
      lastAdvancedDate: args.date,
    });
  },
});
