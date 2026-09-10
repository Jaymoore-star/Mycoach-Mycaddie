import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type QueryCtx, query } from './_generated/server';
import { toDateOnly } from './lib/streaks';

async function ownedProfile(ctx: QueryCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/** Full shot history, for trend analysis and export. */
export const getFullShotHistory = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('shotLogs')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(500);
  },
});

/** Full round history, for trend analysis and export. */
export const getFullRoundHistory = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('roundScores')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(100);
  },
});

export const getFullSkillsTests = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('skillsTests')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(100);
  },
});

/**
 * Long-range performance summary for My Analytics.
 *
 * Aggregated on the server rather than shipping 500 shots to the phone to be
 * reduced there.
 */
export const getPerformanceSummary = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return null;

    const [rounds, sessions, shots] = await Promise.all([
      ctx.db
        .query('roundScores')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(100),
      ctx.db
        .query('trainingSessions')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(600),
      ctx.db
        .query('shotLogs')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(500),
    ]);

    const fullRounds = rounds.filter((r) => r.holes.length >= 18);

    // Scoring trend, oldest first, so a chart can plot it directly.
    const scoringTrend = [...fullRounds]
      .reverse()
      .map((r) => ({
        date: toDateOnly(r.date),
        score: r.totalScore,
        toPar: r.scoreDifferential,
        courseName: r.courseName,
      }));

    const allHoles = fullRounds.flatMap((r) => r.holes);
    const withFairway = allHoles.filter((h) => h.fairwayHit !== undefined);
    const withGir = allHoles.filter((h) => h.girHit !== undefined);

    const totalPutts = allHoles.reduce((sum, h) => sum + h.putts, 0);

    // Strokes by par, showing where shots are actually lost.
    const byPar: Record<number, { holes: number; over: number }> = {};
    for (const h of allHoles) {
      const bucket = (byPar[h.par] ??= { holes: 0, over: 0 });
      bucket.holes++;
      bucket.over += h.score - h.par;
    }

    const practiceDays = new Set(sessions.map((s) => toDateOnly(s.date))).size;
    const completedSessions = sessions.filter((s) => s.sessionComplete).length;

    return {
      roundsPlayed: fullRounds.length,
      avgScore:
        fullRounds.length > 0
          ? Math.round(
              (fullRounds.reduce((sum, r) => sum + r.totalScore, 0) / fullRounds.length) * 10,
            ) / 10
          : null,
      bestScore: fullRounds.length > 0 ? Math.min(...fullRounds.map((r) => r.totalScore)) : null,
      scoringTrend,
      fairwayPct:
        withFairway.length > 0
          ? Math.round((withFairway.filter((h) => h.fairwayHit).length / withFairway.length) * 100)
          : null,
      girPct:
        withGir.length > 0
          ? Math.round((withGir.filter((h) => h.girHit).length / withGir.length) * 100)
          : null,
      puttsPerRound:
        fullRounds.length > 0 ? Math.round((totalPutts / fullRounds.length) * 10) / 10 : null,
      strokesByPar: Object.entries(byPar)
        .map(([par, v]) => ({
          par: Number(par),
          holes: v.holes,
          avgOverPar: Math.round((v.over / v.holes) * 100) / 100,
        }))
        .sort((a, b) => a.par - b.par),
      practiceDays,
      completedSessions,
      shotsLogged: shots.length,
    };
  },
});
