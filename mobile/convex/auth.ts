import Google from '@auth/core/providers/google';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

/**
 * Replaces `@usehercules/auth` from the web app.
 *
 * Google requires AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET to be set on the
 * deployment (`npx convex env set ...`). Until they are, the Google button
 * fails while email + password keeps working.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Google],
  callbacks: {
    /**
     * Native apps finish OAuth by deep-linking back into the app rather than
     * to a website, so the default same-origin check has to be widened.
     *
     * Allowed: the app's own `mycoach://` scheme, and the `exp://` URLs Expo
     * Go hands out in development. Anything else is rejected — an open
     * redirect here would let a crafted link steal the auth code.
     */
    async redirect({ redirectTo }) {
      if (redirectTo.startsWith('mycoach://') || redirectTo.startsWith('exp://')) {
        return redirectTo;
      }
      const siteUrl = process.env.SITE_URL;
      if (siteUrl && redirectTo.startsWith(siteUrl)) {
        return redirectTo;
      }
      throw new Error(`Invalid redirectTo: ${redirectTo}`);
    },
  },
});
