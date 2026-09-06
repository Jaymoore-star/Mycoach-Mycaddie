/**
 * Launch monitor sessions and shots (Garmin R10 and similar).
 *
 * Note on the port: the original checked only that *a* user was signed in for
 * several of these, and `getClubAverages` checked nothing at all — a guessed
 * profileId exposed or deleted another golfer's data. Every function here
 * verifies the record belongs to the caller.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';

const SHOT_SHAPE = v.union(
  v.literal('straight'),
  v.literal('draw'),
  v.literal('fade'),
  v.literal('hook'),
  v.literal('slice'),
  v.literal('push'),
  v.literal('pull'),
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

async function ownedSession(ctx: MutationCtx, sessionId: Id<'launchSessions'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId) {
    throw new ConvexError({ message: 'Session not found', code: 'NOT_FOUND' });
  }
  return { userId, session };
}

/** Recompute the denormalised averages stored on the session row. */
async function recomputeSessionStats(ctx: MutationCtx, sessionId: Id<'launchSessions'>) {
  const shots = await ctx.db
    .query('launchShots')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .collect();

  const mean = (values: number[]) =>
    values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : undefined;

  const pick = (get: (s: (typeof shots)[number]) => number | undefined) =>
    shots.map(get).filter((n): n is number => n != null);

  await ctx.db.patch(sessionId, {
    shotCount: shots.length,
    avgCarryYards: mean(pick((s) => s.carryYards)),
    avgBallSpeedMph: mean(pick((s) => s.ballSpeedMph)),
    avgSmashFactor: mean(pick((s) => s.smashFactor)),
    avgSpinRpm: mean(pick((s) => s.spinRpm)),
  });
}

export const listSessions = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    return await ctx.db
      .query('launchSessions')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(50);
  },
});

export const getSession = query({
  args: { sessionId: v.id('launchSessions') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) return null;
    return session;
  },
});

export const getShots = query({
  args: { sessionId: v.id('launchSessions') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) return [];

    return await ctx.db
      .query('launchShots')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();
  },
});

/** Per-club averages across every logged launch-monitor shot. */
export const getClubAverages = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    const shots = await ctx.db
      .query('launchShots')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .take(2000);

    type Group = {
      carry: number[];
      total: number[];
      ballSpeed: number[];
      clubSpeed: number[];
      smash: number[];
      spin: number[];
      launch: number[];
    };

    const byClub: Record<string, Group> = {};

    for (const s of shots) {
      const g = (byClub[s.club] ??= {
        carry: [],
        total: [],
        ballSpeed: [],
        clubSpeed: [],
        smash: [],
        spin: [],
        launch: [],
      });
      if (s.carryYards != null) g.carry.push(s.carryYards);
      if (s.totalYards != null) g.total.push(s.totalYards);
      if (s.ballSpeedMph != null) g.ballSpeed.push(s.ballSpeedMph);
      if (s.clubSpeedMph != null) g.clubSpeed.push(s.clubSpeedMph);
      if (s.smashFactor != null) g.smash.push(s.smashFactor);
      if (s.spinRpm != null) g.spin.push(s.spinRpm);
      if (s.launchAngleDeg != null) g.launch.push(s.launchAngleDeg);
    }

    const mean = (a: number[]) =>
      a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : undefined;

    return Object.entries(byClub).map(([club, g]) => ({
      club,
      shotCount: Math.max(g.carry.length, g.ballSpeed.length),
      avgCarry: mean(g.carry),
      avgTotal: mean(g.total),
      avgBallSpeed: mean(g.ballSpeed),
      avgClubSpeed: mean(g.clubSpeed),
      avgSmash: mean(g.smash),
      avgSpin: mean(g.spin),
      avgLaunch: mean(g.launch),
    }));
  },
});

export const createSession = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    date: v.string(),
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
    club: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'launchSessions'>> => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });

    return await ctx.db.insert('launchSessions', {
      userId: owned.userId,
      profileId: args.profileId,
      date: args.date,
      label: args.label,
      notes: args.notes,
      club: args.club,
      shotCount: 0,
    });
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id('launchSessions') },
  handler: async (ctx, args): Promise<void> => {
    await ownedSession(ctx, args.sessionId);

    const shots = await ctx.db
      .query('launchShots')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();

    for (const s of shots) await ctx.db.delete(s._id);
    await ctx.db.delete(args.sessionId);
  },
});

export const addShot = mutation({
  args: {
    sessionId: v.id('launchSessions'),
    club: v.string(),
    carryYards: v.optional(v.number()),
    totalYards: v.optional(v.number()),
    ballSpeedMph: v.optional(v.number()),
    clubSpeedMph: v.optional(v.number()),
    smashFactor: v.optional(v.number()),
    spinRpm: v.optional(v.number()),
    launchAngleDeg: v.optional(v.number()),
    shotShape: v.optional(SHOT_SHAPE),
    contactType: v.optional(CONTACT_TYPE),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // profileId comes from the session rather than the client, so a shot can
    // never be filed against someone else's profile.
    const { userId, session } = await ownedSession(ctx, args.sessionId);

    await ctx.db.insert('launchShots', {
      ...args,
      userId,
      profileId: session.profileId,
    });

    await recomputeSessionStats(ctx, args.sessionId);
  },
});

export const deleteShot = mutation({
  args: { shotId: v.id('launchShots') },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const shot = await ctx.db.get(args.shotId);
    if (!shot || shot.userId !== userId) {
      throw new ConvexError({ message: 'Shot not found', code: 'NOT_FOUND' });
    }

    await ctx.db.delete(args.shotId);
    await recomputeSessionStats(ctx, shot.sessionId);
  },
});
