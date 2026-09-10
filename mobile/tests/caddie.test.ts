import { describe, expect, it } from 'vitest';

import {
  CLUB_DISTANCES,
  type CaddieConditions,
  type TendencyProfile,
  buildCaddieRecommendation,
  extractTendencies,
} from '../convex/lib/caddie';
import type { SkillLevel } from '../convex/lib/curriculum';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'scratch', 'tour_pro'];
const LIES: CaddieConditions['lie'][] = [
  'tee',
  'fairway',
  'rough',
  'bunker',
  'hardpan',
  'downslope',
  'upslope',
  'sidehill',
];
const WINDS: CaddieConditions['windDirection'][] = [
  'none',
  'headwind',
  'tailwind',
  'crosswind_left',
  'crosswind_right',
];

const NO_TENDENCIES: TendencyProfile = {
  dominantMiss: null,
  avgMissYards: 0,
  favoriteShape: null,
  commonClubs: [],
  weaknesses: [],
};

const BASE: CaddieConditions = {
  distanceToPin: 150,
  elevation: 0,
  windSpeedMph: 0,
  windDirection: 'none',
  lie: 'fairway',
  pinPosition: 'middle',
  greenFirmness: 'medium',
  temperature: 70,
  altitude: 0,
};

/** Playing yardage under a variation of the baseline conditions. */
const playsAs = (overrides: Partial<CaddieConditions>) =>
  buildCaddieRecommendation('Jeet', 'intermediate', NO_TENDENCIES, {
    ...BASE,
    ...overrides,
  }).adjustedYardage;

describe('yardage adjustments point the right way', () => {
  // Elevation and pin position were inverted in the version this was ported
  // from: it clubbed down for an uphill shot, so a 20-yard elevation change
  // produced a 40-yard error. These are the regression guards.
  it('plays an uphill shot longer', () => {
    expect(playsAs({ elevation: 20 })).toBeGreaterThan(playsAs({}));
  });

  it('plays a downhill shot shorter', () => {
    expect(playsAs({ elevation: -20 })).toBeLessThan(playsAs({}));
  });

  it('plays a back pin longer and a front pin shorter', () => {
    expect(playsAs({ pinPosition: 'back' })).toBeGreaterThan(playsAs({}));
    expect(playsAs({ pinPosition: 'front' })).toBeLessThan(playsAs({}));
  });

  it('plays a firm green shorter and a soft green longer', () => {
    expect(playsAs({ greenFirmness: 'firm' })).toBeLessThan(playsAs({}));
    expect(playsAs({ greenFirmness: 'soft' })).toBeGreaterThan(playsAs({}));
  });

  it('plays into wind longer and downwind shorter', () => {
    expect(playsAs({ windSpeedMph: 20, windDirection: 'headwind' })).toBeGreaterThan(playsAs({}));
    expect(playsAs({ windSpeedMph: 20, windDirection: 'tailwind' })).toBeLessThan(playsAs({}));
  });

  it('adjusts more for stronger wind', () => {
    expect(playsAs({ windSpeedMph: 30, windDirection: 'headwind' })).toBeGreaterThan(
      playsAs({ windSpeedMph: 10, windDirection: 'headwind' }),
    );
  });

  it('plays longer out of rough and sand', () => {
    expect(playsAs({ lie: 'rough' })).toBeGreaterThan(playsAs({}));
    expect(playsAs({ lie: 'bunker' })).toBeGreaterThan(playsAs({}));
  });

  it('plays longer in cold air and shorter at altitude', () => {
    expect(playsAs({ temperature: 40 })).toBeGreaterThan(playsAs({}));
    expect(playsAs({ altitude: 5280 })).toBeLessThan(playsAs({}));
  });
});

describe('buildCaddieRecommendation holds up across conditions', () => {
  it('returns a complete, usable recommendation for every combination', () => {
    let runs = 0;

    for (const skillLevel of LEVELS) {
      for (const lie of LIES) {
        for (const windDirection of WINDS) {
          for (const distanceToPin of [8, 95, 150, 400, 650]) {
            for (const elevation of [-40, 0, 40]) {
              runs++;
              const r = buildCaddieRecommendation('Jeet', skillLevel, NO_TENDENCIES, {
                ...BASE,
                lie,
                windDirection,
                windSpeedMph: windDirection === 'none' ? 0 : 18,
                distanceToPin,
                elevation,
              });

              expect(r.primaryClub).toBeTruthy();
              // The engine floors playing yardage at 10 rather than returning
              // a negative number for a downhill shot from close range.
              expect(r.adjustedYardage).toBeGreaterThanOrEqual(10);
              expect(r.rawYardage).toBe(distanceToPin);
              expect(r.aimAdjustment).toBeTruthy();
              expect(r.landingTarget).toBeTruthy();
              expect(r.greenReading).toBeTruthy();
              expect(r.caddieQuip).toBeTruthy();
              expect(r.courseManagementNote).toBeTruthy();
              // An alternate identical to the primary is not an alternative.
              expect(r.alternateClub).not.toBe(r.primaryClub);
              // Never recommend a club the golfer's chart doesn't contain.
              expect(CLUB_DISTANCES[skillLevel]).toHaveProperty(r.primaryClub);
            }
          }
        }
      }
    }

    expect(runs).toBe(LEVELS.length * LIES.length * WINDS.length * 5 * 3);
  });
});

describe('extractTendencies', () => {
  it('finds the dominant miss and favourite shape', () => {
    const t = extractTendencies([
      { club: '7-Iron', missDirection: 'left', distanceFromTargetYards: 12, shotShape: 'draw' },
      { club: '7-Iron', missDirection: 'left', distanceFromTargetYards: 9, shotShape: 'draw' },
      { club: 'Driver', missDirection: 'right', distanceFromTargetYards: 25, shotShape: 'slice' },
    ]);

    expect(t.dominantMiss).toBe('left');
    expect(t.favoriteShape).toBe('draw');
    expect(t.commonClubs).toContain('7-Iron');
    expect(t.avgMissYards).toBeGreaterThan(0);
  });

  it('reports nothing from an empty history rather than throwing', () => {
    const t = extractTendencies([]);
    expect(t.dominantMiss).toBeNull();
    expect(t.commonClubs).toEqual([]);
  });
});
