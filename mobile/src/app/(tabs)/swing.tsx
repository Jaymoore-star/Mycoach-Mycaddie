import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';

export default function SwingScreen() {
  return (
    <Screen
      eyebrow="Video analysis"
      title="My Swing"
      subtitle="Record a swing and get AI feedback on strengths and fixes.">
      <Card title="Record a swing">
        <ThemedText variant="body" tone="secondary">
          Capture uses expo-camera; AI analysis arrives in step 9.
        </ThemedText>
      </Card>
    </Screen>
  );
}
