import { describe, expect, it } from 'vitest';

import {
  MAX_HANDICAP_INDEX,
  contributingRounds,
  handicapIndex,
  handicapTrend,
  scoreDifferential,
  scoresToUse,
} from '../convex/lib/handicap';

/**
 * The authoritative table from Rule 5.2a of the Rules of Handicapping.
 * The implementation this replaced disagreed with it for every record size
 * from 10 to 19 scores, so it is asserted entry by entry.
 */
const RULE_5_2A: Record<number, { count: number; adjustment: number }> = {
  3: { count: 1, adjustment: -2.0 },
  4: { count: 1, adjustment: -1.0 },
  5: { count: 1, adjustment: 0 },
  6: { count: 2, adjustment: -1.0 },
  7: { count: 2, adjustment: 0 },
  8: { count: 2, adjustment: 0 },
  9: { count: 3, adjustment: 0 },
  10: { count: 3, adjustment: 0 },
  11: { count: 3, adjustment: 0 },
  12: { count: 4, adjustment: 0 },
  13: { count: 4, adjustment: 0 },
  14: { count: 4, adjustment: 0 },
  15: { count: 5, adjustment: 0 },
  16: { count: 5, adjustment: 0 },
  17: { count: 6, adjustment: 0 },
  18: { count: 6, adjustment: 0 },
  19: { count: 7, adjustment: 0 },
  20: { count: 8, adjustment: 0 },
};

const TWENTY = [
  14.2, 26.1, 18.5, 21.0, 16.4, 23.8, 19.9, 15.1, 24.6, 17.7, 20.3, 22.9, 13.8, 25.4, 18.1,
  19.2, 21.6, 16.8, 23.1, 20.8,
];

describe('scoresToUse', () => {
  for (const [n, expected] of Object.entries(RULE_5_2A)) {
    it(`matches Rule 5.2a at ${n} scores`, () => {
      expect(scoresToUse(Number(n))).toEqual(expected);
    });
  }

  it('uses nothing below three scores', () => {
    expect(scoresToUse(0).count).toBe(0);
    expect(scoresToUse(2).count).toBe(0);
  });

  it('caps at the best 8 beyond 20 scores', () => {
    expect(scoresToUse(25)).toEqual({ count: 8, adjustment: 0 });
  });
});

describe('scoreDifferential', () => {
  it('is (gross - rating) x 113 / slope', () => {
    expect(scoreDifferential(85, 72.0, 113)).toBe(13.0);
    expect(scoreDifferential(90, 74.2, 140)).toBe(12.8);
  });

  it('can be negative for a round better than the rating', () => {
    expect(scoreDifferential(70, 74.2, 140)).toBeLessThan(0);
  });

  it('rejects a non-positive slope rather than dividing by zero', () => {
    expect(() => scoreDifferential(85, 72, 0)).toThrow();
  });
});

describe('handicapIndex', () => {
  it('issues no index below three scores', () => {
    expect(handicapIndex([])).toBeNull();
    expect(handicapIndex([10])).toBeNull();
    expect(handicapIndex([10, 12])).toBeNull();
  });

  it('applies the -2.0 adjustment at three scores', () => {
    expect(handicapIndex([15.0, 12.0, 18.0])).toBe(10.0);
  });

  it('applies the -1.0 adjustment at four scores', () => {
    expect(handicapIndex([15.0, 12.0, 18.0, 20.0])).toBe(11.0);
  });

  it('applies no adjustment at five scores', () => {
    expect(handicapIndex([15, 12, 18, 20, 22])).toBe(12.0);
  });

  it('averages the lowest two and subtracts 1.0 at six scores', () => {
    // lowest two are 12 and 15 -> 13.5, minus 1.0
    expect(handicapIndex([15, 12, 18, 20, 22, 25])).toBe(12.5);
  });

  it('averages the lowest eight at twenty scores', () => {
    const lowest8 = [...TWENTY].sort((a, b) => a - b).slice(0, 8);
    const expected = Math.round((lowest8.reduce((s, d) => s + d, 0) / 8) * 10) / 10;
    expect(handicapIndex(TWENTY)).toBe(expected);
  });

  it('does not apply the retired 0.96 bonus for excellence', () => {
    // A straight average of five identical 20.0s is 20.0.
    // The pre-2020 USGA multiplier would have produced 19.2.
    expect(handicapIndex([20, 20, 20, 20, 20])).toBe(20.0);
  });

  it('ignores scores beyond the most recent twenty', () => {
    const withOlder = [...TWENTY, 99, 99, 99, 99, 99];
    expect(handicapIndex(withOlder)).toBe(handicapIndex(TWENTY));
  });

  it('caps at 54.0', () => {
    expect(handicapIndex([80, 80, 80, 80, 80])).toBe(MAX_HANDICAP_INDEX);
  });

  it('allows a plus handicap', () => {
    // Three scores of 1.0 with the -2.0 adjustment is a plus handicap.
    expect(handicapIndex([1.0, 1.0, 1.0])).toBeLessThan(0);
  });

  it('rounds to one decimal place', () => {
    const index = handicapIndex([12.34, 15.0, 18.0, 20.0, 22.0]);
    expect(index).not.toBeNull();
    expect(index).toBe(Math.round(index! * 10) / 10);
  });
});

describe('handicapTrend', () => {
  const rounds = TWENTY.map((differential, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    courseName: `Course ${i}`,
    grossScore: 80 + i,
    differential,
  }));

  it('ends on the same value as the headline index', () => {
    const trend = handicapTrend(rounds);
    expect(trend.at(-1)?.index).toBe(handicapIndex(rounds.map((r) => r.differential)));
  });

  it('skips the rounds before an index can be issued', () => {
    expect(handicapTrend(rounds)).toHaveLength(rounds.length - 2);
  });

  it('is empty when there is no index yet', () => {
    expect(handicapTrend(rounds.slice(0, 2))).toHaveLength(0);
  });
});

describe('contributingRounds', () => {
  it('marks exactly as many rounds as the index averaged', () => {
    const rounds = TWENTY.map((differential, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      courseName: `Course ${i}`,
      grossScore: 80 + i,
      differential,
    }));
    const marked = contributingRounds(rounds).filter((r) => r.contributing);
    expect(marked).toHaveLength(scoresToUse(20).count);
  });

  it('marks the lowest differential', () => {
    const rounds = [
      { date: '2026-01-02', courseName: 'B', grossScore: 95, differential: 25 },
      { date: '2026-01-01', courseName: 'A', grossScore: 80, differential: 10 },
      { date: '2026-01-03', courseName: 'C', grossScore: 88, differential: 18 },
    ];
    const marked = contributingRounds(rounds).filter((r) => r.contributing);
    expect(marked).toHaveLength(1);
    expect(marked[0].differential).toBe(10);
  });

  it('does not mark both of two rounds sharing a date and course', () => {
    // The original keyed contribution on date + courseName, so a second round
    // at the same course on the same day was wrongly marked too.
    const rounds = [
      { date: '2026-01-01', courseName: 'X', grossScore: 80, differential: 10 },
      { date: '2026-01-01', courseName: 'X', grossScore: 95, differential: 25 },
      { date: '2026-01-02', courseName: 'Y', grossScore: 88, differential: 18 },
    ];
    expect(contributingRounds(rounds).filter((r) => r.contributing)).toHaveLength(1);
  });
});
