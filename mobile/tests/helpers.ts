/**
 * Harness for the Convex function tests.
 *
 * `convex-test` runs the real function code against an in-memory database, so
 * these cover what the pure-logic tests cannot: the ownership checks, the
 * server-side gates, and the shape of what actually reaches the tables.
 *
 * Auth is the part worth explaining. `getAuthUserId` reads the identity's
 * `subject` and splits it on `|` - the left half is the user id, the right the
 * session. So signing a test in is a matter of handing `withIdentity` a
 * subject in that shape; there is no need to run the real sign-in flow.
 */
import { convexTest } from 'convex-test';

import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import schema from '../convex/schema';

/**
 * Every module under `convex/`, for `convex-test` to resolve function
 * references against. Vite's `import.meta.glob` is lazy, so a module is only
 * evaluated when a test actually calls into it.
 */
export const modules = import.meta.glob('../convex/**/*.ts');

export function testApp() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof testApp>;

/** A signed-in user, as the app would have after a real sign-in. */
export async function signIn(t: TestConvex, email = 'golfer@example.com') {
  const userId = await t.run(async (ctx) => ctx.db.insert('users', { email }));
  // The session half is never read by anything under test; it only has to be
  // present so the split produces the user id on the left.
  return { userId, asUser: t.withIdentity({ subject: `${userId}|session` }) };
}

/** A signed-in user who already finished onboarding. */
export async function signInWithProfile(
  t: TestConvex,
  options: {
    email?: string;
    displayName?: string;
    skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'scratch' | 'tour_pro';
    coachId?: 'que' | 'mason' | 'sam' | 'dom';
  } = {},
) {
  const { userId, asUser } = await signIn(t, options.email);

  const profileId = await asUser.mutation(api.profiles.createProfile, {
    displayName: options.displayName ?? 'Alex',
    skillLevel: options.skillLevel ?? 'intermediate',
    ...(options.coachId ? { coachId: options.coachId } : {}),
  });

  return { userId, asUser, profileId };
}

/** Today in the golfer's own timezone, the format every dated mutation wants. */
export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Marks today's session complete, the gate `advanceProgramDay` enforces. */
export async function completeToday(
  t: TestConvex,
  profileId: Id<'golferProfiles'>,
  day: number,
  date: string,
) {
  await t.run(async (ctx) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error('No such profile');

    await ctx.db.insert('trainingSessions', {
      userId: profile.userId,
      profileId,
      date,
      day,
      phase: profile.currentPhase,
      tasksCompleted: [],
      tasksTotal: 3,
      sessionComplete: true,
      sessionType: 'practice',
    });
  });
}
