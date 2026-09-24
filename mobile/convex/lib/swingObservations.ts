/** One checkpoint in a swing analysis, as the Swing screen lists them. */
export type SwingObservation = { position: string; detail: string };

/**
 * The positions the analysis reports on: the manual's eight checkpoints, in
 * swing order. The prompt's answer format is built from this list - it was
 * written out by hand once and lost R in PURE, the release, so the Swing
 * screen spelled TOUPURE.
 */
export const CHECKPOINT_LABELS = [
  'T - Address',
  'O - Takeaway',
  "U in TOUR - 9 o'clock",
  'R in TOUR - Top of backswing',
  'P - Transition to the slot',
  'U in PURE - Impact',
  'R in PURE - Release',
  'E - Finish',
] as const;

/** "Not visible", "not visible in these frames", "Cannot be seen" and the like. */
const NOTHING_SEEN = /^(not|cannot be|can't be|could not be|couldn't be)\s+(visible|seen|determined|judged)\b|^n\/a\b/i;

/**
 * The model's observations, made fit to show.
 *
 * Kept to the eight TOUR PURE checkpoints at most. A single "not visible" is
 * worth keeping - impact falling between two frames is something the golfer
 * should know - but a list where nothing at all was visible is not an
 * analysis: it is what comes back for a clip that is not a golf swing, which
 * the summary already says. Showing eight rows of "Not visible" under that
 * reads as a broken screen, so the list is dropped.
 */
export function cleanObservations(raw: unknown): SwingObservation[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const observations = raw
    .filter(
      (o): o is { position?: unknown; detail: string } =>
        typeof o === 'object' && o !== null && typeof o.detail === 'string' && o.detail.trim() !== '',
    )
    .slice(0, 8)
    .map((o) => ({
      position: typeof o.position === 'string' && o.position.trim() ? o.position.trim() : 'Swing',
      detail: o.detail.trim(),
    }));

  if (observations.length === 0) return undefined;
  if (observations.every((o) => NOTHING_SEEN.test(o.detail))) return undefined;
  return observations;
}
