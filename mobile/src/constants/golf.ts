import { PHASES, PHASE_ORDER, type Phase } from '@/convex/lib/curriculum';

/**
 * Golf domain constants, ported from the web app.
 * These mirror the union types in the Convex schema - keep them in sync.
 */

// Phase identifiers and metadata come from the curriculum, which the server
// also uses - one definition, no drift.
export { PHASES, PHASE_ORDER, type Phase } from '@/convex/lib/curriculum';

// Derived from the curriculum so the label can never differ between screens.
// The two used to disagree: "Hybrids & Woods" here vs "Hybrids & Fairway
// Woods" in the curriculum, so Home and Program showed different names.
export const PHASE_LABELS: Record<Phase, string> = Object.fromEntries(
  PHASE_ORDER.map((p) => [p, PHASES[p].label]),
) as Record<Phase, string>;

/** Shown on the marketing screen and phase cards. */
export const PHASE_BLURBS: Record<Phase, string> = {
  putting: 'Master the flat stick - 40% of all strokes',
  short_game: 'Up-and-down from anywhere inside 50 yards',
  pitching: 'Dial in your wedges to a yardage',
  mid_irons: 'Find the green from 130–180',
  hybrids_woods: 'Long approach and par-5 second shots',
  driver: 'Tee-shot speed with fairway control',
};

export const SKILL_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'scratch',
  'tour_pro',
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  scratch: 'Scratch',
  tour_pro: 'Tour Pro',
};

/** Onboarding skill picker - handicap band and blurb per level. */
export const SKILL_OPTIONS: {
  value: SkillLevel;
  label: string;
  handicap: string;
  description: string;
}[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    handicap: '30+',
    description: "New to golf or just getting started. We'll build from the ground up.",
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    handicap: '15–29',
    description: 'You understand the basics and are working on consistency.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    handicap: '5–14',
    description: 'You play regularly and want to break 80 consistently.',
  },
  {
    value: 'scratch',
    label: 'Scratch',
    handicap: '0–4',
    description: "You're near scratch and want to sharpen every aspect.",
  },
  {
    value: 'tour_pro',
    label: 'Tour Pro',
    handicap: '+3 to 0',
    description: 'Elite-level training with tour-standard precision thresholds.',
  },
];

export const COACHES = [
  { id: 'que', name: 'Que' },
  { id: 'mason', name: 'Mason' },
  { id: 'sam', name: 'Sam' },
  { id: 'dom', name: 'Dom' },
] as const;

export type CoachId = (typeof COACHES)[number]['id'];

// Re-exported so screens have one import site, but defined once in
// convex/lib/program.ts alongside the phase boundaries the server uses.
export { PROGRAM_DAYS } from '@/convex/lib/program';
export const DEFAULT_TARGET_SCORE = 80;

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
