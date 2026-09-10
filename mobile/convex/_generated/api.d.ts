/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as clubs from "../clubs.js";
import type * as devTools from "../devTools.js";
import type * as http from "../http.js";
import type * as launchMonitor from "../launchMonitor.js";
import type * as lib_bag from "../lib/bag.js";
import type * as lib_caddie from "../lib/caddie.js";
import type * as lib_coachLevels from "../lib/coachLevels.js";
import type * as lib_courseIntegrity from "../lib/courseIntegrity.js";
import type * as lib_courses from "../lib/courses.js";
import type * as lib_curriculum from "../lib/curriculum.js";
import type * as lib_handicap from "../lib/handicap.js";
import type * as lib_program from "../lib/program.js";
import type * as lib_shotInsight from "../lib/shotInsight.js";
import type * as lib_streaks from "../lib/streaks.js";
import type * as lib_strokesGained from "../lib/strokesGained.js";
import type * as profiles from "../profiles.js";
import type * as rounds from "../rounds.js";
import type * as sessions from "../sessions.js";
import type * as shots from "../shots.js";
import type * as streaks from "../streaks.js";
import type * as swingVideos from "../swingVideos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  clubs: typeof clubs;
  devTools: typeof devTools;
  http: typeof http;
  launchMonitor: typeof launchMonitor;
  "lib/bag": typeof lib_bag;
  "lib/caddie": typeof lib_caddie;
  "lib/coachLevels": typeof lib_coachLevels;
  "lib/courseIntegrity": typeof lib_courseIntegrity;
  "lib/courses": typeof lib_courses;
  "lib/curriculum": typeof lib_curriculum;
  "lib/handicap": typeof lib_handicap;
  "lib/program": typeof lib_program;
  "lib/shotInsight": typeof lib_shotInsight;
  "lib/streaks": typeof lib_streaks;
  "lib/strokesGained": typeof lib_strokesGained;
  profiles: typeof profiles;
  rounds: typeof rounds;
  sessions: typeof sessions;
  shots: typeof shots;
  streaks: typeof streaks;
  swingVideos: typeof swingVideos;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
