/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { api } from '../convex/_generated/api';
import { blankCourse } from '../convex/lib/customCourses';

import { signIn, signInWithProfile, testApp } from './helpers';

function course(overrides: Partial<ReturnType<typeof blankCourse>> = {}) {
  return { ...blankCourse(), name: 'Royal County Down', location: 'Newcastle', ...overrides };
}

describe('create', () => {
  it('stores a valid course', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    await asUser.mutation(api.customCourses.create, course());

    const mine = await asUser.query(api.customCourses.list, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe('Royal County Down');
    expect(mine[0].holes).toHaveLength(18);
  });

  it('trims the name and location it was given', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    await asUser.mutation(
      api.customCourses.create,
      course({ name: '  Spaced Out  ', location: '  Somewhere  ' }),
    );

    const [saved] = await asUser.query(api.customCourses.list, {});
    expect(saved.name).toBe('Spaced Out');
    expect(saved.location).toBe('Somewhere');
  });

  it('refuses a signed-out caller', async () => {
    const t = testApp();

    await expect(t.mutation(api.customCourses.create, course())).rejects.toThrow();
  });

  it('validates on the server, not only in the form', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    const bad = course();
    bad.slope.regular = 400;

    // A modified client would otherwise write a slope that bends the golfer's
    // handicap for every round played here.
    await expect(asUser.mutation(api.customCourses.create, bad)).rejects.toThrow();
  });

  it('rejects an incomplete card', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    await expect(
      asUser.mutation(api.customCourses.create, course({ holes: blankCourse().holes.slice(0, 9) })),
    ).rejects.toThrow();
  });

  it('refuses a second course with the same name', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    await asUser.mutation(api.customCourses.create, course());

    await expect(
      asUser.mutation(api.customCourses.create, course({ name: 'royal county down' })),
    ).rejects.toThrow(/already have a course/i);
  });

  it('lets two golfers each add a course of the same name', async () => {
    const t = testApp();
    const { asUser: asAlex } = await signIn(t, 'a@example.com');
    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await asAlex.mutation(api.customCourses.create, course());
    await asBob.mutation(api.customCourses.create, course());

    expect(await asAlex.query(api.customCourses.list, {})).toHaveLength(1);
    expect(await asBob.query(api.customCourses.list, {})).toHaveLength(1);
  });

  it('sorts the holes before storing them', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);

    await asUser.mutation(
      api.customCourses.create,
      course({ holes: [...blankCourse().holes].reverse() }),
    );

    const [saved] = await asUser.query(api.customCourses.list, {});
    expect(saved.holes.map((h) => h.hole)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
});

describe('list and get', () => {
  it('shows a golfer only their own courses', async () => {
    const t = testApp();
    const { asUser: asAlex } = await signIn(t, 'a@example.com');
    await asAlex.mutation(api.customCourses.create, course());

    const { asUser: asBob } = await signIn(t, 'b@example.com');
    await expect(asBob.query(api.customCourses.list, {})).resolves.toEqual([]);
  });

  it('gives a signed-out caller nothing', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);
    await asUser.mutation(api.customCourses.create, course());

    await expect(t.query(api.customCourses.list, {})).resolves.toEqual([]);
  });

  it('will not fetch a course by id for someone who does not own it', async () => {
    const t = testApp();
    const { asUser: asAlex } = await signIn(t, 'a@example.com');
    const courseId = await asAlex.mutation(api.customCourses.create, course());

    const { asUser: asBob } = await signIn(t, 'b@example.com');

    // Ids arrive from the client, so a valid id is not permission.
    await expect(asBob.query(api.customCourses.get, { courseId })).resolves.toBeNull();
  });
});

describe('update', () => {
  it('saves a change to the golfer own course', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);
    const courseId = await asUser.mutation(api.customCourses.create, course());

    await asUser.mutation(api.customCourses.update, {
      courseId,
      ...course({ name: 'Renamed', altitudeFt: 400 }),
    });

    const saved = await asUser.query(api.customCourses.get, { courseId });
    expect(saved?.name).toBe('Renamed');
    expect(saved?.altitudeFt).toBe(400);
  });

  it("refuses to edit another golfer's course", async () => {
    const t = testApp();
    const { asUser: asAlex } = await signIn(t, 'a@example.com');
    const courseId = await asAlex.mutation(api.customCourses.create, course());

    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(
      asBob.mutation(api.customCourses.update, { courseId, ...course({ name: 'Hijacked' }) }),
    ).rejects.toThrow();

    const saved = await asAlex.query(api.customCourses.get, { courseId });
    expect(saved?.name).toBe('Royal County Down');
  });

  it('validates the update too', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);
    const courseId = await asUser.mutation(api.customCourses.create, course());

    const bad = course();
    bad.holes[0].strokeIndex = bad.holes[1].strokeIndex;

    await expect(
      asUser.mutation(api.customCourses.update, { courseId, ...bad }),
    ).rejects.toThrow();
  });
});

describe('remove', () => {
  it('deletes the golfer own course', async () => {
    const t = testApp();
    const { asUser } = await signIn(t);
    const courseId = await asUser.mutation(api.customCourses.create, course());

    await asUser.mutation(api.customCourses.remove, { courseId });

    await expect(asUser.query(api.customCourses.list, {})).resolves.toEqual([]);
  });

  it("refuses to delete another golfer's course", async () => {
    const t = testApp();
    const { asUser: asAlex } = await signIn(t, 'a@example.com');
    const courseId = await asAlex.mutation(api.customCourses.create, course());

    const { asUser: asBob } = await signIn(t, 'b@example.com');

    await expect(asBob.mutation(api.customCourses.remove, { courseId })).rejects.toThrow();
    await expect(asAlex.query(api.customCourses.list, {})).resolves.toHaveLength(1);
  });

  it('leaves rounds already played there intact', async () => {
    const t = testApp();
    const { asUser, profileId } = await signInWithProfile(t);
    const courseId = await asUser.mutation(api.customCourses.create, course());

    const roundId = await asUser.mutation(api.rounds.startRound, {
      profileId,
      courseName: 'Royal County Down',
      courseId: `custom:${courseId}`,
      courseRating: 72.1,
      courseSlope: 133,
    });
    await asUser.mutation(api.rounds.logHoleScore, {
      roundId,
      hole: 1,
      par: 4,
      score: 5,
      putts: 2,
    });

    await asUser.mutation(api.customCourses.remove, { courseId });

    // The scorecard keeps its own name, rating and slope, so the round stays
    // readable and its handicap differential stays correct.
    const round = await asUser.query(api.rounds.getRound, { roundId });
    expect(round?.courseName).toBe('Royal County Down');
    expect(round?.courseRating).toBe(72.1);
    expect(round?.holes).toHaveLength(1);
  });
});
