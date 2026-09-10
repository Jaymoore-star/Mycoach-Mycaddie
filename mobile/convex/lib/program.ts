/**
 * The 90-day program's shape: phase boundaries and length.
 *
 * Single source of truth. These were previously duplicated in
 * `convex/profiles.ts` and `src/app/program.tsx`; if the copies had drifted,
 * the server would have advanced a golfer into a different phase than the
 * screen displayed.
 *
 * Lives in `lib/` because the client imports it - see convex/lib/bag.ts for
 * why client code must never import a Convex function module.
 */
import { PHASE_ORDER, type Phase } from './curriculum';

/** 6 phases x 15 days. */
export const PHASE_DAY_START: Record<Phase, number> = {
  putting: 1,
  short_game: 16,
  pitching: 31,
  mid_irons: 46,
  hybrids_woods: 61,
  driver: 76,
};

export const PROGRAM_DAYS = 90;

/** Which phase a given program day falls in. */
export function getPhaseForDay(day: number): Phase {
  let phase = PHASE_ORDER[0];
  for (const p of PHASE_ORDER) {
    if (day >= PHASE_DAY_START[p]) phase = p;
  }
  return phase;
}

/** 1-based day within the current phase. */
export function getDayInPhase(day: number, phase: Phase): number {
  return day - PHASE_DAY_START[phase] + 1;
}
