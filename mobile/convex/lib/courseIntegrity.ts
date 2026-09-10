/**
 * Integrity checks and repairs for the built-in course library.
 *
 * The library was carried over from the web app and contains data-entry
 * errors. Two kinds are detectable from the data alone and repaired here:
 *
 *   1. Duplicate stroke indices — six courses allocate the same index to two
 *      holes and omit another, so the 1-18 allocation is invalid. Stroke
 *      index decides which holes give shots in net play.
 *   2. Par contradicting yardage — a "par 5" of 136 yards, or a "par 3" of
 *      427. Par drives score-to-par and the handicap differential; yardage
 *      drives the caddie. A hole that disagrees with itself is wrong either
 *      way, so par is re-derived from the yardage.
 *
 * A third kind CANNOT be repaired from the data: a hole whose par and yardage
 * agree but are both wrong for the real hole. TPC Sawgrass's 17th is listed as
 * a 368-yard par 4 when it is the ~137-yard island-green par 3 — internally
 * consistent, externally false. Treat this library as plausible placeholder
 * data, not authoritative course data, until it is replaced from a real source.
 */
import type { GolfCourse, TeeBox } from './courses';

/**
 * Par implied by a yardage, using standard men's rating bands.
 * Measured from the regular tees, which is what the app defaults to.
 */
export function parForYardage(yards: number): 3 | 4 | 5 {
  if (yards <= 250) return 3;
  if (yards <= 470) return 4;
  return 5;
}

/** True when a hole's stated par cannot be right for its own yardage. */
export function parContradictsYardage(par: number, regularYards: number): boolean {
  return par !== parForYardage(regularYards);
}

export type CourseIssue = {
  courseId: string;
  hole?: number;
  kind: 'duplicate-stroke-index' | 'par-yardage-mismatch' | 'hole-count' | 'tee-order';
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

      if (parContradictsYardage(h.par, h.yards.regular)) {
        issues.push({
          courseId: c.id,
          hole: h.hole,
          kind: 'par-yardage-mismatch',
          detail: `par ${h.par} at ${h.yards.regular} yds implies par ${parForYardage(h.yards.regular)}`,
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
 */
export function normalizeCourses(courses: GolfCourse[]): GolfCourse[] {
  return courses.map((course) => {
    const holes = course.holes.map((h) => ({ ...h, yards: { ...h.yards }, green: { ...h.green } }));

    // Par first: the stroke-index repair ranks holes using par.
    for (const h of holes) {
      if (parContradictsYardage(h.par, h.yards.regular)) {
        h.par = parForYardage(h.yards.regular);
      }
    }

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
