/**
 * Integrity checks and repairs for the built-in course library.
 *
 * The library is now transcribed from published scorecards (see the header of
 * `courses.ts` for the sources), so par is taken as authored. It used to be
 * re-derived from yardage, which was the right call while the data was
 * invented and is the wrong call now: real golf is full of holes that a
 * yardage band gets wrong. Oakmont's 8th is a 289-yard par 3, Winged Foot's
 * 9th a 565-yard par 4, and Riviera's 10th a 315-yard par 4. Re-deriving par
 * turned every one of those into something else - it took a correct library
 * and broke it in exactly the famous places a golfer would check.
 *
 * What is still repaired is the stroke index, because that is a structural
 * property - the eighteen holes must carry the indices 1-18 exactly once each,
 * whatever the scorecard says - and several courses' indices were never
 * sourced.
 *
 * `findCourseIssues` still flags a par that cannot be right for its yardage,
 * but with bounds drawn around what real golf holes do rather than around a
 * rating table. It reports; it no longer rewrites.
 */
import type { GolfCourse, TeeBox } from './courses';

/**
 * Par implied by a yardage, using standard men's rating bands.
 *
 * Used to *suggest* a par when a golfer enters a course of their own and has
 * not said what a hole plays as. It is a default, not a correction - nothing
 * in the built-in library is derived from it any more.
 */
export function parForYardage(yards: number): 3 | 4 | 5 {
  if (yards <= 250) return 3;
  if (yards <= 470) return 4;
  return 5;
}

/**
 * What each par actually measures in the real world, generously bounded.
 *
 * The ends are set past the known extremes rather than at them: the longest
 * par 3s in major championship golf run just under 300 yards, the longest par
 * 4s around 570, and drivable par 4s down to about 280. A hole outside these
 * is a transcription error, not an unusual hole.
 */
export const PAR_YARDAGE_BOUNDS: Record<3 | 4 | 5, readonly [number, number]> = {
  3: [70, 310],
  4: [260, 600],
  5: [430, 720],
} as const;

/** True when a hole's stated par cannot be right for its own yardage. */
export function parImplausibleForYardage(par: number, regularYards: number): boolean {
  const bounds = PAR_YARDAGE_BOUNDS[par as 3 | 4 | 5];
  if (!bounds) return true;
  return regularYards < bounds[0] || regularYards > bounds[1];
}

export type CourseIssue = {
  courseId: string;
  hole?: number;
  kind: 'duplicate-stroke-index' | 'par-yardage-implausible' | 'hole-count' | 'tee-order';
  detail: string;
};

/** Reports every detectable problem without changing anything. */
export function findCourseIssues(courses: GolfCourse[]): CourseIssue[] {
  const issues: CourseIssue[] = [];

  for (const c of courses) {
    if (c.holes.length !== 18) {
      issues.push({
        courseId: c.id,
        kind: 'hole-count',
        detail: `${c.holes.length} holes`,
      });
    }

    const seen = new Map<number, number>();
    for (const h of c.holes) {
      const first = seen.get(h.strokeIndex);
      if (first !== undefined) {
        issues.push({
          courseId: c.id,
          hole: h.hole,
          kind: 'duplicate-stroke-index',
          detail: `stroke index ${h.strokeIndex} already used by hole ${first}`,
        });
      } else {
        seen.set(h.strokeIndex, h.hole);
      }

      if (parImplausibleForYardage(h.par, h.yards.regular)) {
        const bounds = PAR_YARDAGE_BOUNDS[h.par as 3 | 4 | 5];
        issues.push({
          courseId: c.id,
          hole: h.hole,
          kind: 'par-yardage-implausible',
          detail: bounds
            ? `par ${h.par} at ${h.yards.regular} yds is outside ${bounds[0]}-${bounds[1]}`
            : `par ${h.par} is not 3, 4 or 5`,
        });
      }

      const tees: TeeBox[] = ['championship', 'regular', 'forward'];
      const [champ, reg, fwd] = tees.map((t) => h.yards[t]);
      if (!(champ >= reg && reg >= fwd)) {
        issues.push({
          courseId: c.id,
          hole: h.hole,
          kind: 'tee-order',
          detail: `tees not ordered: ${champ}/${reg}/${fwd}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Returns a repaired copy of the library.
 *
 * Stroke indices are made a valid 1-18 permutation: existing values are kept
 * where unique, and each duplicate is reassigned from the unused indices. The
 * hole playing longer relative to its par keeps the lower (harder) index, so
 * the allocation still tracks difficulty and the result is deterministic.
 *
 * Par is never touched - see the note at the top of this file.
 */
export function normalizeCourses(courses: GolfCourse[]): GolfCourse[] {
  return courses.map((course) => {
    const holes = course.holes.map((h) => ({ ...h, yards: { ...h.yards }, green: { ...h.green } }));

    const claimed = new Set<number>();
    const needsIndex: typeof holes = [];

    for (const h of holes) {
      const valid = Number.isInteger(h.strokeIndex) && h.strokeIndex >= 1 && h.strokeIndex <= 18;
      if (valid && !claimed.has(h.strokeIndex)) {
        claimed.add(h.strokeIndex);
      } else {
        needsIndex.push(h);
      }
    }

    if (needsIndex.length > 0) {
      const free = Array.from({ length: 18 }, (_, i) => i + 1).filter((n) => !claimed.has(n));

      // Yards over par is a rough difficulty proxy; hardest takes the lowest
      // free index. Hole number breaks ties so the result never varies.
      needsIndex.sort((a, b) => {
        const da = a.yards.regular / a.par;
        const db = b.yards.regular / b.par;
        return db - da || a.hole - b.hole;
      });
      free.sort((a, b) => a - b);

      needsIndex.forEach((h, i) => {
        h.strokeIndex = free[i];
      });
    }

    return { ...course, holes };
  });
}
