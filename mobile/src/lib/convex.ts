import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!url) {
  throw new Error(
    'EXPO_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` in the mobile/ ' +
      'folder — it creates .env.local with the deployment URL.',
  );
}

/**
 * A failed sign-in is an expected outcome, not a defect — the form already
 * tells the user. Convex logs it via console.error, which React Native's
 * LogBox then throws on screen as a red banner in development.
 *
 * Only `auth:signIn` failures are filtered; everything else still logs, so
 * real problems stay visible.
 */
const isExpectedAuthFailure = (args: unknown[]) =>
  args.some((a) => typeof a === 'string' && a.includes('auth:signIn'));

const filteredLogger = {
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => {
    if (isExpectedAuthFailure(args)) return;
    console.error(...args);
  },
  logVerbose: () => {},
};

export const convex = new ConvexReactClient(url, {
  // React Native has no window to regain focus, so this must be off or the
  // client keeps trying to resync against a lifecycle event that never fires.
  unsavedChangesWarning: false,
  logger: filteredLogger,
});

/**
 * Auth tokens go in the device keychain/keystore, never AsyncStorage.
 * SecureStore has no web implementation, so the web build falls back to
 * the default in-memory store.
 */
export const secureStorage =
  Platform.OS === 'web'
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
