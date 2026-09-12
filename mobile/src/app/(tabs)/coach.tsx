import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, ChevronUp, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { COACH_FOR_SKILL, DEFAULT_COACH_ID } from '@/convex/lib/coachLevels';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { COACHES, getCoachById } from '@/constants/coaches';
import { SKILL_LABELS } from '@/constants/golf';
import { GOLD, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * My Coach - your coach, not a catalogue.
 *
 * This screen used to list all four coaches as an accordion, which meant the
 * golfer scrolled past three people who do not teach them to reach their own
 * drills. Picking a coach is a settings-level decision made once, so the
 * roster now lives on `/coach-select`, reached from Profile.
 */
export default function CoachScreen() {
  const colors = useTheme();
  const router = useRouter();

  const profile = useQuery(api.profiles.getMyProfile, {});

  // Collapsed by default: the bio and level spec are reference material you
  // read once, not something to scroll past on the way to today's work.
  const [open, setOpen] = useState(false);

  // Profiles created before coach assignment existed have no coachId; they
  // are taught by the level-1 coach, same as the server assumes.
  const assigned = profile?.coachId ?? DEFAULT_COACH_ID;
  const coach = getCoachById(assigned);
  const recommended = profile ? COACH_FOR_SKILL[profile.skillLevel] : undefined;
  const mismatched = profile && recommended && assigned !== recommended;

  return (
    <Screen
      eyebrow="Elite Academy"
      title="My Coach"
      subtitle={`${coach.levelLabel} of four. 36 years of top-10 instructor knowledge.`}>
      {mismatched && (
        <Card
          onPress={() => router.push('/coach-select')}
          style={[styles.notice, { borderColor: colors.warning }]}>
          <ThemedText variant="label" style={{ color: colors.warning }}>
            Coach doesn&apos;t match your level
          </ThemedText>
          <ThemedText variant="caption" tone="secondary">
            You&apos;re set to {SKILL_LABELS[profile.skillLevel].toLowerCase()}, which is{' '}
            {COACHES.find((c) => c.id === recommended)?.name}&apos;s level. Your drills come
            from the coach, not the level, so switching aligns them.
          </ThemedText>
          <View style={styles.rowBetween}>
            <ThemedText variant="caption" tone="accent">
              Change coach
            </ThemedText>
            <ChevronRight size={16} color={colors.primary} />
          </View>
        </Card>
      )}

      <Card style={[styles.coach, { borderColor: colors.primary, borderWidth: 1 }]}>
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`About ${coach.name}`}
          style={styles.coachHead}>
          <View>
            <Image source={coach.image} style={styles.avatar} contentFit="cover" />
            <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
              <ThemedText variant="caption" style={{ color: colors.primaryText }}>
                L{coach.level}
              </ThemedText>
            </View>
          </View>

          <View style={styles.coachInfo}>
            <ThemedText variant="title">{coach.name}</ThemedText>
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

          {open ? (
            <ChevronUp size={18} color={colors.textMuted} />
          ) : (
            <ChevronDown size={18} color={colors.textMuted} />
          )}
        </Pressable>

        {!open && (
          <ThemedText variant="caption" tone="muted" style={styles.hint}>
            {coach.tagline}
          </ThemedText>
        )}

        {open && (
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
          </View>
        )}
      </Card>

      <Card
        eyebrow="Today's work"
        title="Open the 90-Day Program"
        onPress={() => router.push('/program')}
        style={styles.block}>
        <View style={styles.rowBetween}>
          <ThemedText variant="caption" tone="secondary">
            {coach.name}&apos;s drills, warm-up and cues for today.
          </ThemedText>
          <ChevronRight size={16} color={colors.primary} />
        </View>
      </Card>

      <Card
        eyebrow="Ask your coach"
        title={`Talk it through with ${coach.name}`}
        onPress={() => router.push('/ask-coach')}
        style={styles.block}>
        <View style={styles.rowBetween}>
          <ThemedText variant="caption" tone="secondary" style={styles.askCopy}>
            Describe a miss and get a fix back, in {coach.name}&apos;s voice. They can see
            your rounds, sessions and swing notes.
          </ThemedText>
          <ChevronRight size={16} color={colors.primary} />
        </View>
      </Card>
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
  block: { marginTop: Spacing.three },
  notice: { borderWidth: 1, gap: Spacing.one, marginBottom: Spacing.three },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  askCopy: { flex: 1, paddingRight: Spacing.three },

  coach: { gap: 0 },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  hint: { marginTop: Spacing.three },
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
  stars: { flexDirection: 'row', gap: 2, marginVertical: 1 },

  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  detailRow: { gap: 2 },
  focusBlock: { gap: Spacing.one },
});
