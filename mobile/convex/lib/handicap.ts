/**
 * WHS Handicap Index calculation.
 *
 * Implements Rule 5.2 of the Rules of Handicapping. Pure functions with no
 * Convex imports, so the client can reuse them and they can be unit tested.
 *
 * The version ported from the web app was wrong in three ways, all corrected
 * here:
 *   1. Its "scores to use" table diverged from the standard for every record
 *      size from 10 to 19 rounds - it averaged the best 5 at 12 rounds where
 *      WHS uses the best 4.
 *   2. It multiplied the result by 0.96. That is the "bonus for excellence"
 *      from the pre-2020 USGA system; WHS uses a straight average.
 *   3. It omitted the adjustments WHS applies to short records (-2.0 at three
 *      scores, -1.0 at four, -1.0 at six).
 */

/** A score differential: (adjusted gross - course rating) x 113 / slope. */
export type ScoreDifferential = {
  date: string;
  courseName: string;
  grossScore: number;
  differential: number;
};

/** WHS caps a Handicap Index at 54.0 for every player. */
export const MAX_HANDICAP_INDEX = 54.0;

/** Fewer than this many acceptable scores yields no index at all. */
export const MIN_SCORES_FOR_INDEX = 3;

/**
 * Rule 5.2a - how many of the lowest differentials to average, and what
 * adjustment to apply, for records of fewer than 20 scores.
 */
const SCORES_TO_USE: Record<number, { count: number; adjustment: number }> = {
  3: { count: 1, adjustment: -2.0 },
  4: { count: 1, adjustment: -1.0 },
  5: { count: 1, adjustment: 0 },
  6: { count: 2, adjustment: -1.0 },
  7: { count: 2, adjustment: 0 },
  8: { count: 2, adjustment: 0 },
  9: { count: 3, adjustment: 0 },
  10: { count: 3, adjustment: 0 },
  11: { count: 3, adjustment: 0 },
  12: { count: 4, adjustment: 0 },
  13: { count: 4, adjustment: 0 },
  14: { count: 4, adjustment: 0 },
  15: { count: 5, adjustment: 0 },
  16: { count: 5, adjustment: 0 },
  17: { count: 6, adjustment: 0 },
  18: { count: 6, adjustment: 0 },
  19: { count: 7, adjustment: 0 },
  20: { count: 8, adjustment: 0 },
};

/**
 * Differential count and adjustment for a record of `n` scores. Records longer
 * than 20 use the most recent 20, so they resolve to 8 and no adjustment.
 */
export function scoresToUse(n: number): { count: number; adjustment: number } {
  if (n < MIN_SCORES_FOR_INDEX) return { count: 0, adjustment: 0 };
  return SCORES_TO_USE[n] ?? { count: 8, adjustment: 0 };
}

/** Round to one decimal place, as WHS requires. */
function toTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Score differential for a single round.
 *
 * The playing conditions calculation (PCC) is not modelled - it needs
 * field-wide scoring data this app does not collect.
 */
export function scoreDifferential(
  grossScore: number,
  courseRating: number,
  slopeRating: number,
): number {
  if (slopeRating <= 0) throw new Error('slopeRating must be positive');
  return toTenth(((grossScore - courseRating) * 113) / slopeRating);
}

/**
 * Handicap Index from a scoring record, newest first.
 *
 * Returns null below three acceptable scores: WHS issues no index at that
 * point, and rendering 0.0 would read as scratch.
 */
export function handicapIndex(differentials: number[]): number | null {
  if (differentials.length < MIN_SCORES_FOR_INDEX) return null;

  // Only the 20 most recent scores are eligible.
  const eligible = differentials.slice(0, 20);
  const { count, adjustment } = scoresToUse(eligible.length);

  const lowest = [...eligible].sort((a, b) => a - b).slice(0, count);
  const average = lowest.reduce((sum, d) => sum + d, 0) / lowest.length;

  // An adjustment can take a strong record below zero. A plus handicap is
  // legitimate, so only the upper cap applies.
  return Math.min(MAX_HANDICAP_INDEX, toTenth(average + adjustment));
}

/**
 * Running index after each round, oldest first - for the trend chart.
 *
 * Shares handicapIndex with the headline number, so the chart and the figure
 * can no longer disagree. The original kept two separate tables for these.
 */
export function handicapTrend(
  rounds: ScoreDifferential[],
): { date: string; index: number; courseName: string }[] {
  const chronological = [...rounds].reverse();
  const trend: { date: string; index: number; courseName: string }[] = [];

  for (let i = 0; i < chronological.length; i++) {
    const upTo = chronological.slice(0, i + 1);
    // handicapIndex expects newest-first.
    const index = handicapIndex([...upTo].reverse().map((r) => r.differential));
    if (index === null) continue;

    const last = upTo[upTo.length - 1];
    trend.push({ date: last.date, index, courseName: last.courseName });
  }

  return trend;
}

/** Marks which rounds contribute to the current index. */
export function contributingRounds(
  rounds: ScoreDifferential[],
): (ScoreDifferential & { contributing: boolean })[] {
  const eligible = rounds.slice(0, 20);
  const { count } = scoresToUse(eligible.length);

  // Rank by differential but track original position, so ties and repeated
  // course/date pairs cannot both be marked (the original keyed on
  // date + courseName and mismarked duplicates).
  const contributingIndexes = new Set(
    eligible
      .map((r, index) => ({ index, differential: r.differential }))
      .sort((a, b) => a.differential - b.differential)
      .slice(0, count)
      .map((r) => r.index),
  );

  return rounds.map((r, index) => ({
    ...r,
    contributing: index < 20 && contributingIndexes.has(index),
  }));
}
