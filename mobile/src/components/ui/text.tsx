import { Text, type TextProps, type TextStyle } from 'react-native';

import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'stat';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: 'PlayfairDisplayBold', fontSize: FontSize['4xl'], lineHeight: 42 },
  title: { fontFamily: 'PlayfairDisplaySemiBold', fontSize: FontSize['2xl'], lineHeight: 30 },
  heading: { fontSize: FontSize.lg, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: FontSize.base, lineHeight: 22 },
  label: { fontSize: FontSize.sm, fontWeight: '500', lineHeight: 18 },
  caption: { fontSize: FontSize.xs, lineHeight: 16 },
  // Numbers deliberately avoid Playfair: its old-style figures draw zero
  // short, so "0d" reads as "od". Scores and yardages use the system face
  // with tabular figures so digits stay legible and columns stay aligned.
  stat: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
};

export type ThemedTextProps = TextProps & {
  variant?: Variant;
  /** `secondary` and `muted` step down the contrast; `accent` is brushed gold. */
  tone?: 'default' | 'secondary' | 'muted' | 'accent' | 'destructive';
  /** Small-caps style tracking used for section eyebrows. */
  uppercase?: boolean;
};

export function ThemedText({
  variant = 'body',
  tone = 'default',
  uppercase,
  style,
  ...rest
}: ThemedTextProps) {
  const colors = useTheme();

  const color = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.primary,
    destructive: colors.destructive,
  }[tone];

  return (
    <Text
      style={[
        VARIANTS[variant],
        { color },
        uppercase && { textTransform: 'uppercase', letterSpacing: 1.5 },
        style,
      ]}
      {...rest}
    />
  );
}
