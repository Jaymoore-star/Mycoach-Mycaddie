import { describe, expect, it } from 'vitest';

import {
  buildCoachSystemPrompt,
  formatPlayerContext,
  type PlayerSnapshot,
} from '../convex/lib/coachContext';
import { COACH_PROFILES, getCoachProfile } from '../convex/lib/coachPersona';
import { MANUAL_CORE, MANUAL_TITLE, manualForQuestion } from '../convex/lib/manual';

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

describe('the manual in the coach prompt', () => {
  const coach = getCoachProfile('mason');

  it('carries the core of the manual and names it as the authority', () => {
    const prompt = buildCoachSystemPrompt(coach, FULL, true);
    expect(prompt).toContain(MANUAL_CORE);
    expect(prompt).toContain(MANUAL_TITLE);
    // Mason's persona still speaks the older edition; the prompt has to say
    // which one wins, or the model splits the difference.
    expect(prompt).toMatch(/authority/);
    expect(prompt).toMatch(/P1 to P10/);
  });

  it('includes the passages it is given, and no empty heading when there are none', () => {
    const passages = manualForQuestion('I keep slicing my driver', 'putting');
    expect(buildCoachSystemPrompt(coach, FULL, true, passages)).toContain(passages);
    expect(buildCoachSystemPrompt(coach, FULL, true)).not.toContain('Passages from the manual');
  });

  it('builds on Tour Pure for a golfer who has one, and offers a way round it for one who does not', () => {
    expect(buildCoachSystemPrompt(coach, FULL, true)).toContain('This student trains with Tour Pure');
    const without = buildCoachSystemPrompt(coach, EMPTY, false);
    expect(without).toContain('may not own Tour Pure');
    expect(without).toContain('without it');
  });

  it('forbids selling beyond what the manual says', () => {
    const prompt = buildCoachSystemPrompt(coach, EMPTY, false);
    expect(prompt).toMatch(/never as a\s+sales pitch/);
    expect(prompt).toMatch(/no\s+prices/);
  });

  it('stays well inside the per-minute token allowance with passages included', () => {
    // 30k tokens a minute is shared across every golfer chatting. The system
    // prompt plus three passages has to leave room for history and replies:
    // about 4 characters a token, so 24k characters is ~6k tokens.
    const passages = manualForQuestion('I keep slicing my driver and hitting it fat', 'driver');
    expect(buildCoachSystemPrompt(coach, FULL, true, passages).length).toBeLessThan(24_000);
  });
});

describe('how the coach is told to use the manual', () => {
  const prompt = buildCoachSystemPrompt(getCoachProfile('sam'), EMPTY, false);

  it('grounds golf answers in the manual and says where they come from', () => {
    expect(prompt).toContain('Ground every golf answer in it');
    expect(prompt).toMatch(/the\s+manual's Low Point Drill/);
  });

  it('says plainly when the manual does not cover something, and does not force it into small talk', () => {
    expect(prompt).toContain('say plainly that it is not in the manual');
    expect(prompt).toMatch(/a greeting, a thank-you/);
  });

  it('stops at pain rather than coaching through it', () => {
    // The first live run answered "my back hurts" with a swing diagnosis and a
    // drill. The only right answer is to stop and see someone.
    expect(prompt).toContain('tell them to stop whatever hurts and see a medical professional');
    expect(prompt).toContain('do not prescribe drills to work through it');
  });
});
