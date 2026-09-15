import { describe, expect, it } from 'vitest';

import { getCoursePar, getCourseYardage } from '../convex/lib/courses';
import {
  CUSTOM_COURSE_PREFIX,
  HOLE_COUNT,
  type CustomCourseInput,
  blankCourse,
  coursePar,
  customCourseId,
  customCourseRowId,
  isCustomCourseId,
  toGolfCourse,
  validateCustomCourse,
} from '../convex/lib/customCourses';

function valid(): CustomCourseInput {
  return { ...blankCourse(), name: 'Royal County Down', location: 'Newcastle' };
}

describe('blankCourse', () => {
  it('starts on a complete, valid par-72 card', () => {
    const course = valid();

    // Eighteen blanks would mean typing seventy-two numbers before the form
    // would even save.
    expect(course.holes).toHaveLength(HOLE_COUNT);
    expect(coursePar(course.holes)).toBe(72);
    expect(validateCustomCourse(course)).toEqual([]);
  });

  it('allocates every stroke index exactly once', () => {
    const indices = blankCourse()
      .holes.map((h) => h.strokeIndex)
      .sort((a, b) => a - b);

    expect(indices).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('gives every hole yardages that shorten toward the forward tees', () => {
    for (const hole of blankCourse().holes) {
      expect(hole.yards.championship).toBeGreaterThan(hole.yards.regular);
      expect(hole.yards.regular).toBeGreaterThan(hole.yards.forward);
    }
  });
});

describe('validateCustomCourse', () => {
  it('wants a name and a location', () => {
    expect(validateCustomCourse({ ...valid(), name: '  ' })).toContain(
      'Give the course a name.',
    );
    expect(validateCustomCourse({ ...valid(), location: '' })).toContain(
      'Add where the course is.',
    );
  });

  it('refuses a rating or slope outside what the WHS allows', () => {
    // These feed the handicap differential, so a typo bends every round
    // played at this course.
    const badRating = valid();
    badRating.rating.regular = 7;
    expect(validateCustomCourse(badRating).join(' ')).toMatch(/course rating/i);

    const badSlope = valid();
    badSlope.slope.regular = 400;
    expect(validateCustomCourse(badSlope).join(' ')).toMatch(/slope/i);
  });

  it('insists on all eighteen holes', () => {
    const short = { ...valid(), holes: blankCourse().holes.slice(0, 9) };

    expect(validateCustomCourse(short).join(' ')).toMatch(/needs all 18 holes/);
  });

  it('stops after the hole count so it does not pile on', () => {
    const short = { ...valid(), holes: [] };

    // One clear instruction beats eighteen follow-on complaints.
    expect(validateCustomCourse(short)).toHaveLength(1);
  });

  it('catches a duplicated stroke index', () => {
    const course = valid();
    course.holes[1].strokeIndex = course.holes[0].strokeIndex;

    // Two holes would give a shot and one never would.
    expect(validateCustomCourse(course)).toContain('Stroke indexes must be 1 to 18, once each.');
  });

  it('catches a duplicated or missing hole number', () => {
    const course = valid();
    course.holes[5].hole = 4;

    expect(validateCustomCourse(course)).toContain('Holes must be numbered 1 to 18, once each.');
  });

  it('catches a yardage that is not a real golf hole', () => {
    const course = valid();
    course.holes[0].yards.regular = 12;

    expect(validateCustomCourse(course).join(' ')).toMatch(/Hole 1 regular yardage/);
  });

  it('catches tees entered back to front', () => {
    const course = valid();
    course.holes[2].yards.forward = 600;
    course.holes[2].yards.championship = 150;

    // The commonest data-entry mistake, and it inverts every caddie yardage.
    expect(validateCustomCourse(course)).toContain(
      'Hole 3: forward tees cannot play longer than championship.',
    );
  });

  it('reports every problem at once rather than the first', () => {
    const course = valid();
    course.name = '';
    course.location = '';
    course.holes[0].yards.regular = 5;

    expect(validateCustomCourse(course).length).toBeGreaterThanOrEqual(3);
  });

  it('accepts an altitude in the range a course can actually sit at', () => {
    expect(validateCustomCourse({ ...valid(), altitudeFt: 5280 })).toEqual([]);
    expect(validateCustomCourse({ ...valid(), altitudeFt: 40000 }).join(' ')).toMatch(
      /Altitude/,
    );
  });
});

describe('custom course ids', () => {
  it('round-trips a row id through the prefix', () => {
    const id = customCourseId('abc123');

    expect(id.startsWith(CUSTOM_COURSE_PREFIX)).toBe(true);
    expect(isCustomCourseId(id)).toBe(true);
    expect(customCourseRowId(id)).toBe('abc123');
  });

  it('does not mistake a library course for a custom one', () => {
    // Both live in one namespace on `roundScores.courseId`.
    expect(isCustomCourseId('pebble-beach')).toBe(false);
    expect(customCourseRowId('pebble-beach')).toBeNull();
    expect(isCustomCourseId(undefined)).toBe(false);
  });
});

describe('toGolfCourse', () => {
  const stored = {
    _id: 'row1',
    name: 'Royal County Down',
    location: 'Newcastle',
    altitudeFt: 30,
    rating: { championship: 74.2, regular: 72.1, forward: 69.8 },
    slope: { championship: 142, regular: 133, forward: 124 },
    holes: blankCourse().holes,
  };

  it('produces a course the rest of the app cannot tell apart', () => {
    const course = toGolfCourse(stored);

    // Everything downstream takes a GolfCourse; a second shape would mean a
    // branch in the caddie, the scorecard and the handicap.
    expect(course.id).toBe(customCourseId('row1'));
    expect(getCoursePar(course)).toBe(72);
    expect(getCourseYardage(course, 'regular')).toBeGreaterThan(5000);
    expect(course.holes).toHaveLength(18);
  });

  it('gives every hole a neutral green rather than an invented break', () => {
    const course = toGolfCourse(stored);

    // A confident misread on every putt is worse than no read at all.
    for (const hole of course.holes) {
      expect(hole.green.breakSeverityInches).toBe(0);
      expect(hole.green.dangerZone).toBe('none');
    }
  });

  it('sorts the holes into playing order', () => {
    const shuffled = { ...stored, holes: [...stored.holes].reverse() };

    expect(toGolfCourse(shuffled).holes.map((h) => h.hole)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it('defaults the coordinates it has no use for yet', () => {
    const course = toGolfCourse(stored);

    expect(course.lat).toBe(0);
    expect(course.lon).toBe(0);
  });
});
