import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

/**
 * Development helpers.
 *
 * These are `internalMutation`s on purpose: internal functions are NOT callable
 * from any client, only from the Convex dashboard or `npx convex run`, both of
 * which require deployment admin credentials. Exposing a gate-reset as a public
 * mutation would let anyone bypass the one-day-per-day rule.
 */

/** Unlocks today's drills again by clearing the advance gate. */
export const resetDailyGate = internalMutation({
  args: {
    profileId: v.id('golferProfiles'),
    /** When given, today's sessions for this date are deleted too. */
    clearSessionsOn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error('Profile not found');

    await ctx.db.patch(args.profileId, { lastAdvancedDate: undefined });

    let deleted = 0;
    if (args.clearSessionsOn) {
      const sessions = await ctx.db
        .query('trainingSessions')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .collect();

      // Only the session for the day the golfer is currently on - earlier
      // days' practice history is left untouched.
      for (const s of sessions) {
        if (s.date === args.clearSessionsOn && s.day === profile.currentDay) {
          await ctx.db.delete(s._id);
          deleted++;
        }
      }
    }

    return {
      displayName: profile.displayName,
      currentDay: profile.currentDay,
      gateCleared: true,
      sessionsDeleted: deleted,
    };
  },
});
