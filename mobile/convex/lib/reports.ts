/**
 * The report key for a swing analysis.
 *
 * Keyed to the analysis, not just the video: re-analysing a clip writes new
 * advice, and that is a different thing to report. Shared by the server,
 * which stores it, and the Swing screen, which checks it to show "Reported".
 */
export function swingAnalysisTarget(videoId: string, analyzedAt: string): string {
  return `${videoId}:${analyzedAt}`;
}
