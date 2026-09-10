import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './text';

type ScreenProps = {
  children: ReactNode;
  /** Large serif page title, e.g. "My Caddie". */
  title?: string;
  /** Gold eyebrow above the title. */
  eyebrow?: string;
  subtitle?: string;
  /** Set false for screens that manage their own scrolling (maps, lists). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  title,
  eyebrow,
  subtitle,
  scroll = true,
  contentStyle,
}: ScreenProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const header = (title || eyebrow) && (
    <View style={styles.header}>
      {eyebrow && (
        <ThemedText variant="caption" tone="accent" uppercase>
          {eyebrow}
        </ThemedText>
      )}
      {title && (
        <ThemedText variant="title" style={styles.title}>
          {title}
        </ThemedText>
      )}
      {subtitle && (
        <ThemedText variant="body" tone="secondary" style={styles.subtitle}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );

  const body = (
    <>
      {header}
      {children}
    </>
  );

  const padding: ViewStyle = {
    paddingTop: insets.top + Spacing.four,
    paddingHorizontal: Spacing.five,
  };

  if (!scroll) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }, padding, contentStyle]}>
        {body}
      </View>
    );
  }

  return (
    // Handled here rather than per screen so no text input can end up hidden
    // behind the keyboard. `automaticallyAdjustKeyboardInsets` grows the scroll
    // inset on iOS and brings the focused field into view; KeyboardAvoidingView
    // does the equivalent on Android, where that prop has no effect.
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[padding, styles.scrollContent, contentStyle]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Generous bottom padding so the last card clears the tab bar and leaves
  // room for the keyboard to scroll into.
  scrollContent: { paddingBottom: Spacing.eight * 2 },
  header: { marginBottom: Spacing.five, gap: Spacing.one },
  title: { marginTop: Spacing.one },
  subtitle: { marginTop: Spacing.one },
});
