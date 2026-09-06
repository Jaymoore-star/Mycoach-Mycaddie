import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[padding, styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled">
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.eight },
  header: { marginBottom: Spacing.five, gap: Spacing.one },
  title: { marginTop: Spacing.one },
  subtitle: { marginTop: Spacing.one },
});
