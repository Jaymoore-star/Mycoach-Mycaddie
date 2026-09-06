import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import {
  BarChart2,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Flame,
  LineChart,
  LogOut,
  Radio,
  Target,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The eight screens that don't get a bottom-tab slot. */
const LINKS = [
  { href: '/stats', label: 'My Stats', icon: BarChart2 },
  { href: '/bag', label: 'My Bag', icon: Briefcase },
  { href: '/handicap', label: 'My Handicap', icon: Target },
  { href: '/analytics', label: 'My Analytics', icon: LineChart },
  { href: '/streak', label: 'My Streak', icon: Flame },
  { href: '/program', label: '90-Day Program', icon: CalendarDays },
  { href: '/launch', label: 'Launch Monitor', icon: Radio },
  { href: '/guide', label: 'How to Use', icon: BookOpen },
] as const;

export default function ProfileScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { signOut } = useAuthActions();

  return (
    <Screen eyebrow="Account" title="Profile">
      <View style={styles.list}>
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Card key={href} onPress={() => router.push(href)} style={styles.row}>
            <Icon size={20} color={colors.primary} />
            <ThemedText variant="body" style={styles.rowLabel}>
              {label}
            </ThemedText>
            <ChevronRight size={18} color={colors.textMuted} />
          </Card>
        ))}
      </View>

      <Button
        label="Sign Out"
        variant="secondary"
        icon={<LogOut size={18} color={colors.text} />}
        onPress={() => void signOut()}
        style={styles.signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowLabel: { flex: 1 },
  signOut: { marginTop: Spacing.six },
});
