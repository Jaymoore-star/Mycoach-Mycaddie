import { useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { CheckCircle2, ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/convex/_generated/api';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/text';
import { COACHES, type CoachId } from '@/constants/coaches';
import {
  PHASE_BLURBS,
  PHASE_LABELS,
  PHASE_ORDER,
  PROGRAM_DAYS,
  SKILL_OPTIONS,
  type SkillLevel,
} from '@/constants/golf';
import { FontSize, GOLD, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TOTAL_STEPS = 5;

const WELCOME_FEATURES = [
  'My Coach — P-Position Feedback',
  'My Caddie — On-Course System',
  'Shot & Strokes Gained Tracking',
  'Skills Gates + 3-in-a-Row',
];

export default function OnboardingScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const createProfile = useMutation(api.profiles.createProfile);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [coachId, setCoachId] = useState<CoachId>('que');
  const [handicap, setHandicap] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed =
    step === 1 ? name.trim().length > 0 : step === 2 ? skillLevel !== null : true;

  async function handleSubmit() {
    if (!name.trim() || !skillLevel) return;
    setError(null);
    setSubmitting(true);
    try {
      const parsed = handicap.trim() ? Number.parseFloat(handicap.trim()) : undefined;
      await createProfile({
        displayName: name.trim(),
        skillLevel,
        // Guard against "abc" parsing to NaN, which Convex would reject.
        handicap: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
        coachId,
      });
      // The root navigator swaps to the tabs as soon as the profile query
      // returns a document, so there is no navigation call here.
    } catch {
      setError('Could not create your profile. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.goldLine, { top: insets.top }]} />

      {/* Step indicator */}
      <View style={[styles.steps, { paddingTop: insets.top + Spacing.five }]}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              i < step
                ? { width: 32, backgroundColor: colors.primary }
                : i === step
                  ? { width: 32, backgroundColor: `${GOLD}99` }
                  : { width: 16, backgroundColor: colors.backgroundElement },
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View style={styles.centeredBlock}>
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <ThemedText variant="title" style={{ color: colors.primaryText }}>
                D
              </ThemedText>
            </View>
            <ThemedText variant="title" style={styles.centered}>
              Welcome to <ThemedText variant="title" tone="accent">Dominus Golf</ThemedText>
            </ThemedText>
            <ThemedText variant="caption" tone="secondary" uppercase style={styles.centered}>
              Dominus Golf · The Blueprint System
            </ThemedText>
            <ThemedText variant="body" tone="secondary" style={styles.centered}>
              The MyCoach / MyCaddie system is a {PROGRAM_DAYS}-day mastery program built around the
              10 P-Positions, the Core 9-to-3 Sequence, and the Clock System Wedge Matrix — the same
              methodology trusted by elite instructors for decades.
            </ThemedText>

            <View style={styles.featureGrid}>
              {WELCOME_FEATURES.map((f) => (
                <View
                  key={f}
                  style={[styles.featureChip, { backgroundColor: colors.backgroundElement }]}>
                  <ThemedText variant="label">{f}</ThemedText>
                </View>
              ))}
            </View>

            <Button
              label="Let's Get Started"
              icon={<ChevronRight size={18} color={colors.primaryText} />}
              onPress={() => setStep(1)}
              style={styles.fullWidth}
            />
          </View>
        )}

        {step === 1 && (
          <View style={styles.centeredBlock}>
            <ThemedText variant="title" style={styles.centered}>
              What should we call you?
            </ThemedText>
            <ThemedText variant="body" tone="secondary" style={styles.centered}>
              Your coach and caddie will greet you by name every session.
            </ThemedText>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => canProceed && setStep(2)}
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.backgroundElement,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
            <NavRow
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
              nextDisabled={!canProceed}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.block}>
            <ThemedText variant="title" style={styles.centered}>
              Your skill level{name ? `, ${name.trim()}` : ''}
            </ThemedText>
            <ThemedText variant="body" tone="secondary" style={styles.centered}>
              Choose the level that best matches your current game.
            </ThemedText>

            <View style={styles.optionList}>
              {SKILL_OPTIONS.map((sl) => {
                const selected = skillLevel === sl.value;
                return (
                  <Pressable
                    key={sl.value}
                    onPress={() => setSkillLevel(sl.value)}
                    style={[
                      styles.option,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? `${GOLD}1A` : colors.card,
                      },
                    ]}>
                    <View style={styles.optionHead}>
                      <ThemedText variant="heading">{sl.label}</ThemedText>
                      <ThemedText variant="caption" tone="accent">
                        Handicap {sl.handicap}
                      </ThemedText>
                      {selected && <CheckCircle2 size={18} color={colors.primary} />}
                    </View>
                    <ThemedText variant="caption" tone="secondary">
                      {sl.description}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <NavRow
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              nextDisabled={!canProceed}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.block}>
            <ThemedText variant="title" style={styles.centered}>
              Choose your coach
            </ThemedText>
            <ThemedText variant="body" tone="secondary" style={styles.centered}>
              Each coach teaches a different level of the system. You can switch any time.
            </ThemedText>

            <View style={styles.optionList}>
              {COACHES.map((coach) => {
                const selected = coachId === coach.id;
                return (
                  <Pressable
                    key={coach.id}
                    onPress={() => setCoachId(coach.id)}
                    style={[
                      styles.coach,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? `${GOLD}1A` : colors.card,
                      },
                    ]}>
                    <View>
                      <Image source={coach.image} style={styles.avatar} contentFit="cover" />
                      <View
                        style={[
                          styles.levelBadge,
                          {
                            backgroundColor: selected ? colors.primary : colors.backgroundSelected,
                          },
                        ]}>
                        <ThemedText
                          variant="caption"
                          style={{ color: selected ? colors.primaryText : colors.text }}>
                          L{coach.level}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.coachInfo}>
                      <View style={styles.coachHead}>
                        <ThemedText variant="heading">{coach.name}</ThemedText>
                        {selected && <CheckCircle2 size={18} color={colors.primary} />}
                      </View>
                      <ThemedText
                        variant="caption"
                        style={{ color: selected ? colors.primary : coach.accent }}>
                        {coach.title}
                      </ThemedText>
                      <View style={styles.stars}>
                        {Array.from({ length: coach.level }).map((_, i) => (
                          <Star key={i} size={11} color={GOLD} fill={GOLD} />
                        ))}
                      </View>
                      <ThemedText variant="caption" tone="secondary">
                        {coach.tagline}
                      </ThemedText>
                      <ThemedText variant="caption" tone="muted">
                        {coach.skillRange} · {coach.levelSpec.breakingScore}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </View>
        )}

        {step === 4 && (
          <View style={styles.block}>
            <ThemedText variant="title" style={styles.centered}>
              Your {PROGRAM_DAYS}-day program
            </ThemedText>
            <ThemedText variant="body" tone="secondary" style={styles.centered}>
              Greens to tee. Each phase unlocks when you pass its skills gate.
            </ThemedText>

            <View style={styles.phaseList}>
              {PHASE_ORDER.map((phase, i) => (
                <View key={phase} style={[styles.phase, { borderColor: colors.border }]}>
                  <View style={[styles.phaseNum, { backgroundColor: colors.backgroundElement }]}>
                    <ThemedText variant="label" tone="accent">
                      {i + 1}
                    </ThemedText>
                  </View>
                  <View style={styles.phaseText}>
                    <ThemedText variant="label">{PHASE_LABELS[phase]}</ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      {PHASE_BLURBS[phase]}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.handicapBlock}>
              <ThemedText variant="label">Current handicap (optional)</ThemedText>
              <ThemedText variant="caption" tone="muted">
                Leave blank if you don&apos;t have one — it&apos;s calculated from your rounds.
              </ThemedText>
              <TextInput
                value={handicap}
                onChangeText={setHandicap}
                placeholder="e.g. 18.4"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={[
                  styles.handicapInput,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />
            </View>

            {error && (
              <ThemedText variant="label" tone="destructive" accessibilityRole="alert">
                {error}
              </ThemedText>
            )}

            <View style={styles.navRow}>
              <Button
                label="Back"
                variant="ghost"
                onPress={() => setStep(3)}
                disabled={submitting}
                style={styles.navButton}
              />
              <Button
                label="Start My Program"
                onPress={handleSubmit}
                loading={submitting}
                style={styles.navButton}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NavRow({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <View style={styles.navRow}>
      <Button label="Back" variant="ghost" onPress={onBack} style={styles.navButton} />
      <Button label="Next" onPress={onNext} disabled={nextDisabled} style={styles.navButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  goldLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: GOLD },
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingBottom: Spacing.four,
  },
  pip: { height: 5, borderRadius: 3 },
  content: { paddingHorizontal: Spacing.five, flexGrow: 1 },

  block: { gap: Spacing.three },
  centeredBlock: { gap: Spacing.three, flex: 1, justifyContent: 'center' },
  centered: { textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch', marginTop: Spacing.three },

  badge: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  featureGrid: { gap: Spacing.two, marginVertical: Spacing.three },
  featureChip: { borderRadius: Radius.lg, padding: Spacing.three },

  nameInput: {
    height: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    textAlign: 'center',
    fontSize: FontSize.xl,
    marginTop: Spacing.two,
  },

  optionList: { gap: Spacing.two, marginTop: Spacing.two },
  option: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.one },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },

  coach: {
    flexDirection: 'row',
    gap: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
  },
  avatar: { width: 76, height: 76, borderRadius: Radius.lg },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  coachInfo: { flex: 1, gap: 2 },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stars: { flexDirection: 'row', gap: 2, marginVertical: 2 },

  phaseList: { gap: Spacing.two, marginTop: Spacing.two },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  phaseNum: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseText: { flex: 1, gap: 1 },

  handicapBlock: { gap: Spacing.one, marginTop: Spacing.four },
  handicapInput: {
    height: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    fontSize: FontSize.base,
    marginTop: Spacing.one,
  },

  navRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.five },
  navButton: { flex: 1 },
});
