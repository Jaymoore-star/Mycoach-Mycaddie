import { describe, expect, it } from 'vitest';

import { dayGap, summarizeStreak, toDateOnly } from '../convex/lib/streaks';

describe('toDateOnly', () => {
  it('strips a timestamp to its date', () => {
    // roundScores.date is a full ISO timestamp while trainingSessions.date is
    // already a plain date. The version this replaced pooled both raw, so
    // round days never matched session days.
    expect(toDateOnly('2026-09-06T02:19:36.044Z')).toBe('2026-09-06');
  });

  it('passes a plain date through unchanged', () => {
    expect(toDateOnly('2026-09-06')).toBe('2026-09-06');
  });
});

describe('dayGap', () => {
  it('counts whole days', () => {
    expect(dayGap('2026-09-01', '2026-09-02')).toBe(1);
    expect(dayGap('2026-09-01', '2026-09-08')).toBe(7);
    expect(dayGap('2026-09-02', '2026-09-01')).toBe(-1);
    expect(dayGap('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    expect(dayGap('2026-01-31', '2026-02-01')).toBe(1);
    expect(dayGap('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('handles a leap day', () => {
    expect(dayGap('2028-02-28', '2028-02-29')).toBe(1);
    expect(dayGap('2028-02-29', '2028-03-01')).toBe(1);
  });
});

describe('summarizeStreak', () => {
  it('reports nothing for an empty record', () => {
    const s = summarizeStreak([], '2026-09-10');
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.totalActiveDays).toBe(0);
    expect(s.streakStartDate).toBeNull();
  });

  it('counts a run ending today', () => {
    const s = summarizeStreak(['2026-09-08', '2026-09-09', '2026-09-10'], '2026-09-10');
    expect(s.currentStreak).toBe(3);
    expect(s.streakStartDate).toBe('2026-09-08');
  });

  it('keeps a streak alive when the last day was yesterday', () => {
    // Mid-streak and simply hasn't practised yet today.
    const s = summarizeStreak(['2026-09-08', '2026-09-09'], '2026-09-10');
    expect(s.currentStreak).toBe(2);
  });

  it('breaks a streak after a missed day', () => {
    const s = summarizeStreak(['2026-09-05', '2026-09-06'], '2026-09-10');
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(2);
  });

  it('finds the longest historical run', () => {
    const s = summarizeStreak(
      ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-09-09', '2026-09-10'],
      '2026-09-10',
    );
    expect(s.longestStreak).toBe(4);
    expect(s.currentStreak).toBe(2);
  });

  it('deduplicates several activities on one day', () => {
    // Two sessions plus a round on the same date is still one active day.
    const s = summarizeStreak(
      ['2026-09-10', '2026-09-10', '2026-09-10T14:30:00.000Z'],
      '2026-09-10',
    );
    expect(s.totalActiveDays).toBe(1);
    expect(s.currentStreak).toBe(1);
  });

  it('mixes plain dates and timestamps into one streak', () => {
    const s = summarizeStreak(
      ['2026-09-08', '2026-09-09T22:15:00.000Z', '2026-09-10'],
      '2026-09-10',
    );
    expect(s.currentStreak).toBe(3);
  });

  it('counts the current week from Monday', () => {
    // 2026-09-10 is a Thursday; that week starts Monday the 7th.
    const s = summarizeStreak(
      ['2026-09-06', '2026-09-07', '2026-09-09', '2026-09-10'],
      '2026-09-10',
    );
    expect(s.weekStartDate).toBe('2026-09-07');
    // Sunday the 6th is the previous week.
    expect(s.thisWeekCount).toBe(3);
  });

  it('treats Sunday as the end of its week, not the start', () => {
    // 2026-09-13 is a Sunday; its week began Monday the 7th.
    const s = summarizeStreak(['2026-09-13'], '2026-09-13');
    expect(s.weekStartDate).toBe('2026-09-07');
    expect(s.thisWeekCount).toBe(1);
  });

  it('excludes future dates from the week count', () => {
    const s = summarizeStreak(['2026-09-10', '2026-09-12'], '2026-09-10');
    expect(s.thisWeekCount).toBe(1);
  });

  it('returns active dates sorted and unique', () => {
    const s = summarizeStreak(['2026-09-10', '2026-09-08', '2026-09-08'], '2026-09-10');
    expect(s.activeDates).toEqual(['2026-09-08', '2026-09-10']);
  });

  it('handles a single active day', () => {
    const s = summarizeStreak(['2026-09-10'], '2026-09-10');
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(1);
  });

  it('counts a streak that runs across a month boundary', () => {
    const s = summarizeStreak(
      ['2026-08-30', '2026-08-31', '2026-09-01'],
      '2026-09-01',
    );
    expect(s.currentStreak).toBe(3);
  });
});
