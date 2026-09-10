import { ConvexAuthProvider } from '@convex-dev/auth/react';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { useConvexAuth, useQuery } from 'convex/react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { api } from '@/convex/_generated/api';

import { Colors, GOLD } from '@/constants/theme';
import { convex, secureStorage } from '@/lib/convex';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay: PlayfairDisplay_400Regular,
    PlayfairDisplaySemiBold: PlayfairDisplay_600SemiBold,
    PlayfairDisplayBold: PlayfairDisplay_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider
          value={{
            ...navTheme,
            colors: {
              ...navTheme.colors,
              primary: GOLD,
              background: colors.background,
              card: colors.card,
              text: colors.text,
              border: colors.border,
            },
          }}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator background={colors.background} />
        </ThemeProvider>
      </GestureHandlerRootView>
    </ConvexAuthProvider>
  );
}

/**
 * Splits the tree on auth state. Must live inside ConvexAuthProvider so
 * useConvexAuth can read it.
 */
function RootNavigator({ background }: { background: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Skipped while signed out, so no unauthenticated request is made.
  // Three states: undefined = loading, null = needs onboarding, doc = ready.
  const profile = useQuery(api.profiles.getMyProfile, isAuthenticated ? {} : 'skip');
  const profileLoading = isAuthenticated && profile === undefined;

  const settled = !isLoading && !profileLoading;

  useEffect(() => {
    // Auth resolves asynchronously from SecureStore, and the profile query
    // follows it. Holding the splash until both settle stops a signed-in user
    // seeing the landing screen - or onboarding - for a frame.
    if (settled) void SplashScreen.hideAsync();
  }, [settled]);

  if (!settled) return null;

  const needsOnboarding = isAuthenticated && profile === null;
  const inApp = isAuthenticated && profile != null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: background },
        // Without this the back button inherits the previous route's name and
        // renders the raw group segment - "(tabs)" - as its label.
        headerBackTitle: 'Back',
      }}>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="bag" />
        <Stack.Screen name="handicap" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="streak" />
        <Stack.Screen name="program" />
        <Stack.Screen name="launch" />
        <Stack.Screen name="guide" />
        <Stack.Screen name="round/[id]" />
        <Stack.Screen name="launch/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" options={{ presentation: 'card' }} />
      </Stack.Protected>
    </Stack>
  );
}
