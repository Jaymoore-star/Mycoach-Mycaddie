import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './text';

type CardProps = {
  children?: ReactNode;
  title?: string;
  /** Small gold label above the title. */
  eyebrow?: string;
  /** Renders the card as a tappable row with press feedback. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, title, eyebrow, onPress, style }: CardProps) {
  const colors = useTheme();

  const content = (
    <>
      {eyebrow && (
        <ThemedText variant="caption" tone="accent" uppercase>
          {eyebrow}
        </ThemedText>
      )}
      {title && (
        <ThemedText variant="heading" style={eyebrow ? styles.titleWithEyebrow : undefined}>
          {title}
        </ThemedText>
      )}
      {children}
    </>
  );

  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderColor: colors.border,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          base,
          pressed && { backgroundColor: colors.backgroundElement },
          style,
        ]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, base, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  titleWithEyebrow: { marginTop: Spacing.half },
});
