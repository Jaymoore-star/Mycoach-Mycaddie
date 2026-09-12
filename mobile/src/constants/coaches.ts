// My Coach / My Caddie - Coach roster
//
// The roster itself is plain data in `convex/lib/coachPersona.ts` so the
// server can build the chat prompt from the same source. This file adds the
// one thing the server cannot have: the portrait, which Metro resolves at
// bundle time through `require()`.

import type { CoachId } from "@/convex/lib/coachLevels";
import {
  COACH_PROFILES,
  type CoachProfile,
  type TtsVoice,
} from "@/convex/lib/coachPersona";

export type { CoachId, TtsVoice };
export type { CoachLevelSpec } from "@/convex/lib/coachPersona";

export type Coach = CoachProfile & {
  /** Local portrait asset (require()d image module). */
  image: number;
};

// Static require() per id - Metro cannot resolve a computed path.
const PORTRAITS: Record<CoachId, number> = {
  que: require('@/assets/images/coaches/que.jpg'),
  mason: require('@/assets/images/coaches/mason.jpg'),
  sam: require('@/assets/images/coaches/sam.jpg'),
  dom: require('@/assets/images/coaches/dom.jpg'),
};

export const COACHES: Coach[] = COACH_PROFILES.map((coach) => ({
  ...coach,
  image: PORTRAITS[coach.id],
}));

// Level mapping and ids live in convex/lib/coachLevels.ts so the server
// and tests can read them without Metro resolving the portrait assets.
export { COACH_FOR_SKILL, DEFAULT_COACH_ID } from "@/convex/lib/coachLevels";

export function getCoachById(id: string | undefined): Coach {
  return COACHES.find((c) => c.id === id) ?? COACHES[0];
}
