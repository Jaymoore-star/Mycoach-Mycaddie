import { describe, expect, it } from 'vitest';

import { PHASE_ORDER, type SkillLevel } from '../convex/lib/curriculum';
import { getSkillTest, gradeSkillTest } from '../convex/lib/skillTests';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'scratch', 'tour_pro'];

describe('getSkillTest', () => {
  it('returns a complete test for every phase and week', () => {
    for (const phase of PHASE_ORDER) {
      for (const week of [1, 2, 3]) {
        const test = getSkillTest(phase, week);

        expect(test.phase).toBe(phase);
        expect(test.week).toBe(week);
        expect(test.title).toBeTruthy();
        expect(test.description).toBeTruthy();
        expect(test.coachIntro).toBeTruthy();
        expect(test.challenges.length).toBeGreaterThan(0);

        for (const c of test.challenges) {
          expect(c.id).toBeTruthy();
          expect(c.name).toBeTruthy();
          expect(c.description).toBeTruthy();
          expect(c.metric).toBeTruthy();
          expect(c.totalAttempts).toBeGreaterThan(0);

          // Every level needs a threshold, and it can never exceed the
          // attempts available or the challenge would be unpassable.
          for (const level of LEVELS) {
            const required = c.requiredPasses[level];
            expect(required, `${c.id}/${level}`).toBeGreaterThan(0);
            expect(required, `${c.id}/${level}`).toBeLessThanOrEqual(c.totalAttempts);
          }
        }

        // Challenge ids must be unique or the results map collides.
        const ids = test.challenges.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('raises the bar as skill level rises', () => {
    for (const phase of PHASE_ORDER) {
      for (const c of getSkillTest(phase, 1).challenges) {
        const thresholds = LEVELS.map((l) => c.requiredPasses[l]);
        for (let i = 1; i < thresholds.length; i++) {
          expect(thresholds[i], `${c.id}`).toBeGreaterThanOrEqual(thresholds[i - 1]);
        }
      }
    }
  });

  it('clamps an out-of-range week rather than throwing', () => {
    expect(getSkillTest('putting', 0).week).toBe(1);
    expect(getSkillTest('putting', 99).week).toBe(3);
  });
});

describe('gradeSkillTest', () => {
  const challenges = getSkillTest('putting', 1).challenges;
  const allAttempts = challenges.reduce((s, c) => s + c.totalAttempts, 0);

  const perfect = challenges.map((c) => ({ challengeId: c.id, passes: c.totalAttempts }));
  const nothing = challenges.map((c) => ({ challengeId: c.id, passes: 0 }));

  it('scores a perfect set at 100 and passes every level', () => {
    for (const level of LEVELS) {
      const g = gradeSkillTest(challenges, perfect, level);
      expect(g.score).toBe(100);
      expect(g.overallPass).toBe(true);
    }
  });

  it('scores an empty set at 0 and fails every level', () => {
    for (const level of LEVELS) {
      const g = gradeSkillTest(challenges, nothing, level);
      expect(g.score).toBe(0);
      expect(g.overallPass).toBe(false);
    }
  });

  it('raises the passing mark with skill level', () => {
    const marks = LEVELS.map((l) => gradeSkillTest(challenges, nothing, l).passingScore);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i]).toBeGreaterThan(marks[i - 1]);
    }
  });

  it('clamps a claim of more passes than attempts', () => {
    // Without this a modified client could submit 999 and score above 100%.
    const cheating = challenges.map((c) => ({ challengeId: c.id, passes: 999 }));
    const g = gradeSkillTest(challenges, cheating, 'beginner');
    expect(g.score).toBe(100);
    expect(g.challengeResults.every((c) => c.passes <= c.totalAttempts)).toBe(true);
  });

  it('ignores negative passes', () => {
    const g = gradeSkillTest(
      challenges,
      challenges.map((c) => ({ challengeId: c.id, passes: -5 })),
      'beginner',
    );
    expect(g.score).toBe(0);
    expect(g.challengeResults.every((c) => c.passes === 0)).toBe(true);
  });

  it('treats a missing challenge result as zero', () => {
    const g = gradeSkillTest(challenges, [], 'beginner');
    expect(g.score).toBe(0);
    expect(g.challengeResults).toHaveLength(challenges.length);
  });

  it('scores as raw conversion across all attempts', () => {
    const half = challenges.map((c) => ({
      challengeId: c.id,
      passes: Math.floor(c.totalAttempts / 2),
    }));
    const madeCount = half.reduce((s, r) => s + r.passes, 0);
    const g = gradeSkillTest(challenges, half, 'beginner');
    expect(g.score).toBe(Math.round((madeCount / allAttempts) * 100));
  });

  it('reports per-challenge outcomes against the level threshold', () => {
    const g = gradeSkillTest(challenges, perfect, 'tour_pro');
    expect(g.challengeResults).toHaveLength(challenges.length);
    for (const r of g.challengeResults) {
      expect(r.met).toBe(true);
      expect(r.required).toBeGreaterThan(0);
      expect(r.name).toBeTruthy();
    }
  });

  it('gives identical feedback for identical input', () => {
    // The original used Math.random(), so the same attempt produced different
    // coaching each call and could not be tested or reproduced.
    const a = gradeSkillTest(challenges, perfect, 'beginner').feedback;
    const b = gradeSkillTest(challenges, perfect, 'beginner').feedback;
    expect(a).toBe(b);
  });

  it('does not call a bare pass elite', () => {
    // A beginner passes at 45%. The original always used the top-tier text on
    // any pass, telling them their consistency was "at an elite level".
    const level: SkillLevel = 'beginner';
    const target = gradeSkillTest(challenges, nothing, level).passingScore;

    // Build a set that just clears the bar.
    let made = 0;
    const needed = Math.ceil((target / 100) * allAttempts);
    const barely = challenges.map((c) => {
      const take = Math.min(c.totalAttempts, Math.max(0, needed - made));
      made += take;
      return { challengeId: c.id, passes: take };
    });

    const g = gradeSkillTest(challenges, barely, level);
    expect(g.overallPass).toBe(true);
    expect(g.score).toBeLessThan(90);
    expect(g.feedback.toLowerCase()).not.toContain('elite');
    expect(g.feedback.toLowerCase()).not.toContain('outstanding');
  });

  it('names a shortfall so the golfer knows where to work', () => {
    const oneWeak = challenges.map((c, i) => ({
      challengeId: c.id,
      passes: i === 0 ? 0 : c.totalAttempts,
    }));
    const g = gradeSkillTest(challenges, oneWeak, 'beginner');
    expect(g.feedback).toContain(challenges[0].name);
  });
});
