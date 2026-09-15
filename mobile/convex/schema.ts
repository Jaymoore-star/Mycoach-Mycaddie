import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Ported from the Hercules web app (`reference/convex/schema.ts`).
 *
 * The one change: that app defined its own `users` table keyed by
 * `tokenIdentifier` for Hercules auth. Convex Auth supplies `users` (plus its
 * session/account tables) via `authTables`, so the hand-rolled table is gone.
 * Everything referencing `v.id("users")` still resolves correctly.
 */
export default defineSchema({
  ...authTables,

  // Golfer profile with program details
  golferProfiles: defineTable({
    userId: v.id('users'),
    displayName: v.string(),
    skillLevel: v.union(
      v.literal('beginner'),
      v.literal('intermediate'),
      v.literal('advanced'),
      v.literal('scratch'),
      v.literal('tour_pro'),
    ),
    handicap: v.optional(v.number()),
    currentDay: v.number(), // 1-90
    currentPhase: v.union(
      v.literal('putting'),
      v.literal('short_game'),
      v.literal('pitching'),
      v.literal('mid_irons'),
      v.literal('hybrids_woods'),
      v.literal('driver'),
    ),
    programStartDate: v.string(), // ISO
    /**
     * Local YYYY-MM-DD of the last program-day advance. Enforces one day per
     * calendar day so the 90-day program cannot be completed in an afternoon.
     * Optional because profiles created before this rule existed have none.
     */
    lastAdvancedDate: v.optional(v.string()),
    scoringAvg: v.optional(v.number()),
    targetScore: v.number(), // 80
    weeklyTasksCompleted: v.array(v.string()),
    onboardingComplete: v.boolean(),
    coachId: v.optional(
      v.union(v.literal('que'), v.literal('mason'), v.literal('sam'), v.literal('dom')),
    ),
    weeklyGoal: v.optional(v.number()), // target practice sessions per week
    // Hardware state: Tour Pure Training System active vs. standard clubs
    tourPureActive: v.optional(v.boolean()),
    // Personal club distance profile - overrides generic defaults in caddie
    clubDistances: v.optional(
      v.record(
        v.string(),
        v.object({
          carry: v.number(),
          total: v.number(),
          manual: v.boolean(),
          brand: v.optional(v.string()),
        }),
      ),
    ),
  }).index('by_user', ['userId']),

  // Daily training sessions
  trainingSessions: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    day: v.number(),
    phase: v.string(),
    date: v.string(), // ISO
    tasksCompleted: v.array(v.string()),
    tasksTotal: v.number(),
    sessionComplete: v.boolean(),
    coachNotes: v.optional(v.string()),
    sessionType: v.union(v.literal('practice'), v.literal('skills_test'), v.literal('round')),
  })
    .index('by_profile', ['profileId'])
    .index('by_profile_day', ['profileId', 'day'])
    .index('by_user_date', ['userId', 'date']),

  // Shot data from launch monitor / range finder
  shotLogs: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    sessionId: v.optional(v.id('trainingSessions')),
    sessionType: v.union(v.literal('practice'), v.literal('skills_test'), v.literal('round')),
    date: v.string(),
    club: v.string(),
    targetDistanceYards: v.number(),
    actualDistanceYards: v.number(),
    distanceFromTargetYards: v.number(),
    shotShape: v.union(
      v.literal('straight'),
      v.literal('draw'),
      v.literal('fade'),
      v.literal('hook'),
      v.literal('slice'),
      v.literal('push'),
      v.literal('pull'),
    ),
    ballFlight: v.union(
      v.literal('penetrating'),
      v.literal('mid'),
      v.literal('high'),
      v.literal('low'),
    ),
    missDirection: v.optional(
      v.union(
        v.literal('left'),
        v.literal('right'),
        v.literal('short'),
        v.literal('long'),
        v.literal('center'),
      ),
    ),
    // Launch monitor data (optional)
    carryYards: v.optional(v.number()),
    totalYards: v.optional(v.number()),
    ballSpeedMph: v.optional(v.number()),
    clubSpeedMph: v.optional(v.number()),
    smashFactor: v.optional(v.number()),
    spinRpm: v.optional(v.number()),
    launchAngleDeg: v.optional(v.number()),
    // Contact quality
    contactType: v.optional(
      v.union(
        v.literal('solid'),
        v.literal('fat'),
        v.literal('thin'),
        v.literal('toe'),
        v.literal('heel'),
        v.literal('top'),
      ),
    ),
    // Context
    lieType: v.optional(v.string()), // fairway, rough, bunker, etc
    elevation: v.optional(v.number()), // yards up/down
    windSpeedMph: v.optional(v.number()),
    windDirection: v.optional(v.string()),
    // AI analysis
    aiInsight: v.optional(v.string()),
    skillTestResult: v.optional(v.union(v.literal('pass'), v.literal('fail'))),
  })
    .index('by_profile', ['profileId'])
    .index('by_session', ['sessionId']),

  // Skills test results
  skillsTests: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    phase: v.string(),
    weekNumber: v.number(),
    date: v.string(),
    results: v.array(
      v.object({
        drill: v.string(),
        attempts: v.number(),
        passed: v.number(),
        threshold: v.string(),
      }),
    ),
    overallPass: v.boolean(),
    score: v.number(), // 0-100
    coachFeedback: v.string(),
  })
    .index('by_profile', ['profileId'])
    .index('by_profile_week', ['profileId', 'weekNumber']),

  // Round scores (caddie mode)
  roundScores: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    date: v.string(),
    courseName: v.string(),
    courseId: v.optional(v.string()), // ID from course library
    teeBox: v.optional(
      v.union(v.literal('championship'), v.literal('regular'), v.literal('forward')),
    ),
    courseConditions: v.optional(v.string()),
    weatherConditions: v.optional(v.string()),
    windMph: v.optional(v.number()),
    temperature: v.optional(v.number()),
    courseRating: v.optional(v.number()), // WHS course rating (e.g. 74.3)
    courseSlope: v.optional(v.number()), // WHS slope rating (e.g. 137)
    totalScore: v.number(),
    totalPar: v.number(),
    scoreDifferential: v.number(),
    holes: v.array(
      v.object({
        hole: v.number(),
        par: v.number(),
        score: v.number(),
        putts: v.number(),
        fairwayHit: v.optional(v.boolean()),
        girHit: v.optional(v.boolean()),
        distanceToPin: v.optional(v.number()), // yards from tee or as entered on-course
        pinSide: v.optional(
          v.union(v.literal('left'), v.literal('center'), v.literal('right')),
        ),
        pinDepth: v.optional(
          v.union(v.literal('front'), v.literal('middle'), v.literal('back')),
        ),
        notes: v.optional(v.string()),
      }),
    ),
    caddieNotes: v.optional(v.string()),
  }).index('by_profile', ['profileId']),

  // User-added custom courses
  customCourses: defineTable({
    userId: v.id('users'),
    name: v.string(),
    location: v.string(),
    altitudeFt: v.number(),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    rating: v.object({ championship: v.number(), regular: v.number(), forward: v.number() }),
    slope: v.object({ championship: v.number(), regular: v.number(), forward: v.number() }),
    holes: v.array(
      v.object({
        hole: v.number(),
        par: v.union(v.literal(3), v.literal(4), v.literal(5)),
        strokeIndex: v.number(),
        yards: v.object({
          championship: v.number(),
          regular: v.number(),
          forward: v.number(),
        }),
      }),
    ),
  }).index('by_user', ['userId']),

  // Swing video recordings
  swingVideos: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    storageId: v.id('_storage'),
    label: v.string(), // e.g. "Driver", "7-iron", "Chip shot"
    notes: v.optional(v.string()),
    durationSeconds: v.number(),
    recordedAt: v.string(), // ISO timestamp
    linkedSessionId: v.optional(v.id('launchSessions')), // linked R10 session
    // Stills pulled off the clip on-device, in swing order. These are what the
    // vision model actually reads; without them analysis is club-level only.
    frameStorageIds: v.optional(v.array(v.id('_storage'))),
    // AI analysis fields
    aiFeedback: v.optional(
      v.object({
        summary: v.string(),
        strengths: v.array(v.string()),
        improvements: v.array(v.string()),
        drills: v.array(v.string()),
        analyzedAt: v.string(),
        // What the model could actually see, keyed to the point in the swing.
        observations: v.optional(
          v.array(v.object({ position: v.string(), detail: v.string() })),
        ),
        // 'video' when read from frames, 'club' when it is generic guidance.
        basis: v.optional(v.union(v.literal('video'), v.literal('club'))),
      }),
    ),
    aiAnalysisStatus: v.optional(
      v.union(v.literal('pending'), v.literal('done'), v.literal('error')),
    ),
  })
    .index('by_profile', ['profileId'])
    .index('by_user', ['userId']),

  // ── Launch monitor sessions (Garmin R10 / range sessions) ─────────────────
  launchSessions: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    date: v.string(), // ISO date
    label: v.optional(v.string()), // e.g. "Driver work", "Iron session"
    notes: v.optional(v.string()),
    club: v.optional(v.string()), // primary club of the session
    shotCount: v.number(), // denormalized count
    avgCarryYards: v.optional(v.number()),
    avgBallSpeedMph: v.optional(v.number()),
    avgSmashFactor: v.optional(v.number()),
    avgSpinRpm: v.optional(v.number()),
  })
    .index('by_profile', ['profileId'])
    .index('by_user_date', ['userId', 'date']),

  // Individual shots within a launch session
  launchShots: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    sessionId: v.id('launchSessions'),
    club: v.string(),
    // R10 primary metrics
    carryYards: v.optional(v.number()),
    totalYards: v.optional(v.number()),
    ballSpeedMph: v.optional(v.number()),
    clubSpeedMph: v.optional(v.number()),
    smashFactor: v.optional(v.number()),
    spinRpm: v.optional(v.number()),
    launchAngleDeg: v.optional(v.number()),
    // Shot shape
    shotShape: v.optional(
      v.union(
        v.literal('straight'),
        v.literal('draw'),
        v.literal('fade'),
        v.literal('hook'),
        v.literal('slice'),
        v.literal('push'),
        v.literal('pull'),
      ),
    ),
    // Contact
    contactType: v.optional(
      v.union(
        v.literal('solid'),
        v.literal('fat'),
        v.literal('thin'),
        v.literal('toe'),
        v.literal('heel'),
        v.literal('top'),
      ),
    ),
    notes: v.optional(v.string()),
  })
    .index('by_session', ['sessionId'])
    .index('by_profile', ['profileId']),

  /**
   * Maps a golfer to their conversation with each coach.
   *
   * The messages themselves live in the `@convex-dev/agent` component, keyed
   * by an opaque `threadId`. This table is the ownership record: the client
   * only ever sends a `profileId`, and `convex/coachChat.ts` resolves it to a
   * thread here after checking the profile belongs to the caller. One thread
   * per coach, so switching coach opens that coach's own conversation rather
   * than handing a new persona someone else's history.
   */
  coachThreads: defineTable({
    userId: v.id('users'),
    profileId: v.id('golferProfiles'),
    coachId: v.union(
      v.literal('que'),
      v.literal('mason'),
      v.literal('sam'),
      v.literal('dom'),
    ),
    threadId: v.string(),
  })
    .index('by_profile_and_coach', ['profileId', 'coachId'])
    .index('by_profile', ['profileId']),

  /**
   * The reply currently being written, one row per thread.
   *
   * The agent component only stores a message once it is complete, so without
   * this a golfer waits several seconds at a "thinking" indicator and then has
   * the whole answer appear at once. `generateReply` streams the model's
   * output into here as it arrives and the chat screen renders it live, which
   * is the difference between waiting and reading.
   *
   * Deleted the moment the finished message lands, so it is never a second
   * copy of the conversation - only ever the few seconds in between.
   */
  coachDrafts: defineTable({
    threadId: v.string(),
    profileId: v.id('golferProfiles'),
    text: v.string(),
    updatedAt: v.number(),
  })
    .index('by_thread', ['threadId'])
    .index('by_profile', ['profileId']),

  // Cached course data fetched from OpenGolfAPI - keyed by external course ID
  courseCache: defineTable({
    externalId: v.string(), // OpenGolfAPI course id
    name: v.string(),
    location: v.string(),
    altitudeFt: v.number(),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    rating: v.object({ championship: v.number(), regular: v.number(), forward: v.number() }),
    slope: v.object({ championship: v.number(), regular: v.number(), forward: v.number() }),
    holes: v.array(
      v.object({
        hole: v.number(),
        par: v.union(v.literal(3), v.literal(4), v.literal(5)),
        strokeIndex: v.number(),
        yards: v.object({
          championship: v.number(),
          regular: v.number(),
          forward: v.number(),
        }),
      }),
    ),
    fetchedAt: v.string(), // ISO timestamp
  }).index('by_external_id', ['externalId']),

  /**
   * Synthesised speech, kept so the same sentence is only ever paid for once.
   *
   * The caddie repeats itself constantly - every par 4 opens with the same
   * shape of brief - and a round would otherwise re-synthesise near-identical
   * audio on every hole. Keyed by voice plus the exact text, so a change to
   * either is simply a different clip rather than a stale one.
   *
   * Not owned by a golfer on purpose: the text is generated from public course
   * data and the caddie's own script, holds nothing personal, and sharing the
   * cache across accounts is the whole point.
   */
  voiceClips: defineTable({
    key: v.string(), // `${voice}:${sha256(text)}`
    voice: v.string(),
    storageId: v.id('_storage'),
    createdAt: v.number(),
  }).index('by_key', ['key']),
});
