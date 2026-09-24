/**
 * Where the privacy policy lives.
 *
 * Served by the Convex deployment itself (`convex/http.ts`), so every build
 * links to the policy of the backend it talks to. The same URL goes in the
 * Play Console listing; if the company later hosts the policy on its own
 * site, change this line and that entry together.
 */
const site = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;

export const PRIVACY_POLICY_URL = site ? `${site}/privacy` : null;
