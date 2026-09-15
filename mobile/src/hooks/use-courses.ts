/**
 * Every course the golfer can pick, built-in and their own, as one list.
 *
 * The point of doing the merge here is that no screen downstream has to know
 * which kind it is holding. `buildCaddieRecommendation`, the scorecard and the
 * handicap all take a `GolfCourse`; a custom course is converted at this edge
 * and is indistinguishable from there on.
 */
import { useQuery } from 'convex/react';
import { useMemo } from 'react';

import { api } from '@/convex/_generated/api';
import { type GolfCourse, COURSE_LIBRARY, getCourseById } from '@/convex/lib/courses';
import { toGolfCourse } from '@/convex/lib/customCourses';

/** The golfer's own courses, in the shared shape. */
export function useCustomCourses(): GolfCourse[] {
  const rows = useQuery(api.customCourses.list, {});

  return useMemo(() => (rows ?? []).map(toGolfCourse), [rows]);
}

/**
 * The library plus the golfer's own, theirs first.
 *
 * Their own courses lead because a golfer who has added their home course is
 * looking for that one, not for Pebble Beach.
 */
export function useAllCourses(): GolfCourse[] {
  const custom = useCustomCourses();

  return useMemo(() => [...custom, ...COURSE_LIBRARY], [custom]);
}

/**
 * Resolves a course id from either source.
 *
 * Returns `null` both while the golfer's courses are still loading and when
 * the id belongs to a course they have since deleted. The scorecard handles
 * that the same way either way: it keeps its own stored par, rating and slope,
 * so the round stays readable and its handicap differential stays correct -
 * only the hole-by-hole yardages the caddie wants are missing.
 */
export function useCourse(courseId: string | undefined): GolfCourse | null {
  const custom = useCustomCourses();

  return useMemo(() => {
    if (!courseId) return null;
    return custom.find((c) => c.id === courseId) ?? getCourseById(courseId);
  }, [courseId, custom]);
}
