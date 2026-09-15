/**
 * The golfer's own courses.
 *
 * `customCourses` has been in the schema since the port with nothing reading
 * or writing it, so only the eighteen built-in courses were selectable. These
 * are the functions that were missing.
 *
 * Validation is deliberately run here and not only in the form. A bad slope
 * rating does not just look wrong - it feeds the WHS differential and quietly
 * distorts the golfer's handicap for every round played at that course, so the
 * server is the place that has to refuse it.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { type MutationCtx, mutation, query } from './_generated/server';
import { type CustomCourseInput, validateCustomCourse } from './lib/customCourses';

const TEE_NUMBERS = v.object({
  championship: v.number(),
  regular: v.number(),
  forward: v.number(),
});

const HOLE = v.object({
  hole: v.number(),
  par: v.union(v.literal(3), v.literal(4), v.literal(5)),
  strokeIndex: v.number(),
  yards: TEE_NUMBERS,
});

const COURSE_FIELDS = {
  name: v.string(),
  location: v.string(),
  altitudeFt: v.number(),
  lat: v.optional(v.number()),
  lon: v.optional(v.number()),
  rating: TEE_NUMBERS,
  slope: TEE_NUMBERS,
  holes: v.array(HOLE),
};

/** How many a single golfer may add. High enough never to be reached in play. */
const MAX_COURSES_PER_GOLFER = 50;

async function requireUser(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }
  return userId;
}

/** Rejects the whole course rather than storing a half-valid one. */
function assertValid(course: CustomCourseInput) {
  const problems = validateCustomCourse(course);
  if (problems.length > 0) {
    throw new ConvexError({
      message: problems[0],
      code: 'BAD_REQUEST',
      // The form lists every problem at once; the message above is for
      // callers that only surface one line.
      problems,
    });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query('customCourses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  },
});

export const get = query({
  args: { courseId: v.id('customCourses') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    // Ids arrive from the client, so a valid id is not permission.
    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) return null;

    return course;
  },
});

export const create = mutation({
  args: COURSE_FIELDS,
  handler: async (ctx, args): Promise<Id<'customCourses'>> => {
    const userId = await requireUser(ctx);
    assertValid(args);

    const existing = await ctx.db
      .query('customCourses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    if (existing.length >= MAX_COURSES_PER_GOLFER) {
      throw new ConvexError({
        message: `You can keep ${MAX_COURSES_PER_GOLFER} of your own courses. Delete one to add another.`,
        code: 'BAD_REQUEST',
      });
    }

    const name = args.name.trim();
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({
        message: `You already have a course called ${name}.`,
        code: 'BAD_REQUEST',
      });
    }

    return await ctx.db.insert('customCourses', {
      userId,
      ...args,
      name,
      location: args.location.trim(),
      holes: [...args.holes].sort((a, b) => a.hole - b.hole),
    });
  },
});

export const update = mutation({
  args: { courseId: v.id('customCourses'), ...COURSE_FIELDS },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx);

    const { courseId, ...fields } = args;
    assertValid(fields);

    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) {
      throw new ConvexError({ message: 'Course not found', code: 'NOT_FOUND' });
    }

    await ctx.db.patch(courseId, {
      ...fields,
      name: fields.name.trim(),
      location: fields.location.trim(),
      holes: [...fields.holes].sort((a, b) => a.hole - b.hole),
    });
  },
});

/**
 * Deletes a course the golfer added.
 *
 * Rounds already played there keep their `courseId` and their own copy of the
 * name, rating and slope, so a finished scorecard stays readable and its
 * handicap differential stays correct. Only the caddie's hole-by-hole yardages
 * are lost, which is the right trade: a golfer deleting a course should not
 * silently lose their scoring history at it.
 */
export const remove = mutation({
  args: { courseId: v.id('customCourses') },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course || course.userId !== userId) {
      throw new ConvexError({ message: 'Course not found', code: 'NOT_FOUND' });
    }

    await ctx.db.delete(args.courseId);
  },
});
