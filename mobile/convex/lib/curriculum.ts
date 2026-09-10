/**
 * Tour Pure Blueprint - Dominus Golf curriculum engine.
 * Generates daily drills, tasks, and coaching cues per phase + skill level.
 *
 * Vocabulary canon (must match the Tour Pure Training Manual exactly):
 *   • The 10 P-Positions: P1 (address) through P10 (finish)
 *   • The Core 9-to-3 Sequence: P3 → P9 controlled swing progression
 *   • Setup: 50/50 weight balance, neutral V-grip pointing to trail shoulder, 4/10 grip pressure
 *   • Transition: lower-body hip bump toward target, hands drop to inside slot, 70/30 weight shift at P7
 *   • Clock System: 8:00 / 9:00 / 10:00 arm positions for wedge distance calibration
 *   • Accountability: 3-in-a-Row Rule (resets to 0 on a miss) and 30-Second Reset Rule
 *   • Putting: Guide-Rail Gate Drill, static lower body, pendulum shoulder stroke, Three-View Green Reading
 */

export type Phase =
  | "putting"
  | "short_game"
  | "pitching"
  | "mid_irons"
  | "hybrids_woods"
  | "driver";

export type SkillLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "scratch"
  | "tour_pro";

export type DrillDifficulty = "foundation" | "development" | "mastery" | "elite";

export interface Drill {
  id: string;
  name: string;
  duration: string; // e.g. "15 min"
  reps: string; // e.g. "20 putts" or "3 sets of 10"
  description: string;
  coachingCue: string;
  keyFocus: string;
  difficulty: DrillDifficulty;
  completionStandard?: string; // What "done" looks like at this level
}

export interface CorrectiveAction {
  fault: string;       // What is going wrong (short label)
  symptom: string;     // How the golfer notices it
  fix: string;         // The specific correction to make
}

export interface DailySession {
  phase: Phase;
  dayInPhase: number;
  weekInPhase: number;
  title: string;
  coachGreeting: string;
  warmup: string;
  drills: Drill[];
  correctiveActions: CorrectiveAction[];
  cooldown: string;
  sessionGoal: string;
  completionGate: string; // What must happen before advancing
  estimatedMinutes: number;
}

// ─── Accuracy thresholds per skill level ───────────────────────────────────
export const ACCURACY_THRESHOLDS: Record<SkillLevel, {
  puttFeet: number;         // within X feet
  chipYards: number;        // within X yards
  pitchYards: number;       // within X yards (inside 120)
  ironYards: number;        // within X yards (outside 120)
  woodYards: number;        // within X yards
}> = {
  beginner:     { puttFeet: 10, chipYards: 15, pitchYards: 20, ironYards: 40, woodYards: 50 },
  intermediate: { puttFeet:  6, chipYards: 10, pitchYards: 15, ironYards: 25, woodYards: 30 },
  advanced:     { puttFeet:  4, chipYards:  7, pitchYards: 10, ironYards: 18, woodYards: 22 },
  scratch:      { puttFeet:3.5, chipYards:  5, pitchYards:  7, ironYards: 13, woodYards: 16 },
  tour_pro:     { puttFeet:  3, chipYards:  5, pitchYards:  7, ironYards: 12, woodYards: 15 },
};

// ─── Phase metadata ─────────────────────────────────────────────────────────
export const PHASES: Record<Phase, {
  label: string;
  icon: string;
  order: number;
  daysAllocated: number;
  description: string;
}> = {
  putting:       { label: "Putting",                icon: "🏌️", order: 1, daysAllocated: 15, description: "Master the flat stick - 40% of all strokes start here" },
  short_game:    { label: "Short Game",             icon: "🎯", order: 2, daysAllocated: 15, description: "Chipping, bump-and-run, bunker play, and flop shots" },
  pitching:      { label: "Pitching (≤120 yds)",    icon: "📐", order: 3, daysAllocated: 15, description: "Wedge distance control and trajectory management" },
  mid_irons:     { label: "Mid Irons",              icon: "🔩", order: 4, daysAllocated: 15, description: "5–9 iron accuracy, ball striking, and shot shaping" },
  hybrids_woods: { label: "Hybrids & Fairway Woods",icon: "🌲", order: 5, daysAllocated: 15, description: "Long game consistency, hybrid utility, fairway woods" },
  driver:        { label: "Driver",                 icon: "💥", order: 6, daysAllocated: 15, description: "Distance, accuracy, tee strategy, and shot shaping" },
};

export const PHASE_ORDER: Phase[] = [
  "putting", "short_game", "pitching", "mid_irons", "hybrids_woods", "driver"
];

// ─── Drill library per phase ─────────────────────────────────────────────────
const DRILLS: Record<Phase, Drill[]> = {
  putting: [
    {
      id: "p1", name: "Guide-Rail Gate Drill", duration: "15 min", reps: "30 putts",
      description: "Set two tees just wider than your putter face, 8 inches in front of the ball (the Guide-Rail Gate). Stroke through the gate without touching either tee.",
      coachingCue: "Setup first: 50/50 weight, eyes directly over the ball. Then lock your lower body completely still - this is a pendulum shoulder stroke, no hands, no wrists.",
      keyFocus: "Static lower body + pendulum shoulder stroke",
      difficulty: "foundation",
    },
    {
      id: "p2", name: "Three-View Green Reading", duration: "20 min", reps: "4 balls × 3 distances",
      description: "Read every putt from three views: behind the ball, from the low side, and from behind the hole. Then place 4 balls evenly around the cup at 3 ft, 6 ft, and 9 ft. Apply the 3-in-a-Row Rule - make three in a row before moving out.",
      coachingCue: "Three-View Reading builds a complete picture of the break. Commit to your read before stepping in - that's the 30-Second Reset Rule in action.",
      keyFocus: "Three-View Green Reading + 3-in-a-Row Rule",
      difficulty: "foundation",
    },
    {
      id: "p3", name: "Lag Putting - Distance Control", duration: "20 min", reps: "5 balls × 3 distances (20, 30, 40 ft)",
      description: "From each distance, putt all 5 balls. Goal: all must stop within a 3-foot circle. The 3-in-a-Row Rule applies - three consecutive stops inside the circle before advancing.",
      coachingCue: "Setup: 50/50 weight, neutral V-grip at 4/10 pressure. Feel the weight of the putter head, let the pendulum shoulder stroke calibrate your pace - never force it.",
      keyFocus: "Distance control through pendulum tempo",
      difficulty: "development",
    },
    {
      id: "p4", name: "Address Setup Drill - Straight-Line", duration: "15 min", reps: "20 putts from 6 ft",
      description: "Find a straight 6-foot putt. Use an alignment rod on the ground pointing to the cup. Build your address position: 50/50 weight, neutral V-grip (4/10 pressure), eyes over the ball. Match putter to rod on every stroke.",
      coachingCue: "Your address is the foundation for every putt: 50/50 weight, V-grip to trail shoulder, 4/10 grip pressure. If it misses, come back to your setup - not the stroke.",
      keyFocus: "Address position + static lower body",
      difficulty: "foundation",
    },
    {
      id: "p5", name: "One-Hand Pendulum Drill", duration: "10 min", reps: "15 putts each hand",
      description: "Putt with only your trail hand, then only your lead hand from 5 feet. Each hand isolates a different part of the pendulum shoulder stroke.",
      coachingCue: "Lead hand keeps the face square through impact. Trail hand drives the pace. Together they complete the pendulum stroke - shoulders rock back and through, no hands or wrists.",
      keyFocus: "Pendulum shoulder stroke - no hands or wrists",
      difficulty: "development",
    },
    {
      id: "p6", name: "Eyes-Closed Pendulum Drill", duration: "10 min", reps: "20 putts from 6 ft",
      description: "Take your address, close your eyes just before the stroke. Focus entirely on the pendulum shoulder movement - no peeking until the ball is rolling.",
      coachingCue: "Remove the visual - trust the pendulum shoulder stroke you've built. Your 50/50 setup and 4/10 grip pressure will do the work.",
      keyFocus: "Feel-based execution + static lower body",
      difficulty: "mastery",
    },
    {
      id: "p7", name: "Speed Ladder - Distance Calibration", duration: "15 min", reps: "3 balls × 5 stations (10–50 ft)",
      description: "Station every 10 feet from 10 to 50 ft. Putt 3 balls from each distance. The 3-in-a-Row Rule: three stops within threshold before advancing to the next station.",
      coachingCue: "Longer putts need a longer backswing - same tempo, bigger pendulum arc. Let the shoulder stroke scale naturally with distance: more arc = more pace. Never force it.",
      keyFocus: "Pendulum arc calibration for distance control",
      difficulty: "mastery",
    },
    {
      id: "p8", name: "Pressure Round Simulation", duration: "20 min", reps: "18-hole simulation",
      description: "Putt one ball from random positions, simulating an 18-hole round. Apply Three-View Green Reading on every putt and the 30-Second Reset Rule before each stroke. No do-overs.",
      coachingCue: "50/50 weight, V-grip 4/10 - every single time. After reading with Three-View, trigger the 30-Second Reset: one breath, see the line, commit, execute.",
      keyFocus: "Routine under pressure + 30-Second Reset Rule",
      difficulty: "elite",
    },
  ],

  short_game: [
    {
      id: "sg1", name: "Clock System Chip - 3 Clubs", duration: "20 min", reps: "20 chips × 3 clubs",
      description: "Using a 7-iron, PW, and SW from 5 yards off the green. Apply the Clock System: use an 8:00 arm swing for short chips, 9:00 for mid-distance chips. Same P1 setup every time - the clock position controls how far the ball rolls out. Land on the fringe and let it release to the pin.",
      coachingCue: "P1 setup: hands slightly ahead of the ball, 60/40 weight on the lead side. The clock position is the only variable - 8:00 gets less roll, 9:00 gets more. Lower body stays quiet; shoulders rock the club through.",
      keyFocus: "Clock System (8:00 / 9:00) applied to chipping",
      difficulty: "foundation",
    },
    {
      id: "sg2", name: "Landing Zone Drill - 3-in-a-Row", duration: "20 min", reps: "30 chips",
      description: "Place a towel 3 feet onto the green. Using your 8:00 Clock System chip, apply the 3-in-a-Row Rule - three consecutive chips landing on the towel before moving the target. Forget the flag; own the landing zone.",
      coachingCue: "3-in-a-Row Rule: one miss resets your count to zero. P1 setup, pick your clock position (8:00 or 9:00), commit to the landing zone - not the hole. Consistency wins.",
      keyFocus: "Clock System precision + 3-in-a-Row accountability",
      difficulty: "foundation",
    },
    {
      id: "sg3", name: "Bunker Splash - Sand Entry Drill", duration: "20 min", reps: "20 bunker shots",
      description: "Draw a line 2 inches behind the ball in the sand. Use a 10:00 Clock System swing - the fuller arm arc generates enough speed to drive through the sand. Open the face, open your stance, enter behind the line, and commit to a full finish.",
      coachingCue: "The lower body initiates with a hip bump toward the target - this drops the hands to the inside and creates the wide, shallow entry angle. A 10:00 swing gives you the speed to splash through. Deceleration is the #1 bunker fault.",
      keyFocus: "10:00 Clock System swing + shallow sand entry",
      difficulty: "development",
    },
    {
      id: "sg4", name: "High-Loft Flop - Full Clock Swing", duration: "15 min", reps: "15 flop shots",
      description: "Open your wedge to maximum loft, open your stance, and swing along your foot line using a full 10:00 clock position. The loft does the work - your job is committing to the full swing without decelerating.",
      coachingCue: "Trust the loft; the 10:00 clock swing provides the speed. Lower-body hip bump starts the sequence, hands through the inside slot, full finish. Deceleration kills the flop shot every time.",
      keyFocus: "10:00 Clock System + committed full swing for flop",
      difficulty: "mastery",
    },
    {
      id: "sg5", name: "Up-and-Down Challenge - 30-Second Reset", duration: "25 min", reps: "10 attempts from 5 positions",
      description: "From 10 different lies around the green, get up and down in 2 shots. Before each chip, select your clock position (8:00, 9:00, or 10:00) based on distance needed, then apply the 30-Second Reset Rule: read, visualize, P1 setup, trigger, go.",
      coachingCue: "30-Second Reset before every shot. Pick your clock position first - that decision locks in your distance. Then see the landing zone, feel the swing in your practice motion, P1 address, execute.",
      keyFocus: "Clock System selection + 30-Second Reset under pressure",
      difficulty: "mastery",
    },
    {
      id: "sg6", name: "Tight Lie Recovery - Ball-First Contact", duration: "15 min", reps: "20 shots",
      description: "Practice chipping from tight, hard lies using an 8:00 or 9:00 clock position. The compact swing reduces risk on tight turf. The key is a descending strike - ball before ground. Play the ball slightly back of center at P1, hands forward.",
      coachingCue: "Hands ahead of the ball at P1, 60/40 weight on the lead side. The 8:00 or 9:00 clock swing keeps the motion compact and controlled. The club descends into the ball - a small, low divot after contact confirms you got it right.",
      keyFocus: "Clock System compact swing + ball-first contact on tight lies",
      difficulty: "elite",
    },
  ],

  pitching: [
    {
      id: "pt1", name: "Clock System Introduction", duration: "20 min", reps: "10 shots × 3 clock positions",
      description: "Build your personal Wedge Matrix using the Clock System. Swing to 8:00, 9:00, and 10:00 arm positions. Record carry distances for each position with each wedge (PW, GW, SW, LW).",
      coachingCue: "The Clock System is your distance calculator. 8:00 = short carry, 9:00 = mid carry, 10:00 = full carry. Same P1 setup every time - the clock position is the only variable.",
      keyFocus: "Clock System Wedge Matrix (8:00, 9:00, 10:00)",
      difficulty: "foundation",
    },
    {
      id: "pt2", name: "Wedge Matrix Calibration - 3-in-a-Row", duration: "25 min", reps: "5 balls × 3 clock stations",
      description: "Using your Wedge Matrix distances, set targets at your 9:00 carry for each wedge. Apply the 3-in-a-Row Rule - three balls inside your threshold circle before advancing to the next wedge.",
      coachingCue: "The 3-in-a-Row Rule locks in your Wedge Matrix numbers. P1 setup, same tempo - only the clock position changes. Don't muscle the shot; let the arm position do the work.",
      keyFocus: "Wedge Matrix calibration + 3-in-a-Row Rule",
      difficulty: "development",
    },
    {
      id: "pt3", name: "Trajectory Control - P3 to P9 Variations", duration: "20 min", reps: "10 shots each: low / mid / high",
      description: "Hit the same 9:00 arm position shot three ways: ball back at P1/hands forward (low trajectory), neutral P1 (mid), ball forward/open face (high trajectory).",
      coachingCue: "Ball position at P1 is a trajectory dial. Forward = higher launch angle through impact; back = lower, more penetrating. Your P3–P9 sequence stays the same - P1 setup controls the window.",
      keyFocus: "P1 ball position as trajectory control",
      difficulty: "development",
    },
    {
      id: "pt4", name: "Spin Control - P3 Angle of Attack", duration: "15 min", reps: "20 shots",
      description: "Alternate between check-spin (steep P3–P7 descent, open face, clean turf) and release shots (shallow P3, ball rolls out). Feel the difference in your P3 to P7 sequence.",
      coachingCue: "Spin is created by your angle of attack between P3 and P7. Steep = more spin, check. Shallow = less spin, release. Your lower-body hip bump controls the steepness.",
      keyFocus: "P3–P7 angle of attack for spin management",
      difficulty: "mastery",
    },
    {
      id: "pt5", name: "One-Club Full Clock System", duration: "20 min", reps: "20 shots",
      description: "Using only one wedge, hit to your 8:00, 9:00, and 10:00 carry distances alternating randomly. This is your Wedge Matrix in competition - one club, four distances.",
      coachingCue: "Tour pros have 4+ distances from every wedge. Your Clock System gives you that. P1 setup is identical every time - only the arm position (8, 9, or 10 o'clock) changes.",
      keyFocus: "Full Clock System mastery from one club",
      difficulty: "elite",
    },
  ],

  mid_irons: [
    {
      id: "mi1", name: "P3–P7 Ball-Striking Sequence", duration: "20 min", reps: "30 shots (5-iron, 7-iron, 9-iron)",
      description: "Hit 10 shots with each club. Focus on the P3 to P7 sequence - club enters the hitting zone at P3, contacts the ball, and the divot appears after ball contact, not before.",
      coachingCue: "The divot tells the story of your P3–P7 sequence. Divot after the ball = correct. P1 setup: 50/50 weight, V-grip 4/10 pressure. Lower-body hip bump initiates the sequence.",
      keyFocus: "P3–P7 ball-first contact sequence",
      difficulty: "foundation",
    },
    {
      id: "mi2", name: "P1 Alignment System", duration: "15 min", reps: "20 shots",
      description: "Lay one alignment stick along your toe line, another pointing at the target. Build your P1 position - 50/50 weight, neutral V-grip, 4/10 grip pressure - then execute the 9-to-3 Sequence.",
      coachingCue: "Most missed greens are P1 alignment errors, not P3–P9 swing errors. Set your P1 correctly: clubface to target, body lines parallel, 50/50 balance, V-grip to trail shoulder.",
      keyFocus: "P1 alignment foundation",
      difficulty: "foundation",
    },
    {
      id: "mi3", name: "Shot Shaping - Draw (Path-Face Relationship)", duration: "20 min", reps: "20 draw shots",
      description: "Aim feet right of target (closed stance at P1), close the clubface to the target. Swing along foot line from P3 through P9. Ball starts right of target and draws left.",
      coachingCue: "Path right, face at target - the difference creates draw spin through the P3–P7 impact zone. Your lower-body hip bump drops the hands to the inside slot, which creates the in-to-out path.",
      keyFocus: "P1 closed alignment → inside slot → draw",
      difficulty: "development",
    },
    {
      id: "mi4", name: "Shot Shaping - Fade (Outside Slot)", duration: "20 min", reps: "20 fade shots",
      description: "Aim feet left of target (open stance at P1), open the clubface to the target. Swing along foot line. Ball starts left of target and fades right.",
      coachingCue: "Path left, face at target - same P3–P7 principle as the draw, opposite spin. Open P1 setup promotes the outside-in path. Lower-body initiation and hip bump still lead the sequence.",
      keyFocus: "P1 open alignment → outside path → fade",
      difficulty: "development",
    },
    {
      id: "mi5", name: "Wedge Matrix - Iron Gapping Test", duration: "25 min", reps: "10 shots each club (5i–9i)",
      description: "Hit 10 balls with each iron. Record the median carry for each. Confirm consistent 10–12 yard gaps between clubs. Apply the 3-in-a-Row Rule for each club before moving on.",
      coachingCue: "Inconsistent gaps are a P3–P7 contact problem - usually off-center strikes, not swing speed. Nail your P1 50/50 setup, feel the lower-body initiation, and flush the center.",
      keyFocus: "P1 setup consistency → iron gapping",
      difficulty: "mastery",
    },
    {
      id: "mi6", name: "Par-3 Simulation - Full 9-to-3 Routine", duration: "25 min", reps: "9-hole simulation",
      description: "Simulate 9 par-3 holes: pick a flag, choose the correct iron, apply your 30-Second Reset Rule (Three-View read equivalent for iron shots), then execute the full 9-to-3 Sequence P1–P10.",
      coachingCue: "30-Second Reset on every shot: pick your target, feel the 9-to-3 sequence in a practice swing, P1 address, lower-body initiation, execute to P10 finish.",
      keyFocus: "Full P1–P10 routine under course simulation",
      difficulty: "elite",
    },
  ],

  hybrids_woods: [
    {
      id: "hw1", name: "Hybrid Utility - 9-to-3 from All Lies", duration: "20 min", reps: "20 shots",
      description: "Hit hybrids from tight lies, rough, and uphill/downhill lies using the 9-to-3 Sequence. The hybrid demands a slightly descending P3–P7 - treat it as an iron, not a wood.",
      coachingCue: "Hybrid P1 setup: ball just forward of center, 50/50 weight, V-grip 4/10. Slightly descending P3 angle - lower-body hip bump initiates, hands drop to the inside slot.",
      keyFocus: "9-to-3 Sequence adapted for hybrid lies",
      difficulty: "foundation",
    },
    {
      id: "hw2", name: "Fairway Wood - Shallow Sweep", duration: "20 min", reps: "20 shots",
      description: "Fairway woods require a shallow, sweeping angle of attack. Ball position: inside lead heel at P1, slight spine tilt away from target. The low point of the arc should be at or just after the ball - brush the grass, don't dig.",
      coachingCue: "The fairway wood is different from your irons - sweep it, don't hit down on it. P1 setup: ball forward, slight tilt away from target. The lower-body hip bump initiates and the wide, shallow arc does the work.",
      keyFocus: "Shallow angle of attack + sweeping arc for woods",
      difficulty: "foundation",
    },
    {
      id: "hw3", name: "200-Yard Accuracy - 3-in-a-Row Fairway", duration: "20 min", reps: "20 shots at 200-yd target",
      description: "Using your 3-wood or hybrid, hit 20 shots at a 200-yard target. Apply the 3-in-a-Row Rule - three consecutive shots within a simulated 30-yard-wide fairway before the drill is complete.",
      coachingCue: "3-in-a-Row Rule: one miss resets your count. At 200 yards, direction matters more than distance. Your 9-to-3 Sequence should feel controlled and repeatable, not max effort.",
      keyFocus: "3-in-a-Row accuracy at 200 yards",
      difficulty: "development",
    },
    {
      id: "hw4", name: "Tight Lie 3-Wood - Shallow Sweep", duration: "20 min", reps: "20 shots from tight lie",
      description: "The hardest shot in golf. Ball on a tight lie, 3-wood. P1 setup: ball positioned inside the lead heel, chest over the ball, minimal spine tilt away from the target. The swing must be ultra-shallow - brush the turf, don't take a divot.",
      coachingCue: "Stay patient at the top - no early cast. Let the lower-body hip bump initiate and trust the wide, shallow arc. The club should feel like it's skimming the ground through impact. Commit to a full finish at P10.",
      keyFocus: "Shallow sweep on tight lies - no divot",
      difficulty: "mastery",
    },
    {
      id: "hw5", name: "Lay-Up Strategy - Clock System Application", duration: "20 min", reps: "10 scenarios",
      description: "Given hazards at specific distances, choose and execute the correct lay-up club to your ideal wedge approach distance - referencing your personal Wedge Matrix from the Clock System.",
      coachingCue: "Course management is knowing your Wedge Matrix. Lay up to your strongest Clock System distance - the yardage where your 3-in-a-Row pass rate is highest.",
      keyFocus: "Wedge Matrix → lay-up strategy",
      difficulty: "mastery",
    },
  ],

  driver: [
    {
      id: "dr1", name: "P1 Driver Setup - Tee Height & Spine Tilt", duration: "15 min", reps: "15 tee shots",
      description: "P1 driver address: tee ball so the equator of the ball is level with the top of the driver crown. Ball position inside lead heel. Slight spine tilt away from target. 50/50 weight - not back-foot heavy.",
      coachingCue: "P1 for driver is unique: spine tilt creates an upward attack angle through P7 impact. Neutral V-grip, 4/10 pressure, 50/50 weight. Tee high, trust the tilt.",
      keyFocus: "P1 driver-specific setup",
      difficulty: "foundation",
    },
    {
      id: "dr2", name: "9-to-3 Slow-Motion Sequence", duration: "15 min", reps: "20 slow swings + 10 full swings",
      description: "Take the club through the 9-to-3 Sequence (P3 through P9) at 50% speed. Pause at P3, confirm the inside slot position, pause at P6 shaft position, then complete to P9 and P10 finish.",
      coachingCue: "9-to-3 at 50%: feel each position - P3 parallel takeaway, P6 shaft on plane, P9 follow-through mirror of P3. Speed is irrelevant until the sequence is correct.",
      keyFocus: "9-to-3 Sequence position checkpoints",
      difficulty: "foundation",
    },
    {
      id: "dr3", name: "Draw Driver - Inside Slot to P9", duration: "20 min", reps: "20 shots",
      description: "P1: aim right-center of the fairway, close the face slightly to target. Lower-body hip bump drops hands to the inside slot at transition. In-to-out path through P7, full P9–P10 finish.",
      coachingCue: "Lower-body initiation drops the hands to the inside slot - that creates the draw. The hip bump toward the target starts the 70/30 weight shift that arrives at P7 impact.",
      keyFocus: "Lower-body hip bump → inside slot → draw",
      difficulty: "development",
    },
    {
      id: "dr4", name: "Fairway Width Target - 3-in-a-Row", duration: "20 min", reps: "20 shots",
      description: "Using two alignment sticks 30 yards apart at 200 yards as a simulated fairway, hit drives between them. Apply the 3-in-a-Row Rule - three consecutive fairways before the drill ends.",
      coachingCue: "3-in-a-Row Rule under driver pressure. P1 address, 9-to-3 Sequence, full P10 finish. Fairways are 30–50 yards wide - you're aiming at a building. Control the sequence, not the swing.",
      keyFocus: "9-to-3 consistency + 3-in-a-Row Rule",
      difficulty: "development",
    },
    {
      id: "dr5", name: "P7 Impact Position Training", duration: "20 min", reps: "3 sets of 10",
      description: "Hit drives focusing on your P7 impact position: 70/30 weight on the lead side, hips open to the target, hands ahead of the ball, face square. Pause at P7 in slow-motion swings before going full speed.",
      coachingCue: "P7 is the moment of truth: 70/30 weight to lead side, hip bump completed, hands just ahead of the clubhead. Every driver drill you do is building toward this one position.",
      keyFocus: "P7 impact position - 70/30 weight + hip sequence",
      difficulty: "mastery",
    },
    {
      id: "dr6", name: "Tee Strategy - P1 Through P10 Routine", duration: "25 min", reps: "9 tee shots",
      description: "For 9 different hole shapes, apply the full Tour Pure pre-shot routine: 30-Second Reset (Three-View of the hole), P1 setup (50/50, V-grip, 4/10 pressure), 9-to-3 practice swing, commit, execute to P10.",
      coachingCue: "30-Second Reset: read the hole, pick your shape, feel the 9-to-3 sequence. P1 address. Lower-body hip bump initiates. P7 impact position. P10 finish. That's the complete Tour Pure Blueprint.",
      keyFocus: "Full P1–P10 Blueprint routine on the tee",
      difficulty: "elite",
    },
  ],
};

// ─── Coach-specific content ──────────────────────────────────────────────────
// Each of the 4 coaches (que, mason, sam, dom) has a distinct voice. When a
// coachId is supplied to generateSession, this content overrides the generic
// defaults. When no coachId is supplied, the generic content is used (backward
// compatible).

type GreetingFn = (playerName: string, dayInPhase: number, phaseLabel: string) => string;

// 6 greetings per coach (24 total)
export const COACH_GREETINGS: Record<string, GreetingFn[]> = {
  que: [
    (p) => `Hey ${p}! So glad you showed up today - let's have some fun out there!`,
    (p, d) => `${p}, Day ${d} and you keep showing up. That's exactly how champions are quietly built!`,
    (p) => `No pressure today, ${p} - just you, the ball, and a bunch of little wins waiting to happen.`,
    (p) => `Welcome back, ${p}! Remember: every great golfer started exactly where you are right now.`,
    (p) => `${p}, we're keeping this simple and fun today. One small step at a time, okay?`,
    (p) => `Big smile, ${p} - golf's a game, and games are meant to be enjoyed. Let's go!`,
  ],
  mason: [
    (p) => `${p}, your data from last session points to one thing we need to fix today. Let's get to work.`,
    (p, d) => `Day ${d}, ${p}. Consistency is a number - and today we push that number up.`,
    (p) => `${p}, good golf is repeatable golf. Every rep today is a data point. Let's log clean ones.`,
    (p) => `Let's talk ball-flight, ${p}. Start line and curve don't lie - today we control both.`,
    (p) => `${p}, we're not guessing today. We measure, we adjust, we measure again. That's the process.`,
    (p) => `Welcome back, ${p}. Percentages win rounds. Let's stack a few points in your favor.`,
  ],
  sam: [
    (p) => `${p}, champions don't wait for confidence - they build it rep by rep. Let's build.`,
    (p, d) => `Day ${d}, ${p}. The scratch player is already on the range grinding. Are you with me?`,
    (p) => `${p}, precision is a decision. Make it before you make the swing. Let's sharpen up.`,
    (p) => `Today we hone the edge, ${p}. The gap between good and great is measured in inches.`,
    (p) => `${p}, see the shot before you own it. Every rep today is a rehearsal for pressure.`,
    (p) => `Welcome, ${p}. Talent gets you noticed - precision gets you paid. Let's earn it.`,
  ],
  dom: [
    (p) => `${p}. I've seen every swing fault there is. Today we eliminate one more.`,
    (p, d) => `Day ${d}, ${p}. Thirty-six years taught me one thing: the standard doesn't lower. You rise to it.`,
    (p) => `${p}, tour players don't hope - they know. Today we replace hope with certainty.`,
    (p) => `No excuses today, ${p}. The fundamentals are the price of entry. Let's see them.`,
    (p) => `${p}, I've coached club amateurs and tour professionals. The work is the same. So is the standard.`,
    (p) => `Welcome, ${p}. I don't hand out praise cheaply. Earn a word from me today.`,
  ],
};

// Coach-specific warmups - 4 coaches × 6 phases (24 total). Same activity,
// different framing and cues.
export const COACH_WARMUPS: Record<string, Record<Phase, string>> = {
  que: {
    putting:       "Roll a handful of putts anywhere on the green - no target, no worries. Just get a feel for how fast the greens are today and let your shoulders loosen up.",
    short_game:    "Toss down a few balls 5 yards off the green and chip them with a smile. No target yet - just watch the ball land and roll, and enjoy the little bounces.",
    pitching:      "Grab your most lofted wedge and make 10 easy half-swings from 40 yards. Don't think about distance - just let your arms swing free and loose.",
    mid_irons:     "Hit 10 smooth 9-irons at about 70%. We're not chasing distance - we just want nice, clean contact and a warm, happy body.",
    hybrids_woods: "Make 10 slow, relaxed hybrid swings at half speed, then 5 easy ones. Getting comfy with the longer club is the whole goal here.",
    driver:        "Start with some gentle stretches - roll the shoulders, twist side to side - then make 10 easy driver swings at about 60%. Loose and happy, that's it!",
  },
  mason: {
    putting:       "Roll putts for 5 minutes to read today's green speed - the Stimp changes daily. Note whether they're running fast or slow so you set an accurate pace baseline.",
    short_game:    "Hit 10 chips from 5 yards with a single club to establish today's turf and roll-out ratio. Note where each one lands versus where it stops.",
    pitching:      "Make 10 half-swings with your lob wedge from 40 yards to establish today's launch and spin feel. This is your baseline before we calibrate the Matrix.",
    mid_irons:     "Hit 10 controlled 9-irons at 70% and watch your start line and curve on each. We want a repeatable baseline flight before we add any speed.",
    hybrids_woods: "Ten slow-motion hybrid swings, then 5 at pace. Track your strike location on the face - center contact is the metric that matters most today.",
    driver:        "Five minutes of dynamic mobility, then 10 driver swings at 60%. Note your typical start line and curve so we have a data baseline for the session.",
  },
  sam: {
    putting:       "Roll putts with no target for 5 minutes, but stay present - feel the exact weight of each stroke. You're calibrating your senses, not killing time.",
    short_game:    "Chip 10 balls from 5 yards and study each one as it lands. Build the picture in your mind now - you'll need to recall it under pressure later.",
    pitching:      "Ten half-swings with your lob wedge from 40 yards. Close your eyes on a few and feel the exact tempo - that feel is the weapon we sharpen today.",
    mid_irons:     "Hit 10 smooth 9-irons at 70%, and see the shot before every one. Precision starts in the mind before it ever reaches the clubface.",
    hybrids_woods: "Ten slow hybrid swings, then 5 at speed - but visualize a target line for each. Even in warmup, a scratch player never swings without intent.",
    driver:        "Move through your mobility work, then 10 easy drivers at 60%. On each, picture a fairway and commit to a start line. Warmup is rehearsal, not filler.",
  },
  dom: {
    putting:       "Five minutes of putting to read the green. I don't care about makes yet - I care that you're reading speed. Sloppy warmups become sloppy rounds.",
    short_game:    "Ten chips from 5 yards. No target, but I expect clean contact from the first one. Professionals warm up with intent - there is no throwaway rep.",
    pitching:      "Ten half-swings with your lob wedge from 40 yards. Loosen the body, but keep the setup disciplined. Bad habits creep in during careless warmups.",
    mid_irons:     "Ten 9-irons at 70%. I want center-face contact warming up. A loose warmup produces a looser round. Tighten it now.",
    hybrids_woods: "Ten slow hybrid swings, then 5 at pace. The long clubs punish laziness. Warm up like the shot matters - because on the course, it will.",
    driver:        "Stretch properly - the driver demands range of motion - then 10 swings at 60%. I've watched careers shortened by skipped warmups. Do it right.",
  },
};

// Coach-specific cooldowns - 3 per coach (not per phase).
export const COACH_COOLDOWNS: Record<string, string[]> = {
  que: [
    "Take 5 minutes to think about one thing that felt good today - even a small one. Celebrate it! Progress is built from little wins like that.",
    "Nice work today! Before you go, jot down one thing you enjoyed. Golf is more fun when you notice how far you've come.",
    "Cool down slowly and give yourself credit - you showed up and you improved. Pick one happy takeaway to carry into tomorrow.",
  ],
  mason: [
    "Log your numbers now while they're fresh - make rate, landing zones, carry distances. Compare the trend to last session. Data is only useful if you record it.",
    "Spend 5 minutes writing down today's key metrics and one measurable target for next time. What gets measured gets improved.",
    "Review your session data: where did the percentages climb, where did they dip? Note the one metric to attack next session.",
  ],
  sam: [
    "Close your eyes for 2 minutes and replay your three best shots in full detail. Then visualize where you want to be next session. Mental reps count.",
    "Debrief honestly: what held up under pressure, what cracked? See yourself executing it cleanly tomorrow - rehearse the win before it happens.",
    "Sit with today's session. Lock in the feel of your best rep, then picture carrying it to the course. Champions train the mind after the body.",
  ],
  dom: [
    "One thing. Identify the single biggest weakness you exposed today and commit to fixing it before we meet again. Everything else is noise.",
    "Don't overthink the debrief. Name the one fault that cost you the most today. That's your homework. No excuses next session.",
    "Cool down, then be honest about the one area that isn't tour-standard yet. Own it. Then go fix it.",
  ],
};

// ─── Coach-specific drill sets ────────────────────────────────────────────────
// Each coach has a dedicated pool of drills PER PHASE, scaled to their level.
// Higher levels get more drills per phase, and generateSession shows the number
// defined in COACH_SESSION_DRILL_COUNT (Que = 2, Mason = 3, Sam = 4, Dom = 5).
export const COACH_DRILL_SETS: Record<string, Partial<Record<Phase, Drill[]>>> = {
  // ── QUE - Level 1: Breaking 100 ─────────────────────────────────────────
  que: {
    putting: [
      {
        id: "que_p1", name: "The Gate Putt", duration: "15 min", reps: "10 consecutive putts",
        description: "Place two tees just wider than the putter head a foot in front of the ball. Putt from 4 feet, ensuring the putter head passes through the gate without striking either tee. Fails reset the count to zero.",
        coachingCue: "Check for excessive wrist action. Keep the wrists firm and let the shoulders rock the pendulum - a breakdown in the wrists causes the toe or heel to clip the tees.",
        keyFocus: "Square clubface at impact + straight initial start line",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Make 10 consecutive putts through the gate without touching either tee. Any miss resets the count to zero.",
      },
      {
        id: "que_p2", name: "The Coin Strike", duration: "12 min", reps: "10 putts",
        description: "Place a small coin or sticker directly in the center of the putter face. Hit 3-foot putts focusing entirely on striking the ball with the center of the face.",
        coachingCue: "Slow down the backswing stroke length. Jerky strokes lead to off-center hits - focus on a smooth, rhythmic tempo.",
        keyFocus: "Center-face contact for predictable speed control",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Execute 8 of 10 clean strikes where the ball rolls smoothly without skipping. Fails require restarting the block of 10.",
      },
      {
        id: "que_p3", name: "Ladder Speed Control", duration: "15 min", reps: "3 balls × 3 ft, 5 ft, 8 ft",
        description: "Putt to targets set at 3, 5, and 8 feet. The goal is to stop the ball within a 6-inch circle past the hole. Missing any distance resets the entire 3-distance sequence.",
        coachingCue: "Focus on altering the length of the backswing rather than hitting harder with the arms to change distance.",
        keyFocus: "Basic distance control on short putts to avoid three-putts",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Successfully lag 3 of 3 balls into the target zone at each distance consecutively. Missing any distance resets the entire 3-distance sequence.",
      },
    ],
    short_game: [
      {
        id: "que_sg1", name: "The Towel Landing Zone", duration: "15 min", reps: "10 chips",
        description: "Place a small hand towel 3 paces onto the green. Using a 9-iron or pitching wedge, hit standard bump-and-run chips designed to land on the towel and release toward a hole. Keep the weight heavily favored on the lead foot (70/30) throughout the stroke.",
        coachingCue: "Keep the weight heavily favored on the lead foot (70/30) throughout the stroke, and use a putting-like rocking motion with minimal wrist hinge.",
        keyFocus: "Consistent carry distance and basic club selection awareness",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Land 7 of 10 balls on top of the towel. Falling short of 7 makes you restart the 10-shot block.",
      },
      {
        id: "que_sg2", name: "Narrow Gate Chip", duration: "15 min", reps: "10 chips",
        description: "Set up two alignment rods in a 'V' shape 5 feet in front of the ball, forcing the chipped ball to start through a 2-foot window. A single missed window resets the set.",
        coachingCue: "Check alignment at address - the feet, hips, and shoulders are likely aimed too far right or left, forcing an OTT or inside-out path.",
        keyFocus: "Eliminating push/pull chips that miss the green entirely",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Hit 8 of 10 chips through the gate. A single missed window resets the entire set.",
      },
      {
        id: "que_sg3", name: "Single-Axis Balance Chip", duration: "12 min", reps: "10 chips",
        description: "Hit 10 chips standing on only the lead foot with the trailing toe just touching the ground for balance. If losing balance, shorten the swing and maintain a soft, athletic knee flex.",
        coachingCue: "If losing balance toward the toes or heels, shorten the swing length and maintain a soft, athletic knee flex.",
        keyFocus: "Eliminating lower body sway and weight reverse-pivots",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Make clean contact and strike the ball solidly on 8 of 10 attempts. Failing requires repeating the single-leg chipping set from scratch.",
      },
    ],
    pitching: [
      {
        id: "que_pt1", name: "Clock Swing - 9 O'Clock", duration: "15 min", reps: "10 pitches",
        description: "Grab a wedge and make swings where your lead arm only reaches the 9 o'clock position (parallel to the ground). Land the ball near a target 40 yards out. Same easy swing every time - this is your go-to distance.",
        coachingCue: "Keep the same smooth tempo on every swing. Don't try to add power - just let the 9 o'clock swing repeat and watch how the ball flies almost the same distance each time.",
        keyFocus: "One repeatable half-swing distance you can trust",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Land 7 of 10 pitches within 10 yards of the target. Falling short of 7 restarts the 10-shot block.",
      },
      {
        id: "que_pt2", name: "Feel the Weight Wedge", duration: "12 min", reps: "10 pitches",
        description: "Hit soft pitches from 30 yards, keeping your weight leaning gently onto your lead foot the whole time. Let the club swing back and through with your body turn - no scooping.",
        coachingCue: "Feel your weight stay on the front foot from start to finish. Let the club brush the grass just under the ball - no need to help it into the air, the loft does that for you.",
        keyFocus: "Steady weight and clean contact on short pitches",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Make clean contact on 8 of 10 pitches without chunking or thinning. Failing resets the set of 10.",
      },
    ],
    mid_irons: [
      {
        id: "que_fs1", name: "The Pre-Sensing Alignment Rod", duration: "15 min", reps: "10 consecutive half-swings",
        description: "Lay an alignment rod on the ground for feet alignment and place another club across the thighs to check spine tilt. Execute half-swings with an 8-iron. Any alignment or posture error resets the 10-shot count.",
        coachingCue: "Stop and reset the posture. Ensure the bend comes from the hips, not the lower back, and the arms hang naturally straight down from the shoulders.",
        keyFocus: "Fundamentally sound, repeatable pre-swing setup checklist",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Complete 10 consecutive swings with correct posture and target alignment. Any alignment or posture error resets the count.",
      },
      {
        id: "que_mi1", name: "9-to-3 Iron Contact", duration: "15 min", reps: "10 shots",
        description: "Restrict the swing to waist-high on the backswing (9 o'clock) and waist-high on the follow-through (3 o'clock) using a 7-iron. Focus on clipping the ball first, then the grass.",
        coachingCue: "Keep your lead wrist flat through impact - no flipping. Try to hit the ball first and see a little brush of the grass after. That crisp feeling means you nailed it!",
        keyFocus: "Solid center-face contact with a controlled half-swing",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Hit 8 of 10 shots cleanly off the center of the face. Missing the count requires starting the drill over.",
      },
      {
        id: "que_mi2", name: "Alignment Rod Setup", duration: "12 min", reps: "10 shots",
        description: "Lay one alignment rod along your toes and another pointing at your target. Hit 8-iron shots making sure your feet, hips, and shoulders match the rods every time before you swing.",
        coachingCue: "Most missed shots come from aiming wrong, not swinging wrong! Set your feet parallel to the rod, aim the clubface at the target, and you'll be amazed how many more shots find the middle.",
        keyFocus: "Square alignment so the ball starts on line",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Set up correctly and start 8 of 10 shots on your intended line. A careless setup resets the block.",
      },
    ],
    hybrids_woods: [
      {
        id: "que_hw1", name: "Hybrid Sweep Drill", duration: "15 min", reps: "10 shots",
        description: "Tee the ball very low or use a good lie. Swing your hybrid like a big, friendly iron - ball just forward of center, small descending brush through impact.",
        coachingCue: "Treat the hybrid as your rescue friend, not a scary club. Ball just forward of center, make a smooth sweep, and let the club do the work. It's built to make hard lies easy!",
        keyFocus: "Comfortable, sweeping contact with the hybrid",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Make solid contact on 7 of 10 shots that get airborne and travel straight. Falling short restarts the set.",
      },
      {
        id: "que_hw2", name: "Fairway Wood Tempo", duration: "15 min", reps: "10 shots",
        description: "Hit fairway wood shots off a good lie with a slow, smooth tempo. Ball a little forward in your stance. Focus on brushing the grass, not digging into it.",
        coachingCue: "Think smooth, not hard. Imagine the club skimming along the top of the grass and the ball just launches off it. Easy tempo wins - swinging harder only makes it tougher!",
        keyFocus: "Smooth tempo and a sweeping strike with the fairway wood",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Get 7 of 10 shots airborne with balanced tempo. Losing balance or topping the ball restarts the block.",
      },
    ],
    driver: [
      {
        id: "que_fs2", name: "9-to-3 Half-Swing Contact", duration: "15 min", reps: "10 shots",
        description: "Restrict the swing to waist-high on the backswing (9 o'clock) and waist-high on the follow-through (3 o'clock) using a 7-iron. Avoid flipping the wrists at impact - keep the lead wrist flat through the hitting zone.",
        coachingCue: "Avoid flipping the wrists at impact. Keep the lead wrist flat through the hitting zone to trap the ball.",
        keyFocus: "Solid center-face contact and control over the clubface",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Hit 8 of 10 shots cleanly off the center of the face, carrying a minimum distance. Missing the count requires starting the drill over.",
      },
      {
        id: "que_fs3", name: "Feel Right Band Connection", duration: "15 min", reps: "10 consecutive half-swings",
        description: "Use an arm-connection training aid (or a headcover tucked under the trail arm) to tie the arms together during half-swings, preventing the elbows from separating. Do not try to lift the arms with brute force - let rotation pull them.",
        coachingCue: "Do not try to lift the arms with brute force - let the rotation of the chest pull the arms back and through.",
        keyFocus: "Synchronized arm movement connected to early torso rotation",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Execute 10 consecutive smooth half-swings without the aid slipping or causing a shank/fat strike. Dropping or misusing the aid resets the count.",
      },
      {
        id: "que_dr1", name: "Tee Height and Setup", duration: "15 min", reps: "10 tee shots",
        description: "Tee the ball high so half of it peeks over the top of the driver. Set up tall with the ball forward near your lead heel and lean your spine slightly away from the target. Make smooth swings and just get comfortable.",
        coachingCue: "Set up big and tall! Tee it high, ball forward, and lean your upper body a touch away from the target. This helps you hit up on the ball and send it flying - no need to swing hard.",
        keyFocus: "A comfortable, repeatable driver setup",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Build the correct setup and make solid contact on 7 of 10 tee shots. Rushing the setup restarts the block.",
      },
      {
        id: "que_dr2", name: "Balanced Finish Drill", duration: "15 min", reps: "10 tee shots",
        description: "Hit driver shots where the only goal is to hold a balanced finish for 3 full seconds, weight on your lead foot, belt buckle facing the target. If you stumble, the swing was too fast.",
        coachingCue: "Swing smooth enough to freeze in a proud, balanced finish and hold it while the ball lands. If you can pose like that every time, good shots follow. Balance beats brute force!",
        keyFocus: "Controlled tempo and a balanced finish position",
        difficulty: "foundation" as DrillDifficulty,
        completionStandard: "Hold a balanced 3-second finish on 8 of 10 swings. Any stumble resets the count.",
      },
    ],
  },

  // ── MASON - Level 2: Breaking 90 ────────────────────────────────────────
  mason: {
    putting: [
      {
        id: "mason_p1", name: "The 20-Foot Speed Lag", duration: "15 min", reps: "5 putts",
        description: "Putt from 20 feet away to a tee stuck in the green, measuring distance control rather than makes. A single long or short miss outside the 2-foot circle resets the set of 5.",
        coachingCue: "Focus on a wider arc rather than an aggressive jab. Acceleration must be smooth, matching the backswing length to the follow-through length.",
        keyFocus: "Eliminating three-putts by dying the ball within a 2-foot circle",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Lag 4 of 5 putts inside the 2-foot circle. A single long or short miss outside the circle resets the set of 5.",
      },
      {
        id: "mason_p2", name: "Break Reading Arc", duration: "15 min", reps: "10 putts",
        description: "Set up a 10-foot breaking putt. Place a marker at the apex of the break and hit 10 putts aiming to cross the apex correctly. Respect the slope - players often under-read break because they hit the ball too hard.",
        coachingCue: "Respect the slope. Play more break and softer speed - under-reading is almost always caused by hitting the ball too hard.",
        keyFocus: "Visual feedback and touch for sloped greens",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Hit the apex window and convert or lag close on 7 of 10 attempts. Failing to hit the window 7 times resets the drill.",
      },
      {
        id: "mason_p3", name: "Pressure Make-or-Break", duration: "10 min", reps: "6 consecutive putts from 5 ft",
        description: "Putt 6 consecutive balls from 5 feet. If you miss even one, you restart from zero. Establish a strict pre-putt routine - focus entirely on the target hole, take one look, and execute without hesitation.",
        coachingCue: "Establish a strict pre-putt routine. Focus entirely on the target hole, take one look, and execute without hesitation.",
        keyFocus: "Mental resilience and repeatable stroke mechanics under pressure",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Make all 6 putts in a row without a single miss. Any miss on putts 2 through 6 instantly resets the count back to 1.",
      },
    ],
    short_game: [
      {
        id: "mason_sg1", name: "Divot Depth Control", duration: "15 min", reps: "10 chips",
        description: "Draw a chalk line on the turf (or use a mat). Hit chips ensuring the club's divot or low point occurs strictly on or after the chalk line. The sternum must stay forward over the ball through impact.",
        coachingCue: "The sternum must stay forward over the ball through impact. Leaning backward causes the club to bottom out too early behind the ball.",
        keyFocus: "Clean turf interaction, preventing fat or thin chipping miscues",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Execute 8 of 10 clean post-line divots. Hitting behind the line resets the 10-shot count.",
      },
      {
        id: "mason_sg2", name: "Trajectory Ladder", duration: "20 min", reps: "3 clubs × 3 rounds",
        description: "Hit three consecutive chips to the same pin using three different clubs (PW, 8-iron, SW) to manage rollout. Do not alter the swing speed to change distance - change the club loft while keeping the same swing cadence.",
        coachingCue: "Do not alter the swing speed to change distance. Change the club loft while keeping the same swing cadence.",
        keyFocus: "Understanding how club selection alters carry-to-roll ratio",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Successfully land each club's ball within a 3-foot target radius across 3 separate rounds. Missing any club in the sequence requires restarting.",
      },
      {
        id: "mason_sg3", name: "Rough Escape Chipping", duration: "15 min", reps: "10 chips",
        description: "Drop 10 balls in thick greenside rough and chip to a tucked pin. Open the clubface slightly and commit to an aggressive, steeper descent angle - grass wrapping the hosel closes the face on deceleration.",
        coachingCue: "Open the clubface slightly and commit to an aggressive, steeper descent angle. Grass wrapping around the hosel will close the face if you decelerate.",
        keyFocus: "Managing flier lies and unpredictable grass resistance",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Finish within 4 feet of the pin on 7 of 10 attempts. Failing to meet the 7-out-of-10 standard forces a full restart.",
      },
    ],
    pitching: [
      {
        id: "mason_pt1", name: "Clock System Distance Calibration", duration: "20 min", reps: "5 balls × 3 clock positions",
        description: "Using a single wedge, hit 5 balls each at the 8:00, 9:00, and 10:00 arm positions and log the carry number for each. Keep the same tempo - the clock length is the only variable that changes distance.",
        coachingCue: "Same setup, same tempo - only the arm position changes. Don't decelerate to shorten a number; change the clock length and keep accelerating through the ball. Log every carry.",
        keyFocus: "Building a three-tier distance chart per wedge",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Log a consistent carry for all three clock positions with each ball landing within a 5-yard spread of its position's average. Wild scatter resets the station.",
      },
      {
        id: "mason_pt2", name: "Trajectory Control - High/Low", duration: "15 min", reps: "10 pitches",
        description: "From 60 yards, alternate high and low pitches by moving ball position - forward for high, back for low - while keeping a steady 9:00 swing. Confirm each ball flies the intended window.",
        coachingCue: "Ball forward launches it higher; ball back flights it down and running. Keep the same 9:00 swing throughout - let ball position control the window, not extra hand action.",
        keyFocus: "Controlling launch window with ball position",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Produce the correct high or low window on 7 of 10 called shots. Missing the intended window restarts the set.",
      },
      {
        id: "mason_pt3", name: "Random Distance Challenge", duration: "15 min", reps: "10 pitches",
        description: "Call out a random distance between 40 and 100 yards before each shot, then select the clock position that matches your chart and execute. This tests recall and repeatability of your calibrated numbers.",
        coachingCue: "Trust the number you logged - pick the clock position, commit to the setup, and swing. If the ball comes up short repeatedly, your carry number needs recalibrating, not more effort.",
        keyFocus: "Applying the wedge distance chart on demand",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Land 7 of 10 pitches within 6 yards of the called distance. Falling short restarts the challenge.",
      },
    ],
    mid_irons: [
      {
        id: "mason_fs1", name: "The P-Position Gate Check", duration: "15 min", reps: "5 flawless paused reps",
        description: "Stop at P4 (top of backswing) and P6 (the slot) during slow-motion swings with a mid-iron to check club position and shaft plane. Any positional breakdown resets the consecutive count to zero.",
        coachingCue: "At P6, ensure the lower body has initiated the slide/rotation before the arms begin pulling down - a stuck trail elbow causes a casting motion.",
        keyFocus: "Internalizing correct kinetic sequencing and structural body positions",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Complete 5 flawless paused repetitions in a row. Any positional breakdown resets the consecutive count to zero.",
      },
      {
        id: "mason_mi2", name: "Divot Board Contact", duration: "15 min", reps: "10 shots",
        description: "Hit mid-iron shots off a divot board or spray a line of foot spray behind the ball. The divot must start at or after the ball - never behind it - confirming ball-first contact and forward shaft lean.",
        coachingCue: "The divot is your feedback: after the ball means correct sequence, behind it means an early low point. Keep the sternum over the ball and the weight shifting to the lead side through impact.",
        keyFocus: "Ball-first contact and a divot after the ball",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Produce a divot starting after the ball on 8 of 10 strikes. Hitting behind the ball resets the count.",
      },
      {
        id: "mason_mi3", name: "Iron Gap Confirmation", duration: "20 min", reps: "5 shots × 3 irons",
        description: "Hit 5 shots each with three consecutive irons (e.g. 7, 8, 9) and record the median carry. Confirm consistent 10–12 yard gaps between them so you always know which club covers which distance.",
        coachingCue: "Record the median carry for each iron, not the best one. Irregular gaps usually mean off-center strikes rather than a speed problem - cross-check your contact before trusting the number.",
        keyFocus: "Verifying consistent yardage gaps between irons",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Confirm clean 10–12 yard gaps across the three irons with tight dispersion. Scattered carries require re-hitting the set.",
      },
    ],
    hybrids_woods: [
      {
        id: "mason_hw1", name: "Hybrid from Rough", duration: "15 min", reps: "10 shots",
        description: "Drop 10 balls in light-to-medium rough and hit hybrid shots to a target 180 yards out. Position the ball just forward of center and use a slightly descending strike to cut through the grass.",
        coachingCue: "Treat the hybrid like a long iron - a slightly descending strike cuts through the rough. Expect the grass to reduce spin, so plan for extra run-out on landing.",
        keyFocus: "Escaping rough with the hybrid using clean contact",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Advance 7 of 10 balls onto the target line with solid contact. Chunks or thin strikes reset the block.",
      },
      {
        id: "mason_hw2", name: "Fairway Wood Corridor", duration: "20 min", reps: "10 shots",
        description: "Hit fairway wood shots through an imaginary 30-yard wide corridor set 220 yards out. Prioritize a shallow, sweeping strike with the ball forward, and use the same 9-to-3 controlled feel to keep it in the corridor.",
        coachingCue: "Sweep, don't dig - low point at or just after the ball. A controlled swing that finds the corridor beats a max-effort swing that sprays. Track your corridor-hit rate.",
        keyFocus: "Repeatable fairway wood accuracy into a defined corridor",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Hit 7 of 10 shots into the corridor. Missing the corridor 4 or more times restarts the 10-shot block.",
      },
      {
        id: "mason_hw3", name: "Lay-Up Precision", duration: "15 min", reps: "10 shots",
        description: "Pick a target lay-up zone that leaves your favorite wedge distance. Hit 10 shots with the club that lands you in that zone, focusing on distance control rather than maximum carry.",
        coachingCue: "The correct lay-up is a distance decision, not an ego one. Choose the club that leaves your strongest wedge number and commit to a controlled, balanced swing.",
        keyFocus: "Strategic distance control to set up the next shot",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Finish 7 of 10 shots inside the lay-up zone. Overshooting the zone restarts the set.",
      },
    ],
    driver: [
      {
        id: "mason_dr1", name: "Driver Setup and Tempo", duration: "20 min", reps: "10 tee shots",
        description: "Build the driver setup - tee height with the equator at the crown, ball inside the lead heel, slight spine tilt away from the target - then swing at 80% for a repeatable start line and tempo.",
        coachingCue: "The upward attack angle comes from the tilt and ball position, not from lifting. Verify tee height and tilt every rep, and prioritize a repeatable start line over raw speed.",
        keyFocus: "A repeatable driver setup and controlled tempo",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Produce the same start line and solid contact on 8 of 10 swings. Inconsistent setup resets the block.",
      },
      {
        id: "mason_fs2", name: "Weighted Club Rotational Speed", duration: "15 min", reps: "10 consecutive swings",
        description: "Take 10 swings with a weighted training club (or your heaviest club) focusing on maintaining core lag and explosive lower-body release into a driver-length motion. Power must originate from driving the ground with the lead foot and rotating the hips.",
        coachingCue: "Avoid using upper-body arm strength to whip the heavy club. Power must originate from driving the ground with the lead foot and rotating the hips.",
        keyFocus: "Strengthening core rotation and grooving lower-body sequencing",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Execute 10 consecutive dynamic swings with balanced completion. Loss of balance or poor tempo resets the set.",
      },
      {
        id: "mason_fs3", name: "Draw and Fade Tee Shot", duration: "20 min", reps: "10 shots",
        description: "Alternate an intentional draw and an intentional fade off the tee. For the draw, close the stance and swing from the inside; for the fade, open the stance and feel an out-to-in path. The hip bump initiates the weight shift on each.",
        coachingCue: "Path relative to face creates the curve. Closed stance and in-to-out path for the draw; open stance and out-to-in for the fade. Let the lower-body hip bump start the downswing on both.",
        keyFocus: "Curving the ball both directions off the tee on command",
        difficulty: "development" as DrillDifficulty,
        completionStandard: "Produce the intended curve on 7 of 10 shots, alternating draw and fade. Missing the shape restarts the set.",
      },
    ],
  },

  // ── SAM - Level 3: Breaking 80 ───────────────────────────────────────────
  sam: {
    putting: [
      {
        id: "sam_p1", name: "The Clock Face Pressure Test", duration: "15 min", reps: "12 putts (4 at 3 ft, 4 at 4 ft, 4 at 5 ft)",
        description: "Place 4 tees in a circle around a hole at 3 feet (North, South, East, West). Putt all 4, then move them to 4 feet, then 5 feet. Any miss at any distance resets the entire 12-putt sequence to the beginning.",
        coachingCue: "Stay down through the stroke. Looking up early to see if the ball goes in pulls the putter head offline.",
        keyFocus: "Building automatic conversion skills under changing breaking angles",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Make all 12 putts consecutively - 4 at each distance - without a single miss. Any miss at any distance resets the entire sequence to the beginning.",
      },
      {
        id: "sam_p2", name: "Lag-to-Dead Zone", duration: "15 min", reps: "10 putts from 35 ft",
        description: "Putt from 35 feet away. The goal is to leave every single putt inside a 1-foot halo around the cup. Pace is governed by rhythm - visualize a metronome, not a power stroke.",
        coachingCue: "Pace is governed by rhythm. Visualize a metronome or a smooth 1-2 cadence rather than trying to 'hit' the ball long distances.",
        keyFocus: "Eliminating long-range three-putts entirely",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Lag 8 of 10 putts inside the 1-foot halo. Failing to meet the 8-out-of-10 threshold restarts the block.",
      },
      {
        id: "sam_p3", name: "Cross-Slope Lag Calibration", duration: "15 min", reps: "10 putts",
        description: "Hit 10 long putts across a severe two-way slope, factoring break and speed simultaneously. Ensure the ball travels on its intended high-side arc long enough before gravity takes over.",
        coachingCue: "When putting across a steep slope, ensure the ball travels on its intended high-side arc long enough before gravity takes over.",
        keyFocus: "Mastering speed-to-break ratios on challenging green complexes",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Keep 7 of 10 putts within tap-in range (2 feet). Falling short of 7 makes you restart the drill.",
      },
      {
        id: "sam_pt_putt", name: "3-in-a-Row Money Ladder", duration: "15 min", reps: "3 makes each at 6, 8, 10 ft",
        description: "Work outward from 6 feet: make 3 in a row before advancing to 8 feet, then 10 feet. A miss at any station drops you back one station. This rehearses the 3-in-a-Row scoring-zone standard under mounting pressure.",
        coachingCue: "Commit to a single read from the Three-View and execute - indecision is the miss. Treat every putt as a scoring-zone putt that must be earned three deep before you move back.",
        keyFocus: "Pressure conversion across the mid-range scoring zone",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "String 3 consecutive makes at all three stations to finish. Any miss drops you back one station until you rebuild the streak.",
      },
    ],
    short_game: [
      {
        id: "sam_sg1", name: "Wedge Matrix Calibration", duration: "20 min", reps: "5 balls × 3 clock positions",
        description: "Using a 56-degree wedge, hit shots using clock-face backswing lengths (7:00, 9:00, 10:00) to establish distinct yardage tiers. Do not decelerate to control distance - change the backswing length and maintain acceleration.",
        coachingCue: "Do not decelerate into the ball to control distance. Change the backswing length, but maintain acceleration through the ball.",
        keyFocus: "Eliminating guessing on partial wedge shots",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Land 4 of 5 balls within a 5-yard target zone for each clock setting. Missing the target window requires restarting the distance tier.",
      },
      {
        id: "sam_sg2", name: "The Up-and-Down Simulation", duration: "25 min", reps: "10 attempts",
        description: "Drop 10 balls in random challenging spots around a practice green (rough, sand, downhill lie) and try to save par by getting up and down in two shots. Assess the lie before selecting the club.",
        coachingCue: "Assess the lie before selecting the club. If sitting in thick rough, use a higher-lofted wedge and expect the ball to roll out more due to less spin.",
        keyFocus: "Turning missed greens into scrambling pars",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Successfully convert 7 of 10 up-and-downs. Failing to convert 7 times means restarting the 10-shot simulation.",
      },
      {
        id: "sam_sg3", name: "Bunker Splash Precision", duration: "20 min", reps: "10 bunker shots",
        description: "Draw a target circle in the sand 10 feet away. Hit 10 bunker shots focusing on entering the sand 2 inches behind the ball. Open the clubface before taking your grip, lower your center of gravity, and splash the sand out.",
        coachingCue: "Open the clubface before taking your grip, lower your center of gravity, and splash the sand out like an invisible cushion beneath the ball.",
        keyFocus: "Consistent explosion shots that escape bunkers and hold greens",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Land 8 of 10 balls inside the target circle. Hitting clean or stubbing the sand too deep requires a full restart.",
      },
      {
        id: "sam_sg_scoring", name: "Scoring-Zone Three-View Test", duration: "20 min", reps: "9 shots (3 lies × 3 pins)",
        description: "Read each greenside shot from three views, then execute to three different pin positions from three lies. Score it as up-and-down or not - this is a risk-reward decision test where the aggressive line must be earned by the lie.",
        coachingCue: "Read the lie, then choose the line - the tucked pin is only worth attacking when the lie supports it. Play the percentage shot to the fat of the green when the risk outweighs the reward.",
        keyFocus: "Risk-reward shot selection and scoring-zone execution",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Convert 6 of 9 up-and-downs while choosing the correct risk-reward line each time. Reckless short-siding restarts the test.",
      },
    ],
    pitching: [
      {
        id: "sam_pt1", name: "Wedge Matrix Calibration", duration: "20 min", reps: "5 balls × 3 clock positions",
        description: "Using a 56-degree wedge, hit shots using clock-face backswing lengths (8:00, 9:00, 10:00) to establish distinct yardage tiers inside 120. Do not decelerate to control distance - change the backswing length and maintain acceleration.",
        coachingCue: "Do not decelerate into the ball to control distance. Change the backswing length, but maintain acceleration through the ball. Log each clock position's carry to the yard.",
        keyFocus: "Eliminating guessing on partial wedge shots inside 120",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Land 4 of 5 balls within a 5-yard target zone for each clock setting. Missing the target window requires restarting the distance tier.",
      },
      {
        id: "sam_pt2", name: "Trajectory Window Control", duration: "20 min", reps: "10 pitches",
        description: "From 90 yards, alternate a low piercing wedge and a high soft-landing wedge into a defined vertical window. Ball position and finish height control trajectory while the clock length holds the distance.",
        coachingCue: "See the window before you swing - ball back and abbreviated finish flights it down, ball forward and full finish floats it high. The clock position holds the number; trajectory is the variable.",
        keyFocus: "Controlling trajectory to attack front and back pins",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Fly the intended high or low window on 8 of 10 pitches within the scoring zone. Missing the window restarts the set.",
      },
      {
        id: "sam_pt3", name: "Clock System Random", duration: "15 min", reps: "10 pitches",
        description: "Have a partner or a shuffled card call a random distance inside 120 before each shot. Select the clock position from your Matrix and execute. This tests instant recall of your calibrated numbers under decision pressure.",
        coachingCue: "See the number, pick the clock, commit - no rehearsal swings to talk yourself out of it. A trustworthy Matrix means you attack the flag instead of guessing.",
        keyFocus: "On-demand distance control from the wedge Matrix",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Land 7 of 10 pitches within a 5-yard radius of the called number. Falling short restarts the drill.",
      },
      {
        id: "sam_pt4", name: "Competition Wedge Game", duration: "20 min", reps: "9 pitches, scored",
        description: "Play 9 scored wedge shots to varied distances inside 120, awarding points for landing in the scoring zone and deducting for short-siding. Track your total against a target score to simulate tournament wedge pressure.",
        coachingCue: "Every shot counts on the card - treat each like the 72nd hole. Choose the shot that keeps the ball below the hole in the scoring zone; a great wedge game is disciplined, not flashy.",
        keyFocus: "Executing wedge shots under scored, competitive pressure",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Reach the target score with 7 of 9 shots finishing in the scoring zone. Missing the score restarts the 9-shot game.",
      },
    ],
    mid_irons: [
      {
        id: "sam_mi1", name: "The Window Gate", duration: "20 min", reps: "10 iron shots",
        description: "Set up alignment rods 15 yards in front at a specific height to force iron shots to fly underneath a low ceiling or through a narrow window. Move the ball slightly back and finish with a lower, abbreviated follow-through.",
        coachingCue: "Move the ball slightly back in your stance and finish with a lower, abbreviated follow-through to flight the ball down.",
        keyFocus: "Controlling trajectory and launch windows for windy conditions",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Hit 8 of 10 iron shots cleanly through the window without hitting the visual obstruction. Hitting the rods or missing the window restarts the count.",
      },
      {
        id: "sam_mi2", name: "Shape Dominance", duration: "20 min", reps: "10 alternate shots (fade/draw)",
        description: "Hit 10 alternate shots: one intentional controlled fade, followed by one intentional controlled draw using a 7-iron. For a fade, open the stance slightly and feel an outside-in path with an open face. For a draw, close the stance and swing from the inside.",
        coachingCue: "For a fade, open the stance slightly and feel an outside-in path with an open face. For a draw, close the stance and swing from the inside with a closed face.",
        keyFocus: "Shaping shots around doglegs and obstacles on command",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Successfully execute 4 clean fades and 4 clean draws out of 10 total shots. Failing to shape the required count restarts the entire series.",
      },
      {
        id: "sam_mi3", name: "GIR Simulation Circuit", duration: "25 min", reps: "9 approach shots",
        description: "Simulate 9 approach shots to greens of varied depths, picking a specific club and landing zone for each. Score a green in regulation only when the ball finishes on the putting surface in the correct scoring zone.",
        coachingCue: "Commit to a full pre-shot routine and a specific landing spot on every approach - this is course play, not range beating. Aim to the fat of the green when the pin is guarded.",
        keyFocus: "Converting approach shots into greens in regulation",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Hit 6 of 9 simulated greens in the correct zone. Falling short of 6 restarts the circuit.",
      },
      {
        id: "sam_mi4", name: "Yardage Gap Verification", duration: "20 min", reps: "5 shots × 4 irons",
        description: "Hit 5 shots each with four irons and record the median carry, confirming clean gaps with no overlaps or holes. Precise gapping lets you pick a club with total confidence on the course.",
        coachingCue: "Trust the median carry, not your best strike. Overlapping gaps expose contact inconsistency - tighten the strike before you trust the number, then commit to the club without second-guessing.",
        keyFocus: "Confirming precise, overlap-free yardage gaps",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Confirm clean gaps across all four irons with tight dispersion at each. Scattered carries require re-hitting the affected iron.",
      },
    ],
    hybrids_woods: [
      {
        id: "sam_hw1", name: "Risk-Reward Long Club Decisions", duration: "20 min", reps: "10 shots",
        description: "Face 10 long-club scenarios (par-5 second shots, long par-3s) and decide between attacking the green or laying up to the scoring zone. Execute the committed shot and score whether the decision paid off.",
        coachingCue: "The smart play is the one that leaves the easiest next shot. Attack only when the reward clearly outweighs the risk; otherwise lay up to your favorite number and take your medicine.",
        keyFocus: "Course-strategy decisions with the long clubs",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Make and execute the correct risk-reward decision on 7 of 10 scenarios. Forcing low-percentage hero shots restarts the set.",
      },
      {
        id: "sam_hw2", name: "Lay-Up to Scoring Zone", duration: "15 min", reps: "10 shots",
        description: "Pick the lay-up club that leaves your deadliest wedge distance and hit 10 shots into that scoring-zone window. This is precision distance control, not maximum carry.",
        coachingCue: "Lay up to where your Matrix is strongest - position beats distance every time you're playing to score. Commit to the club that removes the awkward in-between wedge.",
        keyFocus: "Strategic lay-ups that set up your best wedge number",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Finish 7 of 10 shots inside the scoring-zone window. Overshooting into an awkward number restarts the set.",
      },
      {
        id: "sam_hw3", name: "Hybrid from Varied Lies", duration: "20 min", reps: "10 shots",
        description: "Hit hybrid shots from tight fairway lies, rough, and mild uphill/downhill slopes to a target 190 yards out. Adjust ball position and stance to the lie while keeping a controlled, repeatable strike.",
        coachingCue: "Match your setup to the lie - ball back off a tight lie, weight into the slope on uneven ground. Control beats power; a repeatable three-quarter hybrid finds more greens than a max swing.",
        keyFocus: "Repeatable hybrid contact from any lie",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Advance 7 of 10 balls onto the target line with solid contact. Mishits from poor lie adjustment restart the block.",
      },
      {
        id: "sam_hw4", name: "The Pressure Fairway Circuit", duration: "15 min", reps: "5 consecutive long-club shots",
        description: "Hit 5 consecutive fairway wood shots with a target dispersion window of 20 yards. Focus on rhythm over maximum power - when tension rises, players tend to quicken the transition. Any miss resets the sequence back to shot 1.",
        coachingCue: "Focus on rhythm over maximum power. When tension rises, players tend to quicken the transition - slow down the top pause.",
        keyFocus: "High-probability long-club strategy under pressure",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Hit all 5 shots inside the target corridor consecutively. Any miss on shots 2 through 5 instantly resets the sequence back to shot 1.",
      },
    ],
    driver: [
      {
        id: "sam_dr1", name: "Pressure Tee Shot - Shape on Command", duration: "20 min", reps: "10 tee shots",
        description: "Call the shape (draw or fade) before each tee shot and execute into a defined fairway corridor. Alternate shapes to prove you can bend it either way under pressure.",
        coachingCue: "See the shape and the start line before you step in, then commit fully - a half-hearted shape is a two-way miss. Trust the setup to create the curve; don't steer it with your hands.",
        keyFocus: "Shaping the tee shot both directions on demand",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Produce the called shape inside the corridor on 7 of 10 tee shots. Missing the shape or corridor restarts the set.",
      },
      {
        id: "sam_dr2", name: "Course Management Simulation", duration: "25 min", reps: "9 tee shots",
        description: "Play 9 simulated tee shots on holes of varied shape and hazard, choosing the club and target that leaves the best angle in. Score fairways hit and quality of position, not raw distance.",
        coachingCue: "The tee shot's job is to set up the approach - sometimes that's a 3-wood to the wide side, not a driver at the trouble. Pick the target that keeps the big number out of play.",
        keyFocus: "Strategic tee-shot decisions that protect the card",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Find the correct position on 6 of 9 tee shots with the right club choice. Chasing distance into hazards restarts the simulation.",
      },
      {
        id: "sam_dr3", name: "Controlled Draw and Fade Tee", duration: "20 min", reps: "10 shots",
        description: "Hit 5 controlled draws and 5 controlled fades off the tee into a 25-yard corridor, keeping the curve gentle and repeatable rather than exaggerated. Consistency of shape matters more than the size of the curve.",
        coachingCue: "A tour-caliber shape is a subtle 5-yard bend, not a big hook or slice. Repeat the setup and let the corridor confirm the pattern - repeatability is the whole point.",
        keyFocus: "Repeatable, controlled shot shapes off the tee",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Land 4 draws and 4 fades inside the corridor with a controlled curve. Exaggerated or missed shapes restart the set.",
      },
      {
        id: "sam_dr4", name: "Dispersion Tightening", duration: "20 min", reps: "15 tee shots",
        description: "Hit 15 tee shots and chart the left-right dispersion, aiming to keep the entire pattern inside a 30-yard-wide band. The goal is to shrink the spread, not chase the longest drive.",
        coachingCue: "Aim small to miss small - pick a single tree or marker, not the whole fairway. A tight dispersion band is what keeps you in play on every hole; distance means nothing from the trees.",
        keyFocus: "Shrinking left-right dispersion off the tee",
        difficulty: "mastery" as DrillDifficulty,
        completionStandard: "Keep 12 of 15 tee shots inside the 30-yard dispersion band. A wider pattern restarts the charting session.",
      },
    ],
  },

  // ── DOM - Level 4: Scratch & Under-Par ──────────────────────────────────
  dom: {
    putting: [
      {
        id: "dom_p1", name: "Tour-Standard Pressure Ladder", duration: "15 min", reps: "10 consecutive putts from 8 ft",
        description: "Putt 10 consecutive putts from 8 feet on a breaking slope. A single miss at any point resets the 10-putt counter back to zero. Maintain absolute stillness in the head and lower body.",
        coachingCue: "Maintain absolute stillness in the head and lower body. Elite putting relies on microscopic consistency in face angle at impact.",
        keyFocus: "Tour-level conversion rates on must-make par and birdie putts",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Make all 10 putts in a row without a single miss. A single miss at any point resets the 10-putt counter back to zero.",
      },
      {
        id: "dom_p2", name: "Spin-Axis Putt Roll Optimization", duration: "15 min", reps: "10 putts",
        description: "Use alignment tape or a line on the ball to verify immediate true roll versus skid. Check shaft lean at address - a slight upward strike (positive attack angle of 1–2 degrees) launches the ball smoothly onto the turf.",
        coachingCue: "Check shaft lean at address. A slight upward strike - positive attack angle of 1 to 2 degrees - launches the ball smoothly onto the turf without skidding.",
        keyFocus: "Perfect launch angle and zero skid for true tracking over long distances",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Achieve true roll within the first 12 inches on 9 of 10 putts. Failing the metric threshold restarts the 10-shot block.",
      },
      {
        id: "dom_p3", name: "The Blindfolded Speed Drill", duration: "15 min", reps: "10 lag putts from 30+ ft",
        description: "Hit 10 lag putts from 30+ feet with eyes closed or looking at the target rather than the ball, relying entirely on kinesthetic feel. Over-controlling the mechanics creates deceleration - trust your athletic instincts.",
        coachingCue: "Over-controlling the mechanics creates deceleration. Trust your athletic instincts and let the target dictate the stroke size.",
        keyFocus: "Harmonization of speed and distance memory under high-stress conditions",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Leave 8 of 10 putts within a 1-foot circle. Falling short of 8 requires a full restart.",
      },
      {
        id: "dom_p4", name: "Competitive Make Simulation", duration: "20 min", reps: "18 putts, tournament scoring",
        description: "Simulate 18 holes of putting from varied breaking distances (4–12 ft), one ball each, tracking makes against a tour-standard target. This mirrors the single-attempt reality of competition - no second balls, no re-reads.",
        coachingCue: "One ball, one read, one stroke - this is the standard. Tour players convert this set at a defined rate; anything below it is a deficiency to close, not a bad day to excuse.",
        keyFocus: "Single-attempt conversion under tournament simulation",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Meet the tour-standard make total across all 18 attempts. Falling below the standard restarts the full simulation.",
      },
      {
        id: "dom_p5", name: "Zero-Skid Lag Matrix", duration: "20 min", reps: "12 putts (4 each at 25, 40, 55 ft)",
        description: "Combine launch quality and speed control: every long putt must show true roll off the face and finish inside a tightening dead-zone at each distance. Verify roll with a marked ball and speed with the finish position.",
        coachingCue: "Distance control and launch quality are one system, not two. A skidding ball is unpredictable at any distance - deliver a positive attack angle and let identical tempo scale the arc.",
        keyFocus: "Uniting true roll with elite lag speed across long distances",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Finish 10 of 12 putts inside the dead-zone with verified true roll. Skid or a long/short miss restarts the affected station.",
      },
    ],
    short_game: [
      {
        id: "dom_sg1", name: "Micro-Landing Window", duration: "20 min", reps: "10 high-lofted chips",
        description: "Place a scorecard or small coin on the green as a landing target. Hit 10 high-lofted chips over a bunker. Open the clubface wide, lay the shaft back slightly, and commit fully to sliding the bounce underneath the ball.",
        coachingCue: "Open the clubface wide, lay the shaft back slightly, and commit fully to sliding the bounce underneath the ball without slowing down.",
        keyFocus: "Elite dispersion control for tight pin placements and dangerous green complexes",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Land within 6 inches of the coin on 8 of 10 shots. Missing the tight window restarts the entire set.",
      },
      {
        id: "dom_sg2", name: "The 3-Club Short-Game Test", duration: "20 min", reps: "9 shots (3 LW, 3 9-iron, 3 hybrid)",
        description: "Hit 9 consecutive short-game shots to a tucked pin - 3 with a Lob Wedge, 3 with a 9-Iron, and 3 with a Hybrid (bump-and-run style). Adjust your setup, not your stroke style, when switching clubs.",
        coachingCue: "Adjust your setup, not your stroke style, when switching clubs. Let the loft do the work.",
        keyFocus: "Complete mastery of all greenside trajectories under tournament conditions",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Finish all 9 shots within 3 feet of the hole. Any shot finishing outside the 3-foot ring resets the entire 9-shot test.",
      },
      {
        id: "dom_sg3", name: "Severe Lie Scramble", duration: "20 min", reps: "10 recovery shots",
        description: "Hit 10 short-game recovery shots from plugged sand, bare mud lies, and uphill/downhill slopes. On downhill lies, match your spine angle to the slope, play the ball back, and expect the ball to release hard.",
        coachingCue: "On downhill lies, match your spine angle to the slope, play the ball back, and expect the ball to release hard.",
        keyFocus: "Par-saving execution from catastrophic or unusual course conditions",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Convert 8 of 10 shots to tap-in range. Failing to meet the 8-of-10 standard forces a full restart.",
      },
      {
        id: "dom_sg4", name: "Spin-Control Flight Windows", duration: "20 min", reps: "9 chips (3 windows)",
        description: "Hit greenside shots into three distinct flight-and-spin windows - one-hop-and-check, two-hop-release, and dead-stop flop - to the same tucked pin. Control spin through attack angle and bounce delivery, not wrist manipulation.",
        coachingCue: "Spin is a function of attack angle, contact quality, and bounce delivery - dial it deliberately. A tour short game produces the reaction you called, not the one you hoped for.",
        keyFocus: "Commanding spin and flight windows around the green",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Produce the intended reaction and finish inside 3 feet on 7 of 9 shots. A wrong reaction resets the window.",
      },
      {
        id: "dom_sg5", name: "Tournament Scramble Gauntlet", duration: "25 min", reps: "12 up-and-downs",
        description: "Run 12 up-and-down attempts from the hardest lies on the practice facility, scored against a tour scrambling percentage. A single lapse in commitment or club selection is charted as a strategic failure.",
        coachingCue: "Scrambling is where rounds are saved and tournaments are won. Assess, commit, execute - the standard is a professional up-and-down rate, and the numbers don't negotiate.",
        keyFocus: "Sustained scrambling execution at tour scoring rates",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Convert to the tour-standard scramble percentage across all 12 attempts. Falling below the rate restarts the gauntlet.",
      },
    ],
    pitching: [
      {
        id: "dom_pt1", name: "Elite Wedge Matrix - Sub-5-Yard Spread", duration: "20 min", reps: "5 balls × 3 clock positions",
        description: "Build the full wedge Matrix (8:00/9:00/10:00 across every wedge) and demand a landing spread under 5 yards at each station, verified on a launch monitor or with measured targets. Carry numbers are recorded to the yard.",
        coachingCue: "A sub-5-yard spread is the professional standard, not an aspiration. Identical setup, only the arm position changes - if the spread widens, the fault is contact or tempo, and it gets fixed now.",
        keyFocus: "Tour-precision distance tiers across the full wedge set",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Hold a sub-5-yard landing spread at all three positions for each wedge. Any station exceeding the spread is re-hit until it conforms.",
      },
      {
        id: "dom_pt2", name: "Spin Verification Wedge", duration: "20 min", reps: "10 pitches",
        description: "Hit 10 wedge shots monitoring spin rate and landing reaction, targeting a repeatable spin window that stops the ball predictably. Verify clean grooves, dry contact, and consistent low-point control.",
        coachingCue: "Spin is engineered through contact quality and attack angle - a flier or a fat strike destroys the number. Deliver the same descending strike and confirm the spin window on every ball.",
        keyFocus: "Repeatable spin rates for predictable stopping power",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Land 8 of 10 pitches inside the target spin window with a predictable stop. Erratic spin restarts the block.",
      },
      {
        id: "dom_pt3", name: "Flighted Wedge Windows", duration: "20 min", reps: "12 pitches (3 windows)",
        description: "From 100 yards, flight the wedge through low, medium, and high launch windows on command, controlling trajectory and descent angle to attack front, middle, and back pins. Ball position and finish control the window.",
        coachingCue: "Trajectory is a scoring weapon - the front pin demands a lower, checking flight; the back pin a higher, softer one. Command the launch window on call; a wedge that only flies one height is half a wedge.",
        keyFocus: "Trajectory command to attack every pin position",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Fly the called window and hold the scoring zone on 9 of 12 pitches. Missing the window resets the affected window.",
      },
      {
        id: "dom_pt4", name: "Pressure Scoring Zone", duration: "20 min", reps: "10 pitches, scored",
        description: "Play 10 scored wedge shots inside 120 to tucked pins, deducting heavily for any shot above the hole or short-sided. Track your total against a tour proximity standard measured in feet from the pin.",
        coachingCue: "Proximity is the currency of scoring wedges - below the hole, in the zone, every time. The tour average from this range is a known number; match it or expose the gap and close it.",
        keyFocus: "Tour-proximity wedge execution under scoring pressure",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Meet the tour proximity standard on the 10-shot total. Falling short of the standard restarts the scored set.",
      },
      {
        id: "dom_pt5", name: "Clock Precision - All Positions", duration: "20 min", reps: "12 pitches, random calls",
        description: "Random distances inside 120 are called in sequence; select the exact clock position and wedge from your Matrix and execute to a 5-yard-radius target. This audits total recall and repeatability of the calibrated system.",
        coachingCue: "Instant recall, zero rehearsal - see the number, select the position, deliver. If the carries wander under random calls, the Matrix isn't internalized to the professional standard yet.",
        keyFocus: "On-demand Matrix recall across all clock positions",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Land 10 of 12 pitches within a 5-yard radius of the called number. Falling short restarts the audit.",
      },
    ],
    mid_irons: [
      {
        id: "dom_fs1", name: "TrackMan Spin-Axis Audit", duration: "20 min", reps: "10 shots with 6-iron",
        description: "Hit 10 full shots with a 6-iron while monitoring spin axis and smash factor on a launch monitor (or using alignment tape feedback). Address face-to-path discrepancies - if the spin axis tilts heavily, check wrist bow at the top and transition slot.",
        coachingCue: "Address face-to-path discrepancies. If the spin axis tilts heavily left or right, check your wrist bow at the top and transition slot.",
        keyFocus: "Tour-level compression, zero side-spin tilt, and maximum energy transfer",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Maintain a spin-axis within ±1 degree and smash factor above 1.38 on 8 of 10 shots. Failing the metrics restarts the 10-shot test.",
      },
      {
        id: "dom_mi2", name: "Ball Compression Verification", duration: "20 min", reps: "10 shots",
        description: "Hit mid-iron shots monitoring smash factor and low-point control, verifying full ball compression through forward shaft lean and a divot after the ball. Every strike must show tour-level energy transfer.",
        coachingCue: "Compression is proof of a delivered strike - shaft leaning, hands ahead, divot after the ball. A smash factor below standard is a fundamental leak, not a swing you can live with.",
        keyFocus: "Verified full compression and energy transfer with the irons",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Hold tour-level smash factor with a divot after the ball on 8 of 10 strikes. Weak contact restarts the block.",
      },
      {
        id: "dom_mi3", name: "Shape on Demand - 10-Shot Series", duration: "20 min", reps: "10 shots (5 draw, 5 fade)",
        description: "Alternate five controlled draws and five controlled fades with a mid-iron, each starting on the correct line and curving a precise amount into a tight target window. Spin-axis tilt is deliberate and repeatable.",
        coachingCue: "The curve is spin-axis tilt you control through face-to-path, not a hopeful lash. Start line and curve amount are both specified - deliver the exact shape, repeatedly, to the professional standard.",
        keyFocus: "Precise, repeatable two-way shot shaping with the irons",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Produce the exact called shape into the window on 8 of 10 shots. A two-way miss or wrong curve restarts the series.",
      },
      {
        id: "dom_mi4", name: "GIR Assault Circuit", duration: "25 min", reps: "12 approach shots",
        description: "Attack 12 simulated approach shots to varied pins, scored against a tour greens-in-regulation and proximity standard. Club selection, start line, and trajectory must all match the shot the pin demands.",
        coachingCue: "Greens in regulation are the engine of scoring - a professional hits the number and the correct portion of the green. Proximity is charted; the standard is tour average from each range.",
        keyFocus: "Tour-rate GIR and proximity from the mid-irons",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Meet the tour GIR and proximity standard across the 12 shots. Falling below the rate restarts the circuit.",
      },
      {
        id: "dom_mi5", name: "Trajectory Launch Windows", duration: "20 min", reps: "12 shots (3 windows)",
        description: "Flight the mid-iron through low, standard, and high launch windows on command, controlling launch angle, spin, and descent to hold greens in varied wind. Verify each window's launch and spin on a monitor where possible.",
        coachingCue: "Launch window is a wind-management tool - knock it down into the breeze, ride it downwind, all with controlled spin. A professional owns the vertical dispersion; hit the window you called.",
        keyFocus: "Commanding launch and spin windows with the irons",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Fly the called window and hold the green on 9 of 12 shots. Missing the launch window resets that window.",
      },
    ],
    hybrids_woods: [
      {
        id: "dom_hw1", name: "Launch Window Optimization", duration: "20 min", reps: "10 shots",
        description: "Optimize hybrid and fairway wood launch on a monitor, dialing launch angle and spin rate into the efficient carry window for maximum controlled distance. Verify smash factor and spin against tour benchmarks.",
        coachingCue: "Efficient distance lives in a narrow launch-and-spin window - too much spin balloons it, too little starves the carry. Deliver the optimized numbers; guesswork is for amateurs.",
        keyFocus: "Optimized launch and spin for maximum controlled long-club carry",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Land 8 of 10 shots inside the optimized launch-and-spin window. Numbers outside the window restart the block.",
      },
      {
        id: "dom_hw2", name: "Aggressive Lay-Up Mastery", duration: "20 min", reps: "10 shots",
        description: "Execute precision lay-ups and go-shots on par-5 scenarios, choosing between an aggressive carry over hazard and a controlled lay-up to the ideal wedge number. Every decision is scored on risk-adjusted outcome.",
        coachingCue: "The aggressive line is only correct when the reward is real and the strike is committed - otherwise lay to your deadliest number. Course management at this level is math, executed without ego.",
        keyFocus: "Risk-adjusted long-club strategy on scoring holes",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Make and execute the correct risk-adjusted play on 8 of 10 scenarios. A reckless or timid error restarts the set.",
      },
      {
        id: "dom_hw3", name: "Wind Management Long Clubs", duration: "20 min", reps: "10 shots",
        description: "Hit hybrids and fairway woods into simulated head, tail, and crosswinds, flighting the ball to hold its line and control carry. Trajectory and spin are manipulated deliberately to defeat the wind.",
        coachingCue: "The wind exposes lazy launch and spin instantly - flight it down into the breeze, hold the line across it. A professional controls the ball flight; the conditions are an input, not an excuse.",
        keyFocus: "Long-club ball-flight control in all wind conditions",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Hold the intended line and window on 8 of 10 shots against the simulated wind. Ballooning or spraying restarts the block.",
      },
      {
        id: "dom_hw4", name: "Hybrid from Every Lie", duration: "20 min", reps: "12 shots",
        description: "Strike hybrids from tight lies, deep rough, fairway bunkers, and severe slopes to a tight target line, adjusting setup to each lie while holding a repeatable, disciplined strike. No lie is an excuse for a loose swing.",
        coachingCue: "Every lie demands a setup adjustment and the same disciplined delivery - ball position, weight, and shaft lean match the lie. The long clubs punish laziness; deliver a professional strike from all of them.",
        keyFocus: "Disciplined hybrid contact from any lie on the course",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Advance 9 of 12 balls onto the target line with committed contact. Mishits from poor lie management restart the block.",
      },
      {
        id: "dom_hw5", name: "Fairway Wood Trajectory Control", duration: "20 min", reps: "10 shots",
        description: "Command low penetrating and high soft-landing fairway wood shots into greens and lay-up zones, controlling descent angle to hold or release as required. Verify launch and spin against the intended window.",
        coachingCue: "A fairway wood that can only fly one trajectory is a liability into a firm green - flight it down to run, up to stop. Command the descent angle; the shot the situation demands is the only acceptable one.",
        keyFocus: "Trajectory and descent-angle command with the fairway wood",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Fly the intended trajectory and hold the target on 8 of 10 shots. Missing the window restarts the block.",
      },
    ],
    driver: [
      {
        id: "dom_fs2", name: "The Wind Window Challenge", duration: "20 min", reps: "10 shots",
        description: "Hit 10 drives and long irons into a simulated crosswind or headwind, alternating between piercing low bullets and high soft-landing cuts. To lower trajectory, choke down 1 inch, move the ball back, and maintain a compact three-quarter finish.",
        coachingCue: "To lower trajectory, choke down 1 inch, move the ball back, and maintain a compact three-quarter finish.",
        keyFocus: "Absolute mastery of launch windows, spin rates, and ball-flight manipulation",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Hit 8 of 10 shots that successfully hold their intended window and land within a 15-yard dispersion grid. Falling short of 8 requires restarting.",
      },
      {
        id: "dom_fs3", name: "Tournament Simulation Closing Stretch", duration: "30 min", reps: "3-hole stretch, par or better",
        description: "Play a virtual or actual 3-hole stretch where par or better is mandatory on every single hole. If you make a bogey, you return to the first hole. Focus entirely on the immediate shot in the present moment.",
        coachingCue: "Focus entirely on the immediate shot in the present moment rather than thinking about the final score or past mistakes. Control your breathing routine.",
        keyFocus: "Mental resilience and clutch execution required to shoot under par",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Play the 3-hole stretch in even par or better without a single dropped shot. A single bogey on any hole resets the entire simulation back to hole one.",
      },
      {
        id: "dom_dr3", name: "Driver Launch Audit", duration: "20 min", reps: "10 tee shots",
        description: "Audit driver launch on a monitor, dialing launch angle, spin rate, and attack angle into the efficient window for maximum carry and controlled dispersion. Ball position, tee height, and low-point control are verified each rep.",
        coachingCue: "Efficient distance is a launch-and-spin equation - a positive attack angle with optimized spin is free yardage. Hit the numbers; a driver that isn't optimized is leaving strokes on the tee.",
        keyFocus: "Optimized launch, spin, and attack angle for maximum efficient distance",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Deliver launch, spin, and attack-angle numbers inside the optimized window on 8 of 10 tee shots. Numbers outside the window restart the audit.",
      },
      {
        id: "dom_dr4", name: "Trajectory Shaping Off Tee", duration: "20 min", reps: "12 tee shots",
        description: "Command four tee-shot shapes - low draw, low fade, high draw, high fade - into defined corridors, controlling both spin-axis tilt and launch window simultaneously. Each shape is called before the shot.",
        coachingCue: "Elite tee shots combine curve and trajectory on demand - a low fade to hold a crosswind, a high draw to chase a downwind fairway. Command the spin axis and the launch window together; hope has no place here.",
        keyFocus: "Simultaneous shape and trajectory command off the tee",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Produce the called shape-and-trajectory combination inside the corridor on 9 of 12 tee shots. A missed combination resets that shape.",
      },
      {
        id: "dom_dr5", name: "Pressure Fairway Series", duration: "20 min", reps: "10 consecutive tee shots",
        description: "Hit 10 consecutive tee shots into a tour-width fairway corridor, alternating called shapes, with any miss resetting the streak to zero. This simulates the single-attempt fairway demand of a tournament back nine.",
        coachingCue: "One miss and you start over - this is the reality of a closing stretch. Commit to the shape, trust the sequence, and repeat it under mounting pressure. The fairway is the standard, not a hope.",
        keyFocus: "Sustained fairway execution under single-attempt pressure",
        difficulty: "elite" as DrillDifficulty,
        completionStandard: "Hit all 10 tee shots into the corridor consecutively. Any miss instantly resets the streak to zero.",
      },
    ],
  },
};

// Number of drills shown per session per coach level
export const COACH_SESSION_DRILL_COUNT: Record<string, number> = {
  que: 2,
  mason: 3,
  sam: 4,
  dom: 5,
};

// Coach-specific session goals - coach × phase × week (1–3).
export const COACH_GOALS: Record<string, Record<Phase, Record<number, string>>> = {
  que: {
    putting: {
      1: "By the end of this week you'll be able to make a smooth, steady stroke without any wrist flick - and it'll feel easy.",
      2: "This week you'll get comfy lagging long putts up close so you rarely three-putt. Nice and relaxed.",
      3: "By week's end you'll roll in most of your short putts and have a little routine that feels like yours.",
    },
    short_game: {
      1: "By the end of this week you'll be chipping the ball cleanly and picking smart spots to land it.",
      2: "This week you'll add a few fun new shots - a little bump-and-run, a soft one, and your first bunker escapes.",
      3: "By week's end you'll get up-and-down more often and feel confident around the greens.",
    },
    pitching: {
      1: "This week you'll build your own simple distance chart so you always know how far each swing goes.",
      2: "By week's end you'll be able to hit the ball low, medium, or high - whatever the shot needs.",
      3: "This week you'll start landing your wedges close from any distance inside 120 yards. Big confidence booster!",
    },
    mid_irons: {
      1: "By the end of this week you'll be striking your irons cleanly - ball first, then turf. It'll feel crisp.",
      2: "This week you'll learn to gently curve the ball both ways. It's easier than it sounds, promise!",
      3: "By week's end you'll know your iron distances and be hitting more greens. You're really becoming a golfer!",
    },
    hybrids_woods: {
      1: "This week you'll get comfortable sweeping your hybrids and woods so they feel friendly, not scary.",
      2: "By week's end you'll be finding the fairway more often with your longer clubs.",
      3: "This week you'll handle tricky lay-up situations with a simple plan and a smile.",
    },
    driver: {
      1: "By the end of this week you'll have a comfy setup and a smooth tempo with the big stick.",
      2: "This week you'll try shaping the ball both ways off the tee - it's a blast when it works!",
      3: "By week's end you'll be finding more fairways and enjoying the driver instead of fearing it.",
    },
  },
  mason: {
    putting: {
      1: "Target: a repeatable pendulum stroke with zero wrist break - verified on 9 of 10 strokes.",
      2: "Target: lag every putt from 20–40 ft to within a 3-foot circle 80% of the time.",
      3: "Target: 70%+ make rate from 6 ft with a repeatable pre-putt routine on every attempt.",
    },
    short_game: {
      1: "Target: land 7 of 10 chips in a 3-foot landing zone with consistent roll-out.",
      2: "Target: execute bump-and-run, flop, and bunker shots with a controlled entry point on 60%+ of attempts.",
      3: "Target: 60%+ up-and-down rate from inside 20 yards.",
    },
    pitching: {
      1: "Target: log carry distances for all three clock positions (8:00/9:00/10:00) per wedge, within a 5-yard spread.",
      2: "Target: control trajectory (low/mid/high) on command, hitting the intended window 70% of the time.",
      3: "Target: land inside threshold from every yardage under 120 on 65%+ of shots.",
    },
    mid_irons: {
      1: "Target: ball-first contact confirmed by a divot after the ball on 8 of 10 strikes.",
      2: "Target: produce a controlled draw and fade on demand, starting on the correct line 70% of the time.",
      3: "Target: confirm 10–12 yard gaps between irons and hit 60%+ greens in simulation.",
    },
    hybrids_woods: {
      1: "Target: center-face contact with hybrid and fairway wood on 7 of 10 shots from varied lies.",
      2: "Target: 60%+ fairways hit in simulation with hybrids and woods.",
      3: "Target: select and execute the correct lay-up club to your best wedge yardage on every scenario.",
    },
    driver: {
      1: "Target: consistent tee height, setup, and tempo - a repeatable start line on 8 of 10 swings.",
      2: "Target: shape draw and fade on command, curving the ball the intended direction 70% of the time.",
      3: "Target: 70%+ simulated fairways hit with a defined tee strategy.",
    },
  },
  sam: {
    putting: {
      1: "The scratch stroke has zero manipulation - pure shoulders. That's the standard we're chasing this week.",
      2: "Scratch players lag to tap-in range nearly every time. Aim for three-putt-free sessions from 20–40 ft.",
      3: "80%+ from 6 ft is the scratch player standard - that's where we're headed this week.",
    },
    short_game: {
      1: "Contenders control their landing spot to the foot. Land 8 of 10 chips in a 3-foot zone.",
      2: "A complete short game has every shot on call. Own bump-and-run, flop, and sand this week.",
      3: "70%+ up-and-down from inside 20 yards separates the field. That's your benchmark.",
    },
    pitching: {
      1: "Scratch players know their wedge numbers cold. Build a Matrix with under a 4-yard spread per station.",
      2: "Trajectory control on demand is a scoring weapon. Hit your intended window 80% of the time.",
      3: "Landing inside threshold from any yardage under 120 on 75%+ - that's tournament-ready.",
    },
    mid_irons: {
      1: "Pure ball-first contact is non-negotiable at scratch level. Flush 9 of 10 this week.",
      2: "Shaping the ball both ways on command is what separates contenders. Own the draw and the fade.",
      3: "70%+ greens in regulation is the scratch benchmark. Confirm your gaps and go hit them.",
    },
    hybrids_woods: {
      1: "Scratch players trust the long clubs from any lie. Center contact on 8 of 10 is the target.",
      2: "70%+ fairways with the long game keeps you in every hole. That's the standard.",
      3: "Elite course management means the perfect lay-up every time. Leave yourself your favorite number.",
    },
    driver: {
      1: "A repeatable driver setup and tempo is your foundation. Same start line 9 of 10 - scratch standard.",
      2: "Shaping the tee shot both ways unlocks every hole. Curve it on command 80% of the time.",
      3: "75%+ fairways with a real strategy - that's how contenders keep the card clean.",
    },
  },
  dom: {
    putting: {
      1: "A pure stroke is the baseline, not the goal. No wrist, no deceleration - every rep. This is the price of entry.",
      2: "Tour players rarely three-putt. From 20–40 ft, inside three feet is the standard. Start meeting it.",
      3: "Tour professionals make 90%+ from 6 ft in practice. This is your baseline. Build toward it - no excuses.",
    },
    short_game: {
      1: "Clean contact and a chosen landing spot are non-negotiable. Amateurs guess; you will not.",
      2: "Every shot around the green must be on command - bump, flop, sand. A missing shot is a missing skill.",
      3: "Tour up-and-down rates live near 90% from close. That's the standard you're chasing. Get to work.",
    },
    pitching: {
      1: "Know your wedge numbers to the yard. Tour players don't estimate - they know. Build the Matrix properly.",
      2: "Trajectory is a tool, not an accident. Hit the window every time or the shot doesn't count.",
      3: "Inside 120, a professional expects to hit it close. Landing inside threshold is the baseline. Meet it.",
    },
    mid_irons: {
      1: "Ball first, always. A fat or thin shot is a fundamental failure. I expect it clean, every time.",
      2: "Working the ball both ways is a professional requirement, not a party trick. Own it.",
      3: "Tour players hit greens. 70% in regulation is a floor, not a ceiling. Confirm your gaps and deliver.",
    },
    hybrids_woods: {
      1: "The long clubs expose lazy technique instantly. I expect a repeatable, disciplined strike from every lie.",
      2: "Find the fairway or accept the consequences. The standard is control, not hero shots.",
      3: "Course management is where scores are made. Lay up to your strength - every time, no exceptions.",
    },
    driver: {
      1: "Setup is everything with the driver. Get it identical every time. Fundamentals are internalized here, not learned.",
      2: "Shaping the tee shot on command is a tour skill. I expect you to command it, not hope for it.",
      3: "The driver sets up the hole. A professional keeps it in play with a plan. 75% fairways is your baseline - build past it.",
    },
  },
};

// Coach-specific drill coaching cues - coach id → drill id. 4 coaches × 36
// drills = 144 distinct cues. These replace the generic Drill.coachingCue when
// a coachId is supplied.
export const COACH_DRILL_CUES: Record<string, Record<string, string>> = {
  que: {
    p1: "Picture your arms as a swing on a playground - they just rock back and through. Keep your feet still and let the shoulders do everything. Tap a tee? No worries - just reset and try the next one.",
    p2: "Look at your putt from three spots like a detective solving a fun puzzle - behind the ball, the low side, and behind the hole. Then trust your first instinct. Three in a row and you get to move back!",
    p3: "Long putts are all about a nice, easy roll - get it to snuggle up close, no need to make it. Feel the putter head swing like a gentle pendulum and let the pace happen on its own.",
    p4: "This one's all about getting comfy at setup: weight even, hands relaxed, eyes right over the ball. If a putt misses, don't blame your stroke - just come back and check your comfy setup first.",
    p5: "Try putting with just one hand at a time - it feels funny, but it teaches your hands their jobs. Lead hand keeps things steady, trail hand gives a little push. Have fun with it!",
    p6: "Close your eyes and just feel the stroke - no peeking! It's a little scary at first but kind of magical. Trust the smooth motion you've been building. You've got this.",
    p7: "Think of it like turning up a dial - the farther the putt, the bigger the backswing, same easy tempo. Work your way out station by station. Little steps, big progress!",
    p8: "Now let's make it a game - one ball, pretend you're playing real holes! Do your little routine before each putt and just enjoy the challenge. No do-overs makes it exciting.",
    sg1: "Same little setup every time - the only thing you change is how far back your arms go. 8 o'clock for a short roll, 9 o'clock for more. Let it land and roll like a putt. Easy!",
    sg2: "Forget the hole - just try to land the ball on the towel. It's like a fun target game. Three in a row and you win that round, then move the towel!",
    sg3: "Sand shots are actually fun once you trust them - splash the sand two inches behind the ball, not the ball itself. Make a full, confident swing and let the sand pop it out. Don't slow down!",
    sg4: "Open the face way up to the sky and make a big, brave swing along your feet. The loft does all the work - your only job is to not chicken out and slow down. Trust it!",
    sg5: "Pretend you missed the green and need to get it close - pick your clock swing, do your little routine, and go. It's a fun test! Every up-and-down is a small victory to celebrate.",
    sg6: "Tight lies look scary but here's the trick: hands ahead, weight on your front foot, and clip the ball first with a small swing. A little brush of the grass after means you nailed it!",
    pt1: "This is like building your own cheat sheet - swing to 8, 9, and 10 o'clock and write down how far each flies. Now you'll always know which swing to use. Pretty cool, right?",
    pt2: "Time to prove your numbers work - aim for your 9 o'clock distance and try to land three near the target in a row. Same easy tempo, don't force it. You're locking in your chart!",
    pt3: "Same swing, but move the ball forward for higher shots and back for lower ones. It's like a remote control for how high the ball flies. Try all three and see what happens!",
    pt4: "Want it to stop quick? Hit down a little steeper and clean. Want it to roll out? Shallower swing. Feel the difference - it's like the ball's got brakes you control!",
    pt5: "One wedge, but you can hit a bunch of different distances just by changing your clock swing. Mix them up randomly - it's like a fun quiz for your hands!",
    mi1: "Here's the golden rule: hit the ball first, then the ground. See a little divot after where the ball was? Give yourself a high five - that's perfect!",
    mi2: "Most missed shots aren't your swing - they're just aiming wrong! Lay down your sticks, line up nice and square, and you'll be amazed how many more shots find the target.",
    mi3: "Aim your feet a little right, turn the face toward the target, and swing along your toes. The ball starts right and curves back - like a friendly boomerang. So satisfying!",
    mi4: "Now the other way - aim your feet a touch left, open the face to the target, swing along your toes. The ball starts left and drifts right. Two shots in your bag now. Nice!",
    mi5: "Hit a bunch with each iron and see how far each goes. You want steady steps between them - like a staircase. A fun way to really get to know your clubs!",
    mi6: "Play pretend par-3s - pick a target, do your routine, and swing to a balanced finish. It's like a mini round on the range. Have fun competing with yourself!",
    hw1: "The hybrid is your friendly rescue club - treat it like a big iron, not a scary wood. Ball just forward of center, small descending swing. It's built to make hard lies easy!",
    hw2: "Fairway woods like a smooth sweep - imagine brushing the grass, not digging in. Ball a bit forward, easy tempo. Let the club skim along and the ball just launches. Lovely feeling!",
    hw3: "Aim for a wide pretend fairway from way back - direction matters way more than distance here. Three in a row in the fairway and you've done it! Smooth, controlled swings win.",
    hw4: "This is a tough one, so be patient with yourself! Ball a little forward, chest over it, and just brush the turf - no digging. Even the pros find this hard, so any good one is a big win!",
    hw5: "Smart golf is picking the spot that leaves your favorite little wedge distance. No need to be a hero - lay up to the number you love and make life easy on yourself!",
    dr1: "Set up big and tall for the driver - tee it high so half the ball peeks over the top, and lean your spine slightly away from the target. This helps you hit up and send it flying!",
    dr2: "Swing in slow motion and feel each spot along the way - no rush, no speed. It's like learning a dance step by step. Get the moves right slowly and speed comes on its own!",
    dr3: "Aim at the right side of the fairway, and let your hips lead so your hands drop to the inside. The ball starts right and curves back left - a big, beautiful draw. Fun to watch!",
    dr4: "You're aiming at a huge target - fairways are as wide as a building! Just make your normal smooth swing and find it three times in a row. Don't try to kill it, just guide it in.",
    dr5: "Impact is the big moment - weight on your front foot, hips turned open, hands just ahead of the ball. Practice freezing there in slow swings. Get this spot right and good shots follow!",
    dr6: "Put it all together - look at the hole, pick your shot, do your routine, and swing to a proud finish. This is real golf now! Enjoy owning the whole tee shot.",
  },
  mason: {
    p1: "Track your gate contact: clip the left tee and your path is out-to-in; clip the right and it's in-to-out. Zero touches means a square path. Log your clean-pass percentage.",
    p2: "Read from all three views and commit - indecision adds start-line error. Track your make rate at each distance; three in a row before you advance keeps the data honest.",
    p3: "Distance control is a tempo metric. Keep grip pressure at 4/10 and let backswing length set the pace. Track how many of your five stop inside the 3-foot circle - aim for 80%+.",
    p4: "Your address is your alignment baseline: 50/50 weight, V-grip at 4/10, eyes over the ball, putter matched to the rod. A miss here is almost always a setup error - verify before you touch the stroke.",
    p5: "This isolates face control (lead hand) from pace (trail hand). Watch each hand's start line separately - if lead-hand putts push right, your face is opening. Diagnose, then combine.",
    p6: "Removing sight forces you to trust your calibrated stroke. Predict where each putt finishes before opening your eyes, then check - the gap between feel and result is your feedback metric.",
    p7: "Same tempo, longer arc for more distance. Map backswing length to each 10-foot station and log your stops-within-threshold rate. This builds a repeatable distance-to-arc reference.",
    p8: "One ball, no mulligans - this is your true make-rate under simulated pressure. Run the full routine every time and log your score. That number is your realistic on-course baseline.",
    sg1: "The clock position is your only variable - 8:00 versus 9:00 changes carry-to-roll ratio predictably. Note the roll-out for each club at each position; that's your chipping data set.",
    sg2: "Target the landing zone, not the hole - that's the controllable variable. One miss resets your count. Track towel-hits out of total attempts; consistency of landing spot is the metric.",
    sg3: "Enter 2 inches behind the ball with a 10:00 swing - the shallow, wide entry from the hip bump is what launches it. Deceleration is the #1 measurable fault; commit to a full finish every time.",
    sg4: "Maximum loft, open stance, full 10:00 swing - the loft manages height, your commitment manages contact. Deceleration is the failure mode here; measure your full-finish rate.",
    sg5: "Select your clock position first - that decision sets your distance. Run the 30-second reset every time and log your up-and-down percentage from each lie. This is your scoring metric.",
    sg6: "Ball back, hands forward, 60/40 lead-side weight - this guarantees a descending strike. A small divot after the ball confirms ball-first contact. Track clean strikes versus chunks.",
    pt1: "Build the Wedge Matrix now - record carry for 8:00, 9:00, and 10:00 with each wedge. Same setup, only the clock changes. These numbers are the foundation of every wedge decision you'll make.",
    pt2: "Validate your Matrix: three balls inside the threshold circle before advancing. Same tempo, clock is the only variable - if you're missing short, your carry number needs recalibration.",
    pt3: "Ball position at setup is your trajectory dial - forward launches higher, back launches lower and more penetrating. Same 9:00 swing throughout. Track which window each position produces.",
    pt4: "Angle of attack drives spin: steep descent equals check, shallow equals release. The hip bump controls steepness. Note which produces more backspin and how each affects roll-out distance.",
    pt5: "One club, four distances, called randomly - this tests recall and repeatability of your Matrix. Same setup every time, only the clock changes. Track how close each lands to its target number.",
    mi1: "The divot is your feedback: after the ball equals correct sequence, before equals an early low point. Same setup with each iron. Track ball-first contact rate across all 30 strikes.",
    mi2: "Most missed greens are alignment errors, not swing errors. Set clubface to target, body parallel-left, 50/50 balance. Check your start line against the stick - that's your alignment feedback.",
    mi3: "Path right of the face equals draw spin. Closed stance sets the in-to-out path; the face still points at target. The hip bump drops hands to the inside slot. Track your start-line-and-curve pattern.",
    mi4: "Path left of the face equals fade spin - the mirror of the draw. Open stance promotes the out-to-in path; face stays at target. Track start line and curve to confirm the pattern.",
    mi5: "Record median carry per iron and confirm consistent 10–12 yard gaps. Irregular gaps usually mean off-center strikes, not speed. Cross-reference with your contact-quality data.",
    mi6: "Full routine on nine simulated par-3s - pick the club, run the reset, execute the sequence. Score it and track greens hit. This is your realistic iron-game baseline under simulated pressure.",
    hw1: "Treat the hybrid as an iron - slightly descending strike, ball just forward of center. Test it from tight lies, rough, and slopes. Track center-face contact rate across the varied lies.",
    hw2: "Shallow, sweeping angle of attack - low point at or just after the ball, no divot. Ball inside lead heel, slight tilt away. Track whether you're brushing turf versus digging; that's the key metric.",
    hw3: "At 200 yards, dispersion matters more than distance. One miss resets your count. Track your fairway-hit rate - a controlled 9-to-3 beats max effort every time for accuracy.",
    hw4: "The hardest shot in golf - ultra-shallow, no divot. Chest over the ball, minimal tilt, no early cast. Track clean brushes versus fat/thin. Patience at the top is the measurable key.",
    hw5: "Lay up to your highest-percentage wedge distance - reference your Matrix pass rates. The correct lay-up is a math decision, not an ego one. Choose the yardage where your data is strongest.",
    dr1: "Driver setup is unique: tee height so the equator sits at the crown, ball inside lead heel, slight spine tilt away - this creates the upward attack angle. Verify tilt and tee height every rep.",
    dr2: "At 50% speed, checkpoint each position: P3 takeaway parallel, P6 shaft on plane, P9 mirroring P3. Sequence correctness comes before speed - a flawed sequence at pace just repeats the error faster.",
    dr3: "Lower-body initiation drops the hands to the inside slot, creating the in-to-out path for the draw. The hip bump starts the 70/30 shift that arrives at impact. Track your start line and curve consistency.",
    dr4: "Under driver pressure, control the sequence, not the swing speed. Fairways are 30–50 yards wide - aim small. One miss resets the count. Track your consecutive-fairway rate as the metric.",
    dr5: "P7 is the measurable moment of truth: 70/30 lead-side weight, hips open, hands ahead, face square. Every driver rep builds toward this. Pause and verify it in slow motion before full speed.",
    dr6: "Full routine on nine hole shapes: read, pick your shape, run the reset, execute P1 through P10. Score fairways hit. This integrates every metric into one repeatable on-course process.",
  },
  sam: {
    p1: "Before each stroke, see the ball rolling dead through the center of the gate. Lock the lower body, let the shoulders pendulum. Precision here is a rehearsal for pressure putts.",
    p2: "Three views, one commitment. See the full break, pick your line, and never second-guess once you step in. That decisiveness is what holds up on the 18th green.",
    p3: "Feel the weight of the head and let it release - never steer a lag. See the ball dying into a 3-foot circle before you stroke it. Speed control is what separates two-putts from three.",
    p4: "A great stroke starts from a precise address. Build it identically every time - eyes over the ball, square to the rod. Consistency in setup is what lets you trust the line under pressure.",
    p5: "Feel how the lead hand holds the face square and the trail hand delivers the speed. Isolate each, then merge them into one seamless pendulum. This is fine-motor precision work.",
    p6: "With eyes closed, feel becomes everything. Sense the tempo, the release, the roll. This heightens the internal calibration that lets you putt by feel when pressure narrows your vision.",
    p7: "Let the arc scale, not the effort - tempo stays constant. Feel the exact backswing length each distance demands. This calibration gives you touch from anywhere on tour-fast greens.",
    p8: "One ball, one chance - just like competition. Full routine, 30-second reset, total commitment on every putt. This is where you rehearse being unshakable on Sunday.",
    sg1: "Same setup, clock position controls the outcome - pick it deliberately. Visualize the landing spot and the release before every chip. Around the greens, control beats hope.",
    sg2: "Commit to the landing zone with total precision - the hole takes care of itself. Three in a row demands focus on every rep, exactly like closing out a tournament.",
    sg3: "See the exact spot of sand you want to strike and drive through it with speed. The hip bump shallows the entry - trust it and accelerate. Fear decelerates; commitment splashes it close.",
    sg4: "Trust the loft completely and commit to the full swing - see the ball floating soft and landing dead. The flop rewards nerve and punishes hesitation. Rehearse the courage.",
    sg5: "Every lie is a new problem to solve with precision - pick the clock position, see the shot, execute the routine. This is exactly the pressure you'll feel saving par in competition.",
    sg6: "Precision contact is everything off a tight lie - ball first, then a whisper of turf. See the descending strike before you make it. This shot rewards discipline and punishes the lazy.",
    pt1: "Your Matrix is a weapon - commit these numbers to memory. Same setup, precise clock positions. Knowing your exact carries is what lets you attack flags instead of guessing.",
    pt2: "Precision calibration - three in a row confirms the number is real under focus. Let the arm position do the work, no forcing. Trustworthy numbers are what let you commit under pressure.",
    pt3: "See the trajectory before you hit it, then let ball position deliver it. Low, mid, high on command - that control is what lets you flight it into wind and attack tucked pins.",
    pt4: "Feel the steepness of your entry - steep bites, shallow releases. Watch how the ball reacts and store it. Controlling spin is how you hold firm greens and stop it by a tucked flag.",
    pt5: "Tour players own four distances from every wedge - this is that skill. Random calls demand instant precision. See the number, pick the clock, execute. This is competition-ready distance control.",
    mi1: "Feel the club compress the ball then take turf - ball first, always. See the descending strike before each swing. Pure contact is the non-negotiable base of every great iron shot.",
    mi2: "Precision starts with aim. Build the setup identically - face to target, lines parallel. A scratch player never wastes a shot on careless alignment. Make it automatic.",
    mi3: "See the ball starting right-center and drawing to the flag before you swing. Path in-to-out, face at target - feel the inside slot. Shaping on command is what separates the shot-makers.",
    mi4: "Picture the ball starting left and fading softly to the target. Out-to-in path, face at target - same principle, opposite spin. A dependable fade is a pressure-proof scoring shot.",
    mi5: "Know the exact gap between every iron - no overlaps, no holes. Inconsistent gaps expose contact flaws. Precise gapping is what lets a scratch player pick a club with total confidence.",
    mi6: "Nine par-3s, full routine, total commitment on each - just like competition. See the shot, pick the club, execute to a held finish. This rehearses the focus that wins on Sunday.",
    hw1: "The hybrid rewards a slightly descending, controlled strike from any lie. See it as a scoring club, not a bailout. Trust it from the rough and you gain a real weapon.",
    hw2: "Feel the clubhead sweeping low and long through impact - brush the grass, never dig. See the ball launching on a penetrating line. The sweep is a feel you rehearse until it's automatic.",
    hw3: "See a fairway, not just a target - commit to a start line. Controlled and repeatable, not maximum. Three in a row demands the discipline that holds up when you must find the short grass.",
    hw4: "Stay patient at the top - no cast - and feel the club skim the turf. See the ball launching low and true. This shot demands total precision and rewards only the disciplined swing.",
    hw5: "Course management is precision thinking. Lay up to your favorite number - the distance where your Matrix is deadliest. Smart position beats aggressive distance when you're playing to win.",
    dr1: "Feel the tilt that lets you launch up on the ball - that's free distance. Tee high, ball forward, spine away from target. Precision in setup is what turns a good swing into a bomb.",
    dr2: "Feel every checkpoint in slow motion - takeaway, top, follow-through. Burn the correct positions into memory. Precision at slow speed builds a repeatable swing you can trust at full tilt.",
    dr3: "See the ball starting right-center and drawing back to the fairway. Feel the hip bump shallow the club into the inside slot. A dependable draw off the tee is a serious weapon - own it.",
    dr4: "Three fairways in a row under pressure - that's the test. Commit to a start line and repeat your sequence. This rehearses the exact focus you need standing on the first tee in competition.",
    dr5: "Feel the ideal impact - weight forward, hips clearing, hands leading. See and hold P7 in slow motion, then deliver it at speed. This one position is where power and accuracy are born.",
    dr6: "Nine holes, full routine, total commitment - read it, shape it, own it. See the tee shot before you hit it. This is the complete process that holds up when the tournament is on the line.",
  },
  dom: {
    p1: "This gate exposes the truth. A tour-caliber stroke never touches a tee. Lower body dead still, shoulders only - give me 30 clean passes or you haven't earned the next drill.",
    p2: "Three-View reading is basic professionalism, not optional. Read it, commit, execute. If you can't string three in a row, your read or your nerve is failing. Fix it.",
    p3: "Three-putts are unacceptable, and they start with poor speed. Feel the pendulum, trust it, and get all five inside three feet. Tour players own this - you will too.",
    p4: "Address is a fundamental, and I expect it internalized. 50/50, V-grip to the trail shoulder, 4/10 pressure, eyes over the ball. If the putter doesn't match the rod, you haven't set up correctly. No shortcuts.",
    p5: "One-hand work reveals which hand is sabotaging your stroke. Lead controls face, trail controls pace - both must be disciplined. If one hand is manipulating, you've found your fault.",
    p6: "If you can't repeat the stroke blind, you don't own it yet. Trust the mechanics you've drilled. Feel, not sight, is what holds up when the moment tightens. Prove you have it.",
    p7: "Distance control is a non-negotiable skill. Longer arc, identical tempo - never a jab. Three clean stops per station before you advance. This is how professionals eliminate three-putts.",
    p8: "This is where practice meets reality. One ball, full routine, no do-overs. Anyone makes putts with three balls - professionals make them with one. Show me you can.",
    sg1: "Three clubs, one setup, clock controls the roll. This is textbook - I expect it clean. Hands ahead, quiet lower body, shoulders through. Master the system, don't improvise.",
    sg2: "The landing zone is the skill; the hole is the byproduct. Three in a row, and a miss resets you to zero. Amateurs aim at the flag and hope. You control the landing. Every time.",
    sg3: "Deceleration is the cardinal sin in the sand - I've seen it wreck rounds for forty years. Enter behind the line, full 10:00 swing, complete the finish. Commit or don't bother.",
    sg4: "The flop is high-risk and demands total commitment - no half measures. Full loft, full swing, full finish. Decelerate and you've already lost the shot. Professionals commit or lay up.",
    sg5: "This is scoring golf under pressure. Choose your shot, commit to the routine, execute - no do-overs. Up-and-down rate is where handicaps live. I expect the standard to climb.",
    sg6: "Tight lies expose poor fundamentals instantly. Hands ahead, weight forward, descend into the ball. Ball first - always. This is elite-level contact, and I accept nothing less.",
    pt1: "The Clock System is how professionals control distance. Build it precisely - sloppy numbers mean sloppy scoring. Same setup, disciplined arm positions. Record every carry. Know them cold.",
    pt2: "Numbers you can't repeat are worthless. Three in a row inside the circle, or the carry isn't real. Don't muscle it - let the clock position deliver. Professionals verify; they don't assume.",
    pt3: "Trajectory control is a scoring tool, not a trick. Ball position sets the window; the swing stays constant. A professional flights the ball on demand. Hit the window you intend - every time.",
    pt4: "Spin is controlled by angle of attack, not wrist tricks. Steep to check, shallow to release. This is advanced work that assumes clean contact is already yours. Command the spin, don't hope for it.",
    pt5: "Tour professionals own 4+ distances from a single wedge. This is that standard. Random order, identical setup, only the arm position changes. If your carries wander, you haven't earned the elite level.",
    mi1: "The divot never lies. After the ball, or you've failed the sequence. I've watched tour players obsess over this exact drill. Ball first, turf second - nothing less is acceptable.",
    mi2: "Alignment is a fundamental you should already own. Face to target, body parallel, balanced. Most amateurs aim wrong and blame their swing. Set it correctly - this is basic professionalism.",
    mi3: "The draw is path-face geometry, not luck. Closed path, face to target, hands to the inside slot. A professional shapes it on demand. Start it right, curve it back - repeatedly.",
    mi4: "The fade is control geometry - open path, face to target. This is standard professional shot-making, not optional. Start it left, hold it, land it soft. Command it or keep practicing.",
    mi5: "Gaps must be clean and consistent - 10 to 12 yards, no exceptions. Irregular gaps mean off-center strikes, a fundamental failure. Tour players know every number. Confirm yours and fix the flushing.",
    mi6: "Nine holes, one ball, full routine - this is where iron play meets reality. Pick the target, commit, finish balanced. No do-overs. Professionals perform on the first ball. Show me you can too.",
    hw1: "The hybrid is a precision tool - hit down on it like an iron, don't sweep it. From any lie, I expect a controlled, repeatable strike. This club solves problems only if your technique is disciplined.",
    hw2: "The fairway wood demands a shallow sweep - dig and you've failed. Ball forward, wide arc, brush the turf. This is a technical shot that separates skilled players from hackers. Sweep it clean.",
    hw3: "From 200, control is everything - direction over distance. Three consecutive fairways, and a miss resets you. Max effort is amateur thinking. A professional swings within himself. Repeat it.",
    hw4: "This is the hardest shot in golf, and I've watched it humble professionals. No cast, chest over the ball, skim the turf - no divot. Patience and precision, or leave it in the bag. No excuses.",
    hw5: "Lay-up strategy is where rounds are saved. Leave yourself your strongest wedge number - the ego shot is the amateur's downfall. Professionals manage the course. Choose the smart yardage. Every time.",
    dr1: "The driver setup is specialized and non-negotiable. Tee high, ball forward, spine tilted away for the upward strike. I expect this dialed in automatically. Setup errors here cost you the whole hole.",
    dr2: "Speed is irrelevant until the sequence is correct. Pause at each position and verify it. I've seen players chase speed with a broken sequence for years. Build it right slowly, then add pace.",
    dr3: "The draw is created by lower-body sequencing, not hand flips. Hip bump first, hands to the inside slot, in-to-out path. This is tour-level movement. Sequence it correctly or the ball won't curve.",
    dr4: "Three consecutive fairways, and a miss resets you to zero. The fairway is enormous - you're aiming at a building. Control the sequence. Professionals find the short grass repeatedly. So will you.",
    dr5: "P7 is the moment everything is judged on. 70/30 forward, hips open, hands ahead, face square. Every drill you've done builds to this. I've studied thousands of impacts - deliver a professional one.",
    dr6: "This is the complete Blueprint under pressure - read, commit, execute to a full finish. Nine shapes, one ball each. No do-overs. This is how professionals play. Execute the standard, start to finish.",
  },
};

// ─── Corrective actions per phase ────────────────────────────────────────────
// Each phase has 6 common faults. generateSession picks the 3 most relevant
// based on the day/week so the golfer gets fresh corrective content each session.
const CORRECTIVE_ACTIONS: Record<Phase, CorrectiveAction[]> = {
  putting: [
    {
      fault: "Wrist Breakdown",
      symptom: "Putter face opens or closes through impact - ball starts offline",
      fix: "Lock both wrists rigid. Grip the putter so the back of your lead hand faces the target. Rock only the shoulders - zero hinge, zero release. Place a ruler along the back of your lead forearm and wrist: it must stay straight through the entire stroke.",
    },
    {
      fault: "Deceleration",
      symptom: "Short putts stay short or veer off on the low side",
      fix: "Make your follow-through longer than your backswing - 40% back, 60% through. A helpful drill: place a tee 6 inches past the ball on your intended line. Your putter head must reach that tee every stroke.",
    },
    {
      fault: "Looking Up Early",
      symptom: "Consistent pulls or pushes, especially on short putts",
      fix: "Keep your eyes on the exact spot where the ball was sitting until you hear it drop - not until you see it roll. Practice with a coin under the ball: your eyes must stay on the coin for two full seconds after contact.",
    },
    {
      fault: "Poor Green Reading",
      symptom: "Consistently breaking the wrong way or under-reading slope",
      fix: "Always read from the low side of the hole - gravity shows you the true fall line from there. Then confirm from behind the ball. Aim 4–6 inches higher than your first instinct on any putt outside 6 feet.",
    },
    {
      fault: "Inconsistent Grip Pressure",
      symptom: "Speed varies dramatically across similar-length putts",
      fix: "Set your grip pressure at exactly 4/10 before every stroke and keep it constant throughout. Hold the putter like a small bird - firm enough not to drop it, gentle enough not to crush it. Tighter grip = tighter arc = less distance.",
    },
    {
      fault: "Weight Not Centered",
      symptom: "Stroke arc is inconsistent, ball rolls crookedly",
      fix: "50/50 weight distribution at address - neither foot heavier. Stack your hips over your ankles. Stand on both feet equally and feel your weight spread across the full width of each foot, not on the toes or heels.",
    },
  ],
  short_game: [
    {
      fault: "Scooping / Flipping",
      symptom: "Thin chips, skulled shots flying low across the green",
      fix: "Hands must be ahead of the ball at impact - not even with it, ahead of it. Set up with 60% weight on your lead side and keep it there. Place an alignment rod along your lead forearm and the shaft: they must stay in a straight line through impact.",
    },
    {
      fault: "Deceleration into Impact",
      symptom: "Chunk shots, fat contact, ball comes up short of the green",
      fix: "Commit to accelerating through the ball every single time. The short swing (8:00 position) feels too big before you start - that's correct. Swing through to the matching 4:00 follow-through position, not to the ball.",
    },
    {
      fault: "Wrong Club Selection",
      symptom: "Ball either runs out past the hole or stops well short",
      fix: "Land the ball 3 feet on the green and let it roll the rest. Use a lower-lofted club (8-iron or 9-iron) when you have green to work with - the extra roll is your friend. Save the lob wedge for when you have no green or a bunker to carry.",
    },
    {
      fault: "Ball Position Too Far Back",
      symptom: "Ball launches too low and runs unpredictably, or contact is thin",
      fix: "For a standard chip, ball should be center or one ball-width back of center - not in line with your trail foot. Too far back delofts the club and removes your margin for error. Check with a tee: ball should sit between the two tees at center.",
    },
    {
      fault: "Bunker Deceleration",
      symptom: "Ball stays in the bunker or barely clears the lip",
      fix: "The sand shot requires more swing speed than you think - not less. Open the face, open your stance, and commit to a 10:00 arm swing that splashes 2 inches behind the ball. The sand slows the club naturally; your job is to never slow down first.",
    },
    {
      fault: "Inconsistent Landing Spot",
      symptom: "Some chips roll out perfectly, others stop dead or run too far",
      fix: "Pick one precise landing spot - a discoloration, a shadow, a blade of grass - and focus entirely on landing the ball on that spot. The hole is irrelevant during the stroke. Landing zone precision is the only controllable variable.",
    },
  ],
  pitching: [
    {
      fault: "Deceleration on Partial Swings",
      symptom: "Ball flight is weak and short, distance is inconsistent",
      fix: "Every clock position must be struck with full, committed acceleration. The 8:00 swing is not a slowed-down full swing - it is a compact full-speed swing to 8 o'clock. Make a matching follow-through (8 o'clock on both sides).",
    },
    {
      fault: "Not Using Clock System",
      symptom: "Distance varies wildly even with the 'same' swing",
      fix: "The clock system is your distance dial - use it literally. Backswing to 8:00 gives one number. 9:00 gives another. 10:00 gives another. Build your personal chart by hitting 10 balls to each position and recording the average carry. Then trust those numbers.",
    },
    {
      fault: "Over-spinning / Blading the Ball",
      symptom: "Ball skips through the green, won't stop near the pin",
      fix: "You need a steeper P3 angle of attack to create backspin. Ball should be center at address, hands slightly forward. Lead with the hands - the club should feel like it's descending sharply into the ball and taking a divot after the ball.",
    },
    {
      fault: "Open Clubface at Impact",
      symptom: "Shots push right (for a right-hander) or lack consistent direction",
      fix: "At P1 address, make sure the grooves are square to your intended target line - not open. Through impact, your lead forearm must rotate so the back of your hand faces the target at P9. A flip or early release means the wrists are too active.",
    },
    {
      fault: "Lower Body Moving Too Much",
      symptom: "Distance control is inconsistent, contact is unpredictable",
      fix: "The wedge game requires quiet lower body. Plant your feet and limit hip movement to a gentle rotation - no lateral sway, no weight shift. Wedge shots are 70% arms and shoulders. Feel your lower half almost completely still.",
    },
    {
      fault: "Wrong Wedge for the Distance",
      symptom: "Forced, uncomfortable swings to reach distance targets",
      fix: "If your 10:00 swing with a SW is still short of the target, switch to a GW or PW. If your 8:00 swing overshoots, switch to a higher-lofted wedge. Each club gives you 3 usable distances - match the clock position AND the club to the distance.",
    },
  ],
  mid_irons: [
    {
      fault: "Hitting Behind the Ball (Fat)",
      symptom: "Divot is behind the ball, contact feels heavy and short",
      fix: "The divot must start at the ball's position or just ahead of it. At address, lean the shaft slightly forward toward the target - hands ahead of the ball. Keep 60% weight on your lead side. Drill: place a tee 1 inch in front of the ball and aim to clip the tee after the ball.",
    },
    {
      fault: "Coming Over the Top (Slice)",
      symptom: "Ball starts left and fades or slices right, divots point left",
      fix: "At the start of the downswing, the lower body must lead - bump the hips toward the target first. This drops the hands and club to the inside slot (P6). The club must approach from inside the target line, not over it. Feel the trail elbow tucking down to the hip before the hands move.",
    },
    {
      fault: "Early Extension",
      symptom: "Thin shots, toe strikes, hips bumping toward the ball through impact",
      fix: "Your hips must rotate - not thrust toward the ball - through impact. Drill: stand 2 inches from a wall with a foam pool noodle behind you. Make full swings without touching the noodle at impact - your hips must clear, not push forward.",
    },
    {
      fault: "Casting (Early Release)",
      symptom: "Weak, high shots, loss of distance, wrists unhinging early on the way down",
      fix: "Maintain the wrist hinge as long as possible on the downswing - the angle between your lead forearm and the club should stay 90° until P6–P7. Imagine you are 'throwing' the clubhead toward the target late, not early. Feel pressure in your trail hand fingertips, not your palm.",
    },
    {
      fault: "Poor Ball Position",
      symptom: "Inconsistent contact and trajectory between different irons",
      fix: "Ball position moves progressively forward: short irons (8, 9, PW) - center. Mid irons (5, 6, 7) - one ball-width forward of center. Check by placing an alignment rod across your toes and another at the ball: the gap should match the club length. Consistent position = consistent low point.",
    },
    {
      fault: "Alignment Error",
      symptom: "Shots that fly the correct shape but end up right or left of target",
      fix: "Use an alignment rod on the range every session. Lay it parallel to your target line pointing at the target - then set your feet parallel to the rod, not at the target. Your body aims left of target (for right-handers). Most missed greens are alignment errors disguised as swing errors.",
    },
  ],
  hybrids_woods: [
    {
      fault: "Trying to Hit Down on Fairway Woods",
      symptom: "Thick contact, divots, loss of distance, low skipping flight",
      fix: "Fairway woods require a sweeping motion - the low point of the arc should be AT the ball, not past it. Ball inside the lead heel. Spine tilts slightly away from target. Think of brushing the grass under the ball, not digging through it.",
    },
    {
      fault: "Overswing for Distance",
      symptom: "Loss of balance, inconsistent contact, big misses left and right",
      fix: "The hybrid and fairway wood already have distance built in - don't add speed by overswinging. Limit your backswing to 90% of full and focus on a smooth transition. A controlled 80% swing with centered contact beats a 100% effort off the toe every time.",
    },
    {
      fault: "Ball Too Far Back for Hybrids",
      symptom: "High, spinny shots that balloon or low, thin contact",
      fix: "Hybrid ball position: one ball-width forward of center. This is NOT the same as an iron. Too far back creates too steep an angle of attack and kills carry distance. Mark center of your stance with a tee, then measure one ball-width forward - that's your hybrid position.",
    },
    {
      fault: "Laying Up to Wrong Distance",
      symptom: "Approach shots from uncomfortable half-distances you can't control",
      fix: "Calculate the exact wedge distance you want to leave - reference your clock-system carry numbers - and work backwards from the flag to find your lay-up spot. Do NOT just 'go as far as possible.' Land your ball 20 yards behind the hazard at a distance that leaves your strongest wedge number.",
    },
    {
      fault: "3-Wood from Tight Lies (Poor Contact)",
      symptom: "Thin, low shots or complete misses off tight fairway lies",
      fix: "The 3-wood from tight grass is the hardest shot in golf. Ball inside lead heel, minimal spine tilt, chest over the ball. The swing must be ultra-shallow - shallower than any other shot. If you miss this shot more than 50% of the time, hybrid is always the smarter play.",
    },
    {
      fault: "Hybrid Used Like a Fairway Wood",
      symptom: "Topping the hybrid, or fat shots when trying to sweep it",
      fix: "Unlike a fairway wood, the hybrid wants a slightly descending strike - treat it like a 3 or 4 iron. Ball slightly forward of center, small divot is fine. The sole is designed to forgive a downward strike. Sweep thinking produces thin contact.",
    },
  ],
  driver: [
    {
      fault: "Tee Height Wrong",
      symptom: "Topped drives, or high-spinning ballooning shots",
      fix: "The equator of the ball should be level with the top of the driver crown at address. Too low = downward attack angle = too much spin. Too high = topped shots. Use a consistent tee height every single time - buy tees that are all the same length.",
    },
    {
      fault: "Trying to Hit Up Consciously",
      symptom: "Hanging back on trail foot, reverse pivot, fat contact behind the tee",
      fix: "The upward attack angle comes from your setup (spine tilt and ball position) - not from consciously hitting up. Set up correctly: ball inside lead heel, slight spine tilt away from target, 50/50 weight. Then swing your normal 9-to-3 sequence. The geometry creates the upward strike.",
    },
    {
      fault: "Casting the Club (Loss of Lag)",
      symptom: "Weak, high, left-starting drives, loss of 20+ yards",
      fix: "Hold the wrist hinge deep into the downswing. At P6, the club shaft should still be angled - not straight. Practice the 'hold the angle' drill: swing to the top, then slowly bring your hands down to waist height while keeping the 90° wrist angle. Then release - lag produces effortless speed.",
    },
    {
      fault: "Slice (Outside-In Path)",
      symptom: "Ball starts left of target and curves further left - or weak fade with 30+ yard miss right",
      fix: "Your club is crossing outside the target line on the downswing. Fix: lower your trail shoulder at the top of the backswing - feel it drop toward the ground, not level. This shallows the shaft and drops it to the inside. Then the hip bump completes the move. Aim 10 yards right of where you want the ball to start.",
    },
    {
      fault: "Hook (Overactive Hands)",
      symptom: "Ball starts right of target and hooks sharply left, often into trouble",
      fix: "Your clubface is closing too fast through impact - wrists are rolling over. Reduce your grip pressure (4/10 on the scale). At P9 finish, the back of your lead hand should face the sky, not the ground. Strengthen your lower-body lead: if hips clear first, hands release naturally at the right time.",
    },
    {
      fault: "Loss of Balance / Overswing",
      symptom: "Inconsistent contact, staggering through the shot, big dispersion",
      fix: "At the top of your backswing, you must be able to hold that position for 2 seconds without falling. If you can't, your backswing is too long. Shorten to 3/4 and stay in control. A 3/4 swing with solid contact goes further than a full overswing that mis-hits by an inch.",
    },
  ],
};


export function generateSession(
  phase: Phase,
  skillLevel: SkillLevel,
  dayInPhase: number,
  playerName: string,
  coachId?: string,
): DailySession {
  const phaseInfo = PHASES[phase];
  const weekInPhase = Math.ceil(dayInPhase / 7);

  // Use coach-specific drills if available for this coach
  let allDrills: Drill[];
  if (coachId && COACH_DRILL_SETS[coachId]) {
    const coachPhaseMap = COACH_DRILL_SETS[coachId];
    allDrills = coachPhaseMap[phase] ?? DRILLS[phase];
  } else {
    allDrills = DRILLS[phase];
  }

  // Filter drills by difficulty matching skill progression
  const difficultyMap: Record<SkillLevel, DrillDifficulty[]> = {
    beginner:     ["foundation"],
    intermediate: ["foundation", "development"],
    advanced:     ["foundation", "development", "mastery"],
    scratch:      ["development", "mastery", "elite"],
    tour_pro:     ["mastery", "elite"],
  };

  const allowed = difficultyMap[skillLevel];

  // Pick 3 drills: always include at least one foundation drill for beginners/intermediate
  const filtered = coachId && COACH_DRILL_SETS[coachId]
    ? allDrills  // coach drills are already level-matched - no filtering needed
    : allDrills.filter(d => allowed.includes(d.difficulty));
  const foundation = allDrills.filter(d => d.difficulty === "foundation");

  // Rotate drills by dayInPhase so each day feels fresh
  const offset = (dayInPhase - 1) % Math.max(filtered.length, 1);
  const picked: Drill[] = [];
  const pool = [...filtered];
  for (let i = 0; i < Math.min(COACH_SESSION_DRILL_COUNT[coachId ?? ""] ?? 3, pool.length); i++) {
    picked.push(pool[(offset + i) % pool.length]);
  }

  // Ensure beginners always get at least one foundation drill
  if (skillLevel === "beginner" && picked.length > 0 && !picked.some(d => d.difficulty === "foundation") && foundation.length > 0) {
    picked[0] = foundation[0];
  }

  // Apply coach-specific drill cues (if any match)
  const cueMap = coachId ? COACH_DRILL_CUES[coachId] : undefined;
  const drills: Drill[] = picked.map((d) => {
    const cue = cueMap?.[d.id];
    return cue ? { ...d, coachingCue: cue } : d;
  });

  // Generic greetings - used when no coach is selected or the coach is unknown.
  const greetings = [
    `Welcome back, ${playerName}! Let's have a great session today.`,
    `Great to see you, ${playerName}. Your consistency is building day by day.`,
    `${playerName}, every rep today is an investment in your future score.`,
    `Ready to work, ${playerName}? Champions are made in sessions like this.`,
    `${playerName}, welcome to Day ${dayInPhase} of ${phaseInfo.label}. Let's elevate your game.`,
    `${playerName}, the best golfers in the world practice with purpose. Let's do the same today.`,
  ];

  // Prefer the coach's voice; fall back to the generic greeting pool.
  let coachGreeting = greetings[(dayInPhase - 1) % greetings.length];
  const coachGreetingPool = coachId ? COACH_GREETINGS[coachId] : undefined;
  if (coachGreetingPool && coachGreetingPool.length > 0) {
    const fn = coachGreetingPool[(dayInPhase - 1) % coachGreetingPool.length];
    if (fn) coachGreeting = fn(playerName, dayInPhase, phaseInfo.label);
  }

  // Prefer the coach's cooldown; fall back to the generic one.
  let cooldown = "Spend 5 minutes reflecting on what clicked today. Identify one thing to focus on in tomorrow's session.";
  const coachCooldownPool = coachId ? COACH_COOLDOWNS[coachId] : undefined;
  if (coachCooldownPool && coachCooldownPool.length > 0) {
    const c = coachCooldownPool[(dayInPhase - 1) % coachCooldownPool.length];
    if (c) cooldown = c;
  }

  const completionGates: Record<Phase, string> = {
    putting:       "Complete all drills and record your make % from 6 ft before ending the session",
    short_game:    "Complete all drills and log at least 10 chip shots with distance from target",
    pitching:      "Complete all drills and record distances for each clock position",
    mid_irons:     "Complete all drills and confirm your yardage gapping for each iron",
    hybrids_woods: "Complete all drills and track your fairway-hit % for the session",
    driver:        "Complete all drills and log your average distance and fairways hit",
  };

  // Pick 3 corrective actions, rotating by day so content stays fresh
  const allCorrectiveActions = CORRECTIVE_ACTIONS[phase];
  const correctiveOffset = (dayInPhase - 1) % allCorrectiveActions.length;
  const correctiveActions: CorrectiveAction[] = [
    allCorrectiveActions[correctiveOffset % allCorrectiveActions.length],
    allCorrectiveActions[(correctiveOffset + 1) % allCorrectiveActions.length],
    allCorrectiveActions[(correctiveOffset + 2) % allCorrectiveActions.length],
  ];

  return {
    phase,
    dayInPhase,
    weekInPhase,
    title: `Day ${dayInPhase}: ${phaseInfo.label} - ${weekInPhase === 1 ? "Foundation" : weekInPhase === 2 ? "Development" : "Mastery"}`,
    coachGreeting,
    warmup: getWarmup(phase, coachId),
    drills,
    correctiveActions,
    cooldown,
    sessionGoal: getSessionGoal(phase, skillLevel, weekInPhase, coachId),
    completionGate: completionGates[phase],
    estimatedMinutes: drills.reduce((acc, d) => acc + parseInt(d.duration), 0) + 20,
  };
}

function getWarmup(phase: Phase, coachId?: string): string {
  if (coachId) {
    const coachSet = COACH_WARMUPS[coachId];
    if (coachSet && coachSet[phase]) return coachSet[phase];
  }

  const warmups: Record<Phase, string> = {
    putting:       "5 minutes of free-form putting. No target - just feel the weight of the putter and get a sense of the green speed today.",
    short_game:    "10 easy chip shots from 5 yards off the green. No target pressure. Just land-and-roll feel.",
    pitching:      "10 half-swing shots with your most lofted wedge from 40 yards. Let the body loosen up.",
    mid_irons:     "10 smooth 9-iron shots at 70% effort. Prioritize contact over distance.",
    hybrids_woods: "10 slow-motion hybrid swings at 50% speed, then 5 normal shots. Build the feel before adding speed.",
    driver:        "5 minutes of stretching (hip hinges, shoulder rotation, side bends), then 10 smooth driver swings at 60% effort.",
  };
  return warmups[phase];
}

function getSessionGoal(phase: Phase, skill: SkillLevel, week: number, coachId?: string): string {
  const wk = Math.min(week, 3);

  if (coachId) {
    const coachPhaseGoals = COACH_GOALS[coachId];
    if (coachPhaseGoals && coachPhaseGoals[phase]) {
      const g = coachPhaseGoals[phase][wk] ?? coachPhaseGoals[phase][1];
      if (g) return g;
    }
  }

  const goals: Record<Phase, Record<number, string>> = {
    putting: {
      1: "Build a consistent pendulum stroke - no wrist break, no deceleration",
      2: "Develop reliable distance control from 20–40 feet",
      3: "Achieve 80%+ make rate from 6 feet and create your pre-putt routine",
    },
    short_game: {
      1: "Develop solid chip contact and learn to select landing zones",
      2: "Expand arsenal: bump-and-run, flop shot, and bunker basics",
      3: "Achieve 60%+ up-and-down from within 20 yards",
    },
    pitching: {
      1: "Build your clock-face distance chart for each wedge",
      2: "Develop trajectory control (low / mid / high) from 80 yards",
      3: "Land within threshold from all yardages inside 120 yards",
    },
    mid_irons: {
      1: "Achieve consistent ball-first contact with all irons",
      2: "Develop controlled draw and fade on command",
      3: "Confirm yardage gapping and hit 60%+ greens in regulation simulation",
    },
    hybrids_woods: {
      1: "Build a repeatable hybrid and fairway wood technique from all lies",
      2: "Achieve 60%+ fairways hit in simulation with hybrids/woods",
      3: "Execute all lay-up and strategic scenarios with confidence",
    },
    driver: {
      1: "Establish optimal setup, tee height, and tempo",
      2: "Shape both draw and fade off the tee on command",
      3: "Achieve 70%+ simulated fairways hit with strategic tee shots",
    },
  };

  // `skill` is retained for signature stability and future skill-based tuning.
  void skill;
  return goals[phase][wk] ?? goals[phase][1];
}
