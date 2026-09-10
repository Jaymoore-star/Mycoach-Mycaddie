import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Web build only. Static rendering has no colour scheme, so the value has to
 * be recalculated once the client hydrates.
 *
 * Uses useSyncExternalStore rather than setState-in-an-effect: React swaps
 * from the server snapshot to the client one as part of hydration, so there
 * is no extra render pass and no cascading update.
 */

/** Nothing to subscribe to — hydration happens exactly once. */
const subscribe = () => () => {};

export function useColorScheme() {
  const colorScheme = useRNColorScheme();

  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true, // client
    () => false, // server / static render
  );

  return hasHydrated ? colorScheme : 'light';
}
