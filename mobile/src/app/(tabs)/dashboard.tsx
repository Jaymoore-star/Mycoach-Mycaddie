import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, Flame, Target, TrendingUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { getCoachById } from '@/constants/coaches';
import { PHASE_LABELS, PROGRAM_DAYS, greeting } from '@/constants/golf';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayDate, localDate } from '@/lib/date';

export default function DashboardScreen() {
  const colors = useTheme();
  const router = useRouter();
  const profile = useQuery(api.profiles.getMyProfile, {});
  const date = localDate();
  const session = useQuery(
    api.sessions.getTodaysSession,
    profile ? { profileId: profile._id, date } : 'skip',
  );
  const snapshot = useQuery(
    api.sessions.get30DaySnapshot,
    profile ? { profileId: profile._id, date } : 'skip',
  );

  // The root navigator only mounts this screen once a profile exists, so a
  // null here means the query is still catching up after a fresh sign-up.
  if (!profile) {
    return (
      <Screen eyebrow="Dominus Golf" title="Loading…">
        <Card>
          <ThemedText variant="body" tone="secondary">
            Fetching your program…
          </ThemedText>
        </Card>
      </Screen>
    );
  }

  const coach = getCoachById(profile.coachId);
  const progress = Math.round((profile.currentDay / PROGRAM_DAYS) * 100);

  return (
    <Screen
      eyebrow="Dominus Golf"
      title={`${greeting()}, ${profile.displayName}`}
      subtitle={displayDate()}>
      <Card
        eyebrow={`Day ${profile.currentDay} of ${PROGRAM_DAYS}`}
        title={PHASE_LABELS[profile.currentPhase]}
        onPress={() => router.push('/program')}>
        <ThemedText variant="body" tone="secondary">
          {session?.sessionComplete
            ? "Today's session is complete. Advance to the next day."
            : session
              ? `${session.tasksCompleted.length} of ${session.tasksTotal} drills done.`
              : "Today's focus. Complete your session to advance the program."}
        </ThemedText>

        <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
          <View style={[styles.fill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
        </View>
        <View style={styles.cardFoot}>
          <ThemedText variant="caption" tone="muted">
            {progress}% complete · Coaching with {coach.name}
          </ThemedText>
          <ChevronRight size={16} color={colors.textMuted} />
        </View>
      </Card>

      <View style={styles.statRow}>
        <StatTile
          icon={<Target size={18} color={colors.primary} />}
          label="Handicap"
          value={profile.handicap === undefined ? '-' : profile.handicap.toFixed(1)}
        />
        <StatTile
          icon={<TrendingUp size={18} color={colors.primary} />}
          label="Target"
          value={String(profile.targetScore)}
        />
      </View>

      <View style={styles.statRow}>
        <StatTile
          icon={<TrendingUp size={18} color={colors.primary} />}
          label="Scoring avg"
          value={profile.scoringAvg === undefined ? '-' : profile.scoringAvg.toFixed(1)}
        />
        <StatTile
          icon={<CalendarDays size={18} color={colors.primary} />}
          label="Day"
          value={String(profile.currentDay)}
        />
      </View>

      <View style={styles.statRow}>
        <StatTile
          icon={<Flame size={18} color={colors.primary} />}
          label="Days trained"
          value={snapshot ? String(snapshot.completedDays) : '-'}
        />
        <StatTile
          icon={<Target size={18} color={colors.primary} />}
          label="30-day reps"
          value={snapshot ? String(snapshot.totalReps) : '-'}
        />
      </View>

      {snapshot && snapshot.totalReps > 0 && (
        <Card eyebrow="Last 30 days" title="Rep volume" style={styles.block}>
          <RepBar
            label="Swing"
            value={snapshot.swingReps}
            goal={snapshot.swingGoal}
            color={colors.primary}
          />
          <RepBar
            label="Putting"
            value={snapshot.puttReps}
            goal={snapshot.puttGoal}
            color={colors.success}
          />
          <ThemedText variant="caption" tone="muted">
            {snapshot.avgDailyReps} reps on an average training day · target{' '}
            {snapshot.dailyTarget}
          </ThemedText>
        </Card>
      )}
    </Screen>
  );
}

function RepBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const colors = useTheme();
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;

  return (
    <View style={styles.repBar}>
      <View style={styles.repHead}>
        <ThemedText variant="caption" tone="secondary">
          {label}
        </ThemedText>
        <ThemedText variant="caption" tone="muted">
          {value} / {goal}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card style={styles.tile}>
      {icon}
      <ThemedText variant="stat">{value}</ThemedText>
      <ThemedText variant="caption" tone="muted" uppercase>
        {label}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.two },
  fill: { height: '100%', borderRadius: 3 },
  statRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  tile: { flex: 1, gap: Spacing.one },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  block: { marginTop: Spacing.three },
  repBar: { gap: Spacing.one },
  repHead: { flexDirection: 'row', justifyContent: 'space-between' },
});
