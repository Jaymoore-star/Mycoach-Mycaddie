import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';
import { PHASE_ORDER, type Phase } from './lib/curriculum';
import { getDayInPhase } from './lib/program';
import { getSkillTest, gradeSkillTest } from './lib/skillTests';

const PHASE_VALIDATOR = v.union(
  v.literal('putting'),
  v.literal('short_game'),
  v.literal('pitching'),
  v.literal('mid_irons'),
  v.literal('hybrids_woods'),
  v.literal('driver'),
);

async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/** Week within the current phase, 1-3. Each phase runs 15 days. */
function weekInPhase(currentDay: number, phase: Phase): number {
  return Math.min(3, Math.max(1, Math.ceil(getDayInPhase(currentDay, phase) / 5)));
}

/**
 * The test for the golfer's current phase and week, with their level's
 * thresholds resolved and any previous attempt attached.
 */
export const getCurrentTest = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return null;

    const { profile } = owned;
    const week = weekInPhase(profile.currentDay, profile.currentPhase);
    const test = getSkillTest(profile.currentPhase, week);

    const previous = await ctx.db
      .query('skillsTests')
      .withIndex('by_profile_week', (q) =>
        q.eq('profileId', args.profileId).eq('weekNumber', week),
      )
      .order('desc')
      .take(10);

    // Only attempts at this phase count; week numbers repeat across phases.
    const attempts = previous.filter((t) => t.phase === profile.currentPhase);

    return {
      test,
      week,
      skillLevel: profile.skillLevel,
      // Resolve each challenge's requirement for this golfer so the UI does
      // not have to know the threshold table.
      requirements: test.challenges.map((c) => ({
        challengeId: c.id,
        required: c.requiredPasses[profile.skillLevel],
        totalAttempts: c.totalAttempts,
      })),
      lastAttempt: attempts[0] ?? null,
      attemptCount: attempts.length,
      bestScore: attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null,
      passed: attempts.some((a) => a.overallPass),
    };
  },
});

/** Grades and stores an attempt. */
export const submitSkillTest = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    phase: PHASE_VALIDATOR,
    week: v.number(),
    /** The golfer's local YYYY-MM-DD - see convex/sessions.ts. */
    date: v.string(),
    results: v.array(
      v.object({
        challengeId: v.string(),
        passes: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new ConvexError({ message: 'Invalid date', code: 'BAD_REQUEST' });
    }

    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    const week = Math.min(3, Math.max(1, Math.round(args.week)));
    const test = getSkillTest(args.phase, week);

    // Grading happens here, never on the client: the score gates phase
    // progression, so a modified client must not be able to set it.
    const graded = gradeSkillTest(test.challenges, args.results, owned.profile.skillLevel);

    const id = await ctx.db.insert('skillsTests', {
      userId: owned.userId,
      profileId: args.profileId,
      phase: args.phase,
      weekNumber: week,
      date: args.date,
      results: graded.challengeResults.map((c) => ({
        drill: c.name,
        attempts: c.totalAttempts,
        passed: c.passes,
        threshold: `${c.required} of ${c.totalAttempts}`,
      })),
      overallPass: graded.overallPass,
      score: graded.score,
      coachFeedback: graded.feedback,
    });

    return { id, ...graded };
  },
});

export const getSkillsTests = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('skillsTests')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(50);
  },
});

/** Best attempt per phase, for the progress ladder. */
export const getBestTestPerPhase = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    const tests = await ctx.db
      .query('skillsTests')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(200);

    return PHASE_ORDER.map((phase) => {
      const forPhase = tests.filter((t) => t.phase === phase);
      const best = forPhase.reduce<(typeof forPhase)[number] | null>(
        (acc, t) => (acc === null || t.score > acc.score ? t : acc),
        null,
      );

      return {
        phase,
        attempts: forPhase.length,
        bestScore: best?.score ?? null,
        passed: forPhase.some((t) => t.overallPass),
        lastDate: forPhase[0]?.date ?? null,
      };
    });
  },
});
