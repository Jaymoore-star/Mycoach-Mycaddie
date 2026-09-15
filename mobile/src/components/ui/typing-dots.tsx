/**
 * The "your coach is writing" indicator.
 *
 * Three dots that rise and fade in turn. A reply takes a few seconds to
 * generate, and a line of static text for that whole time reads as a frozen
 * screen - movement is what says the app is still working.
 *
 * Built on React Native's own `Animated` rather than Reanimated: opacity and
 * transform both run on the native driver here, so the loop keeps moving even
 * while the JS thread is busy taking the reply off the socket, which is
 * exactly when this is on screen. It also needs no babel plugin, and this is
 * the first animation in the app.
 */
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DOT_COUNT = 3;
/** One dot's rise and fall. Slow enough to read as breathing, not blinking. */
const CYCLE_MS = 520;
/** Offset between dots, so the movement travels along the row. */
const STAGGER_MS = 140;

export function TypingDots({ label }: { label?: string }) {
  const colors = useTheme();

  // One value per dot, created once - re-creating them on a re-render would
  // restart the loop and make the row stutter. Lazy state rather than a ref
  // because these are read while rendering, which is what a ref is not for.
  const [values] = useState(() =>
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0)),
  );

  useEffect(() => {
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER_MS),
          Animated.timing(value, {
            toValue: 1,
            duration: CYCLE_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: CYCLE_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Pads the cycle out so the stagger does not collapse once the
          // sequence repeats.
          Animated.delay((DOT_COUNT - 1 - i) * STAGGER_MS),
        ]),
      ),
    );

    for (const loop of loops) loop.start();
    return () => {
      for (const loop of loops) loop.stop();
    };
  }, [values]);

  const styles_ = useMemo(
    () =>
      values.map((value) => ({
        opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
        transform: [
          { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [1.5, -2.5] }) },
        ],
      })),
    [values],
  );

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Writing a reply'}>
      {label ? (
        <ThemedText variant="caption" tone="muted">
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.dots}>
        {styles_.map((animated, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: colors.textMuted }, animated]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 999 },
});
