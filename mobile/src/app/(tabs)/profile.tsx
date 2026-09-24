import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import {
  BarChart2,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Flame,
  GraduationCap,
  LineChart,
  LogOut,
  Shield,
  Radio,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { PRIVACY_POLICY_URL } from '@/constants/legal';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';

/** The secondary screens that don't get a bottom-tab slot. */
const LINKS = [
  // Changing coach changes which drills the program generates, so it is a
  // settings decision rather than something to tap past on the My Coach tab.
  { href: '/coach-select', label: 'Change Coach', icon: GraduationCap },
  { href: '/stats', label: 'My Stats', icon: BarChart2 },
  { href: '/bag', label: 'My Bag', icon: Briefcase },
  { href: '/handicap', label: 'My Handicap', icon: Target },
  { href: '/analytics', label: 'My Analytics', icon: LineChart },
  { href: '/streak', label: 'My Streak', icon: Flame },
  { href: '/program', label: '90-Day Program', icon: CalendarDays },
  { href: '/skills-test', label: 'Skills Test', icon: Trophy },
  { href: '/launch', label: 'Launch Monitor', icon: Radio },
  { href: '/guide', label: 'How to Use', icon: BookOpen },
] as const;

export default function ProfileScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const deleteMyAccount = useMutation(api.account.deleteMyAccount);
  const [deleting, setDeleting] = useState(false);
  const privacyUrl = PRIVACY_POLICY_URL;

  /**
   * Google Play requires that an account made in the app can be deleted in
   * the app. The server removes the sign-in at once and the golf data in the
   * background; signing out afterwards only clears this device's tokens.
   */
  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, rounds, practice history, swing videos and ' +
        'coach conversations. It cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            deleteMyAccount({})
              .then(() => signOut())
              .catch((e: unknown) => {
                setDeleting(false);
                Alert.alert('Could not delete your account', errorMessage(e, 'Please try again.'));
              });
          },
        },
      ],
    );
  }

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
        {privacyUrl && (
          <Card onPress={() => void openBrowserAsync(privacyUrl)} style={styles.row}>
            <Shield size={20} color={colors.primary} />
            <ThemedText variant="body" style={styles.rowLabel}>
              Privacy Policy
            </ThemedText>
            <ChevronRight size={18} color={colors.textMuted} />
          </Card>
        )}
      </View>

      <Button
        label="Sign Out"
        variant="secondary"
        icon={<LogOut size={18} color={colors.text} />}
        onPress={() => void signOut()}
        style={styles.signOut}
      />

      <Button
        label="Delete Account"
        variant="ghost"
        icon={<Trash2 size={18} color={colors.destructive} />}
        onPress={confirmDelete}
        loading={deleting}
        style={styles.delete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowLabel: { flex: 1 },
  signOut: { marginTop: Spacing.six },
  delete: { marginTop: Spacing.two },
});
