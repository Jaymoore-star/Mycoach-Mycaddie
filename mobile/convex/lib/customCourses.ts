/**
 * Courses the golfer adds themselves.
 *
 * The `customCourses` table has been in the schema since the port but nothing
 * read or wrote it, so only the eighteen built-in courses were ever
 * selectable. This is the missing half: validation, and the adapter that lets
 * a custom course be used everywhere a library course can.
 *
 * The adapter matters more than it looks. `buildCaddieRecommendation`, the
 * scorecard and the WHS handicap all take a `GolfCourse`; if a custom course
 * were a second shape, every one of them would need a branch. Instead a
 * `customCourses` row is converted once, at the edge, and nothing downstream
 * can tell the difference.
 */
import type { GolfCourse, GreenData, TeeBox } from './courses';
import { parForYardage } from './courseIntegrity';

/**
 * Marks a course id as the golfer's own.
 *
 * Course ids are stored as plain strings on `roundScores`, so a custom course
 * and a library course share one namespace. The prefix is what keeps a
 * golfer's "Pebble Beach" from resolving to the built-in one - and what lets
 * a round opened months ago still find the course it was played on.
 */
export const CUSTOM_COURSE_PREFIX = 'custom:';

export function customCourseId(id: string): string {
  return `${CUSTOM_COURSE_PREFIX}${id}`;
}

export function isCustomCourseId(courseId: string | undefined): boolean {
  return courseId?.startsWith(CUSTOM_COURSE_PREFIX) ?? false;
}

/** The table row id inside a custom course id, or null if it is not one. */
export function customCourseRowId(courseId: string | undefined): string | null {
  if (!courseId || !isCustomCourseId(courseId)) return null;
  return courseId.slice(CUSTOM_COURSE_PREFIX.length) || null;
}

export const TEE_BOXES: TeeBox[] = ['championship', 'regular', 'forward'];

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Bounds the WHS allows. A rating outside this is a typo, and a handicap
 * computed from it is worse than no handicap at all.
 */
export const RATING_RANGE = { min: 55, max: 85 } as const;
export const SLOPE_RANGE = { min: 55, max: 155 } as const;
/** No hole is 30 yards, and none is 800. */
export const HOLE_YARDS_RANGE = { min: 50, max: 750 } as const;

export const HOLE_COUNT = 18;

export type CustomHoleInput = {
  hole: number;
  par: 3 | 4 | 5;
  strokeIndex: number;
  yards: Record<TeeBox, number>;
};

export type CustomCourseInput = {
  name: string;
  location: string;
  altitudeFt: number;
  rating: Record<TeeBox, number>;
  slope: Record<TeeBox, number>;
  holes: CustomHoleInput[];
};

/**
 * Everything wrong with a course, in the order a golfer would fix it.
 *
 * Returns all of the problems rather than the first, because the form shows
 * them together - being told about one typo at a time across eighteen holes
 * is how people give up halfway.
 */
export function validateCustomCourse(course: CustomCourseInput): string[] {
  const problems: string[] = [];

  if (!course.name.trim()) problems.push('Give the course a name.');
  if (course.name.trim().length > 80) problems.push('That name is too long.');
  if (!course.location.trim()) problems.push('Add where the course is.');

  if (!Number.isFinite(course.altitudeFt) || course.altitudeFt < -500 || course.altitudeFt > 12000) {
    problems.push('Altitude should be between -500 and 12,000 feet.');
  }

  for (const tee of TEE_BOXES) {
    const rating = course.rating[tee];
    if (!Number.isFinite(rating) || rating < RATING_RANGE.min || rating > RATING_RANGE.max) {
      problems.push(
        `${teeLabel(tee)} course rating should be between ${RATING_RANGE.min} and ${RATING_RANGE.max}.`,
      );
    }

    const slope = course.slope[tee];
    if (!Number.isFinite(slope) || slope < SLOPE_RANGE.min || slope > SLOPE_RANGE.max) {
      problems.push(
        `${teeLabel(tee)} slope should be between ${SLOPE_RANGE.min} and ${SLOPE_RANGE.max}.`,
      );
    }
  }

  if (course.holes.length !== HOLE_COUNT) {
    problems.push(`A course needs all ${HOLE_COUNT} holes - ${course.holes.length} entered.`);
    // Everything below assumes eighteen holes, so stop rather than pile on.
    return problems;
  }

  const holeNumbers = course.holes.map((h) => h.hole).sort((a, b) => a - b);
  const expected = Array.from({ length: HOLE_COUNT }, (_, i) => i + 1);
  if (holeNumbers.some((n, i) => n !== expected[i])) {
    problems.push('Holes must be numbered 1 to 18, once each.');
  }

  // Stroke index decides which holes give shots in net play, so a duplicate
  // is not cosmetic - two holes would give a shot and one never would.
  const indices = course.holes.map((h) => h.strokeIndex).sort((a, b) => a - b);
  if (indices.some((n, i) => n !== expected[i])) {
    problems.push('Stroke indexes must be 1 to 18, once each.');
  }

  for (const hole of course.holes) {
    for (const tee of TEE_BOXES) {
      const yards = hole.yards[tee];
      if (
        !Number.isFinite(yards) ||
        yards < HOLE_YARDS_RANGE.min ||
        yards > HOLE_YARDS_RANGE.max
      ) {
        problems.push(
          `Hole ${hole.hole} ${teeLabel(tee).toLowerCase()} yardage should be between ${
            HOLE_YARDS_RANGE.min
          } and ${HOLE_YARDS_RANGE.max}.`,
        );
      }
    }

    // Forward tees play shorter than the back tees. Reversed numbers are the
    // most common data-entry mistake, and they quietly invert every caddie
    // yardage on the card.
    if (
      Number.isFinite(hole.yards.championship) &&
      Number.isFinite(hole.yards.forward) &&
      hole.yards.forward > hole.yards.championship
    ) {
      problems.push(`Hole ${hole.hole}: forward tees cannot play longer than championship.`);
    }
  }

  return problems;
}

function teeLabel(tee: TeeBox): string {
  return tee === 'championship' ? 'Championship' : tee === 'regular' ? 'Regular' : 'Forward';
}

// ─── A blank course to start from ────────────────────────────────────────────

/** Yardages a par produces by default, so a new card is already plausible. */
const DEFAULT_YARDS: Record<3 | 4 | 5, Record<TeeBox, number>> = {
  3: { championship: 185, regular: 165, forward: 135 },
  4: { championship: 420, regular: 385, forward: 330 },
  5: { championship: 545, regular: 505, forward: 440 },
};

/**
 * A standard par-72 layout: four par 3s, four par 5s, ten par 4s.
 *
 * Starting from a real-shaped card rather than eighteen blanks means the
 * golfer edits the handful of holes that differ instead of typing 72 numbers.
 */
export function blankCourseHoles(): CustomHoleInput[] {
  const pars: (3 | 4 | 5)[] = [4, 5, 3, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];

  return pars.map((par, i) => ({
    hole: i + 1,
    par,
    // Odd indexes on the front nine, even on the back, as most courses do.
    strokeIndex: i < 9 ? i * 2 + 1 : (i - 9) * 2 + 2,
    yards: { ...DEFAULT_YARDS[par] },
  }));
}

export function blankCourse(): CustomCourseInput {
  return {
    name: '',
    location: '',
    altitudeFt: 0,
    rating: { championship: 72, regular: 70, forward: 68 },
    slope: { championship: 130, regular: 125, forward: 118 },
    holes: blankCourseHoles(),
  };
}

/** Par as typed, unless the yardage flatly contradicts it. */
export function suggestedPar(regularYards: number): 3 | 4 | 5 {
  return parForYardage(regularYards);
}

export function coursePar(holes: CustomHoleInput[]): number {
  return holes.reduce((sum, h) => sum + h.par, 0);
}

// ─── Making a custom course look like any other ──────────────────────────────

/**
 * The green the caddie reads when the golfer has not described one.
 *
 * Flat and unremarkable on purpose. The built-in courses carry hand-written
 * green data; a custom course has none, and inventing a break the golfer never
 * mentioned would have the caddie confidently misread every putt.
 */
const UNKNOWN_GREEN: GreenData = {
  breakDirection: 'relatively_flat',
  breakSeverityInches: 0,
  slopeNote: 'No green notes for this course - read it yourself.',
  dangerZone: 'none',
};

export type StoredCustomCourse = {
  _id: string;
  name: string;
  location: string;
  altitudeFt: number;
  lat?: number;
  lon?: number;
  rating: Record<TeeBox, number>;
  slope: Record<TeeBox, number>;
  holes: CustomHoleInput[];
};

/**
 * Converts a stored custom course into the shape everything else consumes.
 *
 * `lat`/`lon` fall back to zero: they exist for a live weather lookup that is
 * not built, and the caddie takes wind from what the golfer enters on the
 * hole, so nothing reads them yet.
 */
export function toGolfCourse(stored: StoredCustomCourse): GolfCourse {
  return {
    id: customCourseId(stored._id),
    name: stored.name,
    location: stored.location,
    altitudeFt: stored.altitudeFt,
    lat: stored.lat ?? 0,
    lon: stored.lon ?? 0,
    rating: { ...stored.rating },
    slope: { ...stored.slope },
    holes: [...stored.holes]
      .sort((a, b) => a.hole - b.hole)
      .map((h) => ({
        hole: h.hole,
        par: h.par,
        strokeIndex: h.strokeIndex,
        yards: { ...h.yards },
        green: { ...UNKNOWN_GREEN },
      })),
  };
}
