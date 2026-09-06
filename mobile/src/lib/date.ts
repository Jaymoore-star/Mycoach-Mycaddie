/**
 * The golfer's local calendar date as YYYY-MM-DD.
 *
 * Deliberately not `toISOString().split('T')[0]` — that is always UTC, so a
 * session practised at 9pm in New York (or 2am in Mumbai) would be filed under
 * the wrong day and corrupt streaks and 30-day stats. Convex functions run in
 * UTC and cannot know the device's timezone, so the client sends this along.
 */
export function localDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Human-readable date for screen headers, e.g. "Saturday, 5 September". */
export function displayDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Whole days between two YYYY-MM-DD strings. Negative if `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
