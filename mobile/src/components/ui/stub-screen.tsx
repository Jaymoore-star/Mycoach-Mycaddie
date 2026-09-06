import { Stack } from 'expo-router';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';

/**
 * Placeholder for a screen that is routed and reachable but not yet ported.
 * Replaced file-by-file as the build order in PLAN.md progresses.
 */
export function StubScreen({
  title,
  eyebrow,
  step,
}: {
  title: string;
  eyebrow: string;
  step: string;
}) {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <Screen eyebrow={eyebrow} title={title}>
        <Card title="Not built yet">
          <ThemedText variant="body" tone="secondary">
            {step}
          </ThemedText>
        </Card>
      </Screen>
    </>
  );
}
