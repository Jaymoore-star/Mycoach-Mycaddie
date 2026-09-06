import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { COACHES } from '@/constants/golf';

export default function CoachScreen() {
  return (
    <Screen
      eyebrow="Elite Academy"
      title="My Coach"
      subtitle="36 years of top-10 instructor knowledge, on demand.">
      {COACHES.map((coach) => (
        <Card key={coach.id} title={coach.name} style={{ marginBottom: 12 }}>
          <ThemedText variant="body" tone="secondary">
            Coach profile and chat arrive in step 5 of the build.
          </ThemedText>
        </Card>
      ))}
    </Screen>
  );
}
