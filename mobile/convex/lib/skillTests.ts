/**
 * Skills test definitions - one test per phase per week.
 * Each test has a set of challenges the golfer must complete.
 * Pass/fail is graded against ACCURACY_THRESHOLDS for the golfer's skill level.
 */

import { ACCURACY_THRESHOLDS, type Phase, type SkillLevel } from "./curriculum";

export interface SkillChallenge {
  id: string;
  name: string;
  description: string;
  totalAttempts: number;
  requiredPasses: Record<SkillLevel, number>; // minimum passes needed out of totalAttempts
  metric: string; // human-readable threshold description (built dynamically)
  category: "putting" | "chipping" | "pitching" | "iron" | "wood" | "driver";
}

export interface SkillTest {
  phase: Phase;
  week: number; // 1, 2, or 3
  title: string;
  description: string;
  coachIntro: string;
  challenges: SkillChallenge[];
  totalPoints: number;
  passingScore: number; // 0–100
}

// ─── Challenge library ────────────────────────────────────────────────────────

const PUTTING_CHALLENGES: Record<number, SkillChallenge[]> = {
  1: [
    {
      id: "put_w1_1",
      name: "3-Foot Make Circle",
      description: "Putt 10 balls from 3 feet around the cup (2 o'clock, 4, 6, 8, 10 × 2). Count how many you make.",
      totalAttempts: 10,
      requiredPasses: { beginner: 5, intermediate: 6, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Makes from 3 ft",
      category: "putting",
    },
    {
      id: "put_w1_2",
      name: "Lag Distance Control - 30 ft",
      description: "Putt 5 balls from 30 feet. Each ball must stop within your threshold circle of the cup.",
      totalAttempts: 5,
      requiredPasses: { beginner: 2, intermediate: 3, advanced: 3, scratch: 4, tour_pro: 4 },
      metric: "Stops within threshold",
      category: "putting",
    },
    {
      id: "put_w1_3",
      name: "6-Foot Straight Putt",
      description: "Find a straight 6-foot putt. Hit 10 balls. Count makes.",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Makes from 6 ft",
      category: "putting",
    },
  ],
  2: [
    {
      id: "put_w2_1",
      name: "Breaking Putt - 8 ft",
      description: "Find a left-to-right and right-to-left 8-foot putt. Hit 5 each. Count total makes.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Makes on breaking 8-ft putts",
      category: "putting",
    },
    {
      id: "put_w2_2",
      name: "Speed Ladder - 20/30/40 ft",
      description: "Putt 3 balls from each distance. All must finish within your threshold circle.",
      totalAttempts: 9,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Stop within threshold circle",
      category: "putting",
    },
    {
      id: "put_w2_3",
      name: "18-Hole Simulation",
      description: "Putt from 18 random spots varying 3–30 ft. Goal: no three-putts. Track two-putts and one-putts.",
      totalAttempts: 18,
      requiredPasses: { beginner: 12, intermediate: 14, advanced: 15, scratch: 16, tour_pro: 17 },
      metric: "Holes with ≤2 putts",
      category: "putting",
    },
  ],
  3: [
    {
      id: "put_w3_1",
      name: "Pressure 6-Foot Challenge",
      description: "Make 5 in a row from 6 feet. If you miss, start the streak over. Record how many attempts it takes.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 5, scratch: 5, tour_pro: 5 },
      metric: "Consecutive makes from 6 ft",
      category: "putting",
    },
    {
      id: "put_w3_2",
      name: "Tour Speed Test - 40 ft",
      description: "Putt 10 balls from 40 feet. All must finish within your threshold circle.",
      totalAttempts: 10,
      requiredPasses: { beginner: 5, intermediate: 6, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Within threshold from 40 ft",
      category: "putting",
    },
    {
      id: "put_w3_3",
      name: "Eyes-Closed Accuracy",
      description: "From 6 feet, close eyes before stroking. Hit 10. Count makes - this tests true feel.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 5, scratch: 6, tour_pro: 7 },
      metric: "Makes eyes-closed from 6 ft",
      category: "putting",
    },
  ],
};

const SHORT_GAME_CHALLENGES: Record<number, SkillChallenge[]> = {
  1: [
    {
      id: "sg_w1_1",
      name: "Landing Zone Accuracy",
      description: "Place a towel as a landing zone. Hit 10 chips from 10 yards - land on the towel.",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Land on towel",
      category: "chipping",
    },
    {
      id: "sg_w1_2",
      name: "Up-and-Down from 15 yds",
      description: "From 15 yards off the green, get up and down (chip + 1 putt) out of 5 attempts.",
      totalAttempts: 5,
      requiredPasses: { beginner: 1, intermediate: 2, advanced: 3, scratch: 4, tour_pro: 4 },
      metric: "Up-and-downs from 15 yds",
      category: "chipping",
    },
    {
      id: "sg_w1_3",
      name: "Chip Stop Distance",
      description: "Hit 10 chips from 20 yards. Measure how far each stops from the pin. Log as pass if within threshold.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 5, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Chips within threshold",
      category: "chipping",
    },
  ],
  2: [
    {
      id: "sg_w2_1",
      name: "Bunker Escape Test",
      description: "Hit 5 bunker shots. Goal: get it out and on the green every time. Then try to get within threshold.",
      totalAttempts: 5,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 4, scratch: 5, tour_pro: 5 },
      metric: "Green hits from bunker",
      category: "chipping",
    },
    {
      id: "sg_w2_2",
      name: "Flop Shot Control",
      description: "From a tight lie with the pin close, hit 5 flop shots. Must stop within threshold.",
      totalAttempts: 5,
      requiredPasses: { beginner: 2, intermediate: 3, advanced: 3, scratch: 4, tour_pro: 4 },
      metric: "Flops within threshold",
      category: "chipping",
    },
    {
      id: "sg_w2_3",
      name: "Multi-Club Chip Circuit",
      description: "Using 3 different clubs (8i, PW, SW), chip from 10 yards. 3 balls each. Count within-threshold stops.",
      totalAttempts: 9,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Within threshold (3 clubs)",
      category: "chipping",
    },
  ],
  3: [
    {
      id: "sg_w3_1",
      name: "Up-and-Down Circuit",
      description: "From 10 spots around the green (varying lie, distance, slope), attempt up-and-down. Track %.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Up-and-downs (10 lies)",
      category: "chipping",
    },
    {
      id: "sg_w3_2",
      name: "Tight Lie Short Game",
      description: "5 shots from hardpan/tight lies from 15 yards. Clean contact is required - no chunking.",
      totalAttempts: 5,
      requiredPasses: { beginner: 2, intermediate: 3, advanced: 4, scratch: 4, tour_pro: 5 },
      metric: "Clean contacts from tight lies",
      category: "chipping",
    },
  ],
};

const PITCHING_CHALLENGES: Record<number, SkillChallenge[]> = {
  1: [
    {
      id: "pt_w1_1",
      name: "50-Yard Precision",
      description: "Hit 10 shots to a 50-yard target. Count how many land within your threshold.",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Within threshold at 50 yds",
      category: "pitching",
    },
    {
      id: "pt_w1_2",
      name: "100-Yard Precision",
      description: "Hit 10 shots to a 100-yard target. Count within-threshold landings.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Within threshold at 100 yds",
      category: "pitching",
    },
    {
      id: "pt_w1_3",
      name: "Clock Position Consistency",
      description: "Hit 5 shots at 7 o'clock and 5 at 9 o'clock swing. Each set should cluster within 5 yards of each other.",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 6, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Consistent distance clusters",
      category: "pitching",
    },
  ],
  2: [
    {
      id: "pt_w2_1",
      name: "Three-Target Relay",
      description: "Hit 3 balls each to 60, 80, and 100 yards in sequence. No warm-up between targets.",
      totalAttempts: 9,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Within threshold across 3 distances",
      category: "pitching",
    },
    {
      id: "pt_w2_2",
      name: "Trajectory Window",
      description: "Hit 5 low, 5 mid, and 5 high shots to 80 yards. Each must stay in its intended window.",
      totalAttempts: 15,
      requiredPasses: { beginner: 6, intermediate: 8, advanced: 10, scratch: 12, tour_pro: 13 },
      metric: "Correct trajectory hits",
      category: "pitching",
    },
  ],
  3: [
    {
      id: "pt_w3_1",
      name: "Full Wedge Gapping Test",
      description: "Hit 5 shots each with SW, GW, PW, and AW to their optimal yardages. Confirm consistent gaps.",
      totalAttempts: 20,
      requiredPasses: { beginner: 8, intermediate: 12, advanced: 14, scratch: 16, tour_pro: 18 },
      metric: "Shots within threshold (4 wedges)",
      category: "pitching",
    },
    {
      id: "pt_w3_2",
      name: "120-Yard All-In Challenge",
      description: "Hit 10 shots to a 120-yard target. This is your maximum distance for full-swing wedges.",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Within threshold at 120 yds",
      category: "pitching",
    },
  ],
};

const IRON_CHALLENGES: Record<number, SkillChallenge[]> = {
  1: [
    {
      id: "ir_w1_1",
      name: "Ball-First Contact Test",
      description: "Hit 10 iron shots (7-iron). Count how many take a divot after the ball (not before).",
      totalAttempts: 10,
      requiredPasses: { beginner: 5, intermediate: 7, advanced: 8, scratch: 9, tour_pro: 10 },
      metric: "Correct ball-first divots",
      category: "iron",
    },
    {
      id: "ir_w1_2",
      name: "150-Yard Iron Accuracy",
      description: "Hit 10 shots with your 7-iron to a 150-yard target. Count within-threshold.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Within threshold at 150 yds",
      category: "iron",
    },
    {
      id: "ir_w1_3",
      name: "Iron Gapping Verification",
      description: "Hit 5 shots each with 5i, 7i, and 9i. Confirm 10–12 yard gaps between each club.",
      totalAttempts: 15,
      requiredPasses: { beginner: 6, intermediate: 9, advanced: 11, scratch: 13, tour_pro: 14 },
      metric: "Shots within expected gapping",
      category: "iron",
    },
  ],
  2: [
    {
      id: "ir_w2_1",
      name: "Intentional Draw",
      description: "Hit 10 shots with a 7-iron with an intentional draw shape. Count clean draws.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Clean draws on command",
      category: "iron",
    },
    {
      id: "ir_w2_2",
      name: "Intentional Fade",
      description: "Hit 10 shots with a 7-iron with an intentional fade shape. Count clean fades.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Clean fades on command",
      category: "iron",
    },
  ],
  3: [
    {
      id: "ir_w3_1",
      name: "Par-3 GIR Simulation",
      description: "Simulate 9 par-3 holes with varying distances (130–180 yds). Hit one shot per hole. Track GIR %.",
      totalAttempts: 9,
      requiredPasses: { beginner: 2, intermediate: 3, advanced: 5, scratch: 6, tour_pro: 7 },
      metric: "Greens in regulation (9 holes)",
      category: "iron",
    },
    {
      id: "ir_w3_2",
      name: "Full-Bag Iron Accuracy",
      description: "Hit 3 shots each with 5i, 6i, 7i, 8i, 9i to their optimal targets. Count within-threshold.",
      totalAttempts: 15,
      requiredPasses: { beginner: 5, intermediate: 7, advanced: 10, scratch: 12, tour_pro: 14 },
      metric: "Within threshold (5-iron set)",
      category: "iron",
    },
  ],
};

const WOOD_CHALLENGES: Record<number, SkillChallenge[]> = {
  1: [
    {
      id: "wd_w1_1",
      name: "Hybrid Fairway Hit",
      description: "Hit 10 hybrid shots to a 200-yard target zone (30 yds wide). Count fairway hits.",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Fairway hits with hybrid",
      category: "wood",
    },
    {
      id: "wd_w1_2",
      name: "3-Wood from Fairway",
      description: "Hit 10 3-wood shots from a tight lie. Count clean contacts (no fat shots).",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Clean 3-wood contacts",
      category: "wood",
    },
  ],
  2: [
    {
      id: "wd_w2_1",
      name: "Layup Precision",
      description: "Execute 5 layup shots to a 100-yard target using hybrid. All must land within 20 yards.",
      totalAttempts: 5,
      requiredPasses: { beginner: 2, intermediate: 3, advanced: 4, scratch: 4, tour_pro: 5 },
      metric: "Layups within 20 yds",
      category: "wood",
    },
    {
      id: "wd_w2_2",
      name: "Fairway Wood Accuracy Circuit",
      description: "Hit 5 shots each with 3-wood and 5-wood to their optimal distances. Count within-threshold.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Within threshold (3W + 5W)",
      category: "wood",
    },
  ],
  3: [
    {
      id: "wd_w3_1",
      name: "Par-5 Approach Simulation",
      description: "Simulate 5 par-5 second shots from 220 yards. Use hybrid or fairway wood. Count fairway-width hits.",
      totalAttempts: 5,
      requiredPasses: { beginner: 2, intermediate: 3, advanced: 3, scratch: 4, tour_pro: 4 },
      metric: "Fairway-width contacts",
      category: "wood",
    },
  ],
};

const DRIVER_CHALLENGES: Record<number, SkillChallenge[]> = {
  1: [
    {
      id: "dr_w1_1",
      name: "Simulated Fairway - 30 yds Wide",
      description: "Hit 10 drives at two alignment sticks 30 yards apart at 200 yards. Count fairway hits.",
      totalAttempts: 10,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 6, scratch: 7, tour_pro: 7 },
      metric: "Fairway hits (10 drives)",
      category: "driver",
    },
    {
      id: "dr_w1_2",
      name: "Tee Height & Contact",
      description: "Hit 10 drivers with proper tee height. Count shots with a smash factor above your skill threshold.",
      totalAttempts: 10,
      requiredPasses: { beginner: 5, intermediate: 6, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Quality contacts",
      category: "driver",
    },
  ],
  2: [
    {
      id: "dr_w2_1",
      name: "Shape on Command",
      description: "Hit 5 intentional draws and 5 intentional fades off the tee. Count successful shapes.",
      totalAttempts: 10,
      requiredPasses: { beginner: 3, intermediate: 4, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Successful tee shapes",
      category: "driver",
    },
    {
      id: "dr_w2_2",
      name: "Tight Fairway - 20 yds Wide",
      description: "Hit 10 drives at a tighter 20-yard-wide target. This represents a tight tour fairway.",
      totalAttempts: 10,
      requiredPasses: { beginner: 2, intermediate: 3, advanced: 5, scratch: 6, tour_pro: 7 },
      metric: "Hits in tight fairway",
      category: "driver",
    },
  ],
  3: [
    {
      id: "dr_w3_1",
      name: "9-Hole Tee Strategy",
      description: "For 9 different hole shapes, choose the correct shape, tee position, and execute. Track smart decisions.",
      totalAttempts: 9,
      requiredPasses: { beginner: 4, intermediate: 5, advanced: 6, scratch: 7, tour_pro: 8 },
      metric: "Strategic + accurate tee shots",
      category: "driver",
    },
    {
      id: "dr_w3_2",
      name: "Distance Consistency",
      description: "Hit 10 drivers. Measure carry distance. All 10 must be within 15 yards of each other.",
      totalAttempts: 10,
      requiredPasses: { beginner: 5, intermediate: 6, advanced: 7, scratch: 8, tour_pro: 9 },
      metric: "Drives within 15-yd spread",
      category: "driver",
    },
  ],
};

const CHALLENGE_MAP: Record<Phase, Record<number, SkillChallenge[]>> = {
  putting:       PUTTING_CHALLENGES,
  short_game:    SHORT_GAME_CHALLENGES,
  pitching:      PITCHING_CHALLENGES,
  mid_irons:     IRON_CHALLENGES,
  hybrids_woods: WOOD_CHALLENGES,
  driver:        DRIVER_CHALLENGES,
};

// ─── Grading ──────────────────────────────────────────────────────────────────
export function gradeSkillTest(
  challenges: SkillChallenge[],
  results: { challengeId: string; passes: number }[],
  skillLevel: SkillLevel,
): {
  score: number;
  overallPass: boolean;
  feedback: string;
  /** Passing mark for this skill level, so the UI can show the bar. */
  passingScore: number;
  /** Per-challenge outcome against that level's required passes. */
  challengeResults: {
    challengeId: string;
    name: string;
    passes: number;
    required: number;
    totalAttempts: number;
    met: boolean;
  }[];
} {
  let totalAttempts = 0;
  let totalPasses = 0;

  const challengeResults = challenges.map((challenge) => {
    const result = results.find((r) => r.challengeId === challenge.id);
    // Clamp: a client claiming 12 passes out of 10 attempts must not score 120%.
    const passes = Math.max(0, Math.min(result?.passes ?? 0, challenge.totalAttempts));
    const required = challenge.requiredPasses[skillLevel];

    totalPasses += passes;
    totalAttempts += challenge.totalAttempts;

    return {
      challengeId: challenge.id,
      name: challenge.name,
      passes,
      required,
      totalAttempts: challenge.totalAttempts,
      met: passes >= required,
    };
  });

  // Score is raw conversion across every attempt. The skill level sets the bar
  // it has to clear rather than scaling the score itself.
  const score = totalAttempts > 0 ? Math.round((totalPasses / totalAttempts) * 100) : 0;
  const passingScore = getPhasePassThreshold(skillLevel);
  const overallPass = score >= passingScore;

  return {
    score,
    overallPass,
    feedback: buildFeedback(score, overallPass, challengeResults),
    passingScore,
    challengeResults,
  };
}

/**
 * Feedback keyed to the actual score.
 *
 * Deterministic on purpose. The original picked from three variants with
 * Math.random(), and separately used the top tier for *any* pass - so a
 * beginner scraping through on 45% was told their consistency was "at an elite
 * level". Praise that does not track performance teaches the golfer nothing.
 */
function buildFeedback(
  score: number,
  overallPass: boolean,
  challengeResults: { name: string; met: boolean }[],
): string {
  const missed = challengeResults.filter((c) => !c.met).map((c) => c.name);

  if (score >= 90) {
    return 'Outstanding - conversion at that rate is an elite standard. Hold it under pressure and the phase is yours.';
  }
  if (score >= 75) {
    return overallPass
      ? 'Strong test. The range work is translating to the course. Keep the same routine.'
      : `Good striking, but the bar for your level is ${''}higher. Closest gap: ${missed[0] ?? 'consistency across the set'}.`;
  }
  if (score >= 50) {
    return missed.length > 0
      ? `Solid in places. ${missed.length === 1 ? 'One challenge' : `${missed.length} challenges`} fell short - start with ${missed[0]}.`
      : 'Every challenge met its threshold. Push the volume up next time.';
  }
  return missed.length > 0
    ? `These thresholds are earned, not given. Rebuild from ${missed[0]} - quality reps over quantity, then retest.`
    : 'These thresholds are earned, not given. Slow down, focus on quality reps, and retest after three more sessions.';
}

function getPhasePassThreshold(skillLevel: SkillLevel): number {
  return { beginner: 45, intermediate: 55, advanced: 65, scratch: 72, tour_pro: 80 }[skillLevel];
}

// ─── Get skill test for a phase + week ────────────────────────────────────────
export function getSkillTest(phase: Phase, week: number): SkillTest {
  const w = Math.min(Math.max(week, 1), 3);
  const challenges = CHALLENGE_MAP[phase][w] ?? CHALLENGE_MAP[phase][1];
  const totalAttempts = challenges.reduce((s, c) => s + c.totalAttempts, 0);

  const intros: Record<Phase, string> = {
    putting:       "The putter accounts for nearly 40% of your strokes. These tests separate good players from great ones.",
    short_game:    "The short game is where handicaps are made and broken. Show me what you've got.",
    pitching:      "Distance control inside 120 yards is the most valuable skill in the game. Let's see how dialed-in you are.",
    mid_irons:     "Ball-striking is the engine of your game. These tests will reveal the true state of your iron play.",
    hybrids_woods: "The long game sets up birdie opportunities. Consistency here changes your scoring ceiling.",
    driver:        "The tee shot controls the hole. Hit fairways, control the shape, and your scorecard will show it.",
  };

  const weekLabels = ["Foundation", "Development", "Mastery"];

  return {
    phase,
    week: w,
    title: `Week ${w} Skills Test - ${weekLabels[w - 1]}`,
    description: `${challenges.length} challenges · ${totalAttempts} total attempts`,
    coachIntro: intros[phase],
    challenges,
    totalPoints: totalAttempts,
    passingScore: 60,
  };
}
