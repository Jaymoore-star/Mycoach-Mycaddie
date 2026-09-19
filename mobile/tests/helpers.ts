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
import { register as registerAgent } from '@convex-dev/agent/test';
import { afterAll, beforeAll, vi } from 'vitest';
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
  const t = convexTest(schema, modules);

  // The coach chat keeps its messages in the `@convex-dev/agent` component,
  // mounted in `convex.config.ts`. A component is a separate deployment as far
  // as the test runtime is concerned, so it has to be registered by hand or any
  // call into it fails with "Component \"agent\" is not registered". The
  // package ships the helper for exactly this.
  registerAgent(t);

  return t;
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

/**
 * Makes a real `auth:signIn` possible in a test.
 *
 * Most function tests sign in with `withIdentity`, which fabricates an identity
 * and never runs the auth implementation. A test that drives the real sign-in
 * needs a deployment that can mint a session token, which means an actual
 * RS256 key - `importPKCS8` rejects anything that is not a genuine PKCS#8 PEM,
 * so a placeholder string will not do. One throwaway key per file.
 *
 * Call at the top of a `describe`, or at file scope.
 */
export function useAuthSigningKey() {
  beforeAll(async () => {
    const { privateKey } = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );

    const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
    let binary = '';
    for (const byte of der) binary += String.fromCharCode(byte);
    const body = (btoa(binary).match(/.{1,64}/g) ?? []).join('\n');

    vi.stubEnv('JWT_PRIVATE_KEY', `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`);
    vi.stubEnv('CONVEX_SITE_URL', 'https://test.convex.site');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });
}
