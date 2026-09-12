import { describe, expect, it } from 'vitest';

import {
  buildCoachSystemPrompt,
  formatPlayerContext,
  type PlayerSnapshot,
} from '../convex/lib/coachContext';
import { COACH_PROFILES, getCoachProfile } from '../convex/lib/coachPersona';

/**
 * The briefing is the only thing standing between "your coach knows your game"
 * and a model inventing a handicap. These tests assert the two properties that
 * matter: every number the coach is allowed to cite appears in the prompt, and
 * nothing the golfer has not logged is asserted as fact.
 */

const EMPTY: PlayerSnapshot = {
  displayName: 'Jeet',
  skillLevel: 'intermediate',
  skillLabel: 'Intermediate',
  handicapIndex: null,
  currentDay: 1,
  currentPhase: 'putting',
  targetScore: 80,
  scoringAvg: null,
  weeklyGoal: null,
  tourPureActive: false,
  recentRounds: [],
  recentSessions: [],
  latestSkillTest: null,
  tendencies: null,
  latestSwing: null,
  clubCarries: [],
};

const FULL: PlayerSnapshot = {
  ...EMPTY,
  handicapIndex: 14.2,
  currentDay: 34,
  currentPhase: 'pitching',
  scoringAvg: 91,
  weeklyGoal: 4,
  tourPureActive: true,
  recentRounds: [
    {
      date: '2026-09-08',
      courseName: 'Pebble Creek',
      totalScore: 88,
      totalPar: 72,
      putts: 34,
      holesPlayed: 18,
      fairwaysHit: 7,
      greensHit: 5,
    },
    {
      date: '2026-09-01',
      courseName: 'Rolling Oaks',
      totalScore: 72,
      totalPar: 72,
      putts: 29,
      holesPlayed: 18,
      fairwaysHit: null,
      greensHit: null,
    },
  ],
  recentSessions: [
    {
      date: '2026-09-10',
      day: 34,
      phase: 'pitching',
      tasksCompleted: 2,
      tasksTotal: 3,
      complete: false,
    },
  ],
  latestSkillTest: {
    date: '2026-09-05',
    phase: 'short_game',
    weekNumber: 4,
    score: 68,
    overallPass: false,
  },
  tendencies: {
    dominantMiss: 'right',
    avgMissYards: 18,
    favoriteShape: 'fade',
    commonClubs: ['7-Iron', 'Driver'],
    weaknesses: ['3-Wood'],
  },
  latestSwing: {
    label: '5-Wood',
    recordedAt: '2026-09-11',
    summary: 'Steep shoulder turn with the head drifting toward the target.',
    improvements: ['Keep the trail shoulder higher at the top'],
    basis: 'video',
  },
  clubCarries: [
    { club: 'Driver', carry: 245 },
    { club: '7-Iron', carry: 155 },
  ],
};

describe('formatPlayerContext', () => {
  it('states plainly that there is no handicap rather than inventing one', () => {
    const text = formatPlayerContext(EMPTY);
    expect(text).toContain('not established yet');
    expect(text).not.toMatch(/Handicap Index: \d/);
  });

  it('omits sections the golfer has no data for', () => {
    const text = formatPlayerContext(EMPTY);
    expect(text).not.toContain('Recent rounds');
    expect(text).not.toContain('Recent practice sessions');
    expect(text).not.toContain('tendencies');
    expect(text).not.toContain('Carry distances');
    expect(text).not.toContain('swing recording');
  });

  it('carries every logged number the coach may cite', () => {
    const text = formatPlayerContext(FULL);

    expect(text).toContain('Handicap Index: 14.2');
    expect(text).toContain('day 34 of 90');
    expect(text).toContain('Pitching');
    expect(text).toContain('Pebble Creek');
    expect(text).toContain('34 putts');
    expect(text).toContain('7 fairways');
    expect(text).toContain('Driver 245y');
    expect(text).toContain('scored 68/100');
    expect(text).toContain('did not pass');
  });

  it('renders score relative to par in both directions', () => {
    const text = formatPlayerContext(FULL);
    expect(text).toContain('88 (+16)');
    expect(text).toContain('72 (level par)');
  });

  it('describes the dominant miss in words rather than a raw enum', () => {
    const text = formatPlayerContext(FULL);
    expect(text).toContain('misses right');
    expect(text).toContain('18 yards off target');
  });

  it('passes on swing findings only when frames were actually read', () => {
    const read = formatPlayerContext(FULL);
    expect(read).toContain('Steep shoulder turn');

    const clubOnly = formatPlayerContext({
      ...FULL,
      latestSwing: { ...FULL.latestSwing!, basis: 'club' },
    });
    expect(clubOnly).not.toContain('Steep shoulder turn');
    expect(clubOnly).toContain('do not describe what their swing looked like');
  });

  it('flags the Tour Pure hardware only when it is active', () => {
    expect(formatPlayerContext(FULL)).toContain('Tour Pure');
    expect(formatPlayerContext(EMPTY)).not.toContain('Tour Pure');
  });
});

describe('buildCoachSystemPrompt', () => {
  it('puts the coach in first person with their own level and vocabulary', () => {
    for (const coach of COACH_PROFILES) {
      const prompt = buildCoachSystemPrompt(coach, FULL, true);

      expect(prompt).toContain(`You are ${coach.name}`);
      expect(prompt).toContain(coach.levelSpec.coreObjective);
      expect(prompt).toContain(coach.levelSpec.keyVocabulary[0]);
      // The level guardrail has to name what this coach holds back, or a
      // level-1 student gets spin-axis talk on day one.
      expect(prompt).toContain(coach.levelSpec.avoidKeywords[0]);
    }
  });

  it('redirects rather than refuses when asked past the level', () => {
    const prompt = buildCoachSystemPrompt(getCoachProfile('que'), FULL, true);
    expect(prompt).toContain('do not refuse');
  });

  it('always forbids invented numbers and claimed video', () => {
    const prompt = buildCoachSystemPrompt(getCoachProfile('dom'), FULL, true);
    expect(prompt).toContain('Never state a number about this student that is not in the briefing');
    expect(prompt).toContain('Never claim to have watched a swing');
  });

  it('replaces the briefing with a blank slate when nothing is logged', () => {
    const prompt = buildCoachSystemPrompt(getCoachProfile('mason'), EMPTY, false);

    expect(prompt).toContain('have not logged any rounds');
    // No empty scaffolding for the model to fill in with guesses.
    expect(prompt).not.toContain('Recent rounds');
    expect(prompt).not.toContain('Handicap Index');
  });

  it('names the golfer in every case', () => {
    expect(buildCoachSystemPrompt(getCoachProfile('sam'), EMPTY, false)).toContain('Jeet');
    expect(buildCoachSystemPrompt(getCoachProfile('sam'), FULL, true)).toContain('Jeet');
  });
});

describe('coach roster', () => {
  it('covers all four levels exactly once', () => {
    expect(COACH_PROFILES.map((c) => c.level)).toEqual([1, 2, 3, 4]);
  });

  it('falls back to the level-1 coach for an unknown id', () => {
    expect(getCoachProfile(undefined).id).toBe('que');
    expect(getCoachProfile('nobody').id).toBe('que');
  });
});
