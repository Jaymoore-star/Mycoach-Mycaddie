/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';

import { localDate, signIn, signInWithProfile, testApp } from './helpers';

/**
 * These functions carry the port's worst security bug: the version this was
 * taken from checked only that *a* user was signed in for several of them, and
 * `getClubAverages` checked nothing at all, so a guessed profile id exposed
 * another golfer's whole range history. Every ownership case below is there to
 * keep that fixed.
 */

async function sessionWithShots() {
  const t = testApp();
  const { asUser, profileId } = await signInWithProfile(t);

  const sessionId = await asUser.mutation(api.launchMonitor.createSession, {
    profileId,
    date: localDate(),
    label: 'Iron work',
    club: '7-Iron',
  });

  for (const carry of [150, 160, 155]) {
    await asUser.mutation(api.launchMonitor.addShot, {
      sessionId,
      club: '7-Iron',
      carryYards: carry,
      ballSpeedMph: 118,
      smashFactor: 1.44,
    });
  }

  return { t, asUser, profileId, sessionId };
}

describe('createSession', () => {
  it('starts with no shots', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const sessionId = await asUser.mutation(api.launchMonitor.createSession, {
      profileId,
      date: localDate(),
    });

    const session = await asUser.query(api.launchMonitor.getSession, { sessionId });
    expect(session?.shotCount).toBe(0);
  });

  it("refuses to file a session against someone else's profile", async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.launchMonitor.createSession, { profileId, date: localDate() }),
    ).rejects.toThrow();
  });
});

describe('addShot', () => {
  it('recomputes the session averages on every shot', async () => {
    const { asUser, sessionId } = await sessionWithShots();

    const session = await asUser.query(api.launchMonitor.getSession, { sessionId });
    expect(session?.shotCount).toBe(3);
    expect(session?.avgCarryYards).toBe(155);
    expect(session?.avgSmashFactor).toBe(1.4);
  });

  it('files the shot against the session owner, not the caller', async () => {
    const { asUser, sessionId, profileId } = await sessionWithShots();

    // profileId comes from the session rather than the client, so a shot can
    // never be filed against someone else's profile.
    const shots = await asUser.query(api.launchMonitor.getShots, { sessionId });
    expect(shots).toHaveLength(3);
    for (const shot of shots) expect(shot.profileId).toBe(profileId);
  });

  it("refuses to add a shot to another golfer's session", async () => {
    const { t, sessionId } = await sessionWithShots();
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.launchMonitor.addShot, { sessionId, club: 'Driver', carryYards: 300 }),
    ).rejects.toThrow();
  });

  it('leaves a metric out of the average when it was never measured', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const sessionId = await asUser.mutation(api.launchMonitor.createSession, {
      profileId,
      date: localDate(),
    });

    // A blank field is "not measured", not zero - averaging it as zero would
    // halve the golfer's carry numbers.
    await asUser.mutation(api.launchMonitor.addShot, {
      sessionId,
      club: '7-Iron',
      carryYards: 150,
    });
    await asUser.mutation(api.launchMonitor.addShot, { sessionId, club: '7-Iron' });

    const session = await asUser.query(api.launchMonitor.getSession, { sessionId });
    expect(session?.avgCarryYards).toBe(150);
    expect(session?.avgSpinRpm).toBeUndefined();
  });
});

describe('deleteShot', () => {
  it('recomputes the averages after a shot is removed', async () => {
    const { asUser, sessionId } = await sessionWithShots();

    const shots = await asUser.query(api.launchMonitor.getShots, { sessionId });
    const topped = shots.find((s) => s.carryYards === 160)!;
    await asUser.mutation(api.launchMonitor.deleteShot, { shotId: topped._id });

    const session = await asUser.query(api.launchMonitor.getSession, { sessionId });
    expect(session?.shotCount).toBe(2);
    expect(session?.avgCarryYards).toBe(152.5);
  });

  it("refuses to delete another golfer's shot", async () => {
    const { t, asUser, sessionId } = await sessionWithShots();
    const shots = await asUser.query(api.launchMonitor.getShots, { sessionId });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.launchMonitor.deleteShot, { shotId: shots[0]._id }),
    ).rejects.toThrow();
  });
});

describe('deleteSession', () => {
  it('takes the session shots with it', async () => {
    const { t, asUser, sessionId, profileId } = await sessionWithShots();

    await asUser.mutation(api.launchMonitor.deleteSession, { sessionId });

    const sessions = await asUser.query(api.launchMonitor.listSessions, { profileId });
    expect(sessions).toEqual([]);
    // Orphaned shots would keep skewing the bag long after the session is gone.
    const orphans = await t.run(async (ctx) => ctx.db.query('launchShots').collect());
    expect(orphans).toEqual([]);
  });

  it("refuses to delete another golfer's session", async () => {
    const { t, sessionId } = await sessionWithShots();
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.launchMonitor.deleteSession, { sessionId }),
    ).rejects.toThrow();
  });
});

describe('reading someone else data', () => {
  it('getClubAverages returns nothing for a profile the caller does not own', async () => {
    const { t, profileId } = await sessionWithShots();
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    // This one checked nothing at all before the port.
    await expect(
      asBob.query(api.launchMonitor.getClubAverages, { profileId }),
    ).resolves.toEqual([]);
  });

  it('getSession, getShots and listSessions are all closed too', async () => {
    const { t, sessionId, profileId } = await sessionWithShots();
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(asBob.query(api.launchMonitor.getSession, { sessionId })).resolves.toBeNull();
    await expect(asBob.query(api.launchMonitor.getShots, { sessionId })).resolves.toEqual([]);
    await expect(asBob.query(api.launchMonitor.listSessions, { profileId })).resolves.toEqual(
      [],
    );
  });

  it('gives a signed-out caller nothing', async () => {
    const { t, sessionId, profileId } = await sessionWithShots();

    await expect(t.query(api.launchMonitor.getClubAverages, { profileId })).resolves.toEqual([]);
    await expect(t.query(api.launchMonitor.getSession, { sessionId })).resolves.toBeNull();
  });
});

describe('getClubAverages', () => {
  it('averages each club separately', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const sessionId = await asUser.mutation(api.launchMonitor.createSession, {
      profileId,
      date: localDate(),
    });

    await asUser.mutation(api.launchMonitor.addShot, {
      sessionId,
      club: 'Driver',
      carryYards: 260,
    });
    await asUser.mutation(api.launchMonitor.addShot, {
      sessionId,
      club: 'Driver',
      carryYards: 270,
    });
    await asUser.mutation(api.launchMonitor.addShot, {
      sessionId,
      club: '7-Iron',
      carryYards: 150,
    });

    const averages = await asUser.query(api.launchMonitor.getClubAverages, { profileId });
    const driver = averages.find((a) => a.club === 'Driver');
    const iron = averages.find((a) => a.club === '7-Iron');

    expect(driver?.avgCarry).toBe(265);
    expect(driver?.shotCount).toBe(2);
    expect(iron?.avgCarry).toBe(150);
  });
});
