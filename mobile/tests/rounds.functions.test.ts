/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';
import { COURSE_LIBRARY } from '../convex/lib/courses';

import { signIn, signInWithProfile, testApp } from './helpers';

const COURSE = COURSE_LIBRARY[0];

describe('startRound', () => {
  it('opens an empty scorecard', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
      teeBox: 'regular',
      totalPar: 72,
    });

    const round = await asUser.query(api.rounds.getRound, { roundId });
    expect(round?.holes).toEqual([]);
    expect(round?.totalScore).toBe(0);
    expect(round?.courseName).toBe(COURSE.name);
  });

  it('fills rating and slope from the course library', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
      teeBox: 'championship',
    });

    // These drive the WHS handicap; a round without them is not eligible.
    const round = await asUser.query(api.rounds.getRound, { roundId });
    expect(round?.courseRating).toBe(COURSE.rating.championship);
    expect(round?.courseSlope).toBe(COURSE.slope.championship);
  });

  it('resumes an unfinished round at the same course instead of duplicating it', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const first = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
    });
    const second = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
    });

    // Tapping Start twice must not leave two indistinguishable scorecards.
    expect(second).toBe(first);
    const rounds = await asUser.query(api.rounds.getRounds, { profileId });
    expect(rounds).toHaveLength(1);
  });

  it('starts a fresh round once the old one is a full 18', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const first = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
    });
    for (let hole = 1; hole <= 18; hole++) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId: first,
        hole,
        par: 4,
        score: 4,
        putts: 2,
      });
    }

    const second = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
    });

    expect(second).not.toBe(first);
  });

  it("refuses to start a round on someone else's profile", async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.rounds.startRound, { profileId, courseName: 'Anywhere' }),
    ).rejects.toThrow();
  });
});

describe('logHoleScore', () => {
  async function openRound() {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
    });
    return { t, asUser, profileId, roundId };
  }

  it('keeps the running total in step with the holes', async () => {
    const { asUser, roundId } = await openRound();

    await asUser.mutation(api.rounds.logHoleScore, {
      roundId,
      hole: 1,
      par: 4,
      score: 5,
      putts: 2,
    });
    const result = await asUser.mutation(api.rounds.logHoleScore, {
      roundId,
      hole: 2,
      par: 3,
      score: 3,
      putts: 1,
    });

    expect(result.totalScore).toBe(8);
    expect(result.scoreDifferential).toBe(1);
  });

  it('replaces a hole rather than logging it twice', async () => {
    const { asUser, roundId } = await openRound();

    await asUser.mutation(api.rounds.logHoleScore, {
      roundId,
      hole: 1,
      par: 4,
      score: 7,
      putts: 3,
    });
    const corrected = await asUser.mutation(api.rounds.logHoleScore, {
      roundId,
      hole: 1,
      par: 4,
      score: 4,
      putts: 2,
    });

    expect(corrected.totalScore).toBe(4);
    const round = await asUser.query(api.rounds.getRound, { roundId });
    expect(round?.holes).toHaveLength(1);
  });

  it('keeps holes in playing order however they are entered', async () => {
    const { asUser, roundId } = await openRound();

    for (const hole of [5, 1, 3]) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId,
        hole,
        par: 4,
        score: 4,
        putts: 2,
      });
    }

    const round = await asUser.query(api.rounds.getRound, { roundId });
    expect(round?.holes.map((h) => h.hole)).toEqual([1, 3, 5]);
  });

  it("refuses to write into another golfer's scorecard", async () => {
    const { roundId, t } = await openRound();
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.rounds.logHoleScore, {
        roundId,
        hole: 1,
        par: 4,
        score: 2,
        putts: 1,
      }),
    ).rejects.toThrow();
  });
});

describe('finishRound', () => {
  it('moves the scoring average only on a full round', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    const short = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: 'Practice loop',
    });
    for (let hole = 1; hole <= 3; hole++) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId: short,
        hole,
        par: 4,
        score: 4,
        putts: 2,
      });
    }
    await asUser.mutation(api.rounds.finishRound, { roundId: short });

    // A 3-hole loop scoring 12 would otherwise drag the average to a number
    // no golfer has ever shot.
    let profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.scoringAvg).toBeUndefined();

    const full = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: 'Full round',
    });
    for (let hole = 1; hole <= 18; hole++) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId: full,
        hole,
        par: 4,
        score: 5,
        putts: 2,
      });
    }
    await asUser.mutation(api.rounds.finishRound, { roundId: full });

    profile = await asUser.query(api.profiles.getMyProfile, {});
    expect(profile?.scoringAvg).toBe(90);
  });

  it('stores caddie notes when they are given', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: 'Anywhere',
    });

    await asUser.mutation(api.rounds.finishRound, {
      roundId,
      caddieNotes: 'Left too many putts short.',
    });

    const round = await asUser.query(api.rounds.getRound, { roundId });
    expect(round?.caddieNotes).toBe('Left too many putts short.');
  });
});

describe('deleteRound', () => {
  it('removes the golfer own round', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: 'Anywhere',
    });

    await asUser.mutation(api.rounds.deleteRound, { roundId });

    await expect(asUser.query(api.rounds.getRounds, { profileId })).resolves.toEqual([]);
  });

  it("refuses to delete another golfer's round", async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t, { email: 'a@example.com' });
    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: 'Anywhere',
    });
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(asBob.mutation(api.rounds.deleteRound, { roundId })).rejects.toThrow();

    const rounds = await asUser.query(api.rounds.getRounds, { profileId });
    expect(rounds).toHaveLength(1);
  });
});

describe('getHandicapData', () => {
  it('counts only 18-hole rounds that carry a rating and slope', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);

    // Rated, complete - eligible.
    const rated = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: COURSE.name,
      courseId: COURSE.id,
      teeBox: 'regular',
    });
    for (let hole = 1; hole <= 18; hole++) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId: rated,
        hole,
        par: 4,
        score: 5,
        putts: 2,
      });
    }

    // Unrated free-text course, complete - not eligible.
    const unrated = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: 'Some muni',
    });
    for (let hole = 1; hole <= 18; hole++) {
      await asUser.mutation(api.rounds.logHoleScore, {
        roundId: unrated,
        hole,
        par: 4,
        score: 5,
        putts: 2,
      });
    }

    const data = await asUser.query(api.rounds.getHandicapData, { profileId });
    expect(data.eligibleRounds).toBe(1);
  });

  it('returns nothing for a signed-out caller', async () => {
    const t = testApp();
    const { profileId } = await signInWithProfile(t);

    const data = await t.query(api.rounds.getHandicapData, { profileId });
    expect(data.eligibleRounds).toBe(0);
  });
});
