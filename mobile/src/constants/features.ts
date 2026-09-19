/**
 * Build-time feature switches.
 *
 * `EXPO_PUBLIC_*` variables are inlined by Metro when the bundle is built, so
 * these are constants in the shipped app rather than runtime lookups - which
 * is the point: a switch that decides whether a screen offers a sign-in method
 * should be settled before the APK exists, not negotiated on a cold start.
 *
 * Set them per build profile in `eas.json`.
 */

/**
 * Whether the sign-in screen offers "Continue with Google".
 *
 * On everywhere. The switch exists because it briefly looked as though it
 * would have to be off: the consent app is in Testing, and Testing is widely
 * described as restricting sign-in to accounts on the test-user list, which
 * would have meant an investor tapping the button and being stopped by Google.
 * Tested on a device with an account that was not on the list, and it signed in
 * fine - that restriction goes with *sensitive or restricted* scopes, and this
 * app asks only for `openid`, `email` and `profile`, all non-sensitive. Google
 * counts such users in the "other" bucket of the 100-user cap on the Audience
 * page.
 *
 * So the button stays. What is still true of Testing: the cap is 100 accounts
 * for the lifetime of the app, and Google's refresh grant expires after 7 days
 * - which ends the *Google* grant, not the app session, because Convex Auth
 * issues its own JWT once the code is exchanged. Neither binds a demo.
 *
 * Set `EXPO_PUBLIC_GOOGLE_SIGN_IN=off` in a build profile to hide it again.
 * Worth knowing if you do: Metro's transform cache ignores environment
 * variables, so a local build needs `--clear` or it will silently reuse the
 * previous value.
 */
export const GOOGLE_SIGN_IN_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN !== 'off';
