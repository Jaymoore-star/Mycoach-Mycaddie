import Google from '@auth/core/providers/google';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import type { DatabaseWriter } from './_generated/server';

/**
 * Replaces `@usehercules/auth` from the web app.
 *
 * Google requires AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET to be set on the
 * deployment (`npx convex env set ...`). Until they are, the Google button
 * fails while email + password keeps working.
 */

/** How the golfer signed up, in the words the sign-in screen uses. */
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  password: 'an email and password',
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password,
    // Google skips the account chooser when the browser holds one signed-in
    // account that has used the app before, so signing out and back in could
    // never switch accounts. `select_account` makes it ask every time.
    Google({ authorization: { params: { prompt: 'select_account' } } }),
  ],
  callbacks: {
    /**
     * Native apps finish OAuth by deep-linking back into the app rather than
     * to a website, so the default same-origin check has to be widened.
     *
     * Allowed: the app's own `mycoach://` scheme, and the `exp://` URLs Expo
     * Go hands out in development. Anything else is rejected - an open
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

    /**
     * One account per email address, whichever way you sign in.
     *
     * The default behaviour is safe but confusing. It links a new sign-in to an
     * existing user only when that user's email is *verified*, which neither
     * Google-then-password nor password-then-Google satisfies here: the
     * Password provider never marks an email verified, because this app sends
     * no verification mail. So the second method silently created a second
     * account, with its own profile, its own rounds and none of the first
     * one's history. Two golfers, one person, no sign that anything was wrong.
     *
     * Linking them automatically is the tempting fix and it is not safe. If a
     * password account could absorb a Google sign-in, anyone could register
     * `you@gmail.com` with a password before you did and be handed everything
     * you later put in the app - the account pre-hijacking attack the library
     * is refusing to enable. The reverse is worse: a password set on an
     * existing Google account is a permanent key to it.
     *
     * So the second attempt is refused, and told which method to use instead.
     * The golfer gets one account, and the only way into it is the one they
     * created it with. Real linking needs proof the person owns the address -
     * an emailed code - and that is worth doing the day this app sends email.
     */
    async createOrUpdateUser(ctx, args) {
      // Signing back in through a provider this user already has.
      if (args.existingUserId !== null) return args.existingUserId;

      // The callback hands back a ctx typed against a generic data model, so
      // it knows nothing of this app's tables or their indexes. The runtime
      // object is the real one; only the type is widened.
      const db = ctx.db as unknown as DatabaseWriter;

      const { emailVerified, phoneVerified, ...profile } = args.profile;

      // Stored lower-cased so the uniqueness check cannot be walked past with
      // different capitalisation; the address is not case-sensitive in
      // practice, and `Demo@` and `demo@` are the same inbox.
      const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : null;

      if (email !== null) {
        const existing = await db
          .query('users')
          .withIndex('email', (q) => q.eq('email', email))
          .first();

        if (existing !== null) {
          const account = await db
            .query('authAccounts')
            .withIndex('userIdAndProvider', (q) => q.eq('userId', existing._id))
            .first();

          const how = PROVIDER_LABEL[account?.provider ?? ''] ?? 'a different method';
          throw new ConvexError({
            message: `That email already has an account created with ${how}. Sign in that way instead.`,
            code: 'ACCOUNT_EXISTS',
          });
        }
      }

      // An OAuth provider has already established the address is the
      // golfer's; a password signup has established nothing of the sort.
      const verified =
        emailVerified ?? (args.provider.type === 'oauth' || args.provider.type === 'oidc');

      return await db.insert('users', {
        ...profile,
        ...(email !== null ? { email } : null),
        ...(verified ? { emailVerificationTime: Date.now() } : null),
        ...(phoneVerified ? { phoneVerificationTime: Date.now() } : null),
      });
    },
  },
});
