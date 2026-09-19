import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ui/text';
import { getCoachById } from '@/constants/coaches';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * React Navigation's default bottom tab bar content height, before the safe
 * area is added. The bubble is a sibling of the navigator rather than a child
 * of a tab screen, so `useBottomTabBarHeight()` has no context here and the
 * clearance has to be computed from these two parts instead.
 */
const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 56 });

/**
 * Gap between the tab bar and the bubble. Generous on purpose: the bubble
 * floats over whatever the screen has at the bottom of its scroll, so it needs
 * to clear the tab bar by enough that neither is awkward to tap.
 */
const CLEARANCE = Spacing.six;

/**
 * The floating "ask your coach" bubble.
 *
 * Sits bottom-right over the page, clear of the tab bar, and opens the chat
 * as a modal. It shows the golfer's own coach rather than a generic chat icon
 * - the portrait is what makes it read as "your coach is here" instead of
 * "support widget", and it is the same face they picked on My Coach.
 *
 * Rendered as an absolutely positioned sibling of the scrolling content, so it
 * stays put while the page moves under it.
 */
export function CoachBubble({ coachId }: { coachId: string | undefined }) {
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const coach = getCoachById(coachId);

  return (
    <Pressable
      onPress={() => router.push('/ask-coach')}
      accessibilityRole="button"
      accessibilityLabel={`Ask ${coach.name}`}
      hitSlop={8}
      style={({ pressed }) => [
        styles.row,
        {
          bottom: insets.bottom + TAB_BAR_HEIGHT + CLEARANCE,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}>
      <View style={[styles.label, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ThemedText variant="caption" tone="secondary" numberOfLines={1}>
          Ask {coach.name}
        </ThemedText>
      </View>

      <View
        style={[
          styles.bubble,
          { backgroundColor: colors.card, borderColor: coach.accent, shadowColor: '#000' },
        ]}>
        <Image source={coach.image} style={styles.avatar} contentFit="cover" />
        <View style={[styles.badge, { backgroundColor: coach.accent }]}>
          <MessageCircle size={12} color={colors.card} fill={colors.card} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * Label and portrait sit in a row, and the row is what floats.
   *
   * The label used to be absolutely positioned inside the 56pt circle, which
   * meant React Native measured it against a 56pt containing block: "Ask
   * Mason" had nowhere to go and broke mid-word, three lines deep, reading
   * "Ask / Mas / on". Laying them out as siblings lets the label take the
   * width its text actually needs.
   */
  row: {
    position: 'absolute',
    right: Spacing.five,
    // `bottom` is set inline - it depends on the device's safe-area inset.
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Elevation on Android, shadow on iOS - without one it reads as part of
    // the page rather than floating above it. On the circle rather than the
    // row, so the shadow follows the portrait and not an invisible rectangle.
    ...Platform.select({
      ios: { shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
      default: {},
    }),
  },
  avatar: { width: 48, height: 48, borderRadius: Radius.pill },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
