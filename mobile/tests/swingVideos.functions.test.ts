/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../convex/_generated/api';

import { signIn, signInWithProfile, testApp, type TestConvex } from './helpers';

/** A file in storage, standing in for an uploaded clip or an extracted frame. */
async function stored(t: TestConvex, body = 'a clip') {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([body])));
}

/** Everything the storage layer is currently holding. */
async function storedFiles(t: TestConvex) {
  return await t.run(async (ctx) => ctx.db.system.query('_storage').collect());
}

const RECORDING = {
  label: '7-Iron',
  durationSeconds: 4,
  recordedAt: '2026-03-10T09:15:00.000Z',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('generateUploadUrl', () => {
  it('is closed to a caller who is not signed in', async () => {
    const t = testApp();
    await expect(t.mutation(api.swingVideos.generateUploadUrl, {})).rejects.toThrow();
  });

  it('hands a signed-in golfer an upload slot', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);
    await expect(asUser.mutation(api.swingVideos.generateUploadUrl, {})).resolves.toBeTruthy();
  });
});

describe('saveRecording', () => {
  it('stores the recording against the golfer own profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const storageId = await stored(t);

    await asUser.action(api.swingVideos.saveRecording, { ...RECORDING, profileId, storageId });

    const recordings = await asUser.query(api.swingVideos.listRecordings, { profileId });
    expect(recordings).toHaveLength(1);
    expect(recordings[0].label).toBe('7-Iron');
    // The list is what the library screen plays from.
    expect(recordings[0].url).toBeTruthy();
  });

  it('files nothing when the profile is not the caller own', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    const storageId = await stored(t);
    const frameId = await stored(t, 'a frame');

    await expect(
      asBob.action(api.swingVideos.saveRecording, {
        ...RECORDING,
        profileId,
        storageId,
        frameStorageIds: [frameId],
      }),
    ).rejects.toThrow();

    // The gate itself holds: no row reaches the other golfer's library.
    await expect(
      asUser.query(api.swingVideos.listRecordings, { profileId }),
    ).resolves.toEqual([]);
  });

  it('deletes the rejected upload rather than leaving it billable', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.action(api.swingVideos.saveRecording, {
        ...RECORDING,
        profileId,
        storageId: await stored(t),
        frameStorageIds: [await stored(t, 'a frame')],
      }),
    ).rejects.toThrow();

    // The file is already uploaded by the time ownership is checked, so a
    // rejection that keeps it leaves something billable forever and reachable
    // by nothing. `saveRecording` is an action precisely so the cleanup and
    // the failure land in separate transactions - as a mutation, the throw
    // rolled the deletes back and both files survived.
    expect(await storedFiles(t)).toHaveLength(0);
  });

  it('keeps the extracted frames with the recording', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const storageId = await stored(t);
    const frames = [await stored(t, 'f1'), await stored(t, 'f2')];

    await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId,
      frameStorageIds: frames,
    });

    const recordings = await asUser.query(api.swingVideos.listRecordings, { profileId });
    expect(recordings[0].frameStorageIds).toHaveLength(2);
  });
});

describe('listRecordings', () => {
  it('returns nothing for a profile the caller does not own', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(
      asBob.query(api.swingVideos.listRecordings, { profileId }),
    ).resolves.toEqual([]);
  });
});

describe('deleteRecording', () => {
  it('takes the clip and its frames out of storage with the row', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
      frameStorageIds: [await stored(t, 'f1'), await stored(t, 'f2')],
    });

    await asUser.mutation(api.swingVideos.deleteRecording, { videoId });

    await expect(
      asUser.query(api.swingVideos.listRecordings, { profileId }),
    ).resolves.toEqual([]);
    expect(await storedFiles(t)).toHaveLength(0);
  });

  it('survives a frame the storage layer has already lost', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const frameId = await stored(t, 'f1');
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
      frameStorageIds: [frameId],
    });

    // Delete one frame out from under the row before deleting the recording.
    await t.run(async (ctx) => ctx.storage.delete(frameId));

    // One missing frame must not strand the clip or the row.
    await asUser.mutation(api.swingVideos.deleteRecording, { videoId });
    expect(await storedFiles(t)).toHaveLength(0);
  });

  it('refuses to delete a recording belonging to someone else', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(
      asBob.mutation(api.swingVideos.deleteRecording, { videoId }),
    ).rejects.toThrow();

    await expect(
      asUser.query(api.swingVideos.listRecordings, { profileId }),
    ).resolves.toHaveLength(1);
  });
});

describe('updateRecording', () => {
  it('renames the golfer own recording', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    await asUser.mutation(api.swingVideos.updateRecording, { videoId, label: 'Driver' });

    const recordings = await asUser.query(api.swingVideos.listRecordings, { profileId });
    expect(recordings[0].label).toBe('Driver');
  });

  it('leaves the label alone when only notes are sent', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    await asUser.mutation(api.swingVideos.updateRecording, { videoId, notes: 'Coming over it' });

    const recordings = await asUser.query(api.swingVideos.listRecordings, { profileId });
    expect(recordings[0].label).toBe('7-Iron');
    expect(recordings[0].notes).toBe('Coming over it');
  });

  it('refuses to rename a recording belonging to someone else', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(
      asBob.mutation(api.swingVideos.updateRecording, { videoId, label: 'not mine' }),
    ).rejects.toThrow();
  });
});

describe('analyzeSwing', () => {
  it('is closed to a caller who is not signed in', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    await expect(t.action(api.swingVideos.analyzeSwing, { videoId })).rejects.toThrow();
  });

  it('says so plainly when the deployment has no API key', async () => {
    const t = testApp();
    vi.stubEnv('OPENAI_API_KEY', '');
    const { asUser, profileId } = await signInWithProfile(t);
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    // A deployment without a key should not leave the golfer watching a
    // spinner; the action refuses up front.
    await expect(asUser.action(api.swingVideos.analyzeSwing, { videoId })).rejects.toThrow();
  });

  it('refuses to analyse a recording belonging to someone else', async () => {
    const t = testApp();
    // With a key present, so the refusal is the ownership check rather than
    // the deployment being unconfigured.
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');

    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const videoId = await asUser.action(api.swingVideos.saveRecording, {
      ...RECORDING,
      profileId,
      storageId: await stored(t),
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.action(api.swingVideos.analyzeSwing, { videoId })).rejects.toThrow();

    // And it must refuse before it starts: a pending badge on a recording the
    // caller cannot see is a leak of its own.
    const recordings = await asUser.query(api.swingVideos.listRecordings, { profileId });
    expect(recordings[0].aiAnalysisStatus).toBeUndefined();
  });
});
