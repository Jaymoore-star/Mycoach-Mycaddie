/**
 * Stroke Gained Decision Engine
 *
 * Evaluates every shot as a risk/reward decision across multiple target zones.
 * Returns a ranked matrix of play options with expected strokes, SG delta,
 * success probability, and a clear recommended play.
 *
 * Based on USGA / PGA Tour SG baselines, scaled per skill level.
 */

import type { SkillLevel } from "./curriculum";
import type { CaddieConditions, TendencyProfile } from "./caddie";
import { CLUB_DISTANCES } from "./caddie";

// ─── SG Baseline tables ────────────────────────────────────────────────────────
// Expected strokes to hole from a given distance on the fairway.
// Source: approximated from PGA Tour SG:App data, scaled per skill level.
// Format: [distanceYards, expectedStrokes]

const SG_BASELINES: Record<SkillLevel, [number, number][]> = {
  tour_pro: [
    [0, 1.0], [3, 1.05], [6, 1.10], [10, 1.25], [15, 1.40], [20, 1.52],
    [30, 1.65], [40, 1.73], [50, 1.80], [75, 1.95], [100, 2.20],
    [125, 2.45], [150, 2.65], [175, 2.82], [200, 3.00], [225, 3.15],
    [250, 3.28], [300, 3.50], [350, 3.68], [400, 3.82], [450, 4.00],
  ],
  scratch: [
    [0, 1.0], [3, 1.10], [6, 1.18], [10, 1.32], [15, 1.50], [20, 1.65],
    [30, 1.80], [40, 1.90], [50, 2.00], [75, 2.20], [100, 2.48],
    [125, 2.72], [150, 2.95], [175, 3.15], [200, 3.35], [225, 3.52],
    [250, 3.68], [300, 3.92], [350, 4.12], [400, 4.30], [450, 4.50],
  ],
  advanced: [
    [0, 1.0], [3, 1.12], [6, 1.22], [10, 1.40], [15, 1.60], [20, 1.78],
    [30, 1.98], [40, 2.12], [50, 2.25], [75, 2.50], [100, 2.80],
    [125, 3.08], [150, 3.32], [175, 3.55], [200, 3.75], [225, 3.92],
    [250, 4.08], [300, 4.35], [350, 4.58], [400, 4.78], [450, 5.00],
  ],
  intermediate: [
    [0, 1.0], [3, 1.15], [6, 1.28], [10, 1.50], [15, 1.72], [20, 1.92],
    [30, 2.15], [40, 2.35], [50, 2.52], [75, 2.85], [100, 3.18],
    [125, 3.48], [150, 3.75], [175, 4.00], [200, 4.22], [225, 4.42],
    [250, 4.60], [300, 4.92], [350, 5.20], [400, 5.45], [450, 5.70],
  ],
  beginner: [
    [0, 1.0], [3, 1.20], [6, 1.38], [10, 1.65], [15, 1.92], [20, 2.18],
    [30, 2.48], [40, 2.72], [50, 2.95], [75, 3.38], [100, 3.78],
    [125, 4.15], [150, 4.50], [175, 4.82], [200, 5.12], [225, 5.38],
    [250, 5.62], [300, 6.05], [350, 6.42], [400, 6.75], [450, 7.05],
  ],
};

// Penalty cost in expected strokes (OB/water/hazard)
const PENALTY_STROKES: Record<SkillLevel, number> = {
  tour_pro: 1.8, scratch: 2.2, advanced: 2.8, intermediate: 3.5, beginner: 4.2,
};

// ─── Zone definitions ─────────────────────────────────────────────────────────

export type ZoneId = "aggressive" | "center" | "bail_out" | "layup" | "safe_short";

export interface TargetZone {
  id: ZoneId;
  name: string;
  emoji: string;
  description: string;
  /** Distance to the center of this target zone from the player */
  targetYards: number;
  /** Effective zone radius — how wide/deep a "hit" counts */
  zoneRadiusYards: number;
  /** 0–1 probability of landing in this zone given conditions */
  successProbability: number;
  /** 0–1 probability of a penalty outcome on a miss */
  penaltyProbability: number;
  /** Expected strokes from the target zone center */
  expectedFromSuccess: number;
  /** Expected strokes from a typical miss of this zone */
  expectedFromMiss: number;
  /** Blended expected strokes including miss outcomes */
  expectedStrokes: number;
  /** SG delta vs the center-green baseline (negative = better) */
  sgDelta: number;
  /** Absolute SG gained vs the field average from current distance */
  sgVsField: number;
  riskLevel: "low" | "medium" | "high" | "very_high";
  isRecommended: boolean;
  verdict: string;
  rationale: string;
}

export interface DecisionMatrix {
  zones: TargetZone[];
  recommended: TargetZone;
  summary: string;        // one-line decision
  keyFactor: string;      // the single biggest reason for this call
  expectedStrokesNow: number; // E[strokes] from current position (the cost of this shot)
  sgFromCurrentLie: number;   // net SG gain if you execute recommended play
}

// ─── Interpolation helper ─────────────────────────────────────────────────────

function expectedStrokes(distYards: number, skillLevel: SkillLevel): number {
  const table = SG_BASELINES[skillLevel];
  if (distYards <= 0) return 1.0;

  for (let i = 0; i < table.length - 1; i++) {
    const [d0, s0] = table[i];
    const [d1, s1] = table[i + 1];
    if (distYards >= d0 && distYards <= d1) {
      const t = (distYards - d0) / (d1 - d0);
      return s0 + t * (s1 - s0);
    }
  }
  // Beyond last entry — extrapolate
  const last = table[table.length - 1];
  return last[1] + (distYards - last[0]) * 0.008;
}

// ─── Success probability model ────────────────────────────────────────────────
// Models how likely a golfer is to land in the target zone, accounting for
// distance, skill, tendencies, conditions, and zone attractiveness.

function successProbability(
  distToTarget: number,
  zoneRadius: number,
  skillLevel: SkillLevel,
  tendencies: TendencyProfile,
  conditions: CaddieConditions,
  zoneId: ZoneId,
): number {
  // Base accuracy by skill level — % of shots that finish within 20 yards at 150
  const baseAccuracy: Record<SkillLevel, number> = {
    tour_pro: 0.82, scratch: 0.68, advanced: 0.55, intermediate: 0.42, beginner: 0.28,
  };

  // Accuracy degrades with distance (roughly linearly, worse at longer range)
  const distFactor = Math.max(0.3, 1 - (distToTarget / 250) * 0.45);

  // Zone radius bonus — larger target = higher success
  const radiusFactor = Math.min(1.3, 0.7 + (zoneRadius / 25));

  // Lie penalty
  const liePenalty: Record<CaddieConditions["lie"], number> = {
    tee: 0, fairway: 0, rough: -0.12, bunker: -0.18,
    hardpan: -0.10, downslope: -0.08, upslope: -0.06, sidehill: -0.08,
  };

  // Wind penalty
  const windPenalty = conditions.windDirection === "none" ? 0
    : conditions.windSpeedMph > 20 ? -0.14
    : conditions.windSpeedMph > 10 ? -0.08
    : -0.03;

  // Tendency miss penalty — aggressive pin shot with bad miss pattern
  const missPenalty = (zoneId === "aggressive" && tendencies.dominantMiss !== null && tendencies.dominantMiss !== "center")
    ? -0.10
    : 0;

  const raw = baseAccuracy[skillLevel]
    * distFactor
    * radiusFactor
    + liePenalty[conditions.lie]
    + windPenalty
    + missPenalty;

  return Math.max(0.05, Math.min(0.97, raw));
}

// ─── Penalty probability model ─────────────────────────────────────────────────
// How likely is a miss to result in a penalty (OB/water/hazard)?

function penaltyProbability(
  zoneId: ZoneId,
  successProb: number,
  conditions: CaddieConditions,
): number {
  // Only aggressive and bail-out shots can end in penalties — layup/center are safe
  const basePenalty: Record<ZoneId, number> = {
    aggressive: 0.25,
    center:     0.05,
    bail_out:   0.04,
    layup:      0.02,
    safe_short: 0.01,
  };

  const windModifier = conditions.windDirection !== "none" && conditions.windSpeedMph > 15 ? 0.08 : 0;
  const lieModifier = ["bunker", "rough", "downslope"].includes(conditions.lie) ? 0.06 : 0;

  const missProb = 1 - successProb;
  // Penalty only applies to misses
  return Math.min(0.50, (basePenalty[zoneId] + windModifier + lieModifier) * missProb * 1.8);
}

// ─── Risk level ───────────────────────────────────────────────────────────────

function riskLevel(penaltyProb: number, expectedSg: number): "low" | "medium" | "high" | "very_high" {
  if (penaltyProb > 0.20) return "very_high";
  if (penaltyProb > 0.10 || expectedSg > 0.3) return "high";
  if (penaltyProb > 0.05 || expectedSg > 0.1) return "medium";
  return "low";
}

// ─── Zone builder ─────────────────────────────────────────────────────────────

function buildZone(
  id: ZoneId,
  distanceToPin: number,
  skillLevel: SkillLevel,
  tendencies: TendencyProfile,
  conditions: CaddieConditions,
  centerBaselineStrokes: number,
): Omit<TargetZone, "isRecommended" | "sgDelta" | "sgVsField" | "verdict" | "rationale"> {
  const maxDriver = CLUB_DISTANCES[skillLevel]["Driver"] ?? 220;

  // Zone-specific target and radius
  const zoneConfig: Record<ZoneId, { targetOffsetYards: number; radiusYards: number; name: string; emoji: string; description: string }> = {
    aggressive: {
      targetOffsetYards: 0,    // aim at the flag
      radiusYards: 10,
      name: "Attack the Flag",
      emoji: "🎯",
      description: "Direct at the pin — maximum birdie chance, real penalty risk",
    },
    center: {
      targetOffsetYards: 0,    // same distance, but to center-green (radius is wider)
      radiusYards: 22,
      name: "Center of Green",
      emoji: "🟢",
      description: "Fat part of the green — safest play, still makeable two-putt",
    },
    bail_out: {
      targetOffsetYards: 5,    // slightly shorter / wider
      radiusYards: 30,
      name: "Bail-Out Zone",
      emoji: "⬅️",
      description: "Away from trouble — miss to the safe side, accept longer putt",
    },
    layup: {
      targetOffsetYards: -(distanceToPin - Math.min(distanceToPin - 30, 100)),
      radiusYards: 25,
      name: "Strategic Layup",
      emoji: "📐",
      description: "Leave a full wedge in — set up a high-percentage scoring shot",
    },
    safe_short: {
      targetOffsetYards: -15,  // 15 yards short of pin
      radiusYards: 28,
      name: "Short of the Flag",
      emoji: "🔒",
      description: "Land short, release to pin — avoids back trouble",
    },
  };

  const cfg = zoneConfig[id];
  const targetYards = Math.max(10, distanceToPin + cfg.targetOffsetYards);
  const zoneRadius = cfg.radiusYards;

  // Skip layup if we can reach the green
  const isLayupZone = id === "layup";
  const canReach = distanceToPin <= maxDriver * 1.1;
  if (isLayupZone && canReach && distanceToPin <= 200) {
    // return a no-op zone — will be filtered out
    return {
      id, name: cfg.name, emoji: cfg.emoji, description: cfg.description,
      targetYards, zoneRadiusYards: zoneRadius,
      successProbability: 0, penaltyProbability: 0,
      expectedFromSuccess: 99, expectedFromMiss: 99, expectedStrokes: 99,
      riskLevel: "low",
    };
  }

  const successProb = successProbability(targetYards, zoneRadius, skillLevel, tendencies, conditions, id);
  const penaltyProb = penaltyProbability(id, successProb, conditions);
  const missProb = 1 - successProb;

  // Expected strokes from success = E[strokes from target zone center]
  const fromSuccess = expectedStrokes(
    id === "aggressive" ? Math.max(3, targetYards * 0.05) : // aggressive → close putt on success
    id === "center" ? 18 :                                  // center → ~18 ft first putt
    id === "bail_out" ? 28 :                                // bail-out → longer putt
    id === "safe_short" ? 15 :
    targetYards * 0.6,                                      // layup → short approach
    skillLevel,
  );

  // Expected strokes from a miss
  const penaltyE = expectedStrokes(distanceToPin, skillLevel) + PENALTY_STROKES[skillLevel];
  const roughE = expectedStrokes(distanceToPin + 15, skillLevel); // miss ends up further
  const fromMiss = penaltyProb > 0 
    ? penaltyProb * penaltyE + (1 - penaltyProb) * roughE
    : roughE;

  // Blended expected strokes
  const blended = successProb * (1 + fromSuccess) + missProb * (1 + fromMiss);

  return {
    id,
    name: cfg.name,
    emoji: cfg.emoji,
    description: cfg.description,
    targetYards,
    zoneRadiusYards: zoneRadius,
    successProbability: successProb,
    penaltyProbability: penaltyProb,
    expectedFromSuccess: fromSuccess,
    expectedFromMiss: fromMiss,
    expectedStrokes: blended,
    riskLevel: riskLevel(penaltyProb, blended - centerBaselineStrokes),
  };
}

// ─── Main decision engine ──────────────────────────────────────────────────────

export function buildDecisionMatrix(
  skillLevel: SkillLevel,
  tendencies: TendencyProfile,
  conditions: CaddieConditions,
): DecisionMatrix {
  const dist = conditions.distanceToPin;
  const maxDriver = CLUB_DISTANCES[skillLevel]["Driver"] ?? 220;

  // Baseline: expected strokes from current position
  const lieMultiplier: Record<CaddieConditions["lie"], number> = {
    tee: 1.0, fairway: 1.0, rough: 1.12, bunker: 1.18,
    hardpan: 1.08, downslope: 1.10, upslope: 1.08, sidehill: 1.09,
  };
  const expectedNow = expectedStrokes(dist, skillLevel) * lieMultiplier[conditions.lie];

  // Build center-green as baseline for SG delta comparisons
  const centerZoneRaw = buildZone("center", dist, skillLevel, tendencies, conditions, 0);
  const centerBaseline = centerZoneRaw.expectedStrokes;

  // Build all zones
  const zoneIds: ZoneId[] = ["aggressive", "center", "bail_out", "safe_short", "layup"];
  const rawZones = zoneIds.map((id) =>
    buildZone(id, dist, skillLevel, tendencies, conditions, centerBaseline)
  );

  // Filter out suppressed layup zones (expectedStrokes = 99)
  const validZones = rawZones.filter((z) => z.expectedStrokes < 90);

  // Add SG delta and field comparison
  const zones: TargetZone[] = validZones.map((z) => {
    const sgDelta = z.expectedStrokes - centerBaseline; // positive = worse than center
    const sgVsField = expectedNow - z.expectedStrokes - 1; // SG vs field (1 = the shot itself)
    return { ...z, sgDelta, sgVsField, isRecommended: false, verdict: "", rationale: "" };
  });

  // Rank: minimize expected strokes, tie-break by lower risk
  const riskPenalty: Record<TargetZone["riskLevel"], number> = {
    low: 0, medium: 0.05, high: 0.15, very_high: 0.30,
  };
  const ranked = [...zones].sort((a, b) =>
    (a.expectedStrokes + riskPenalty[a.riskLevel]) -
    (b.expectedStrokes + riskPenalty[b.riskLevel])
  );

  const recommended = ranked[0];

  // Add verdict + rationale to each zone
  const finalZones = zones.map((z) => {
    const isRec = z.id === recommended.id;
    const sgStr = z.sgDelta > 0
      ? `+${z.sgDelta.toFixed(2)} strokes vs center`
      : z.sgDelta < 0
      ? `${z.sgDelta.toFixed(2)} strokes vs center`
      : "same as center";

    const pctSuccess = Math.round(z.successProbability * 100);
    const pctPenalty = Math.round(z.penaltyProbability * 100);

    const verdicts: Record<ZoneId, string> = {
      aggressive: pctPenalty > 15 ? "High risk — only go if pin is on" : "Birdie chance — commit fully",
      center:     "Percentage play — eliminate big numbers",
      bail_out:   "Smart miss — takes trouble out of play",
      layup:      "Control the approach — set up a wedge",
      safe_short: "Eliminate back-flag trouble",
    };

    const rationale = `${pctSuccess}% success · ${pctPenalty}% penalty · ${sgStr}`;

    return { ...z, isRecommended: isRec, verdict: verdicts[z.id], rationale };
  });

  // Key factor driving the recommendation
  const keyFactor = (() => {
    if (conditions.windSpeedMph > 18) return `${conditions.windSpeedMph} mph wind increases miss dispersion`;
    if (conditions.lie === "bunker" || conditions.lie === "rough") return `${conditions.lie} lie reduces accuracy — play safer zone`;
    if (tendencies.dominantMiss && tendencies.dominantMiss !== "center") return `Your ${tendencies.dominantMiss} miss pattern shifts the optimal target`;
    if (dist > maxDriver * 0.95) return "Distance requires a layup — control the next shot";
    if (conditions.pinPosition === "front") return "Front pin penalizes being long — short side is safe";
    if (conditions.greenFirmness === "firm") return "Firm greens mean more rollout — land shorter";
    return "Balanced conditions favor the percentage play";
  })();

  const rec = finalZones.find((z) => z.id === recommended.id) ?? finalZones[0];
  const sgGainedStr = rec.sgVsField > 0.2
    ? `+${rec.sgVsField.toFixed(2)} SG vs field`
    : rec.sgVsField < -0.1
    ? `${rec.sgVsField.toFixed(2)} SG vs field`
    : "on par with field";

  const summary = rec.id === "aggressive"
    ? `Attack the flag — ${Math.round(rec.successProbability * 100)}% chance of a tight result (${sgGainedStr})`
    : rec.id === "center"
    ? `Center of green is the play — eliminate trouble, two-putt for par (${sgGainedStr})`
    : rec.id === "bail_out"
    ? `Miss to the safe side — conditions make the aggressive play too costly (${sgGainedStr})`
    : rec.id === "layup"
    ? `Lay it up — leave yourself a full wedge and attack from there (${sgGainedStr})`
    : `Land short of the flag — let the ground work for you (${sgGainedStr})`;

  return {
    zones: finalZones,
    recommended: rec,
    summary,
    keyFactor,
    expectedStrokesNow: expectedNow,
    sgFromCurrentLie: expectedNow - rec.expectedStrokes - 1,
  };
}
