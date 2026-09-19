/**
 * Builds a demo golfer with a real playing history.
 *
 * A freshly signed-up account is correct and completely empty: Stats,
 * Analytics, My Handicap, My Bag and My Streak all render zeros, which is the
 * worst possible first look at an app whose whole argument is that it learns
 * what you do. This fills one account with a coherent five months of golf so
 * every screen has something to show.
 *
 * `internalMutation`, like everything in `devTools.ts`: internal functions are
 * not callable from any client, only from the dashboard or `npx convex run`,
 * both of which need deployment admin credentials.
 *
 *     npx convex run seed:demoGolfer '{"email":"demo@dominusgolf.com"}'
 *
 * Everything it writes is deterministic - the same email and the same `today`
 * produce byte-identical rows - and it clears its own previous output first, so
 * running it twice leaves one demo golfer rather than two overlapping ones.
 */
import { createAccount } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { BAG_ORDER } from './lib/bag';
import { COURSE_LIBRARY, getCourseById, type GolfCourse } from './lib/courses';
import { getPhaseForDay } from './lib/program';
import { handicapIndex, scoreDifferential } from './lib/handicap';

// ─── Determinism ─────────────────────────────────────────────────────────────

/**
 * A small seeded generator, so a demo built today looks like the one built
 * yesterday. `Math.random()` would give a different handicap on every run, and
 * a demo that changes under you is not one you can rehearse against.
 */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** `days` before `today`, as a local YYYY-MM-DD. */
function daysBefore(today: string, days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

/** The same, as the full ISO timestamp the round and video tables store. */
function timestampBefore(today: string, days: number, hour = 9): string {
  const at = new Date(Date.parse(`${today}T00:00:00Z`) - days * DAY_MS);
  at.setUTCHours(hour, 15, 0, 0);
  return at.toISOString();
}

// ─── The golfer ──────────────────────────────────────────────────────────────

/** Day 24 of 90 puts them mid short-game phase: past the start, far from done. */
const PROGRAM_DAY = 24;
const CURRENT_STREAK_DAYS = 38;
const ROUNDS = 12;

/** Carry distances for a mid-handicap golfer, in yards. */
const CARRY: Record<string, number> = {
  Driver: 248,
  '3-Wood': 225,
  '5-Wood': 210,
  Hybrid: 196,
  '4-Iron': 184,
  '5-Iron': 173,
  '6-Iron': 162,
  '7-Iron': 150,
  '8-Iron': 138,
  '9-Iron': 125,
  PW: 112,
  GW: 98,
  SW: 82,
  LW: 64,
};

/** The courses the demo golfer has played, newest round first. */
const PLAYED = [
  'pebble-beach',
  'torrey-pines-south',
  'harbour-town',
  'bandon-dunes',
  'tpc-sawgrass',
  'shadow-creek',
  'bay-hill',
  'muirfield-village',
  'riviera',
  'whistling-straits',
  'erin-hills',
  'kiawah-ocean',
];

type Rand = () => number;

/** A weighted pick, so misses favour the golfer's real tendency. */
function pick<T>(rand: Rand, options: readonly T[]): T {
  return options[Math.floor(rand() * options.length)];
}

/**
 * One round's 18 holes for a golfer of roughly this handicap.
 *
 * Scoring is built off par and stroke index rather than drawn flat: the
 * hardest holes give up the most shots, which is what makes the scorecard, the
 * strokes-gained view and the hole-by-hole breakdown look like golf rather than
 * like noise.
 *
 * The rates are set so the record lands in the low teens once WHS has taken
 * the best 4 of 12 - the library is all championship courses rated 73 to 77,
 * so a round has to be around +19 for the differential to read as a 13. Scores
 * that felt right in isolation produced a 6.9 index, which is not the golfer
 * this demo is meant to be.
 */
function playRound(course: GolfCourse, rand: Rand, formShift: number) {
  return course.holes.map((h) => {
    // Harder holes (low stroke index) cost more. 0 at SI 18, ~1 at SI 1.
    const difficulty = (19 - h.strokeIndex) / 18;
    const roll = rand();
    let over = 0;

    const bogeyChance = 0.44 + difficulty * 0.26 + formShift;
    const doubleChance = 0.1 + difficulty * 0.2 + formShift;
    const birdieChance = 0.035 - difficulty * 0.02 - formShift;

    if (roll < birdieChance) over = -1;
    else if (roll < birdieChance + doubleChance) over = 2;
    else if (roll < birdieChance + doubleChance + bogeyChance) over = 1;

    const score = h.par + over;
    // Two putts is the default; a birdie usually means one, a double often three.
    const putts = over <= -1 ? 1 : over >= 2 && rand() < 0.45 ? 3 : 2;
    const girHit = over <= 0 || (over === 1 && putts === 3);

    return {
      hole: h.hole,
      par: h.par,
      score,
      putts,
      // A par 3 is hit from the tee, so fairways are not counted on them.
      fairwayHit: h.par === 3 ? undefined : rand() < 0.55 - difficulty * 0.1,
      girHit,
      distanceToPin: h.yards.regular,
      pinSide: pick(rand, ['left', 'center', 'right'] as const),
      pinDepth: pick(rand, ['front', 'middle', 'back'] as const),
    };
  });
}

export const demoGolfer = internalMutation({
  args: {
    /** The account to fill. Sign up in the app first, then run this. */
    email: v.string(),
    /** Local date the history should end on. Defaults to the server's date. */
    today: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const today = args.today ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      throw new Error(`today must be YYYY-MM-DD, got ${today}`);
    }

    // Emails are stored lower-cased by the auth callback, so the lookup has
    // to match that or a mixed-case argument finds nothing.
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', email))
      .first();
    if (!user) {
      throw new Error(
        `No account for ${email}. Sign up in the app with that address first, or use seed:demoAccount to create it.`,
      );
    }

    const rand = makeRandom(hashString(`${email}:${today}`));
    const userId = user._id;

    // ── Profile ──────────────────────────────────────────────────────────────
    const existing = await ctx.db
      .query('golferProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    const profileFields = {
      userId,
      displayName: args.displayName ?? user.name ?? 'Jordan Ellis',
      skillLevel: 'intermediate' as const,
      currentDay: PROGRAM_DAY,
      currentPhase: getPhaseForDay(PROGRAM_DAY),
      programStartDate: timestampBefore(today, PROGRAM_DAY + 9),
      // Yesterday, so the demo can advance a day live without the gate refusing.
      lastAdvancedDate: daysBefore(today, 1),
      targetScore: 80,
      weeklyTasksCompleted: [],
      onboardingComplete: true,
      coachId: 'mason' as const,
      weeklyGoal: 4,
      tourPureActive: true,
      clubDistances: Object.fromEntries(
        BAG_ORDER.filter((c) => c !== 'Putter').map((club) => [
          club,
          { carry: CARRY[club], total: Math.round(CARRY[club] * 1.07), manual: false },
        ]),
      ),
    };

    const profileId: Id<'golferProfiles'> = existing
      ? (await ctx.db.patch(existing._id, profileFields), existing._id)
      : await ctx.db.insert('golferProfiles', profileFields);

    // ── Clear anything a previous run left ───────────────────────────────────
    const wipe = async (
      table: 'trainingSessions' | 'shotLogs' | 'skillsTests' | 'roundScores' | 'launchSessions',
    ) => {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_profile', (q) => q.eq('profileId', profileId))
        .collect();
      await Promise.all(rows.map((r: Doc<typeof table>) => ctx.db.delete(r._id)));
      return rows.length;
    };

    const oldShots = await ctx.db
      .query('launchShots')
      .withIndex('by_profile', (q) => q.eq('profileId', profileId))
      .collect();
    await Promise.all(oldShots.map((s) => ctx.db.delete(s._id)));
    for (const table of [
      'trainingSessions',
      'shotLogs',
      'skillsTests',
      'roundScores',
      'launchSessions',
    ] as const) {
      await wipe(table);
    }

    // ── Rounds ───────────────────────────────────────────────────────────────
    // Spread back over about five months, closing up towards today so the
    // handicap trend has something to slope against.
    const roundGaps = [3, 11, 19, 26, 34, 45, 58, 71, 85, 99, 116, 134];
    const differentials: number[] = [];

    for (let i = 0; i < ROUNDS; i += 1) {
      const course = getCourseById(PLAYED[i % PLAYED.length]) ?? COURSE_LIBRARY[0];
      // Gentle improvement: the older the round, the worse the form.
      const formShift = 0.055 * (i / (ROUNDS - 1));
      const holes = playRound(course, rand, formShift);

      const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
      const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
      const rating = course.rating.regular;
      const slope = course.slope.regular;
      const differential = scoreDifferential(totalScore, rating, slope);
      differentials.push(differential);

      await ctx.db.insert('roundScores', {
        userId,
        profileId,
        date: timestampBefore(today, roundGaps[i], 8),
        courseName: course.name,
        courseId: course.id,
        teeBox: 'regular',
        courseConditions: pick(rand, ['Firm', 'Soft', 'Normal']),
        weatherConditions: pick(rand, ['Clear', 'Overcast', 'Breezy', 'Light rain']),
        windMph: Math.round(4 + rand() * 12),
        temperature: Math.round(58 + rand() * 24),
        courseRating: rating,
        courseSlope: slope,
        totalScore,
        totalPar,
        scoreDifferential: differential,
        holes,
      });
    }

    // ── Practice sessions: an unbroken streak up to today ────────────────────
    let sessionCount = 0;
    for (let back = CURRENT_STREAK_DAYS - 1; back >= 0; back -= 1) {
      const day = Math.max(1, PROGRAM_DAY - Math.floor(back / 2));
      const phase = getPhaseForDay(day);
      const tasksTotal = 4;
      const complete = rand() < 0.82;

      await ctx.db.insert('trainingSessions', {
        userId,
        profileId,
        day,
        phase,
        date: daysBefore(today, back),
        tasksCompleted: Array.from(
          { length: complete ? tasksTotal : 1 + Math.floor(rand() * 3) },
          (_, t) => `task-${t + 1}`,
        ),
        tasksTotal,
        sessionComplete: complete,
        sessionType: 'practice',
      });
      sessionCount += 1;
    }

    // ── Range shots ──────────────────────────────────────────────────────────
    const SHAPES = ['straight', 'draw', 'fade', 'push', 'pull', 'slice'] as const;
    const CONTACT = ['solid', 'solid', 'solid', 'thin', 'fat', 'toe', 'heel'] as const;
    const clubsInPlay = BAG_ORDER.filter((c) => c !== 'Putter');

    let shotCount = 0;
    for (let back = 0; back < 42; back += 1) {
      if (rand() < 0.45) continue; // not every day is a range day
      const date = daysBefore(today, back);

      for (let n = 0; n < 6; n += 1) {
        const club = pick(rand, clubsInPlay);
        const target = CARRY[club];
        // Dispersion widens with club length, as it does in real hands.
        const spread = target * (club === 'Driver' ? 0.09 : 0.06);
        const actual = Math.round(target + (rand() - 0.5) * 2 * spread);
        const offline = Math.round((rand() - 0.5) * 2 * (target * 0.07));

        await ctx.db.insert('shotLogs', {
          userId,
          profileId,
          sessionType: 'practice',
          date,
          club,
          targetDistanceYards: target,
          actualDistanceYards: actual,
          distanceFromTargetYards: Math.abs(actual - target) + Math.abs(offline),
          shotShape: pick(rand, SHAPES),
          ballFlight: pick(rand, ['penetrating', 'mid', 'high', 'low'] as const),
          missDirection: pick(rand, ['left', 'right', 'short', 'long', 'center'] as const),
          carryYards: actual,
          totalYards: Math.round(actual * 1.07),
          contactType: pick(rand, CONTACT),
          lieType: 'range mat',
        });
        shotCount += 1;
      }
    }

    // ── Skills tests: two phase gates already passed ─────────────────────────
    const SKILLS: {
      phase: string;
      weekNumber: number;
      back: number;
      score: number;
      results: { drill: string; attempts: number; passed: number; threshold: string }[];
      coachFeedback: string;
    }[] = [
      {
        phase: 'putting',
        weekNumber: 2,
        back: 44,
        score: 78,
        results: [
          { drill: '3-foot circle', attempts: 20, passed: 18, threshold: '16 of 20' },
          { drill: '6-foot ladder', attempts: 15, passed: 11, threshold: '9 of 15' },
          { drill: 'Lag to 3 feet', attempts: 12, passed: 9, threshold: '8 of 12' },
        ],
        coachFeedback:
          'Short putting is genuinely solid now - you cleared the 3-foot gate with room. Lag speed is the weak link: nine of twelve inside three feet is a pass, not a strength. Keep the ladder drill in the warm-up.',
      },
      {
        phase: 'short_game',
        weekNumber: 4,
        back: 16,
        score: 71,
        results: [
          { drill: 'Chip to 6 feet', attempts: 20, passed: 14, threshold: '12 of 20' },
          { drill: 'Bunker out and on', attempts: 15, passed: 10, threshold: '9 of 15' },
          { drill: 'Flop over the bag', attempts: 10, passed: 6, threshold: '5 of 10' },
        ],
        coachFeedback:
          'Passed, and it was closer than the score makes it look. The bunker number is the one to watch - ten of fifteen out and on will not survive a firmer lie. More reps from a buried lie before the pitching phase.',
      },
    ];

    for (const test of SKILLS) {
      await ctx.db.insert('skillsTests', {
        userId,
        profileId,
        phase: test.phase,
        weekNumber: test.weekNumber,
        date: timestampBefore(today, test.back, 17),
        results: test.results,
        overallPass: true,
        score: test.score,
        coachFeedback: test.coachFeedback,
      });
    }

    // ── Launch monitor sessions ──────────────────────────────────────────────
    const LAUNCH = [
      { club: 'Driver', label: 'Driver work', back: 5, shots: 14 },
      { club: '7-Iron', label: 'Iron session', back: 13, shots: 16 },
      { club: 'Driver', label: 'Speed session', back: 27, shots: 12 },
    ];

    let launchShotCount = 0;
    for (const session of LAUNCH) {
      const target = CARRY[session.club];
      const shots = Array.from({ length: session.shots }, () => {
        const carry = Math.round(target + (rand() - 0.5) * target * 0.1);
        const ballSpeed = Math.round(carry * 0.66 + rand() * 4);
        const clubSpeed = Math.round(ballSpeed / 1.44);
        return {
          carryYards: carry,
          totalYards: Math.round(carry * 1.07),
          ballSpeedMph: ballSpeed,
          clubSpeedMph: clubSpeed,
          smashFactor: Math.round((ballSpeed / clubSpeed) * 100) / 100,
          spinRpm: Math.round(
            (session.club === 'Driver' ? 2600 : 6400) + (rand() - 0.5) * 900,
          ),
          launchAngleDeg:
            Math.round(((session.club === 'Driver' ? 13.5 : 19) + (rand() - 0.5) * 4) * 10) / 10,
          shotShape: pick(rand, SHAPES),
          contactType: pick(rand, CONTACT),
        };
      });

      const mean = (get: (s: (typeof shots)[number]) => number) =>
        Math.round((shots.reduce((sum, s) => sum + get(s), 0) / shots.length) * 100) / 100;

      const sessionId = await ctx.db.insert('launchSessions', {
        userId,
        profileId,
        date: timestampBefore(today, session.back, 15),
        label: session.label,
        club: session.club,
        shotCount: shots.length,
        avgCarryYards: mean((s) => s.carryYards),
        avgBallSpeedMph: mean((s) => s.ballSpeedMph),
        avgSmashFactor: mean((s) => s.smashFactor),
        avgSpinRpm: mean((s) => s.spinRpm),
      });

      for (const shot of shots) {
        await ctx.db.insert('launchShots', {
          userId,
          profileId,
          sessionId,
          club: session.club,
          ...shot,
        });
        launchShotCount += 1;
      }
    }

    // What My Handicap will actually display. Computed with the app's own WHS
    // implementation rather than a second one here - for a 12-round record
    // Rule 5.2a averages the best 4, and a hand-rolled "best 8" reported a
    // different number from the one the screen would show.
    const rounds = await ctx.db
      .query('roundScores')
      .withIndex('by_profile', (q) => q.eq('profileId', profileId))
      .collect();

    const index = handicapIndex([...differentials].reverse());
    const scoringAvg =
      Math.round((rounds.reduce((s, r) => s + r.totalScore, 0) / rounds.length) * 10) / 10;

    await ctx.db.patch(profileId, {
      ...(index === null ? {} : { handicap: index }),
      scoringAvg,
    });

    return {
      profileId,
      displayName: profileFields.displayName,
      handicapIndex: index,
      scoringAvg,
      rounds: ROUNDS,
      practiceSessions: sessionCount,
      rangeShots: shotCount,
      launchSessions: LAUNCH.length,
      launchShots: launchShotCount,
      skillsTests: SKILLS.length,
      streakDays: CURRENT_STREAK_DAYS,
      programDay: PROGRAM_DAY,
    };
  },
});

/**
 * Creates the demo account and fills it, in one command.
 *
 * `demoGolfer` attaches to an account that already exists, which meant signing
 * up by hand on a phone before every reset. This does both, so setting up a
 * demo deployment is:
 *
 *     npx convex run devTools:resetDeployment '{"confirm":"..."}' --prod
 *     npx convex run seed:demoAccount '{"email":"demo@dominusgolf.com","password":"..."}' --prod
 *
 * An action rather than a mutation because `createAccount` needs an action
 * context - it hashes the password with the Password provider's own crypto,
 * so the account it makes is one the sign-in screen can really sign into.
 *
 * Safe to re-run: an account that already exists is reused rather than
 * rejected, and `demoGolfer` clears its own previous output.
 */
export const demoAccount = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    today: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ created: boolean; summary: unknown }> => {
    const email = args.email.trim().toLowerCase();

    if (args.password.length < 8) {
      // The sign-in screen enforces this too; failing here rather than
      // creating an account nobody can log into from the app.
      throw new Error('Password must be at least 8 characters.');
    }

    // Asked first, rather than creating and catching: `createAccount` returns
    // the existing account instead of throwing when one is already there, so a
    // try/catch cannot tell the two apart and always reported "created".
    const already = await ctx.runQuery(internal.seed.userByEmail, { email });

    if (!already) {
      await createAccount(ctx, {
        provider: 'password',
        account: { id: email, secret: args.password },
        profile: { email },
      });
    }

    const summary = await ctx.runMutation(internal.seed.demoGolfer, {
      email,
      ...(args.today ? { today: args.today } : {}),
      ...(args.displayName ? { displayName: args.displayName } : {}),
    });

    return { created: !already, summary };
  },
});

/** Whether an account already exists for this address. Used by `demoAccount`. */
export const userByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) =>
    (await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', args.email.trim().toLowerCase()))
      .first()) !== null,
});
