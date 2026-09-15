/**
 * A coaching reply, rendered.
 *
 * React Native's `<Text>` has no markdown, so a reply written as
 * `**Grip**: hold the club...` showed its asterisks on screen. The coach is
 * now asked for plain prose, but every message already in a golfer's thread
 * was written before that - and a model still slips one in - so the emphasis
 * is rendered rather than merely prevented.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { toLines } from '@/convex/lib/markdown';

type RichTextProps = {
  children: string;
  /** Passed through to every line, so the caller keeps control of colour. */
  style?: ThemedTextProps['style'];
  variant?: ThemedTextProps['variant'];
};

export function RichText({ children, style, variant = 'body' }: RichTextProps) {
  const lines = toLines(children);

  return (
    <View>
      {lines.map((line) =>
        // A blank line is a paragraph break, and the gap is most of what makes
        // a long answer readable - so it is spacing, not an empty <Text>.
        line.blank ? (
          <View key={line.key} style={styles.break} />
        ) : (
          <ThemedText key={line.key} variant={variant} style={style}>
            {line.bullet ? '•  ' : ''}
            {line.spans.map((span, i) => (
              <ThemedText
                key={i}
                variant={variant}
                style={[style, span.bold && styles.bold]}>
                {span.text}
              </ThemedText>
            ))}
          </ThemedText>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  break: { height: Spacing.two },
});
