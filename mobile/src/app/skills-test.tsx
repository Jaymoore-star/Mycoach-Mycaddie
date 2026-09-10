import { useMutation, useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { CheckCircle2, Circle, Minus, Plus, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { PHASES } from '@/convex/lib/curriculum';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BarRow, HeroStat } from '@/components/ui/chart';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localDate } from '@/lib/date';

export default function SkillsTestScreen() {
  const colors = useTheme();
  const date = localDate();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const current = useQuery(
    api.skillTests.getCurrentTest,
    profile ? { profileId: profile._id } : 'skip',
  );
  const ladder = useQuery(
    api.skillTests.getBestTestPerPhase,
    profile ? { profileId: profile._id } : 'skip',
  );
  const submit = useMutation(api.skillTests.submitSkillTest);

  /** Passes entered per challenge, keyed by challenge id. */
  const [passes, setPasses] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  function adjust(challengeId: string, delta: number, max: number) {
    setPasses((prev) => {
      const next = Math.max(0, Math.min(max, (prev[challengeId] ?? 0) + delta));
      return { ...prev, [challengeId]: next };
    });
  }

  async function handleSubmit() {
    if (!profile || !current) return;

    setBusy(true);
    try {
      const result = await submit({
        profileId: profile._id,
        phase: current.test.phase,
        week: current.week,
        date,
        results: current.test.challenges.map((c) => ({
          challengeId: c.id,
          passes: passes[c.id] ?? 0,
        })),
      });

      setPasses({});
      Alert.alert(
        result.overallPass ? 'Gate passed' : 'Not this time',
        `${result.score}% - you needed ${result.passingScore}% at your level.\n\n${result.feedback}`,
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Could not submit', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Skills Test' }} />
      <Screen
        eyebrow={current ? `${PHASES[current.test.phase].label} - week ${current.week}` : 'Skills gate'}
        title={current?.test.title ?? 'Skills Test'}
        subtitle={current?.test.description}>
        {current === undefined && (
          <Card>
            <ThemedText variant="body" tone="secondary">
              Loading your test...
            </ThemedText>
          </Card>
        )}

        {current && (
          <>
            {/* Coach framing */}
            <Card eyebrow="Your coach" style={styles.block}>
              <ThemedText variant="caption" tone="secondary">
                {current.test.coachIntro}
              </ThemedText>
            </Card>

            {/* Best attempt so far */}
            {current.attemptCount > 0 && (
              <Card style={styles.block}>
                <HeroStat
                  value={`${current.bestScore}%`}
                  label="Best attempt"
                  hint={`${current.attemptCount} attempt${
                    current.attemptCount === 1 ? '' : 's'
                  } at this gate${current.passed ? ' - passed' : ''}`}
                  tone={current.passed ? 'accent' : 'default'}
                />
              </Card>
            )}

            {/* ─── Challenges ──────────────────────────────────────────── */}
            <ThemedText variant="heading" style={styles.sectionHeading}>
              Challenges
            </ThemedText>
            <ThemedText variant="caption" tone="muted" style={styles.sectionNote}>
              Do each one, then enter how many you made. Your level sets the bar.
            </ThemedText>

            <View style={styles.list}>
              {current.test.challenges.map((c) => {
                const requirement = current.requirements.find((r) => r.challengeId === c.id);
                const required = requirement?.required ?? 0;
                const entered = passes[c.id] ?? 0;
                const met = entered >= required;

                return (
                  <Card key={c.id} style={styles.challenge}>
                    <View style={styles.challengeHead}>
                      {met ? (
                        <CheckCircle2 size={18} color={colors.success} />
                      ) : (
                        <Circle size={18} color={colors.textMuted} />
                      )}
                      <ThemedText variant="heading" style={styles.challengeName}>
                        {c.name}
                      </ThemedText>
                    </View>

                    <ThemedText variant="caption" tone="secondary">
                      {c.description}
                    </ThemedText>

                    <View style={[styles.target, { borderColor: colors.border }]}>
                      <ThemedText variant="caption" tone="accent" uppercase>
                        Your target
                      </ThemedText>
                      <ThemedText variant="caption" tone="secondary">
                        {required} of {c.totalAttempts} - {c.metric}
                      </ThemedText>
                    </View>

                    <View style={styles.counter}>
                      <ThemedText variant="label">Made</ThemedText>
                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() => adjust(c.id, -1, c.totalAttempts)}
                          disabled={entered === 0}
                          style={[
                            styles.stepBtn,
                            { borderColor: colors.border, opacity: entered === 0 ? 0.35 : 1 },
                          ]}
                          hitSlop={6}>
                          <Minus size={16} color={colors.text} />
                        </Pressable>
                        <ThemedText
                          variant="stat"
                          style={[
                            styles.count,
                            { color: met ? colors.success : colors.text },
                          ]}>
                          {entered}
                          <ThemedText variant="caption" tone="muted">
                            {' '}
                            / {c.totalAttempts}
                          </ThemedText>
                        </ThemedText>
                        <Pressable
                          onPress={() => adjust(c.id, 1, c.totalAttempts)}
                          disabled={entered >= c.totalAttempts}
                          style={[
                            styles.stepBtn,
                            {
                              borderColor: colors.border,
                              opacity: entered >= c.totalAttempts ? 0.35 : 1,
                            },
                          ]}
                          hitSlop={6}>
                          <Plus size={16} color={colors.text} />
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>

            <Button
              label="Submit test"
              icon={<Trophy size={18} color={colors.primaryText} />}
              onPress={() => void handleSubmit()}
              loading={busy}
              disabled={busy}
              style={styles.submit}
            />
            <ThemedText variant="caption" tone="muted" style={styles.hint}>
              Scored on the server against your level, so the result is the real one.
            </ThemedText>

            {/* ─── Last attempt ────────────────────────────────────────── */}
            {current.lastAttempt && (
              <Card
                eyebrow={`Last attempt - ${current.lastAttempt.date}`}
                title={`${current.lastAttempt.score}%`}
                style={styles.block}>
                <ThemedText
                  variant="caption"
                  style={{
                    color: current.lastAttempt.overallPass ? colors.success : colors.warning,
                  }}>
                  {current.lastAttempt.overallPass ? 'Passed' : 'Below the bar'}
                </ThemedText>
                <ThemedText variant="caption" tone="secondary">
                  {current.lastAttempt.coachFeedback}
                </ThemedText>
                {current.lastAttempt.results.map((r) => (
                  <ThemedText key={r.drill} variant="caption" tone="muted">
                    {r.drill}: {r.passed} of {r.attempts} (needed {r.threshold})
                  </ThemedText>
                ))}
              </Card>
            )}

            {/* ─── Phase ladder ────────────────────────────────────────── */}
            {ladder && ladder.some((l) => l.attempts > 0) && (
              <>
                <ThemedText variant="heading" style={styles.sectionHeading}>
                  Gates by phase
                </ThemedText>
                <Card>
                  {ladder.map((l) => (
                    <BarRow
                      key={l.phase}
                      label={PHASES[l.phase].label}
                      value={l.bestScore ?? 0}
                      max={100}
                      display={
                        l.attempts === 0
                          ? 'not attempted'
                          : `${l.bestScore}%${l.passed ? ' - passed' : ''}`
                      }
                      color={l.passed ? colors.success : undefined}
                    />
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: Spacing.three },
  sectionHeading: { marginTop: Spacing.five },
  sectionNote: { marginBottom: Spacing.two },
  list: { gap: Spacing.two },

  challenge: { gap: Spacing.two },
  challengeHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  challengeName: { flex: 1 },
  target: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 2,
  },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { minWidth: 72, textAlign: 'center', fontSize: 20 },

  submit: { marginTop: Spacing.five },
  hint: { textAlign: 'center', marginTop: Spacing.two },
});
