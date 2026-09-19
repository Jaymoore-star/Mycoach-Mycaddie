import { describe, expect, it } from 'vitest';

import {
  PAR_YARDAGE_BOUNDS,
  findCourseIssues,
  normalizeCourses,
  parForYardage,
  parImplausibleForYardage,
} from '../convex/lib/courseIntegrity';
import {
  COURSE_LIBRARY,
  RAW_COURSE_LIBRARY,
  getCourseById,
  getCoursePar,
  getCourseYardage,
  searchCourses,
} from '../convex/lib/courses';

const TEES = ['championship', 'regular', 'forward'] as const;

describe('the raw library', () => {
  it('carries the duplicate stroke indices that normalizeCourses repairs', () => {
    // Guards the repair: if the indices are ever sourced properly, this fails
    // and tells us normalizeCourses has nothing left to do.
    const issues = findCourseIssues(RAW_COURSE_LIBRARY);
    expect(issues.filter((i) => i.kind === 'duplicate-stroke-index').length).toBeGreaterThan(0);
  });

  it('states a par that is possible for every hole as authored', () => {
    // Par comes from published scorecards now, so nothing downstream corrects
    // it. A hole outside the bounds is a transcription slip, and this is the
    // only thing that would catch it.
    expect(
      findCourseIssues(RAW_COURSE_LIBRARY).filter((i) => i.kind === 'par-yardage-implausible'),
    ).toEqual([]);
  });

  it('matches the total par on each published card', () => {
    const CARD_PAR: Record<string, number> = {
      'augusta-national': 72,
      'pebble-beach': 72,
      'tpc-sawgrass': 72,
      'st-andrews-old': 72,
      'torrey-pines-south': 72,
      'bethpage-black': 71,
      'erin-hills': 72,
      'harbour-town': 71,
      'whistling-straits': 72,
      'bay-hill': 72,
      'kiawah-ocean': 72,
      'muirfield-village': 72,
      riviera: 71,
      oakmont: 70,
      'shinnecock-hills': 70,
      'bandon-dunes': 72,
      'shadow-creek': 72,
      'winged-foot-west': 70,
    };

    for (const course of COURSE_LIBRARY) {
      expect(getCoursePar(course), course.id).toBe(CARD_PAR[course.id]);
    }
  });

  it('keeps the holes a golfer would spot-check', () => {
    // Each of these was wrong before the library was sourced, and each is
    // famous enough that being wrong is worse than being missing.
    const hole = (id: string, n: number) => getCourseById(id)!.holes[n - 1];

    // The island green, not a 385-yard par 4. Its 18th is the long par 4.
    expect(hole('tpc-sawgrass', 17)).toMatchObject({ par: 3, yards: { championship: 141 } });
    expect(hole('tpc-sawgrass', 18)).toMatchObject({ par: 4, yards: { championship: 462 } });
    // The Road Hole is a par 4, however long it plays.
    expect(hole('st-andrews-old', 17)).toMatchObject({ par: 4, yards: { championship: 495 } });
    // Riviera's drivable 10th, which had wandered to the 16th.
    expect(hole('riviera', 10)).toMatchObject({ par: 4, yards: { championship: 315 } });
    // Oakmont's 8th: the longest par 3 in major championship golf.
    expect(hole('oakmont', 8)).toMatchObject({ par: 3, yards: { championship: 289 } });
    // Pebble's 7th, the shortest hole in championship golf.
    expect(hole('pebble-beach', 7)).toMatchObject({ par: 3, yards: { championship: 106 } });
    // Augusta's 11th is a par 4; Amen Corner starts on a par 4, not a par 5.
    expect(hole('augusta-national', 11)).toMatchObject({ par: 4, yards: { championship: 520 } });
  });
});

describe('the exported library is self-consistent', () => {
  it('reports no detectable issues at all', () => {
    expect(findCourseIssues(COURSE_LIBRARY)).toEqual([]);
  });

  it('has 18 courses with unique ids', () => {
    expect(COURSE_LIBRARY).toHaveLength(18);
    expect(new Set(COURSE_LIBRARY.map((c) => c.id)).size).toBe(18);
  });

  for (const course of COURSE_LIBRARY) {
    describe(course.id, () => {
      it('has 18 holes numbered 1-18', () => {
        expect(course.holes).toHaveLength(18);
        expect(course.holes.map((h) => h.hole).sort((a, b) => a - b)).toEqual(
          Array.from({ length: 18 }, (_, i) => i + 1),
        );
      });

      it('allocates stroke indices as a 1-18 permutation', () => {
        expect(course.holes.map((h) => h.strokeIndex).sort((a, b) => a - b)).toEqual(
          Array.from({ length: 18 }, (_, i) => i + 1),
        );
      });

      it('has a par possible for every hole yardage', () => {
        for (const h of course.holes) {
          expect(parImplausibleForYardage(h.par, h.yards.regular), `hole ${h.hole}`).toBe(false);
        }
      });

      it('has a plausible total par', () => {
        expect(getCoursePar(course)).toBeGreaterThanOrEqual(68);
        expect(getCoursePar(course)).toBeLessThanOrEqual(74);
      });

      it('orders tees longest to shortest on every hole', () => {
        for (const h of course.holes) {
          expect(h.yards.championship).toBeGreaterThanOrEqual(h.yards.regular);
          expect(h.yards.regular).toBeGreaterThanOrEqual(h.yards.forward);
          expect(h.yards.forward).toBeGreaterThan(0);
        }
      });

      it('has WHS-valid ratings and slopes', () => {
        for (const tee of TEES) {
          expect(course.rating[tee]).toBeGreaterThan(55);
          expect(course.rating[tee]).toBeLessThan(85);
          // WHS slope runs 55-155, with 113 as the neutral value.
          expect(course.slope[tee]).toBeGreaterThanOrEqual(55);
          expect(course.slope[tee]).toBeLessThanOrEqual(155);
          expect(getCourseYardage(course, tee)).toBeGreaterThan(3000);
          expect(getCourseYardage(course, tee)).toBeLessThan(8200);
        }
      });

      it('has real coordinates and a plausible altitude', () => {
        expect(Math.abs(course.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(course.lon)).toBeLessThanOrEqual(180);
        expect(course.altitudeFt).toBeGreaterThan(-300);
        expect(course.altitudeFt).toBeLessThan(9000);
      });
    });
  }
});

describe('normalizeCourses', () => {
  it('is idempotent', () => {
    expect(normalizeCourses(COURSE_LIBRARY)).toEqual(COURSE_LIBRARY);
  });

  it('leaves already-valid courses untouched', () => {
    const clean = RAW_COURSE_LIBRARY.filter(
      (c) => findCourseIssues([c]).length === 0,
    );
    expect(clean.length).toBeGreaterThan(0);
    expect(normalizeCourses(clean)).toEqual(clean);
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(RAW_COURSE_LIBRARY);
    normalizeCourses(RAW_COURSE_LIBRARY);
    expect(JSON.stringify(RAW_COURSE_LIBRARY)).toBe(snapshot);
  });
});

describe('parForYardage', () => {
  it('uses standard rating bands', () => {
    expect(parForYardage(120)).toBe(3);
    expect(parForYardage(250)).toBe(3);
    expect(parForYardage(251)).toBe(4);
    expect(parForYardage(470)).toBe(4);
    expect(parForYardage(471)).toBe(5);
    expect(parForYardage(650)).toBe(5);
  });

  it('only suggests - it no longer decides what the library says', () => {
    // The bands would call Oakmont's 8th a par 4 and Winged Foot's 9th a par
    // 5. Both are wrong, and neither is corrected any more.
    const oakmont8 = getCourseById('oakmont')!.holes[7];
    expect(oakmont8.par).toBe(3);
    expect(parForYardage(oakmont8.yards.regular)).not.toBe(3);
  });
});

describe('parImplausibleForYardage', () => {
  it('accepts the extremes real golf actually plays', () => {
    expect(parImplausibleForYardage(3, 289)).toBe(false); // Oakmont's 8th
    expect(parImplausibleForYardage(4, 565)).toBe(false); // Winged Foot's 9th
    expect(parImplausibleForYardage(4, 315)).toBe(false); // Riviera's 10th
    expect(parImplausibleForYardage(3, 106)).toBe(false); // Pebble's 7th
  });

  it('rejects what has to be a transcription error', () => {
    expect(parImplausibleForYardage(5, 136)).toBe(true);
    expect(parImplausibleForYardage(3, 427)).toBe(true);
    expect(parImplausibleForYardage(4, 640)).toBe(true);
    expect(parImplausibleForYardage(6, 500)).toBe(true);
  });

  it('bounds each par without leaving a gap between them', () => {
    expect(PAR_YARDAGE_BOUNDS[3][1]).toBeGreaterThan(PAR_YARDAGE_BOUNDS[4][0]);
    expect(PAR_YARDAGE_BOUNDS[4][1]).toBeGreaterThan(PAR_YARDAGE_BOUNDS[5][0]);
  });
});

describe('lookup helpers', () => {
  it('finds a course by id and returns null for an unknown one', () => {
    expect(getCourseById(COURSE_LIBRARY[0].id)?.id).toBe(COURSE_LIBRARY[0].id);
    expect(getCourseById('not-a-course')).toBeNull();
  });

  it('searches case-insensitively', () => {
    expect(searchCourses('augusta').length).toBeGreaterThan(0);
    expect(searchCourses('AUGUSTA').length).toBe(searchCourses('augusta').length);
  });

  it('returns nothing for a non-matching query', () => {
    expect(searchCourses('zzzzzzzz')).toHaveLength(0);
  });
});
