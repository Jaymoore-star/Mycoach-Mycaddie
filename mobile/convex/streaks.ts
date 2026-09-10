import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';
import { type StreakSummary, summarizeStreak } from './lib/streaks';

const DEFAULT_WEEKLY_GOAL = 4;

async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/**
 * Practice streak across training sessions and rounds.
 *
 * `date` is the golfer's local YYYY-MM-DD; see convex/sessions.ts for why the
 * client supplies it rather than the server deriving one.
 */
export const getStreakData = query({
  args: { profileId: v.id('golferProfiles'), date: v.string() },
  handler: async (ctx, args): Promise<StreakSummary & { weeklyGoal: number }> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new ConvexError({ message: 'Invalid date', code: 'BAD_REQUEST' });
    }

    const empty = {
      ...summarizeStreak([], args.date),
      weeklyGoal: DEFAULT_WEEKLY_GOAL,
    };

    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return empty;

    // Bounded: a 90-day program with a handful of sessions a day, plus rounds.
    const [sessions, rounds] = await Promise.all([
      ctx.db
        .query('trainingSessions')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(600),
      ctx.db
        .query('roundScores')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(400),
    ]);

    // summarizeStreak normalises both shapes - trainingSessions store a plain
    // date, roundScores a full ISO timestamp.
    const dates = [...sessions.map((s) => s.date), ...rounds.map((r) => r.date)];

    return {
      ...summarizeStreak(dates, args.date),
      weeklyGoal: owned.profile.weeklyGoal ?? DEFAULT_WEEKLY_GOAL,
    };
  },
});

/** Target practice days per week, clamped to a real week. */
export const setWeeklyGoal = mutation({
  args: { profileId: v.id('golferProfiles'), goal: v.number() },
  handler: async (ctx, args): Promise<void> => {
    // The original checked only that someone was signed in, so any user could
    // rewrite another golfer's goal.
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    await ctx.db.patch(args.profileId, {
      weeklyGoal: Math.max(1, Math.min(7, Math.round(args.goal))),
    });
  },
});
