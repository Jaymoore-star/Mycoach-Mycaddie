import { useQuery } from 'convex/react';
import { Tabs } from 'expo-router';
import { Briefcase, GraduationCap, LayoutDashboard, UserCircle2, Video } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';

import { CoachBubble } from '@/components/coach-bubble';
import { Colors, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Five primary tabs, matching MOBILE_NAV in the web app's AppLayout.
 * The other eight screens (Stats, Bag, Handicap, Analytics, Streak,
 * Program, Launch Monitor, Guide) are reached from Profile.
 */
export const unstable_settings = { initialRouteName: 'dashboard' };

export default function TabsLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  // Read here rather than in the bubble so all five tabs share one query
  // subscription instead of opening their own.
  const profile = useQuery(api.profiles.getMyProfile, {});

  return (
    // The bubble is a sibling of the whole tab navigator, so it persists
    // across all five tabs instead of being pasted into each screen. It sits
    // after <Tabs> so it paints above the tab bar.
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: {
            fontSize: FontSize.xs,
            fontWeight: '500',
          },
        }}>
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: 'My Coach',
            tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="caddie"
          options={{
            title: 'My Caddie',
            tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="swing"
          options={{
            title: 'My Swing',
            tabBarIcon: ({ color, size }) => <Video color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <UserCircle2 color={color} size={size} />,
          }}
        />
      </Tabs>
      <CoachBubble coachId={profile?.coachId} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
