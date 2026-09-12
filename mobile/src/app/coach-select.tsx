import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { CheckCircle2, ChevronDown, ChevronUp, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { COACH_FOR_SKILL, DEFAULT_COACH_ID } from '@/convex/lib/coachLevels';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { COACHES, type CoachId } from '@/constants/coaches';
import { SKILL_LABELS } from '@/constants/golf';
import { GOLD, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Change Coach - the full roster, reached from Profile.
 *
 * Lives here rather than on the My Coach tab because choosing a coach is done
 * once and then lived with: the coach determines which drills the 90-day
 * program generates, so switching mid-program changes the work. My Coach shows
 * the one you have; this screen is where you change it.
 */
export default function CoachSelectScreen() {
  const colors = useTheme();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const updateCoach = useMutation(api.profiles.updateCoach);

  const [expanded, setExpanded] = useState<CoachId | null>(null);
  const [busy, setBusy] = useState(false);

  const assigned = profile?.coachId ?? DEFAULT_COACH_ID;
  const recommended = profile ? COACH_FOR_SKILL[profile.skillLevel] : undefined;

  function confirmSwitch(coachId: CoachId, name: string) {
    if (!profile || coachId === assigned) return;

    const mismatch = recommended && coachId !== recommended;
    Alert.alert(
      `Switch to ${name}?`,
      mismatch
        ? `Your drills will come from ${name} from tomorrow's session onward. ${name} teaches a different level than your ${SKILL_LABELS[
            profile.skillLevel
          ].toLowerCase()} setting, so the work may be too easy or too hard.`
        : `Your drills will come from ${name} from tomorrow's session onward.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            setBusy(true);
            void updateCoach({ profileId: profile._id, coachId })
              .catch(() => Alert.alert('Could not switch', 'Please try again.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  return (
    <Screen
      eyebrow="Settings"
      title="Change Coach"
      subtitle="Each coach teaches one level of the system. Your drills come from the coach, so this changes the work itself.">
      <View style={styles.list}>
        {COACHES.map((coach) => {
          const isAssigned = coach.id === assigned;
          const isRecommended = coach.id === recommended;
          const isOpen = expanded === coach.id;

          return (
            <Card
              key={coach.id}
              style={[
                styles.coach,
                isAssigned && { borderColor: colors.primary, borderWidth: 1 },
              ]}>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : coach.id)}
                style={styles.coachHead}>
                <View>
                  <Image source={coach.image} style={styles.avatar} contentFit="cover" />
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: isAssigned ? colors.primary : colors.backgroundSelected },
                    ]}>
                    <ThemedText
                      variant="caption"
                      style={{ color: isAssigned ? colors.primaryText : colors.text }}>
                      L{coach.level}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.coachInfo}>
                  <View style={styles.nameRow}>
                    <ThemedText variant="heading">{coach.name}</ThemedText>
                    {isAssigned && <CheckCircle2 size={16} color={colors.primary} />}
                    {!isAssigned && isRecommended && (
                      <View style={[styles.pill, { backgroundColor: colors.primary }]}>
                        <ThemedText variant="caption" style={{ color: colors.primaryText }}>
                          Your level
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText variant="caption" style={{ color: coach.accent }}>
                    {coach.title}
                  </ThemedText>
                  <View style={styles.stars}>
                    {Array.from({ length: coach.level }).map((_, i) => (
                      <Star key={i} size={10} color={GOLD} fill={GOLD} />
                    ))}
                  </View>
                  <ThemedText variant="caption" tone="muted">
                    {coach.skillRange} · {coach.levelSpec.breakingScore}
                  </ThemedText>
                </View>

                {isOpen ? (
                  <ChevronUp size={18} color={colors.textMuted} />
                ) : (
                  <ChevronDown size={18} color={colors.textMuted} />
                )}
              </Pressable>

              {isOpen && (
                <View style={[styles.detail, { borderTopColor: colors.border }]}>
                  <ThemedText variant="caption" tone="accent">
                    {coach.tagline}
                  </ThemedText>
                  <ThemedText variant="caption" tone="secondary">
                    {coach.bio}
                  </ThemedText>

                  <Detail label="Coaching style" value={coach.coachingStyle} />
                  <Detail label="This level" value={coach.levelSpec.subtitle} />
                  <Detail label="Objective" value={coach.levelSpec.coreObjective} />

                  <View style={styles.focusBlock}>
                    <ThemedText variant="caption" tone="accent" uppercase>
                      Training focus
                    </ThemedText>
                    {coach.levelSpec.trainingFocus.map((f) => (
                      <ThemedText key={f} variant="caption" tone="secondary">
                        • {f}
                      </ThemedText>
                    ))}
                  </View>

                  <Detail label="Graduating looks like" value={coach.levelSpec.scoringBenchmark} />

                  {isAssigned ? (
                    <ThemedText variant="caption" tone="muted">
                      This is your coach.
                    </ThemedText>
                  ) : (
                    <Pressable
                      onPress={() => confirmSwitch(coach.id, coach.name)}
                      disabled={busy}
                      style={[styles.switchBtn, { borderColor: colors.primary }]}>
                      <ThemedText variant="label" tone="accent">
                        Train with {coach.name}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </View>

      <ThemedText variant="caption" tone="muted" style={styles.foot}>
        Switching takes effect from tomorrow&apos;s session. Your conversation with each
        coach is kept separately, so coming back to a coach picks up where you left off.
      </ThemedText>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText variant="caption" tone="muted" uppercase>
        {label}
      </ThemedText>
      <ThemedText variant="caption" tone="secondary">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  foot: { marginTop: Spacing.four },

  coach: { gap: 0 },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  avatar: { width: 68, height: 68, borderRadius: Radius.lg },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  coachInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 1, borderRadius: Radius.pill },
  stars: { flexDirection: 'row', gap: 2, marginVertical: 1 },

  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  detailRow: { gap: 2 },
  focusBlock: { gap: Spacing.one },
  switchBtn: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
});
