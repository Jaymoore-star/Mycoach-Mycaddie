import { useMutation, useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { Flame, Minus, Plus } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';

import { Card } from '@/components/ui/card';
import { CalendarHeat, HeroStat } from '@/components/ui/chart';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localDate } from '@/lib/date';

export default function StreakScreen() {
  const colors = useTheme();
  const date = localDate();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const data = useQuery(
    api.streaks.getStreakData,
    profile ? { profileId: profile._id, date } : 'skip',
  );
  const setWeeklyGoal = useMutation(api.streaks.setWeeklyGoal);

  async function adjustGoal(delta: number) {
    if (!profile || !data) return;
    try {
      await setWeeklyGoal({ profileId: profile._id, goal: data.weeklyGoal + delta });
    } catch {
      Alert.alert('Could not update', 'Please try again.');
    }
  }

  const goalMet = data ? data.thisWeekCount >= data.weeklyGoal : false;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'My Streak' }} />
      <Screen
        eyebrow="Consistency"
        title="My Streak"
        subtitle="Practice sessions and rounds both keep a streak alive.">
        {data === undefined && (
          <Card>
            <ThemedText variant="body" tone="secondary">
              Loading your record…
            </ThemedText>
          </Card>
        )}

        {data && (
          <>
            <Card>
              <HeroStat
                value={String(data.currentStreak)}
                label={data.currentStreak === 1 ? 'day streak' : 'day streak'}
                hint={
                  data.currentStreak === 0
                    ? 'Log a session today to start one.'
                    : data.streakStartDate
                      ? `Running since ${new Date(data.streakStartDate).toLocaleDateString()}`
                      : undefined
                }
              />
            </Card>

            <View style={styles.statRow}>
              <Card style={styles.tile}>
                <Flame size={18} color={colors.primary} />
                <ThemedText variant="stat">{data.longestStreak}</ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase>
                  Longest
                </ThemedText>
              </Card>
              <Card style={styles.tile}>
                <Flame size={18} color={colors.primary} />
                <ThemedText variant="stat">{data.totalActiveDays}</ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase>
                  Active days
                </ThemedText>
              </Card>
            </View>

            {/* ─── Weekly goal ─────────────────────────────────────────── */}
            <Card eyebrow="This week" title={`${data.thisWeekCount} of ${data.weeklyGoal}`} style={styles.block}>
              <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, Math.round((data.thisWeekCount / data.weeklyGoal) * 100))}%`,
                      backgroundColor: goalMet ? colors.success : colors.primary,
                    },
                  ]}
                />
              </View>
              <ThemedText
                variant="caption"
                style={{ color: goalMet ? colors.success : colors.textSecondary }}>
                {goalMet
                  ? 'Weekly goal met.'
                  : `${data.weeklyGoal - data.thisWeekCount} more to hit your goal.`}
              </ThemedText>

              <View style={[styles.goalRow, { borderTopColor: colors.border }]}>
                <ThemedText variant="label">Days per week</ThemedText>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => void adjustGoal(-1)}
                    disabled={data.weeklyGoal <= 1}
                    style={[
                      styles.stepBtn,
                      { borderColor: colors.border, opacity: data.weeklyGoal <= 1 ? 0.35 : 1 },
                    ]}
                    hitSlop={6}>
                    <Minus size={16} color={colors.text} />
                  </Pressable>
                  <ThemedText variant="stat" style={styles.goalValue}>
                    {data.weeklyGoal}
                  </ThemedText>
                  <Pressable
                    onPress={() => void adjustGoal(1)}
                    disabled={data.weeklyGoal >= 7}
                    style={[
                      styles.stepBtn,
                      { borderColor: colors.border, opacity: data.weeklyGoal >= 7 ? 0.35 : 1 },
                    ]}
                    hitSlop={6}>
                    <Plus size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            </Card>

            {/* ─── Calendar ────────────────────────────────────────────── */}
            <Card eyebrow="Last 13 weeks" title="Activity" style={styles.block}>
              <CalendarHeat activeDates={data.activeDates} today={date} />
            </Card>

            {data.totalActiveDays === 0 && (
              <Card style={styles.block}>
                <ThemedText variant="body" tone="secondary">
                  Nothing logged yet. Complete a drill in the 90-Day Program or play a round,
                  and it appears here the same day.
                </ThemedText>
              </Card>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: Spacing.three },
  statRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  tile: { flex: 1, gap: Spacing.one },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: Spacing.two },
  fill: { height: '100%', borderRadius: 4 },
  goalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalValue: { minWidth: 24, textAlign: 'center', fontSize: 18 },
});
