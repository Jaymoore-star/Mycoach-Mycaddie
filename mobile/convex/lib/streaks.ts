/**
 * Practice-streak arithmetic over a set of active dates.
 *
 * Pure so it can be unit tested and shared. Every date here is a local
 * `YYYY-MM-DD` string — never a timestamp. The version this replaced pooled
 * `trainingSessions.date` (already YYYY-MM-DD) with `roundScores.date` (a full
 * ISO timestamp), so round days never matched session days and the day
 * differences came out fractional, silently breaking every streak.
 */

/** Strips a timestamp down to its date, and passes a plain date through. */
export function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

const DAY_MS = 86_400_000;

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Both must be YYYY-MM-DD. */
export function dayGap(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
}

export type StreakSummary = {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  thisWeekCount: number;
  activeDates: string[];
  streakStartDate: string | null;
  /** Monday of the week containing `today`, for the UI to label the week. */
  weekStartDate: string;
};

/**
 * Streak summary from raw active dates.
 *
 * `today` is the golfer's local date, supplied by the client — Convex runs in
 * UTC and cannot know their timezone.
 *
 * A streak stays alive if the last active day was today or yesterday: a golfer
 * mid-streak who hasn't practised yet today hasn't broken it.
 */
export function summarizeStreak(rawDates: string[], today: string): StreakSummary {
  const activeDates = [...new Set(rawDates.map(toDateOnly))].sort();

  const yesterday = shiftDate(today, -1);

  // Monday-start week. getUTCDay() is 0 for Sunday, so Sunday sits at the end.
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStartDate = shiftDate(today, weekday === 0 ? -6 : 1 - weekday);

  const thisWeekCount = activeDates.filter((d) => d >= weekStartDate && d <= today).length;

  if (activeDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      thisWeekCount: 0,
      activeDates: [],
      streakStartDate: null,
      weekStartDate,
    };
  }

  // Longest run of consecutive days anywhere in the record.
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < activeDates.length; i++) {
    if (dayGap(activeDates[i - 1], activeDates[i]) === 1) {
      run++;
    } else {
      longestStreak = Math.max(longestStreak, run);
      run = 1;
    }
  }
  longestStreak = Math.max(longestStreak, run);

  // Current streak, walking back from the most recent active day.
  let currentStreak = 0;
  let streakStartDate: string | null = null;

  const lastActive = activeDates[activeDates.length - 1];
  if (lastActive === today || lastActive === yesterday) {
    currentStreak = 1;
    streakStartDate = lastActive;

    for (let i = activeDates.length - 2; i >= 0; i--) {
      if (dayGap(activeDates[i], streakStartDate) === 1) {
        currentStreak++;
        streakStartDate = activeDates[i];
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: activeDates.length,
    thisWeekCount,
    activeDates,
    streakStartDate,
    weekStartDate,
  };
}
