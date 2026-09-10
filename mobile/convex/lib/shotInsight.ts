/**
 * Shot analysis: the coaching note attached to a logged shot, and whether the
 * shot passes the accuracy threshold for the golfer's level.
 *
 * Lifted from the web app's `convex/shots.ts` unchanged. Extracted into `lib/`
 * so it can be unit tested and read by the client - see convex/lib/bag.ts for
 * why app code must not import a Convex function module.
 */
import { ACCURACY_THRESHOLDS, type SkillLevel } from './curriculum';

// ─── Derive AI insight from shot data ─────────────────────────────────────────
export function deriveAiInsight(args: {
  club: string;
  targetDistanceYards: number;
  actualDistanceYards: number;
  distanceFromTargetYards: number;
  shotShape: string;
  ballFlight: string;
  missDirection?: string;
  lieType?: string;
  windSpeedMph?: number;
  windDirection?: string;
  elevation?: number;
  carryYards?: number;
  spinRpm?: number;
  smashFactor?: number;
  launchAngleDeg?: number;
  clubSpeedMph?: number;
  skillLevel: string;
}): string {
  const insights: string[] = [];
  const diff = args.actualDistanceYards - args.targetDistanceYards;

  // Distance analysis
  if (Math.abs(diff) > 20) {
    if (diff < 0) insights.push(`Shot came up ${Math.abs(diff)} yards short - consider one more club or a more committed swing.`);
    else insights.push(`Shot carried ${diff} yards long - check your yardage chart and club selection.`);
  }

  // Miss pattern
  if (args.missDirection && args.missDirection !== "center") {
    const missMap: Record<string, string> = {
      left:  "Consistent left misses suggest a closed clubface or over-the-top swing path. Work on releasing the club later.",
      right: "Right misses often indicate an open face or inside-out path with a blocked release. Check your grip pressure.",
      short: "Shots coming up short indicate deceleration through impact. Commit to a full finish.",
      long:  "Longer than expected - you may be hitting it purer than you realize. Update your yardage chart.",
    };
    if (missMap[args.missDirection]) insights.push(missMap[args.missDirection]);
  }

  // Shot shape patterns
  if (args.shotShape === "hook" || args.shotShape === "slice") {
    const msg = args.shotShape === "hook"
      ? "A hook indicates a closed face relative to path - loosen grip pressure in your trail hand."
      : "A slice indicates an open face relative to path - focus on releasing the forearms through impact.";
    insights.push(msg);
  }

  // Ball flight
  if (args.ballFlight === "high" && (args.club.includes("iron") || args.club.includes("Iron"))) {
    insights.push("High ball flight with irons reduces distance and increases wind exposure. Check your ball position - it may be too far forward.");
  }
  if (args.ballFlight === "low" && args.club === "driver") {
    insights.push("Low driver flight limits carry distance. Ensure tee height is correct - ball equator should align with crown of driver.");
  }

  // Launch monitor insights
  if (args.smashFactor !== undefined) {
    if (args.smashFactor < 1.40) insights.push(`Smash factor of ${args.smashFactor.toFixed(2)} is below ideal (1.45–1.50) - work on center-face contact.`);
    else if (args.smashFactor >= 1.48) insights.push(`Excellent smash factor of ${args.smashFactor.toFixed(2)} - you're compressing the ball well.`);
  }
  if (args.spinRpm !== undefined) {
    const isShortIron = ["PW","GW","SW","LW","9i","9-iron"].some(c => args.club.includes(c));
    if (isShortIron && args.spinRpm < 7000) insights.push("Low spin on short iron - steep up your angle of attack for more stopping power.");
    if (!isShortIron && args.club === "driver" && args.spinRpm > 3000) insights.push(`High driver spin (${args.spinRpm} rpm) is costing distance - check tee height and attack angle.`);
  }
  if (args.launchAngleDeg !== undefined && args.club === "driver") {
    if (args.launchAngleDeg < 10) insights.push("Driver launch angle under 10° - tee it up higher and move ball slightly forward in stance.");
    if (args.launchAngleDeg > 16) insights.push("Very high launch angle - could be losing efficiency. Check if ball position is too far forward.");
  }

  // Wind / elevation context
  if (args.windSpeedMph && args.windSpeedMph > 10) {
    const dir = args.windDirection ?? "unknown direction";
    insights.push(`${args.windSpeedMph} mph wind from ${dir} was a factor - account for ~1 club per 10 mph into the wind.`);
  }
  if (args.elevation && Math.abs(args.elevation) > 5) {
    const upDown = args.elevation > 0 ? "uphill" : "downhill";
    insights.push(`${upDown} shot of ${Math.abs(args.elevation)} yards - ${args.elevation > 0 ? "add" : "subtract"} ~${Math.round(Math.abs(args.elevation) * 0.5)} yards to your club selection next time.`);
  }

  // Lie type
  if (args.lieType && args.lieType !== "fairway" && args.lieType !== "tee") {
    const lieMap: Record<string, string> = {
      rough:  "From rough, expect 10–20% less distance and reduced spin. Open the face slightly.",
      bunker: "From bunker, the splash technique and sand quality determine distance - practice your consistent entry point.",
      hardpan:"Tight/hardpan lies demand steep angle of attack - hands forward, ball back slightly.",
      divot:  "From a divot, play the ball back and accept reduced flight height.",
    };
    if (lieMap[args.lieType]) insights.push(lieMap[args.lieType]);
  }

  if (insights.length === 0) {
    insights.push("Good shot data logged. Keep tracking to identify patterns over multiple sessions.");
  }

  return insights.slice(0, 3).join(" | ");
}

// ─── Determine pass/fail vs threshold ─────────────────────────────────────────
export function getSkillTestResult(
  club: string,
  distanceFromTargetYards: number,
  skillLevel: SkillLevel
): "pass" | "fail" {
  const t = ACCURACY_THRESHOLDS[skillLevel];
  const isPutt = club.toLowerCase().includes("putter") || club.toLowerCase() === "putter";
  const isChip = ["chip","flop","bump"].some(k => club.toLowerCase().includes(k));
  const isPitch = ["pw","gw","sw","lw","wedge","pitching"].some(k => club.toLowerCase().includes(k));

  if (isPutt) {
    const feetFromCup = distanceFromTargetYards * 3;
    return feetFromCup <= t.puttFeet ? "pass" : "fail";
  }
  if (isChip) return distanceFromTargetYards <= t.chipYards ? "pass" : "fail";
  if (isPitch) return distanceFromTargetYards <= t.pitchYards ? "pass" : "fail";
  return distanceFromTargetYards <= t.ironYards ? "pass" : "fail";
}

// ─── Log a shot ───────────────────────────────────────────────────────────────
