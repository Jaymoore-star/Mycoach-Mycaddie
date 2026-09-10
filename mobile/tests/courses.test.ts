import { describe, expect, it } from 'vitest';

import {
  findCourseIssues,
  normalizeCourses,
  parForYardage,
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

describe('the raw library has the errors we know about', () => {
  it('still carries duplicate stroke indices and par mismatches', () => {
    // Guards the repair: if the underlying data is ever corrected upstream,
    // this fails and tells us normalizeCourses has nothing left to do.
    const issues = findCourseIssues(RAW_COURSE_LIBRARY);
    expect(issues.filter((i) => i.kind === 'duplicate-stroke-index').length).toBeGreaterThan(0);
    expect(issues.filter((i) => i.kind === 'par-yardage-mismatch').length).toBeGreaterThan(0);
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

      it('has a par consistent with every hole yardage', () => {
        for (const h of course.holes) {
          expect(h.par, `hole ${h.hole}`).toBe(parForYardage(h.yards.regular));
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
