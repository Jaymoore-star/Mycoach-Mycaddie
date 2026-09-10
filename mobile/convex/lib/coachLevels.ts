/**
 * Which coach teaches which skill level.
 *
 * Separate from `src/constants/coaches.ts` because that file carries portrait
 * assets via Metro's `require()`, which only resolves inside the bundler. This
 * mapping is plain data, so the server and the tests can both read it.
 *
 * Each coach's drill set is a single difficulty tier — Que is entirely
 * foundation, Mason development, Sam mastery, Dom elite — so the coach IS the
 * level. `generateSession` deliberately skips difficulty filtering when a
 * coach is set, which means a mismatched pairing silently delivers the wrong
 * drills. Onboarding uses this map to keep them aligned.
 */
import type { SkillLevel } from './curriculum';

export const COACH_IDS = ['que', 'mason', 'sam', 'dom'] as const;

export type CoachId = (typeof COACH_IDS)[number];

/** Ordered easiest to hardest, matching the level each coach teaches. */
export const COACH_FOR_SKILL: Record<SkillLevel, CoachId> = {
  beginner: 'que',
  intermediate: 'mason',
  advanced: 'sam',
  // Scratch sits in both Sam's and Dom's stated ranges. Dom's benchmark is
  // "scratch and under" while Sam's is "breaking 80", so scratch goes to Dom.
  scratch: 'dom',
  tour_pro: 'dom',
};

export const DEFAULT_COACH_ID: CoachId = 'que';
