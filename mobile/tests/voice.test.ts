import { describe, expect, it } from 'vitest';

import { BAG_ORDER } from '../convex/lib/bag';
import type { CaddieRecommendation } from '../convex/lib/caddie';
import { COACH_PROFILES } from '../convex/lib/coachPersona';
import { MANUAL_CADDIE_CORE } from '../convex/lib/manual';
import {
  BALL_FLIGHTS,
  CONTACT_TYPES,
  SHOT_PARSE_SYSTEM_PROMPT,
  SHOT_SHAPES,
  TTS_VOICES,
  buildCaddieSystemPrompt,
  buildSessionSummary,
  buildShotBrief,
  normalizeClub,
  normalizeParsedShot,
  ttsInstructionsFor,
} from '../convex/lib/voice';

const REC: CaddieRecommendation = {
  primaryClub: '7-Iron',
  alternateClub: '6-Iron',
  adjustedYardage: 158,
  rawYardage: 150,
  yardageAdjustments: [{ reason: 'Headwind 10mph', yards: 8 }],
  shotShape: 'draw',
  aimAdjustment: 'Aim 5 yards right to play your draw',
  trajectory: 'mid',
  landingTarget: 'Front of green, let it release',
  preShotCues: ['Smooth tempo', 'Hands ahead at impact', 'Finish tall'],
  courseManagementNote: 'Short side is dead - miss long',
  layupRecommendation: null,
  greenReading: 'Breaks two cups left',
  paceNote: 'Firm through the ball',
  caddieQuip: "This is your number, Alex. Trust it.",
};

describe('buildShotBrief', () => {
  it('leads with the hole, the number and the club', () => {
    const brief = buildShotBrief(REC, 7, 4);

    expect(brief.startsWith('Hole 7, par 4.')).toBe(true);
    expect(brief).toContain('7 Iron');
    expect(brief).toContain('158');
  });

  it('says both numbers only when the shot is playing differently', () => {
    const windy = buildShotBrief(REC, 7, 4);
    expect(windy).toContain('150 yards on the card, playing 158');

    const calm = buildShotBrief({ ...REC, adjustedYardage: 150 }, 7, 4);
    expect(calm).toContain('150 yards.');
    expect(calm).not.toContain('on the card');
  });

  it('speaks wedge abbreviations as words', () => {
    // "SW" read literally is two letters, not a club.
    expect(buildShotBrief({ ...REC, primaryClub: 'SW' }, 3, 3)).toContain('sand wedge');
    expect(buildShotBrief({ ...REC, primaryClub: 'PW' }, 3, 3)).toContain('pitching wedge');
    expect(buildShotBrief({ ...REC, primaryClub: 'GW' }, 3, 3)).toContain('gap wedge');
    expect(buildShotBrief({ ...REC, primaryClub: 'LW' }, 3, 3)).toContain('lob wedge');
  });

  it('gives one swing thought, not the whole list', () => {
    const brief = buildShotBrief(REC, 7, 4);

    expect(brief).toContain('Smooth tempo');
    expect(brief).not.toContain('Finish tall');
  });

  it('carries the layup only when there is one', () => {
    expect(buildShotBrief(REC, 7, 4)).not.toContain('Lay up');

    const layup = buildShotBrief({ ...REC, layupRecommendation: 'Lay up to 100 yards' }, 7, 5);
    expect(layup).toContain('Lay up to 100 yards');
  });

  it('never runs two full stops together', () => {
    // Several of these fields already end in punctuation in the caddie's own
    // phrasing, and ".." is audible as a stumble in synthesised speech.
    for (const club of BAG_ORDER) {
      const brief = buildShotBrief({ ...REC, primaryClub: club }, 1, 4);
      expect(brief, club).not.toContain('..');
    }
  });
});

describe('buildSessionSummary', () => {
  const SHOTS = [
    { carryYards: 150, shotShape: 'draw', contactType: 'solid' },
    { carryYards: 162, shotShape: 'draw', contactType: 'solid' },
    { carryYards: 141, shotShape: 'fade', contactType: 'thin' },
    { carryYards: 155, shotShape: 'draw', contactType: 'solid' },
  ];

  it('reads the headline numbers back', () => {
    const text = buildSessionSummary(
      {
        label: 'Iron work',
        club: '7-Iron',
        shotCount: 4,
        avgCarryYards: 152,
        avgBallSpeedMph: 118.4,
        avgSmashFactor: 1.44,
        avgSpinRpm: 6200.6,
      },
      SHOTS,
    );

    expect(text).toContain('Iron work summary');
    expect(text).toContain('You hit 4 shots.');
    expect(text).toContain('Average carry: 152 yards.');
    expect(text).toContain('118.4 miles per hour');
    expect(text).toContain('6201 R P M');
  });

  it('leaves out every metric the session never recorded', () => {
    const text = buildSessionSummary({ shotCount: 2 }, []);

    expect(text).toContain('You hit 2 shots.');
    expect(text).not.toContain('Average carry');
    expect(text).not.toContain('smash');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('falls back to the club, then to a generic label', () => {
    expect(buildSessionSummary({ shotCount: 1, club: 'Driver' }, [])).toContain(
      'Driver session summary',
    );
    expect(buildSessionSummary({ shotCount: 1 }, [])).toContain('practice session summary');
  });

  it('speaks singular and plural correctly', () => {
    expect(buildSessionSummary({ shotCount: 1 }, [])).toContain('1 shot.');
    expect(buildSessionSummary({ shotCount: 2 }, [])).toContain('2 shots.');
  });

  it('calls the spread only once there are enough shots to mean anything', () => {
    const enough = buildSessionSummary({ shotCount: 4 }, SHOTS);
    expect(enough).toContain('Best carry was 162 yards, shortest was 141 - a 21 yard spread.');

    const thin = buildSessionSummary({ shotCount: 2 }, SHOTS.slice(0, 2));
    expect(thin).not.toContain('spread');
  });

  it('reports the most common shape and the contact rate', () => {
    const text = buildSessionSummary({ shotCount: 4 }, SHOTS);

    expect(text).toContain('Most common shape: draw, 3 times.');
    expect(text).toContain('75 percent solid contact.');
  });

  it('coaches smash factor by band', () => {
    const elite = buildSessionSummary({ shotCount: 1, avgSmashFactor: 1.5 }, []);
    const middling = buildSessionSummary({ shotCount: 1, avgSmashFactor: 1.44 }, []);
    const poor = buildSessionSummary({ shotCount: 1, avgSmashFactor: 1.3 }, []);

    expect(elite).toContain('Excellent energy transfer');
    expect(middling).toContain('Solid smash factor');
    expect(poor).toContain('room to grow');
  });

  it('flags driver spin at both ends, and only for the driver', () => {
    const high = buildSessionSummary({ shotCount: 5, club: 'Driver', avgSpinRpm: 3400 }, []);
    const low = buildSessionSummary({ shotCount: 5, club: 'Driver', avgSpinRpm: 2000 }, []);
    const fine = buildSessionSummary({ shotCount: 5, club: 'Driver', avgSpinRpm: 2600 }, []);
    // A 7-iron at 6500 rpm is normal; the driver rule must not reach it.
    const iron = buildSessionSummary({ shotCount: 5, club: '7-Iron', avgSpinRpm: 6500 }, []);

    expect(high).toContain('high side');
    expect(low).toContain('very low');
    expect(fine).not.toContain('attack angle');
    expect(iron).not.toContain('attack angle');
  });
});

describe('normalizeClub', () => {
  it('accepts every name already in the bag', () => {
    for (const club of BAG_ORDER) {
      expect(normalizeClub(club), club).toBe(club);
      expect(normalizeClub(club.toLowerCase()), club).toBe(club);
    }
  });

  it('maps the spoken forms a golfer actually uses', () => {
    expect(normalizeClub('seven iron')).toBe('7-Iron');
    expect(normalizeClub('7 iron')).toBe('7-Iron');
    expect(normalizeClub('pitching wedge')).toBe('PW');
    expect(normalizeClub('sand wedge')).toBe('SW');
    expect(normalizeClub('three wood')).toBe('3-Wood');
  });

  it('folds clubs the bag does not carry separately onto the one it does', () => {
    // The reference app's prompt offered 5-Hybrid and 3-Iron, which its own
    // schema then rejected - the shot was silently dropped.
    expect(normalizeClub('5-Hybrid')).toBe('Hybrid');
    expect(normalizeClub('3-Iron')).toBe('4-Iron');
    expect(normalizeClub('approach wedge')).toBe('GW');
  });

  it('returns nothing for a club it cannot place', () => {
    expect(normalizeClub('banana')).toBeUndefined();
    expect(normalizeClub('')).toBeUndefined();
    expect(normalizeClub(undefined)).toBeUndefined();
  });
});

describe('normalizeParsedShot', () => {
  it('keeps every field the model got right', () => {
    expect(
      normalizeParsedShot({
        club: '7-Iron',
        targetDistanceYards: 150,
        actualDistanceYards: 145,
        shotShape: 'fade',
        ballFlight: 'mid',
        contactType: 'solid',
        notes: 'felt early extension',
      }),
    ).toEqual({
      club: '7-Iron',
      targetDistanceYards: 150,
      actualDistanceYards: 145,
      shotShape: 'fade',
      ballFlight: 'mid',
      contactType: 'solid',
      notes: 'felt early extension',
    });
  });

  it('drops anything the shot log would reject', () => {
    // A stray value here fails the whole mutation, losing the shot the golfer
    // just described - so it is dropped rather than passed through.
    expect(
      normalizeParsedShot({
        club: 'banana wood',
        shotShape: 'boomerang',
        contactType: 'perfect',
        ballFlight: 'sideways',
      }),
    ).toEqual({});
  });

  it('rejects yardages that cannot be real', () => {
    expect(normalizeParsedShot({ actualDistanceYards: 0 })).toEqual({});
    expect(normalizeParsedShot({ actualDistanceYards: -20 })).toEqual({});
    expect(normalizeParsedShot({ actualDistanceYards: 900 })).toEqual({});
    expect(normalizeParsedShot({ actualDistanceYards: 'a lot' })).toEqual({});
    expect(normalizeParsedShot({ actualDistanceYards: 145.6 })).toEqual({
      actualDistanceYards: 146,
    });
  });

  it('accepts a numeric string, which is how a model often returns one', () => {
    expect(normalizeParsedShot({ actualDistanceYards: '145' })).toEqual({
      actualDistanceYards: 145,
    });
  });

  it('is case-insensitive about the enums', () => {
    expect(normalizeParsedShot({ shotShape: 'Fade', contactType: 'SOLID' })).toEqual({
      shotShape: 'fade',
      contactType: 'solid',
    });
  });

  it('caps notes and drops empty ones', () => {
    const long = normalizeParsedShot({ notes: 'x'.repeat(500) });
    expect(long.notes).toHaveLength(200);

    expect(normalizeParsedShot({ notes: '   ' })).toEqual({});
  });

  it('survives anything that is not an object', () => {
    expect(normalizeParsedShot(null)).toEqual({});
    expect(normalizeParsedShot('nope')).toEqual({});
    expect(normalizeParsedShot(undefined)).toEqual({});
    expect(normalizeParsedShot([])).toEqual({});
  });
});

describe('SHOT_PARSE_SYSTEM_PROMPT', () => {
  it('offers the model only clubs the bag actually holds', () => {
    for (const club of BAG_ORDER) {
      expect(SHOT_PARSE_SYSTEM_PROMPT, club).toContain(club);
    }
  });

  it('offers only the enum values the schema accepts', () => {
    for (const value of [...SHOT_SHAPES, ...CONTACT_TYPES, ...BALL_FLIGHTS]) {
      expect(SHOT_PARSE_SYSTEM_PROMPT, value).toContain(value);
    }
  });
});

describe('the coach roster has a voice', () => {
  it('gives every coach a TTS voice OpenAI recognises', () => {
    for (const coach of COACH_PROFILES) {
      expect(TTS_VOICES, coach.id).toContain(coach.ttsVoice);
    }
  });

  it('gives each coach a distinct voice, so they are told apart by ear', () => {
    const voices = COACH_PROFILES.map((c) => c.ttsVoice);
    expect(new Set(voices).size).toBe(voices.length);
  });

  it('builds speaking instructions from the persona itself', () => {
    for (const coach of COACH_PROFILES) {
      const instructions = ttsInstructionsFor(coach);

      expect(instructions, coach.id).toContain(coach.name);
      expect(instructions, coach.id).toContain(coach.coachingStyle);
    }
  });
});

describe('buildCaddieSystemPrompt', () => {
  const CONTEXT = {
    playerName: 'Alex',
    skillLabel: 'Intermediate',
    holeNumber: 12,
    par: 4,
    distanceToPin: 150,
    windMph: 10,
    windDirection: 'headwind',
    lie: 'fairway',
    primaryClub: '7-Iron',
    adjustedYardage: 158,
    aimAdjustment: 'Aim 5 yards right',
  };

  it('grounds the answer in the situation on screen', () => {
    const prompt = buildCaddieSystemPrompt(COACH_PROFILES[1], CONTEXT);

    expect(prompt).toContain('Hole 12, par 4');
    expect(prompt).toContain('150 yards to the pin');
    expect(prompt).toContain('headwind at 10 mph');
    expect(prompt).toContain('7-Iron');
    expect(prompt).toContain('158 yards');
  });

  it('holds the spoken caddie to the same level gate as the written coach', () => {
    for (const coach of COACH_PROFILES) {
      const prompt = buildCaddieSystemPrompt(coach, CONTEXT);

      expect(prompt, coach.id).toContain(coach.levelSpec.breakingScore);
      for (const forbidden of coach.levelSpec.avoidKeywords) {
        expect(prompt, `${coach.id}/${forbidden}`).toContain(forbidden);
      }
    }
  });

  it('says plainly that the answer will be heard, not read', () => {
    const prompt = buildCaddieSystemPrompt(COACH_PROFILES[0], CONTEXT);

    expect(prompt).toContain('heard, not read');
    expect(prompt).toContain('no markdown');
  });

  it('drops the situation entirely when the golfer is not on a hole', () => {
    const prompt = buildCaddieSystemPrompt(COACH_PROFILES[0], {
      playerName: 'Alex',
      skillLabel: 'Beginner',
    });

    expect(prompt).not.toContain('Current situation');
    expect(prompt).toContain('Alex');
  });
});

describe('the manual in the caddie prompt', () => {
  const CONTEXT = { playerName: 'Alex', skillLabel: 'Intermediate' };

  it('always carries the on-course core, and says the manual wins', () => {
    const prompt = buildCaddieSystemPrompt(COACH_PROFILES[1], CONTEXT);
    expect(prompt).toContain(MANUAL_CADDIE_CORE);
    expect(prompt).toContain('use the manual');
  });

  it('adds a passage only when there is one', () => {
    expect(buildCaddieSystemPrompt(COACH_PROFILES[1], CONTEXT, 'PASSAGE')).toContain('PASSAGE');
    expect(buildCaddieSystemPrompt(COACH_PROFILES[1], CONTEXT)).not.toContain('A passage from the manual');
  });
});
