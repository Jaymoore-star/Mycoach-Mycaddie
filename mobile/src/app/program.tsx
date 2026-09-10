import { useMutation, useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Lock,
  Target,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { PHASES, PHASE_ORDER, type Drill, generateSession } from '@/convex/lib/curriculum';
import { PHASE_DAY_START, PROGRAM_DAYS, getDayInPhase } from '@/convex/lib/program';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { localDate } from '@/lib/date';
import { GOLD, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Minutes since a session row was created.
 *
 * Module scope on purpose: `Date.now()` inside the component body makes the
 * render impure, which stops React Compiler optimising the screen.
 */
function minutesSince(creationTime: number | undefined): number {
  return creationTime == null ? 0 : (Date.now() - creationTime) / 60_000;
}

export default function ProgramScreen() {
  const colors = useTheme();
  const profile = useQuery(api.profiles.getMyProfile, {});

  // Recomputed per render; the golfer's device knows its own timezone.
  const date = localDate();

  const session = useQuery(
    api.sessions.getTodaysSession,
    profile ? { profileId: profile._id, date } : 'skip',
  );

  const startSession = useMutation(api.sessions.startSession);
  const completeDrill = useMutation(api.sessions.completeDrill);
  const uncompleteDrill = useMutation(api.sessions.uncompleteDrill);
  const advanceDay = useMutation(api.profiles.advanceProgramDay);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Must sit with the other hooks, above the early return below - a hook
  // after a conditional return changes the hook count between renders.
  const [rushed, setRushed] = useState(false);

  if (!profile) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: '90-Day Program' }} />
        <Screen eyebrow="The plan" title="90-Day Program">
          <Card>
            <ThemedText variant="body" tone="secondary">
              Loading your program…
            </ThemedText>
          </Card>
        </Screen>
      </>
    );
  }

  const phase = profile.currentPhase;
  const dayInPhase = getDayInPhase(profile.currentDay, phase);

  const daily = generateSession(
    phase,
    profile.skillLevel,
    dayInPhase,
    profile.displayName,
    profile.coachId,
  );

  const completed = session?.tasksCompleted ?? [];
  const allDone = daily.drills.every((d) => completed.includes(d.id));

  // Mirrors the server-side gate in advanceProgramDay so the button reflects
  // reality instead of only failing on tap. The server remains the authority.
  const advancedToday = profile.lastAdvancedDate === date;
  const finished = profile.currentDay >= PROGRAM_DAYS;


  async function toggleDrill(drill: Drill) {
    if (!profile || advancedToday) return;
    setBusy(true);
    try {
      // The session row is created lazily on the first drill tap, so a golfer
      // browsing the program doesn't leave empty sessions behind.
      let sessionId = session?._id;
      if (!sessionId) {
        sessionId = await startSession({
          profileId: profile._id,
          phase,
          date,
          tasksTotal: daily.drills.length,
        });
      }

      if (completed.includes(drill.id)) {
        await uncompleteDrill({ sessionId, drillId: drill.id });
        setRushed(false);
        return;
      }

      await completeDrill({ sessionId, drillId: drill.id });

      // Warn on the tick that finishes the session, while the golfer is still
      // looking at the drills - an inline card below the fold gets missed.
      const finishesSession = completed.length + 1 >= daily.drills.length;
      const elapsed = minutesSince(session?._creationTime);
      if (finishesSession && elapsed < daily.estimatedMinutes * 0.25) {
        setRushed(true);
        Alert.alert(
          'That was quick',
          `This session is about ${daily.estimatedMinutes} minutes of work, and you logged it in ` +
            `under ${Math.max(1, Math.round(elapsed))} minute${
              Math.round(elapsed) === 1 ? '' : 's'
            }.\n\n` +
            'Ticking drills you have not done only fools the program. Your skills test will ' +
            'find the gap, and the handicap you build will not be real.',
          [{ text: 'Understood' }],
        );
      }
    } catch {
      Alert.alert('Could not update', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvance() {
    if (!profile) return;
    setBusy(true);
    try {
      await advanceDay({ profileId: profile._id, date });
    } catch (e) {
      const message =
        typeof e === 'object' && e !== null && 'data' in e
          ? ((e.data as { message?: string })?.message ??
            "Complete today's session first.")
          : "Complete today's session first.";
      Alert.alert('Not yet', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '90-Day Program' }} />
      <Screen
        eyebrow={`Day ${profile.currentDay} of ${PROGRAM_DAYS}`}
        title={daily.title}
        subtitle={daily.coachGreeting}>
        {/* ─── Phase timeline ─────────────────────────────────────────── */}
        <View style={styles.timeline}>
          {PHASE_ORDER.map((p) => {
            const start = PHASE_DAY_START[p];
            const end = start + PHASES[p].daysAllocated - 1;
            const state =
              profile.currentDay > end
                ? 'done'
                : profile.currentDay >= start
                  ? 'current'
                  : 'locked';

            return (
              <View
                key={p}
                style={[
                  styles.phaseRow,
                  {
                    borderColor: state === 'current' ? colors.primary : colors.border,
                    backgroundColor: state === 'current' ? `${GOLD}14` : colors.card,
                    opacity: state === 'locked' ? 0.55 : 1,
                  },
                ]}>
                {state === 'done' ? (
                  <CheckCircle2 size={18} color={colors.success} />
                ) : state === 'current' ? (
                  <Target size={18} color={colors.primary} />
                ) : (
                  <Lock size={16} color={colors.textMuted} />
                )}
                <View style={styles.phaseText}>
                  <ThemedText variant="label">{PHASES[p].label}</ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    Days {start}–{end}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── Session meta ───────────────────────────────────────────── */}
        <Card eyebrow="Today's session" title={daily.sessionGoal} style={styles.block}>
          <View style={styles.metaRow}>
            <Clock size={14} color={colors.textMuted} />
            <ThemedText variant="caption" tone="muted">
              ~{daily.estimatedMinutes} min · Week {daily.weekInPhase} · Day {dayInPhase} of{' '}
              {PHASES[phase].daysAllocated}
            </ThemedText>
          </View>
          <ThemedText variant="caption" tone="secondary">
            <ThemedText variant="caption" tone="accent">
              Warm-up:{' '}
            </ThemedText>
            {daily.warmup}
          </ThemedText>
        </Card>

        {/* ─── Drills ─────────────────────────────────────────────────── */}
        <ThemedText variant="heading" style={styles.sectionHeading}>
          Drills
        </ThemedText>

        {advancedToday && (
          <Card style={[styles.notice, { borderColor: colors.primary }]}>
            <ThemedText variant="label" tone="accent">
              Day {profile.currentDay} starts tomorrow
            </ThemedText>
            <ThemedText variant="caption" tone="secondary">
              You&apos;ve already completed a program day today. These drills are previewed so you
              can plan - logging them now wouldn&apos;t count toward advancing, because each day
              needs its own session.
            </ThemedText>
          </Card>
        )}

        <View style={styles.drillList}>
          {daily.drills.map((drill) => {
            const done = completed.includes(drill.id);
            const open = expanded === drill.id;

            return (
              <View
                key={drill.id}
                style={[
                  styles.drill,
                  {
                    borderColor: done ? colors.success : colors.border,
                    backgroundColor: colors.card,
                  },
                ]}>
                <View style={styles.drillHead}>
                  <Pressable
                    onPress={() => void toggleDrill(drill)}
                    disabled={busy || advancedToday}
                    style={advancedToday && styles.lockedCheck}
                    hitSlop={8}>
                    {done ? (
                      <CheckCircle2 size={24} color={colors.success} />
                    ) : (
                      <Circle size={24} color={colors.textMuted} />
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.drillTitle}
                    onPress={() => setExpanded(open ? null : drill.id)}>
                    <ThemedText variant="label">{drill.name}</ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      {drill.duration} · {drill.reps}
                    </ThemedText>
                  </Pressable>

                  <Pressable onPress={() => setExpanded(open ? null : drill.id)} hitSlop={8}>
                    {open ? (
                      <ChevronUp size={18} color={colors.textMuted} />
                    ) : (
                      <ChevronDown size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                </View>

                {open && (
                  <View style={[styles.drillBody, { borderTopColor: colors.border }]}>
                    <ThemedText variant="caption" tone="secondary">
                      {drill.description}
                    </ThemedText>
                    <Detail label="Coaching cue" value={drill.coachingCue} />
                    <Detail label="Key focus" value={drill.keyFocus} />
                    {drill.completionStandard && (
                      <Detail label="Done when" value={drill.completionStandard} />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ─── Corrective actions ─────────────────────────────────────── */}
        {daily.correctiveActions.length > 0 && (
          <>
            <ThemedText variant="heading" style={styles.sectionHeading}>
              If it goes wrong
            </ThemedText>
            <View style={styles.drillList}>
              {daily.correctiveActions.map((ca) => (
                <Card key={ca.fault} style={styles.fix}>
                  <ThemedText variant="label" tone="accent">
                    {ca.fault}
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    {ca.symptom}
                  </ThemedText>
                  <ThemedText variant="caption" tone="secondary">
                    {ca.fix}
                  </ThemedText>
                </Card>
              ))}
            </View>
          </>
        )}

        {/* ─── Cooldown + advance ─────────────────────────────────────── */}
        <Card eyebrow="Cooldown" style={styles.block}>
          <ThemedText variant="caption" tone="secondary">
            {daily.cooldown}
          </ThemedText>
        </Card>

        <Card eyebrow="Completion gate" style={styles.block}>
          <ThemedText variant="caption" tone="secondary">
            {daily.completionGate}
          </ThemedText>
        </Card>

        {rushed && (
          <Card style={[styles.nudge, { borderColor: colors.warning }]}>
            <ThemedText variant="label" style={{ color: colors.warning }}>
              That was quick
            </ThemedText>
            <ThemedText variant="caption" tone="secondary">
              This session is about {daily.estimatedMinutes} minutes of work. Ticking drills you
              haven&apos;t done only fools the program - your skills test will find the gap.
            </ThemedText>
          </Card>
        )}

        <Button
          label={
            finished
              ? 'Program complete'
              : advancedToday
                ? `Day ${profile.currentDay + 1} unlocks tomorrow`
                : `Advance to Day ${profile.currentDay + 1}`
          }
          icon={
            advancedToday || finished ? (
              <Lock size={16} color={colors.text} />
            ) : (
              <ArrowRight size={18} color={colors.primaryText} />
            )
          }
          variant={advancedToday || finished ? 'secondary' : 'primary'}
          onPress={() => void handleAdvance()}
          disabled={!allDone || busy || advancedToday || finished}
          loading={busy}
          style={styles.advance}
        />
        <ThemedText variant="caption" tone="muted" style={styles.hint}>
          {finished
            ? 'You have completed the full 90-day programme.'
            : advancedToday
              ? 'One program day per calendar day - rest and repetition are what build the swing.'
              : !allDone
                ? `Complete all ${daily.drills.length} drills to advance.`
                : 'Nice work. Advance when you are done for the day.'}
        </ThemedText>
      </Screen>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText variant="caption" tone="accent" uppercase>
        {label}
      </ThemedText>
      <ThemedText variant="caption" tone="secondary">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: Spacing.one },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  phaseText: { flex: 1, gap: 1 },

  block: { marginTop: Spacing.four },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },

  drillList: { gap: Spacing.two },
  drill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, overflow: 'hidden' },
  drillHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  drillTitle: { flex: 1, gap: 2 },
  drillBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  detail: { gap: 2 },
  fix: { gap: Spacing.one },

  advance: { marginTop: Spacing.four },
  hint: { textAlign: 'center', marginTop: Spacing.two },
  nudge: { marginTop: Spacing.six, borderWidth: 1, gap: Spacing.one },
  notice: { marginBottom: Spacing.two, borderWidth: 1, gap: Spacing.one },
  lockedCheck: { opacity: 0.35 },
});
