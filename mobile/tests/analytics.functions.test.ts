/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';
import { COURSE_LIBRARY } from '../convex/lib/courses';

import { localDate, signIn, signInWithProfile, testApp } from './helpers';

const COURSE = COURSE_LIBRARY[0];
const TODAY = localDate();

type User = Awaited<ReturnType<typeof signInWithProfile>>;

/**
 * A complete eighteen, scored hole by hole.
 *
 * The summary only counts rounds with all eighteen holes, so a partial card
 * cannot be used to set up these tests.
 */
async function playRound(
  asUser: User['asUser'],
  profileId: User['profileId'],
  options: { score: number; putts?: number; fairwayHit?: boolean; girHit?: boolean },
) {
  const roundId = await asUser.mutation(api.rounds.startRound, {
    profileId,
    courseName: COURSE.name,
    courseId: COURSE.id,
    teeBox: 'regular',
    totalPar: 72,
  });

  for (let hole = 1; hole <= 18; hole++) {
    await asUser.mutation(api.rounds.logHoleScore, {
      roundId,
      hole,
      par: 4,
      score: options.score,
      putts: options.putts ?? 2,
      ...(options.fairwayHit === undefined ? {} : { fairwayHit: options.fairwayHit }),
      ...(options.girHit === undefined ? {} : { girHit: options.girHit }),
    });
  }

  return roundId;
}

describe('getPerformanceSummary', () => {
  it('reports an empty summary before anything is played', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.roundsPlayed).toBe(0);
    expect(summary?.avgScore).toBeNull();
    expect(summary?.bestScore).toBeNull();
    expect(summary?.scoringTrend).toEqual([]);
  });

  it('averages the rounds played and keeps the best', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await playRound(asUser, profileId, { score: 5 }); // 90
    await playRound(asUser, profileId, { score: 4 }); // 72

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.roundsPlayed).toBe(2);
    expect(summary?.avgScore).toBe(81);
    expect(summary?.bestScore).toBe(72);
  });

  it('leaves a partial card out of the averages', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
      teeBox: 'regular',
      totalPar: 72,
    });
    // Nine holes and a rain delay is not a round to be judged on.
    for (let hole = 1; hole <= 9; hole++) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId,
        hole,
        par: 4,
        score: 7,
        putts: 3,
      });
    }

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.roundsPlayed).toBe(0);
    expect(summary?.avgScore).toBeNull();
  });

  it('orders the scoring trend oldest first, ready to plot', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await playRound(asUser, profileId, { score: 6 }); // 108, played first
    await playRound(asUser, profileId, { score: 4 }); // 72, played second

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.scoringTrend.map((point) => point.score)).toEqual([108, 72]);
    // A chart wants a plain date, not the round's ISO timestamp.
    expect(summary?.scoringTrend[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('counts fairways and greens only where they were recorded', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await playRound(asUser, profileId, { score: 4, fairwayHit: true, girHit: false });

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.fairwayPct).toBe(100);
    expect(summary?.girPct).toBe(0);
  });

  it('leaves fairway and green percentages null when nobody recorded them', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await playRound(asUser, profileId, { score: 4 });

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    // Null, not zero: "never entered" and "missed every fairway" are different
    // things and the screen must not report the second for the first.
    expect(summary?.fairwayPct).toBeNull();
    expect(summary?.girPct).toBeNull();
  });

  it('averages putts across the rounds rather than the holes', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await playRound(asUser, profileId, { score: 4, putts: 2 });

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.puttsPerRound).toBe(36);
  });

  it('shows where the strokes went by par', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    await playRound(asUser, profileId, { score: 5 });

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.strokesByPar).toEqual([{ par: 4, holes: 18, avgOverPar: 1 }]);
  });

  it('counts practice days and logged shots', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const sessionId = await asUser.mutation(api.sessions.startSession, {
      profileId,
      phase: 'putting',
      date: TODAY,
      tasksTotal: 1,
    });
    await asUser.mutation(api.sessions.completeDrill, { sessionId, drillId: 'one' });
    await asUser.mutation(api.shots.logShot, {
      profileId,
      date: TODAY,
      sessionType: 'practice',
      club: '7-Iron',
      targetDistanceYards: 150,
      actualDistanceYards: 148,
      shotShape: 'straight',
      ballFlight: 'mid',
    });

    const summary = await asUser.query(api.analytics.getPerformanceSummary, { profileId });
    expect(summary?.practiceDays).toBe(1);
    expect(summary?.completedSessions).toBe(1);
    expect(summary?.shotsLogged).toBe(1);
  });

  it('is closed to a caller who does not own the profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await playRound(asUser, profileId, { score: 4 });

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(
      asBob.query(api.analytics.getPerformanceSummary, { profileId }),
    ).resolves.toBeNull();
  });
});

describe('the export queries', () => {
  it('hand back the golfer own history', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    await playRound(asUser, profileId, { score: 4 });
    await asUser.mutation(api.shots.logShot, {
      profileId,
      date: TODAY,
      sessionType: 'practice',
      club: 'Driver',
      targetDistanceYards: 260,
      actualDistanceYards: 251,
      shotShape: 'draw',
      ballFlight: 'mid',
    });
    await asUser.mutation(api.skillTests.submitSkillTest, {
      profileId,
      phase: 'putting',
      week: 1,
      date: TODAY,
      results: [],
    });

    await expect(
      asUser.query(api.analytics.getFullRoundHistory, { profileId }),
    ).resolves.toHaveLength(1);
    await expect(
      asUser.query(api.analytics.getFullShotHistory, { profileId }),
    ).resolves.toHaveLength(1);
    await expect(
      asUser.query(api.analytics.getFullSkillsTests, { profileId }),
    ).resolves.toHaveLength(1);
  });

  it('are all closed to a caller who does not own the profile', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    await playRound(asUser, profileId, { score: 4 });
    await asUser.mutation(api.shots.logShot, {
      profileId,
      date: TODAY,
      sessionType: 'practice',
      club: 'Driver',
      targetDistanceYards: 260,
      actualDistanceYards: 251,
      shotShape: 'draw',
      ballFlight: 'mid',
    });
    await asUser.mutation(api.skillTests.submitSkillTest, {
      profileId,
      phase: 'putting',
      week: 1,
      date: TODAY,
      results: [],
    });

    // These are the export endpoints - the whole history in one call - so an
    // ownership hole here leaks everything at once.
    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.query(api.analytics.getFullRoundHistory, { profileId })).resolves.toEqual(
      [],
    );
    await expect(asBob.query(api.analytics.getFullShotHistory, { profileId })).resolves.toEqual([]);
    await expect(asBob.query(api.analytics.getFullSkillsTests, { profileId })).resolves.toEqual([]);
  });
});
