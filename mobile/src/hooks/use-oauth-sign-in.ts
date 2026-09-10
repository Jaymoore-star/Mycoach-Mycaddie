import { useAuthActions } from '@convex-dev/auth/react';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';

// Required on Android so the auth session dismisses cleanly on return.
WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth sign-in for native.
 *
 * On the web Convex Auth completes the flow itself. On native it hands back a
 * URL, we open it in the system auth browser, and the provider deep-links back
 * with a `code` that we exchange in a second `signIn` call.
 */
export function useOAuthSignIn(provider: string) {
  const { signIn } = useAuthActions();
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setInProgress(true);
    try {
      const redirectTo = makeRedirectUri();

      const { redirect } = await signIn(provider, { redirectTo });
      if (!redirect) {
        // No redirect means the provider isn't configured on the deployment.
        throw new Error('Provider not configured');
      }

      const result = await WebBrowser.openAuthSessionAsync(redirect.toString(), redirectTo);
      if (result.type !== 'success') {
        // User dismissed the browser - not an error worth surfacing.
        return;
      }

      // Linking.parse rather than `new URL`: Hermes' URL has no searchParams.
      const code = Linking.parse(result.url).queryParams?.code;
      if (typeof code !== 'string') {
        throw new Error('No authorization code returned');
      }

      await signIn(provider, { code });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setInProgress(false);
    }
  }, [provider, signIn]);

  return { start, inProgress, error };
}
