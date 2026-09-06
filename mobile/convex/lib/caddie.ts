/**
 * AI Caddie engine — pure rule-based logic, no LLM needed.
 * Derives club recommendations, yardage adjustments, course management advice,
 * and pre-shot reminders from player tendencies + conditions.
 */

import type { SkillLevel } from "./curriculum";

// ─── GPS Distance Utility ─────────────────────────────────────────────────────

/**
 * Haversine distance between two GPS coordinates, returned in yards.
 * Uses Earth radius = 6371e3 m and the 1.09361 yd/m conversion factor.
 */
export function calculateDistanceInYards(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth radius in metres
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1.09361); // convert metres → yards
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClubCategory =
  | "putter"
  | "wedge"
  | "short_iron"
  | "mid_iron"
  | "long_iron"
  | "hybrid"
  | "fairway_wood"
  | "driver";

export interface CaddieConditions {
  distanceToPin: number;        // yards (carry to flag)
  elevation: number;            // positive = uphill, negative = downhill, yards equivalent
  windSpeedMph: number;
  windDirection: "headwind" | "tailwind" | "crosswind_left" | "crosswind_right" | "none";
  lie: "tee" | "fairway" | "rough" | "bunker" | "hardpan" | "downslope" | "upslope" | "sidehill";
  pinPosition: "front" | "middle" | "back";
  greenFirmness: "soft" | "medium" | "firm";
  temperature: number;          // fahrenheit
  altitude: number;             // feet above sea level
}

export interface TendencyProfile {
  dominantMiss: "left" | "right" | "short" | "long" | "center" | null;
  avgMissYards: number;
  favoriteShape: "draw" | "fade" | "straight" | null;
  commonClubs: string[];        // clubs golfer uses most
  weaknesses: string[];         // clubs with poor accuracy
}

export interface CaddieRecommendation {
  primaryClub: string;
  alternateClub: string | null;
  adjustedYardage: number;      // yardage after all adjustments
  rawYardage: number;           // distance to pin as-is
  yardageAdjustments: { reason: string; yards: number }[];
  shotShape: "draw" | "fade" | "straight";
  aimAdjustment: string;        // e.g. "Aim 5 yards right to play your draw"
  trajectory: "low" | "mid" | "high";
  landingTarget: string;        // e.g. "Front of green, let it release"
  preShotCues: string[];
  courseManagementNote: string;
  layupRecommendation: string | null;
  greenReading: string;
  paceNote: string;
  caddieQuip: string;           // personalized message from the caddie
}

// ─── Club distance chart (average carries per skill level) ───────────────────

export const CLUB_DISTANCES: Record<SkillLevel, Record<string, number>> = {
  beginner: {
    "Driver":   175, "3-Wood":  145, "5-Wood":  130, "Hybrid":  120,
    "4-Iron":   110, "5-Iron":  100, "6-Iron":   90, "7-Iron":   80,
    "8-Iron":    70, "9-Iron":   60, "PW":       50, "GW":       45,
    "SW":        35, "LW":       25, "Putter":    0,
  },
  intermediate: {
    "Driver":   210, "3-Wood":  185, "5-Wood":  165, "Hybrid":  155,
    "4-Iron":   150, "5-Iron":  140, "6-Iron":  130, "7-Iron":  120,
    "8-Iron":   110, "9-Iron":  100, "PW":       90, "GW":       80,
    "SW":        65, "LW":       50, "Putter":    0,
  },
  advanced: {
    "Driver":   245, "3-Wood":  220, "5-Wood":  200, "Hybrid":  190,
    "4-Iron":   185, "5-Iron":  175, "6-Iron":  165, "7-Iron":  155,
    "8-Iron":   145, "9-Iron":  135, "PW":      120, "GW":      110,
    "SW":        95, "LW":       75, "Putter":    0,
  },
  scratch: {
    "Driver":   275, "3-Wood":  250, "5-Wood":  230, "Hybrid":  215,
    "4-Iron":   210, "5-Iron":  200, "6-Iron":  190, "7-Iron":  180,
    "8-Iron":   168, "9-Iron":  155, "PW":      140, "GW":      130,
    "SW":       115, "LW":       90, "Putter":    0,
  },
  tour_pro: {
    "Driver":   295, "3-Wood":  265, "5-Wood":  245, "Hybrid":  230,
    "4-Iron":   225, "5-Iron":  215, "6-Iron":  205, "7-Iron":  195,
    "8-Iron":   183, "9-Iron":  170, "PW":      155, "GW":      142,
    "SW":       125, "LW":      100, "Putter":    0,
  },
};

const CLUB_ORDER = [
  "Driver", "3-Wood", "5-Wood", "Hybrid",
  "4-Iron", "5-Iron", "6-Iron", "7-Iron", "8-Iron", "9-Iron",
  "PW", "GW", "SW", "LW",
];

// ─── Yardage adjustments ──────────────────────────────────────────────────────

function windAdjustment(windSpeedMph: number, direction: CaddieConditions["windDirection"]): number {
  if (direction === "none") return 0;
  const base = Math.round(windSpeedMph * 0.7); // ~0.7 yds per mph
  if (direction === "headwind") return base;
  if (direction === "tailwind") return -Math.round(base * 0.6); // tailwind helps less than headwind hurts
  // crosswind: need extra club for carry uncertainty
  return Math.round(base * 0.25);
}

function elevationAdjustment(elevation: number): number {
  // Every yard of elevation = ~1 yard carry change
  return elevation;
}

function temperatureAdjustment(temp: number): number {
  // Cold air is denser — ~1 yard per 10°F below 70°F
  const baseline = 70;
  const diff = temp - baseline;
  return Math.round(diff * 0.1);
}

function altitudeAdjustment(altitude: number): number {
  // ~10% gain per 5,000 feet
  return Math.round((altitude / 5000) * 0.1 * 150); // rough mid-range baseline
}

function lieAdjustment(lie: CaddieConditions["lie"]): number {
  const adj: Record<CaddieConditions["lie"], number> = {
    tee: 0, fairway: 0, rough: 10, bunker: 15,
    hardpan: -5, downslope: 5, upslope: -5, sidehill: 5,
  };
  return adj[lie];
}

function pinAdjustment(pinPosition: CaddieConditions["pinPosition"], greenFirmness: CaddieConditions["greenFirmness"]): number {
  // On firm greens, aim shorter — on soft greens, fly it pin-high or longer
  const firmBonus = { soft: 5, medium: 0, firm: -5 }[greenFirmness];
  const pinAdj = { front: -8, middle: 0, back: 8 }[pinPosition];
  return firmBonus + pinAdj;
}

// ─── Club selection ───────────────────────────────────────────────────────────

function findBestClub(
  targetYards: number,
  skillLevel: SkillLevel,
  weaknesses: string[],
  lie: CaddieConditions["lie"],
  personalDistances?: Record<string, number>
): { primary: string; alternate: string | null } {
  // Personal distances override generic defaults when available
  const distances = personalDistances
    ? { ...CLUB_DISTANCES[skillLevel], ...personalDistances }
    : CLUB_DISTANCES[skillLevel];

  // Exclude putter (distance 0) and any clubs marked as weaknesses unless forced
  const candidates = CLUB_ORDER.filter((c) => (distances[c] ?? 0) > 0);

  // Find closest match
  let bestClub = candidates[0];
  let bestDiff = Math.abs((distances[candidates[0]] ?? 0) - targetYards);

  for (const club of candidates) {
    const carry = distances[club] ?? 0;
    const diff = Math.abs(carry - targetYards);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestClub = club;
    }
  }

  // If best club is in weaknesses, suggest the next club up as primary
  if (weaknesses.includes(bestClub)) {
    const idx = candidates.indexOf(bestClub);
    const alt = candidates[idx - 1] ?? null; // one club longer
    return { primary: alt ?? bestClub, alternate: bestClub };
  }

  // Suggest the next club down as alternate (punch-down option)
  const idx = candidates.indexOf(bestClub);
  const alternate = candidates[idx + 1] ?? null;
  return { primary: bestClub, alternate };
}

// ─── Shape recommendation based on tendencies ─────────────────────────────────

function recommendShape(
  tendencies: TendencyProfile,
  lie: CaddieConditions["lie"],
  pin: CaddieConditions["pinPosition"],
  skillLevel: SkillLevel,
): "draw" | "fade" | "straight" {
  // Beginners and intermediates should play straight — they can't reliably shape shots
  if (skillLevel === "beginner" || skillLevel === "intermediate") return "straight";
  if (lie === "rough" || lie === "bunker") return "straight"; // keep it simple from trouble
  return tendencies.favoriteShape ?? "straight";
}

// ─── Trajectory ───────────────────────────────────────────────────────────────

function recommendTrajectory(
  wind: CaddieConditions["windDirection"],
  windSpeedMph: number,
  greenFirmness: CaddieConditions["greenFirmness"]
): "low" | "mid" | "high" {
  if (wind === "headwind" && windSpeedMph > 15) return "low";
  if (greenFirmness === "soft") return "high"; // soft greens reward high shots that stop
  if (greenFirmness === "firm") return "mid";
  return "mid";
}

// ─── Pre-shot cues based on skill level ──────────────────────────────────────

function preShotCues(skillLevel: SkillLevel, lie: CaddieConditions["lie"]): string[] {
  const base: Record<SkillLevel, string[]> = {
    beginner: [
      "P1 setup: 50/50 weight, neutral V-grip pointing to trail shoulder, 4/10 grip pressure",
      "Pick a blade of grass as your intermediate target on the 9-to-3 line",
      "Apply the 30-Second Reset Rule — one breath, see the landing zone, commit",
      "Lower body stays passive on short shots; pendulum shoulder stroke only",
    ],
    intermediate: [
      "P1 address: 50/50 weight, V-grip to trail shoulder, 4/10 pressure — every time",
      "Visualize the full P3–P9 sequence from behind the ball",
      "30-Second Reset: read, visualize, trigger, execute",
      "Lower-body hip bump initiates the downswing — hands follow into the inside slot",
    ],
    advanced: [
      "Build P1 around your clubface first — face to target, then body alignment",
      "Feel the 9-to-3 Sequence in your practice swing — P3 takeaway, P6 shaft, P9 finish",
      "30-Second Reset: Three-View read, P1 address, hip bump trigger, commit fully",
      "P7 impact thought: 70/30 weight shift complete, hands ahead of the face",
    ],
    scratch: [
      "P1 alignment locked — one practice swing to rehearse the P3–P9 shape",
      "Identify your intermediate target 2 feet ahead on your P1 line",
      "30-Second Reset: read done, P1 step-in, one trigger word, execute",
      "P7 position: hip bump and weight shift are complete before the hands arrive",
    ],
    tour_pro: [
      "P1 confirmed — V-grip 4/10, 50/50, face first",
      "9-to-3 Sequence is automatic — feel the inside slot drop at transition",
      "30-Second Reset trigger: one word, see P7, execute",
      "P10 full finish — no abbreviating the follow-through",
    ],
  };

  const lieCues: Partial<Record<CaddieConditions["lie"], string>> = {
    rough:     "Grip down slightly — rough grabs the hosel. Steeper P3 entry, more lower-body drive through P7.",
    bunker:    "Open face at P1, open stance. P3 entry 2 inches behind the ball — splash the sand, not the ball.",
    downslope: "Take one extra club. P1: weight forward, ball back. Ball will fly lower through P7 — it's correct.",
    upslope:   "Take one less club. P1: match spine to slope. Ball launches higher — let the slope do the work.",
    hardpan:   "Hands ahead at P1, steep P3 descent. This requires perfect P3–P7 ball-first contact — no margin.",
    sidehill:  "Ball above feet: P1 aim right of target. Ball below feet: P1 aim left of target.",
  };

  const cues = [...base[skillLevel]];
  if (lie !== "fairway" && lie !== "tee" && lieCues[lie]) {
    cues.unshift(lieCues[lie]!);
  }
  return cues.slice(0, 4); // max 4 cues
}

// ─── Course management ────────────────────────────────────────────────────────

function courseManagementNote(
  adjustedYards: number,
  skillLevel: SkillLevel,
  tendencies: TendencyProfile,
  conditions: CaddieConditions
): string {
  const { dominantMiss, avgMissYards } = tendencies;

  if (adjustedYards > (CLUB_DISTANCES[skillLevel]["Driver"] ?? 0)) {
    return "This is a lay-up situation. Don't try to get there in one — give yourself a comfortable full shot in.";
  }

  if (conditions.lie === "bunker" || conditions.lie === "rough") {
    return "From this lie, your priority is clean contact and advancing the ball. Take your medicine.";
  }

  // Beginners and intermediates: keep advice simple — no shape or miss-pattern management
  if (skillLevel === "beginner" || skillLevel === "intermediate") {
    const tipsByLevel: Record<SkillLevel, string> = {
      beginner:     "Keep it simple — aim for the middle of the green. Bogey from the center beats double from the edges.",
      intermediate: "Avoid the big number. The center of the green is always correct golf.",
      advanced:     "Play to your miss. Favor the side with more green and bail-out room.",
      scratch:      "Attack the pin when conditions allow. When in doubt, play the correct side.",
      tour_pro:     "Pin is on. Commit to the number, trust the club.",
    };
    return tipsByLevel[skillLevel];
  }

  if (dominantMiss === "right" && conditions.windDirection === "crosswind_right") {
    return `Your miss pattern leans right, and the wind is also pushing right. Aim one flag left and play for the center-left of the green.`;
  }
  if (dominantMiss === "left" && conditions.windDirection === "crosswind_left") {
    return `Your miss pattern leans left, and the wind is also pushing left. Aim one flag right and protect the right side.`;
  }

  if (dominantMiss && dominantMiss !== "center" && avgMissYards > 10) {
    return `Your data shows you tend to miss ${dominantMiss} by ~${avgMissYards} yards. Adjust your aim accordingly.`;
  }

  const tipsByLevel: Record<SkillLevel, string> = {
    beginner:     "Keep it simple — aim for the middle of the green. Bogey from the center beats double from the edges.",
    intermediate: "Avoid the big number. The center of the green is always correct golf.",
    advanced:     "Play to your miss. Favor the side with more green and bail-out room.",
    scratch:      "Attack the pin when conditions allow. When in doubt, play the correct side.",
    tour_pro:     "Pin is on. Commit to the number, trust the club.",
  };
  return tipsByLevel[skillLevel];
}

// ─── Layup recommendation ─────────────────────────────────────────────────────

function layupRecommendation(
  distanceToPin: number,
  skillLevel: SkillLevel,
): string | null {
  const maxFullShot = CLUB_DISTANCES[skillLevel]["Driver"] ?? 200;
  if (distanceToPin <= maxFullShot * 1.15) return null; // reachable — no layup

  const optimalIn: Record<SkillLevel, number> = {
    beginner:     80,
    intermediate: 100,
    advanced:     120,
    scratch:      130,
    tour_pro:     140,
  };
  const target = optimalIn[skillLevel];
  const layupYards = distanceToPin - target;
  return `Lay up to ${layupYards} yards for a full ${target}-yard approach. Don't try to overpower this one.`;
}

// ─── Green reading ────────────────────────────────────────────────────────────

function greenReading(pin: CaddieConditions["pinPosition"], firmness: CaddieConditions["greenFirmness"]): string {
  const firmMap = {
    soft:   "Soft greens today — the ball will stop quickly. Fly it to the pin. Don't worry about rollout.",
    medium: "Normal conditions — plan for 3–5 yards of rollout past your landing spot.",
    firm:   "Firm greens — plan for 8–12 yards of rollout. Land the ball short and let it chase to the flag.",
  };
  const pinMap = {
    front:  "Pin is at the front. Err on the side of short — going long gives you no angle.",
    middle: "Pin is middle — you have room on both sides. Play for the center of the green.",
    back:   "Pin is at the back. You have the whole green in front of you — be aggressive.",
  };
  return `${firmMap[firmness]} ${pinMap[pin]}`;
}

// ─── Pace note ────────────────────────────────────────────────────────────────

function paceNote(windSpeedMph: number, lie: CaddieConditions["lie"]): string {
  if (windSpeedMph > 20) return "Wind is significant today. Slow your tempo down 10% — you'll make better contact.";
  if (lie === "rough") return "From rough, focus on acceleration through the ball. Don't quit on it.";
  if (lie === "bunker") return "Smooth tempo in the sand. This shot needs a full follow-through — commit!";
  return "Normal tempo. Trust the yardage and the club in your hand.";
}

// ─── Caddie quip ─────────────────────────────────────────────────────────────

function caddieQuip(name: string, skillLevel: SkillLevel, primaryClub: string): string {
  const quips: Record<SkillLevel, string[]> = {
    beginner: [
      `${name}, this is your number. Swing your swing — not someone else's.`,
      `One shot at a time, ${name}. Forget the last hole.`,
      `${name}, commit to this ${primaryClub} and let it go. I've got your yardage right.`,
    ],
    intermediate: [
      `${name}, the ${primaryClub} is perfect here. I like this number.`,
      `Trust the process, ${name}. The data says ${primaryClub} — go get it.`,
      `${name}, your tempo was great last hole. Bring that same feel.`,
    ],
    advanced: [
      `${name}, this is your shot. The ${primaryClub} covers it perfectly.`,
      `Good lie, good yardage, ${name}. There's no reason not to flush this one.`,
      `${name}, I love this number for you. Attack it.`,
    ],
    scratch: [
      `${name}, step up and be a player. The ${primaryClub} is your club.`,
      `I checked it twice, ${name}. The number is right. Trust it.`,
      `${name}, this is birdie territory. Give me your A-swing.`,
    ],
    tour_pro: [
      `${name}, perfect setup for a birdie. The ${primaryClub} is dialed in.`,
      `This is your shot, ${name}. Own it.`,
      `${name}, the pin's in a great spot for you today. Let's go make one.`,
    ],
  };
  const opts = quips[skillLevel];
  return opts[Math.floor(Math.random() * opts.length)];
}

// ─── Main recommendation function ─────────────────────────────────────────────

export function buildCaddieRecommendation(
  playerName: string,
  skillLevel: SkillLevel,
  tendencies: TendencyProfile,
  conditions: CaddieConditions,
  personalDistances?: Record<string, number>,
): CaddieRecommendation {
  const adjustments: { reason: string; yards: number }[] = [];

  // Wind
  const windAdj = windAdjustment(conditions.windSpeedMph, conditions.windDirection);
  if (windAdj !== 0) adjustments.push({ reason: `${conditions.windDirection.replace("_", " ")} ${conditions.windSpeedMph} mph`, yards: windAdj });

  // Elevation
  const elevAdj = elevationAdjustment(conditions.elevation);
  if (elevAdj !== 0) adjustments.push({ reason: `Elevation ${conditions.elevation > 0 ? "+" : ""}${conditions.elevation} yds`, yards: elevAdj });

  // Temperature
  const tempAdj = temperatureAdjustment(conditions.temperature);
  if (tempAdj !== 0) adjustments.push({ reason: `Temperature ${conditions.temperature}°F`, yards: -tempAdj });

  // Altitude
  const altAdj = altitudeAdjustment(conditions.altitude);
  if (altAdj !== 0) adjustments.push({ reason: `Altitude ${conditions.altitude} ft`, yards: -altAdj });

  // Lie
  const lieAdj = lieAdjustment(conditions.lie);
  if (lieAdj !== 0) adjustments.push({ reason: `${conditions.lie} lie`, yards: lieAdj });

  // Pin position + green firmness
  const pinAdj = pinAdjustment(conditions.pinPosition, conditions.greenFirmness);
  if (pinAdj !== 0) adjustments.push({ reason: `${conditions.pinPosition} pin, ${conditions.greenFirmness} green`, yards: pinAdj });

  // Tendency miss — add buffer
  if (tendencies.dominantMiss === "short" && tendencies.avgMissYards > 5) {
    adjustments.push({ reason: "Your data: tends short", yards: -Math.round(tendencies.avgMissYards * 0.5) });
  }

  const totalAdjYards = adjustments.reduce((s, a) => s + a.yards, 0);
  const adjustedYardage = Math.max(10, conditions.distanceToPin + totalAdjYards);

  const { primary, alternate } = findBestClub(adjustedYardage, skillLevel, tendencies.weaknesses, conditions.lie, personalDistances);
  const shape = recommendShape(tendencies, conditions.lie, conditions.pinPosition, skillLevel);
  const trajectory = recommendTrajectory(conditions.windDirection, conditions.windSpeedMph, conditions.greenFirmness);

  const aimAdjustment = (() => {
    const isSimple = skillLevel === "beginner" || skillLevel === "intermediate";
    // ── Tee shot with driver / woods → fairway language ──────────────────────
    if (conditions.lie === "tee") {
      if (isSimple) return "Aim at the center of the fairway — make solid contact and keep it in play";
      const miss = tendencies.dominantMiss;
      if (miss === "right") return `Aim at the left edge of the fairway to play your natural miss`;
      if (miss === "left") return `Aim at the right edge of the fairway to play your natural miss`;
      if (shape === "draw") return `Aim right-center of the fairway — play the draw in from the right`;
      if (shape === "fade") return `Aim left-center of the fairway — play the fade in from the left`;
      return "Aim at the center of the fairway";
    }
    // ── Approach / layup shots ────────────────────────────────────────────────
    if (isSimple) return "Aim at the center of the green — make clean contact and give yourself a putt";
    const miss = tendencies.dominantMiss;
    const miss_yds = Math.round(tendencies.avgMissYards);
    if (miss === "right") return `Aim ${miss_yds} yards left of pin to play your natural miss`;
    if (miss === "left") return `Aim ${miss_yds} yards right of pin to play your natural miss`;
    if (shape === "draw") return `Aim 5 yards right of pin — play the draw in`;
    if (shape === "fade") return `Aim 5 yards left of pin — play the fade in`;
    return "Aim at the middle of the green";
  })();

  const landingTarget = (() => {
    // ── Tee shot → fairway landing zone ──────────────────────────────────────
    if (conditions.lie === "tee") {
      if (primary === "Driver") {
        return conditions.windDirection === "headwind"
          ? "Drive to the fairway — wind is into you, take a smooth 85% swing to keep it in play"
          : "Drive to the fairway — favor the widest part and keep it away from the trouble side";
      }
      // 3-wood / hybrid off tee → lay-up language
      return `Land in the short grass at ${Math.round(adjustedYardage)} yards — ideal position for your next shot`;
    }
    // ── Approach ──────────────────────────────────────────────────────────────
    if (conditions.greenFirmness === "firm") return "Land 10 yards short of the flag and release";
    if (conditions.pinPosition === "back") return "Fly it to the flag — green is open from the front";
    if (conditions.pinPosition === "front") return "Land on the front edge and stop it there";
    return "Carry to the center of the green, let it release";
  })();

  return {
    primaryClub: primary,
    alternateClub: alternate,
    adjustedYardage: Math.round(adjustedYardage),
    rawYardage: conditions.distanceToPin,
    yardageAdjustments: adjustments,
    shotShape: shape,
    aimAdjustment,
    trajectory,
    landingTarget,
    preShotCues: preShotCues(skillLevel, conditions.lie),
    courseManagementNote: courseManagementNote(adjustedYardage, skillLevel, tendencies, conditions),
    layupRecommendation: layupRecommendation(conditions.distanceToPin, skillLevel),
    greenReading: conditions.lie === "tee"
      ? "Tee shot — focus on the fairway, not the flag. Find the short grass before thinking about the green."
      : greenReading(conditions.pinPosition, conditions.greenFirmness),
    paceNote: paceNote(conditions.windSpeedMph, conditions.lie),
    caddieQuip: caddieQuip(playerName, skillLevel, primary),
  };
}

// ─── Tendency extraction from shot history ───────────────────────────────────

export interface ShotLogEntry {
  club: string;
  missDirection?: "left" | "right" | "short" | "long" | "center" | null;
  distanceFromTargetYards: number;
  shotShape: string;
}

export function extractTendencies(shots: ShotLogEntry[]): TendencyProfile {
  if (shots.length === 0) {
    return { dominantMiss: null, avgMissYards: 0, favoriteShape: null, commonClubs: [], weaknesses: [] };
  }

  // Miss direction frequency
  const missCount: Record<string, number> = {};
  let totalMissYards = 0;
  let missedShots = 0;

  for (const s of shots) {
    if (s.missDirection && s.missDirection !== "center") {
      missCount[s.missDirection] = (missCount[s.missDirection] ?? 0) + 1;
      totalMissYards += s.distanceFromTargetYards;
      missedShots++;
    }
  }

  const dominantMiss = (Object.entries(missCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as TendencyProfile["dominantMiss"];
  const avgMissYards = missedShots > 0 ? Math.round(totalMissYards / missedShots) : 0;

  // Shot shape preference
  const shapeCount: Record<string, number> = {};
  for (const s of shots) {
    if (s.shotShape === "draw" || s.shotShape === "fade" || s.shotShape === "straight") {
      shapeCount[s.shotShape] = (shapeCount[s.shotShape] ?? 0) + 1;
    }
  }
  const favoriteShape = (Object.entries(shapeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as TendencyProfile["favoriteShape"];

  // Club usage
  const clubCount: Record<string, number> = {};
  for (const s of shots) clubCount[s.club] = (clubCount[s.club] ?? 0) + 1;
  const commonClubs = Object.entries(clubCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);

  // Weaknesses: clubs with avg miss > 15 yards
  const clubMiss: Record<string, { total: number; count: number }> = {};
  for (const s of shots) {
    if (!clubMiss[s.club]) clubMiss[s.club] = { total: 0, count: 0 };
    clubMiss[s.club].total += s.distanceFromTargetYards;
    clubMiss[s.club].count += 1;
  }
  const weaknesses = Object.entries(clubMiss)
    .filter(([, v]) => v.count >= 3 && v.total / v.count > 15)
    .map(([c]) => c);

  return { dominantMiss, avgMissYards, favoriteShape, commonClubs, weaknesses };
}
