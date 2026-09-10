/**
 * Club names in bag order, longest to shortest.
 *
 * Lives in `lib/` rather than `clubs.ts` because the client imports it. Convex
 * function modules pull in `@convex-dev/auth/server`, which depends on `jose`
 * and `node:buffer` - Metro cannot resolve that, so importing one from React
 * Native breaks the bundle. Only `convex/lib/*` and `_generated/api` are safe
 * to import from app code.
 */
export const BAG_ORDER = [
  'Driver',
  '3-Wood',
  '5-Wood',
  'Hybrid',
  '4-Iron',
  '5-Iron',
  '6-Iron',
  '7-Iron',
  '8-Iron',
  '9-Iron',
  'PW',
  'GW',
  'SW',
  'LW',
  'Putter',
] as const;

export type ClubName = (typeof BAG_ORDER)[number];
