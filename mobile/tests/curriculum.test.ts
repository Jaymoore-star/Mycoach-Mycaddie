import { describe, expect, it } from 'vitest';

import {
  COACH_DRILL_SETS,
  COACH_SESSION_DRILL_COUNT,
  PHASES,
  PHASE_ORDER,
  type SkillLevel,
  generateSession,
} from '../convex/lib/curriculum';
import { PHASE_DAY_START, PROGRAM_DAYS, getDayInPhase, getPhaseForDay } from '../convex/lib/program';
import { COACH_FOR_SKILL, COACH_IDS } from '../convex/lib/coachLevels';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'scratch', 'tour_pro'];


describe('program shape', () => {
  it('allocates every one of the 90 days', () => {
    const total = PHASE_ORDER.reduce((sum, p) => sum + PHASES[p].daysAllocated, 0);
    expect(total).toBe(PROGRAM_DAYS);
  });

  it('starts each phase where the previous one ends', () => {
    let expected = 1;
    for (const phase of PHASE_ORDER) {
      expect(PHASE_DAY_START[phase]).toBe(expected);
      expected += PHASES[phase].daysAllocated;
    }
  });

  it('maps every day to the right phase', () => {
    for (let day = 1; day <= PROGRAM_DAYS; day++) {
      const phase = getPhaseForDay(day);
      const start = PHASE_DAY_START[phase];
      const end = start + PHASES[phase].daysAllocated - 1;
      expect(day, `day ${day} landed in ${phase}`).toBeGreaterThanOrEqual(start);
      expect(day, `day ${day} landed in ${phase}`).toBeLessThanOrEqual(end);
    }
  });

  it('numbers days within a phase from 1', () => {
    for (const phase of PHASE_ORDER) {
      expect(getDayInPhase(PHASE_DAY_START[phase], phase)).toBe(1);
      const lastDay = PHASE_DAY_START[phase] + PHASES[phase].daysAllocated - 1;
      expect(getDayInPhase(lastDay, phase)).toBe(PHASES[phase].daysAllocated);
    }
  });
});

describe('coach drill sets each cover exactly one difficulty', () => {
  // This is why the coach IS the level, and why onboarding must keep the two
  // aligned: generateSession skips difficulty filtering when a coach is set.
  for (const coach of COACH_IDS) {
    it(`${coach} uses a single difficulty tier`, () => {
      const difficulties = new Set(
        PHASE_ORDER.flatMap((p) => (COACH_DRILL_SETS[coach][p] ?? []).map((d) => d.difficulty)),
      );
      expect(difficulties.size).toBe(1);
    });
  }

  it('assigns each skill level a coach', () => {
    for (const level of LEVELS) {
      expect(COACH_FOR_SKILL[level]).toBeDefined();
      expect(COACH_IDS).toContain(COACH_FOR_SKILL[level]);
    }
  });

  it('escalates the coach as skill rises', () => {
    const tier = (level: SkillLevel) => COACH_IDS.indexOf(COACH_FOR_SKILL[level]);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(tier(LEVELS[i])).toBeGreaterThanOrEqual(tier(LEVELS[i - 1]));
    }
  });
});

describe('generateSession', () => {
  it('produces a complete session for every phase, level, coach and day', () => {
    let runs = 0;

    for (const phase of PHASE_ORDER) {
      for (const skillLevel of LEVELS) {
        for (const coach of [...COACH_IDS, undefined]) {
          for (let day = 1; day <= PHASES[phase].daysAllocated; day++) {
            runs++;
            const s = generateSession(phase, skillLevel, day, 'Jeet', coach);

            expect(s.phase).toBe(phase);
            expect(s.dayInPhase).toBe(day);
            expect(s.drills.length).toBeGreaterThan(0);
            expect(s.estimatedMinutes).toBeGreaterThan(0);
            expect(s.warmup).toBeTruthy();
            expect(s.cooldown).toBeTruthy();
            expect(s.sessionGoal).toBeTruthy();
            expect(s.completionGate).toBeTruthy();
            expect(s.coachGreeting).toBeTruthy();

            // A repeated drill would let one tick satisfy two tasks.
            const ids = s.drills.map((d) => d.id);
            expect(new Set(ids).size).toBe(ids.length);

            for (const d of s.drills) {
              expect(d.id).toBeTruthy();
              expect(d.name).toBeTruthy();
              expect(d.coachingCue).toBeTruthy();
              expect(d.duration).toBeTruthy();
              expect(d.reps).toBeTruthy();
            }
          }
        }
      }
    }

    expect(runs).toBe(6 * 5 * 5 * 15);
  });

  it('honours each coach drill count', () => {
    for (const coach of COACH_IDS) {
      const s = generateSession('putting', 'intermediate', 1, 'Jeet', coach);
      expect(s.drills.length).toBeLessThanOrEqual(COACH_SESSION_DRILL_COUNT[coach]);
    }
  });

  it('varies the drills across days within a phase', () => {
    const signatures = new Set(
      Array.from({ length: 15 }, (_, i) =>
        generateSession('putting', 'intermediate', i + 1, 'Jeet', 'dom')
          .drills.map((d) => d.id)
          .join('|'),
      ),
    );
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('filters by skill level when no coach is assigned', () => {
    const perLevel = LEVELS.map((level) =>
      generateSession('putting', level, 1, 'Jeet', undefined)
        .drills.map((d) => d.id)
        .join('|'),
    );
    expect(new Set(perLevel).size).toBeGreaterThan(1);
  });
});
