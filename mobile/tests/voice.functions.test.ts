/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { afterEach, describe, expect, it } from 'vitest';

import { api, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

import { localDate, signIn, signInWithProfile, testApp, type TestConvex } from './helpers';

/**
 * The voice actions all reach OpenAI, so what is testable here is everything
 * that happens before they do: who is allowed to call them, whose data they
 * resolve, and the clip cache that decides whether a request is made at all.
 *
 * No test in this file ever gets as far as a network call. The ownership cases
 * use a dummy key so they fail at the ownership check rather than at the
 * missing-key check, which is the failure actually under test.
 */

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
});

/** A stored blob standing in for synthesised speech. */
async function storeClip(t: TestConvex): Promise<Id<'_storage'>> {
  return await t.run(async (ctx) =>
    ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })),
  );
}

describe('who may use voice at all', () => {
  it('turns a signed-out caller away from every action', async () => {
    const t = testApp();

    await expect(t.action(api.voice.speak, { text: 'Hello' })).rejects.toThrow();
    await expect(t.action(api.voice.parseShot, { transcript: 'seven iron' })).rejects.toThrow();
    await expect(t.mutation(api.voice.generateUploadUrl, {})).rejects.toThrow();
  });

  it('says plainly when the deployment has no key, rather than failing obscurely', async () => {
    delete process.env.OPENAI_API_KEY;

    const t = testApp();
    const { asUser } = await signIn(t);

    // The screen shows this message, so it has to read like an explanation.
    await expect(asUser.action(api.voice.speak, { text: 'Hello' })).rejects.toThrow(
      /not configured/i,
    );
  });

  it('hands a signed-in golfer an upload slot', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    const url = await asUser.mutation(api.voice.generateUploadUrl, {});
    expect(typeof url).toBe('string');
  });
});

describe('the clip cache', () => {
  it('misses on a key it has never seen', async () => {
    const t = testApp();

    await expect(t.query(internal.voice.findClip, { key: 'onyx:nothing' })).resolves.toBeNull();
  });

  it('hits on a key it has stored, and hands back a playable URL', async () => {
    const t = testApp();
    const { userId: ownerId } = await signIn(t);
    const storageId = await storeClip(t);

    await t.mutation(internal.voice.saveClip, { key: 'onyx:abc', voice: 'onyx', storageId, ownerId });

    const hit = await t.query(internal.voice.findClip, { key: 'onyx:abc' });
    expect(hit?.url).toBeTruthy();
  });

  it('treats a clip whose audio is gone as a miss, not a broken URL', async () => {
    const t = testApp();
    const { userId: ownerId } = await signIn(t);
    const storageId = await storeClip(t);
    await t.mutation(internal.voice.saveClip, { key: 'onyx:abc', voice: 'onyx', storageId, ownerId });

    await t.run(async (ctx) => ctx.storage.delete(storageId));

    await expect(t.query(internal.voice.findClip, { key: 'onyx:abc' })).resolves.toBeNull();
  });

  it('keeps the first writer and tells the second to drop its copy', async () => {
    const t = testApp();
    const { userId: ownerId } = await signIn(t);
    const first = await storeClip(t);
    const second = await storeClip(t);

    const a = await t.mutation(internal.voice.saveClip, {
      key: 'onyx:same',
      voice: 'onyx',
      storageId: first,
      ownerId,
    });
    const b = await t.mutation(internal.voice.saveClip, {
      key: 'onyx:same',
      voice: 'onyx',
      storageId: second,
      ownerId,
    });

    // Two golfers on the same hole can ask for the same sentence at once. The
    // loser has to know to delete its blob, or storage fills with orphans.
    expect(a.kept).toBe(true);
    expect(b.kept).toBe(false);
    expect(b.storageId).toBe(first);

    const clips = await t.run(async (ctx) => ctx.db.query('voiceClips').collect());
    expect(clips).toHaveLength(1);
  });

  it('keys a different voice as a different clip', async () => {
    const t = testApp();
    const { userId: ownerId } = await signIn(t);
    const onyx = await storeClip(t);
    const echo = await storeClip(t);

    await t.mutation(internal.voice.saveClip, { key: 'onyx:x', voice: 'onyx', storageId: onyx, ownerId });
    await t.mutation(internal.voice.saveClip, { key: 'echo:x', voice: 'echo', storageId: echo, ownerId });

    // The same words in two coaches' voices are two recordings.
    const clips = await t.run(async (ctx) => ctx.db.query('voiceClips').collect());
    expect(clips).toHaveLength(2);
  });
});

describe('getSpeaker', () => {
  it('resolves the golfer name, level and coach', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, {
      displayName: 'Alex',
      skillLevel: 'advanced',
      coachId: 'sam',
    });

    const speaker = await asUser.query(internal.voice.getSpeaker, { profileId });

    expect(speaker?.displayName).toBe('Alex');
    expect(speaker?.coachId).toBe('sam');
    expect(speaker?.skillLabel).toBeTruthy();
  });

  it('falls back to the level 1 coach when none is set', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const speaker = await asUser.query(internal.voice.getSpeaker, { profileId });
    expect(speaker?.coachId).toBe('que');
  });

  it('gives nothing for a profile the caller does not own', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(asBob.query(internal.voice.getSpeaker, { profileId })).resolves.toBeNull();
  });
});

describe('askCaddie', () => {
  it("will not answer against another golfer's profile", async () => {
    // A dummy key so the call fails at the ownership check, which is the part
    // under test, rather than at the missing-key check before it.
    process.env.OPENAI_API_KEY = 'test-key-not-used';

    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.action(api.voice.askCaddie, { profileId, transcript: 'what club?' }),
    ).rejects.toThrow(/not found/i);
  });

  it('refuses an empty question before spending anything on it', async () => {
    process.env.OPENAI_API_KEY = 'test-key-not-used';

    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.action(api.voice.askCaddie, { profileId, transcript: '   ' }),
    ).rejects.toThrow();
  });
});

describe('readAloudSession', () => {
  it("will not read out another golfer's range session", async () => {
    process.env.OPENAI_API_KEY = 'test-key-not-used';

    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const sessionId = await asUser.mutation(api.launchMonitor.createSession, {
      profileId,
      date: localDate(),
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.action(api.voice.readAloudSession, { sessionId }),
    ).rejects.toThrow(/not found/i);
  });

  it('resolves the session, its shots and the coach who should read them', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { coachId: 'dom' });
    const sessionId = await asUser.mutation(api.launchMonitor.createSession, {
      profileId,
      date: localDate(),
      label: 'Driver work',
      club: 'Driver',
    });
    await asUser.mutation(api.launchMonitor.addShot, {
      sessionId,
      club: 'Driver',
      carryYards: 265,
    });

    const found = await asUser.query(internal.voice.getSessionForReadAloud, { sessionId });

    expect(found?.session.label).toBe('Driver work');
    expect(found?.shots).toHaveLength(1);
    expect(found?.coachId).toBe('dom');
  });
});

describe('realtimeToken', () => {
  it('turns a signed-out caller away', async () => {
    const t = testApp();

    // The token is a live microphone session billed to the account; it is not
    // handed to anyone who simply knows the URL.
    await expect(t.action(api.voice.realtimeToken, {})).rejects.toThrow();
  });

  it('says plainly when the deployment has no key', async () => {
    delete process.env.OPENAI_API_KEY;

    const t = testApp();
    const { asUser } = await signIn(t);

    await expect(asUser.action(api.voice.realtimeToken, {})).rejects.toThrow(/not configured/i);
  });
});

describe('transcribe', () => {
  it('turns a signed-out caller away', async () => {
    const t = testApp();
    const storageId = await storeClip(t);

    await expect(t.action(api.voice.transcribe, { storageId })).rejects.toThrow();
  });

  it('deletes the recording even when transcription cannot run at all', async () => {
    delete process.env.OPENAI_API_KEY;

    const t = testApp();
    const { asUser } = await signIn(t);
    const storageId = await storeClip(t);

    // The recording is already uploaded by the time the key is checked, so a
    // deployment with no key must still clean it up. A golfer's voice sitting
    // in storage is a liability with no feature behind it.
    await expect(asUser.action(api.voice.transcribe, { storageId })).rejects.toThrow(
      /not configured/i,
    );

    const blob = await t.run(async (ctx) => ctx.storage.get(storageId));
    expect(blob).toBeNull();
  });
});
