/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';

import { localDate, signIn, signInWithProfile, testApp } from './helpers';

const TODAY = localDate();

describe('startSession', () => {
  it('returns the existing session rather than starting a second one', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const first = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
    });
    const second = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
    });

    // Tapping start twice is an ordinary thing to do - a second row would
    // split the day's drills across two sessions and double the rep count.
    expect(second).toBe(first);
    await expect(
      asUser.query(api.sessions.getSessionHistory, { profileId }),
    ).resolves.toHaveLength(1);
  });

  it('moves the profile to the phase the session was started in', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'driver',
      date: TODAY,
    });

    const profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.currentPhase).toBe('driver');
  });

  it('keeps a different phase on the same day as its own session', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const putting = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
    });
    const driver = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'driver',
      date: TODAY,
    });

    expect(driver).not.toBe(putting);
  });

  it('rejects a UTC timestamp where a local date belongs', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await expect(
      asUser.mutation(api.sessions.startSession, {
        profileId,
        phase: 'putting',
        date: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });

  it('refuses to start a session on a profile the caller does not own', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.sessions.startSession, { profileId, phase: 'putting', date: TODAY }),
    ).rejects.toThrow();
  });
});

describe('completeDrill', () => {
  async function started(tasksTotal = 2) {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
      tasksTotal,
    });
    return { t, asUser, profileId, sessionId };
  }

  it('closes the session only once every drill is done', async () => {
    const { asUser, profileId, sessionId } = await started();

    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });
    let session = await asUser.query(api.sessions.getTodaysSession, { profileId, date: TODAY });
    expect(session?.sessionComplete).toBe(false);

    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'two' });
    session = await asUser.query(api.sessions.getTodaysSession, { profileId, date: TODAY });
    expect(session?.sessionComplete).toBe(true);
  });

  it('counts the same drill once however often it is tapped', async () => {
    const { asUser, profileId, sessionId } = await started();

    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });
    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });

    const session = await asUser.query(api.sessions.getTodaysSession, { profileId, date: TODAY });
    expect(session?.tasksCompleted).toEqual(['one']);
    // Two taps on one drill must not finish a two-drill session.
    expect(session?.sessionComplete).toBe(false);
  });

  it('refuses to complete a drill in a session belonging to someone else', async () => {
    const { t, sessionId } = await started();
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' }),
    ).rejects.toThrow();
  });

  it('is closed to a caller who is not signed in at all', async () => {
    const { t, sessionId } = await started();

    await expect(
      t.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' }),
    ).rejects.toThrow();
  });
});

describe('uncompleteDrill', () => {
  it('reopens a session that had been finished', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
      tasksTotal: 1,
    });

    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });
    await asUser.mutation(api.sessions.uncompleteDrill, { sessionId, drillId: 'one' });

    const session = await asUser.query(api.sessions.getTodaysSession, { profileId, date: TODAY });
    expect(session?.tasksCompleted).toEqual([]);
    expect(session?.sessionComplete).toBe(false);
  });

  it('leaves a session belonging to someone else alone', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
      tasksTotal: 1,
    });
    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await asBob.mutation(api.sessions.uncompleteDrill, { sessionId, drillId: 'one' });

    const session = await asUser.query(api.sessions.getTodaysSession, { profileId, date: TODAY });
    expect(session?.tasksCompleted).toEqual(['one']);
  });
});

describe('saveCoachNotes', () => {
  it('does not write notes into a session belonging to someone else', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await asBob.mutation(api.sessions.saveCoachNotes, { sessionId, notes: 'not mine to write' });

    const session = await asUser.query(api.sessions.getTodaysSession, { profileId, date: TODAY });
    expect(session?.coachNotes).toBeUndefined();
  });

  it('keeps the notes the golfer wrote', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
    });

    await asUser.mutation(api.sessions.saveCoachNotes, {
      sessionId,
      notes: 'Left it short all day',
    });

    const session = await asUser.query(api.sessions.getTodaysSession, { profileId, date: TODAY });
    expect(session?.coachNotes).toBe('Left it short all day');
  });
});

describe('getTodaysSession', () => {
  it('returns nothing for a profile the caller does not own', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
    });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(
      asBob.query(api.sessions.getTodaysSession, { profileId, date: TODAY }),
    ).resolves.toBeNull();
  });

  it('does not hand back yesterday session as today', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: '2026-01-01',
    });

    await expect(
      asUser.query(api.sessions.getTodaysSession, { profileId, date: '2026-01-02' }),
    ).resolves.toBeNull();
  });
});

describe('get30DaySnapshot', () => {
  it('counts only the drills actually completed', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
      tasksTotal: 3,
    });
    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });
    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'two' });

    const snapshot = await asUser.query(api.sessions.get30DaySnapshot, { profileId, date: TODAY });
    expect(snapshot?.totalReps).toBe(2);
    // Putting drills are putts, not swings.
    expect(snapshot?.puttReps).toBe(2);
    expect(snapshot?.swingReps).toBe(0);
  });

  it('files a non-putting phase under swings', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'driver',
      date: TODAY,
      tasksTotal: 3,
    });
    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });

    const snapshot = await asUser.query(api.sessions.get30DaySnapshot, { profileId, date: TODAY });
    expect(snapshot?.swingReps).toBe(1);
    expect(snapshot?.puttReps).toBe(0);
  });

  it('leaves a session older than the window out of the count', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: '2026-01-01',
      tasksTotal: 1,
    });
    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });

    // Well over 30 days after the session.
    const snapshot = await asUser.query(api.sessions.get30DaySnapshot, {
      profileId,
      date: '2026-06-01',
    });
    expect(snapshot?.totalReps).toBe(0);
    expect(snapshot?.completedDays).toBe(0);
  });

  it('is closed to a caller who does not own the profile', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.query(api.sessions.get30DaySnapshot, { profileId, date: TODAY }),
    ).resolves.toBeNull();
  });
});
