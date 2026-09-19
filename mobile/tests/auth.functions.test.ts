/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';

import { testApp, useAuthSigningKey } from './helpers';

/**
 * One account per email address.
 *
 * These drive the real `auth:signIn` action rather than calling the callback
 * directly, because the thing worth protecting is what happens when somebody
 * signs up twice - not whether a function returns the id you passed it.
 *
 * Every other function test signs in with `t.withIdentity`, which fabricates
 * an identity and never touches the auth implementation. These cannot: a real
 * sign-in mints a session token, so the deployment needs a signing key. One
 * throwaway RS256 key is generated per run - `importPKCS8` rejects anything
 * that is not a genuine PKCS#8 PEM, so a placeholder string will not do.
 */

const EMAIL = 'golfer@example.com';
const PASSWORD = 'a-long-enough-password';

useAuthSigningKey();

async function signUp(t: ReturnType<typeof testApp>, email: string, password = PASSWORD) {
  return await t.action(api.auth.signIn, {
    provider: 'password',
    params: { email, password, flow: 'signUp' },
  });
}

async function signInWithPassword(
  t: ReturnType<typeof testApp>,
  email: string,
  password = PASSWORD,
) {
  return await t.action(api.auth.signIn, {
    provider: 'password',
    params: { email, password, flow: 'signIn' },
  });
}

/** A user as Google's callback would have left it: email already verified. */
async function existingGoogleUser(t: ReturnType<typeof testApp>, email: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      email,
      name: 'Existing Golfer',
      emailVerificationTime: Date.now(),
    });
    await ctx.db.insert('authAccounts', {
      userId,
      provider: 'google',
      providerAccountId: email,
    });
    return userId;
  });
}

describe('one account per email', () => {
  it('creates an account on first sign-up', async () => {
    const t = testApp();
    await expect(signUp(t, EMAIL)).resolves.toBeTruthy();

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(EMAIL);
  });

  it('lets the same golfer sign back in without making a second user', async () => {
    const t = testApp();
    await signUp(t, EMAIL);
    await signInWithPassword(t, EMAIL);

    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toHaveLength(1);
  });

  it('refuses a password sign-up for an address already used with Google', async () => {
    const t = testApp();
    await existingGoogleUser(t, EMAIL);

    await expect(signUp(t, EMAIL)).rejects.toThrow(/already has an account created with Google/i);

    // The point of the whole exercise: no second golfer.
    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toHaveLength(1);
  });

  it('names the method the golfer actually used, so the message is actionable', async () => {
    const t = testApp();
    await existingGoogleUser(t, EMAIL);
    await expect(signUp(t, EMAIL)).rejects.toThrow(/Sign in that way instead/i);
  });

  it('is not fooled by different capitalisation', async () => {
    const t = testApp();
    await signUp(t, 'Demo@Example.com');

    // Same inbox, so it must be the same account - and the second attempt is
    // refused rather than quietly creating a near-duplicate.
    await expect(signUp(t, 'demo@example.com')).rejects.toThrow(/already has an account/i);
    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toHaveLength(1);
  });

  it('stores the address lower-cased, so the uniqueness check holds', async () => {
    const t = testApp();
    await signUp(t, 'Mixed@Example.com');

    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users[0].email).toBe('mixed@example.com');
  });

  it('does not mark a password signup as a verified email', async () => {
    const t = testApp();
    await signUp(t, EMAIL);

    // Nothing has proved the golfer owns this address - no mail was ever sent.
    // If this became truthy, the library would start auto-linking onto it.
    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users[0].emailVerificationTime).toBeUndefined();
  });

  it('keeps separate addresses separate', async () => {
    const t = testApp();
    await signUp(t, 'one@example.com');
    await signUp(t, 'two@example.com');

    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toHaveLength(2);
  });

  it('still rejects a wrong password rather than making a new account', async () => {
    const t = testApp();
    await signUp(t, EMAIL);

    await expect(signInWithPassword(t, EMAIL, 'not-the-right-password')).rejects.toThrow();
    expect(await t.run(async (ctx) => ctx.db.query('users').collect())).toHaveLength(1);
  });
});
