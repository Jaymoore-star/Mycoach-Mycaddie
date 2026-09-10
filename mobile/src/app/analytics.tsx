import { useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BarRow, HeroStat, Sparkline } from '@/components/ui/chart';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AnalyticsScreen() {
  const colors = useTheme();
  const router = useRouter();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const summary = useQuery(
    api.analytics.getPerformanceSummary,
    profile ? { profileId: profile._id } : 'skip',
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'My Analytics' }} />
      <Screen
        eyebrow="Insights"
        title="My Analytics"
        subtitle="Where your strokes actually go, across every round you've logged.">
        {summary === undefined && (
          <Card>
            <ThemedText variant="body" tone="secondary">
              Crunching your rounds…
            </ThemedText>
          </Card>
        )}

        {summary && summary.roundsPlayed === 0 && (
          <Card title="No complete rounds yet">
            <ThemedText variant="body" tone="secondary">
              Analytics needs full 18-hole rounds. Play one in My Caddie and it appears
              here — scoring trend, fairways, greens in regulation and putts.
            </ThemedText>
            <Button
              label="Start a round"
              variant="secondary"
              onPress={() => router.push('/(tabs)/caddie')}
              style={styles.cta}
            />
            {summary.practiceDays > 0 && (
              <ThemedText variant="caption" tone="muted">
                {summary.practiceDays} practice day
                {summary.practiceDays === 1 ? '' : 's'} logged so far —
                that feeds My Streak and the 90-Day Program.
              </ThemedText>
            )}
          </Card>
        )}

        {summary && summary.roundsPlayed > 0 && (
          <>
            <Card>
              <HeroStat
                value={summary.avgScore === null ? '—' : summary.avgScore.toFixed(1)}
                label="Scoring average"
                hint={`${summary.roundsPlayed} complete round${
                  summary.roundsPlayed === 1 ? '' : 's'
                }${summary.bestScore !== null ? ` · best ${summary.bestScore}` : ''}`}
              />
            </Card>

            {/* ─── Scoring trend ───────────────────────────────────────── */}
            {summary.scoringTrend.length >= 2 && (
              <Card eyebrow="Over time" title="Scoring trend" style={styles.block}>
                <Sparkline
                  values={summary.scoringTrend.map((r) => r.score)}
                  lowerIsBetter
                />
              </Card>
            )}

            {/* ─── Accuracy ────────────────────────────────────────────── */}
            <Card eyebrow="Off the tee and in" title="Accuracy" style={styles.block}>
              {summary.fairwayPct !== null && (
                <BarRow
                  label="Fairways hit"
                  value={summary.fairwayPct}
                  max={100}
                  display={`${summary.fairwayPct}%`}
                />
              )}
              {summary.girPct !== null && (
                <BarRow
                  label="Greens in regulation"
                  value={summary.girPct}
                  max={100}
                  display={`${summary.girPct}%`}
                />
              )}
              {summary.fairwayPct === null && summary.girPct === null && (
                <ThemedText variant="caption" tone="muted">
                  Tick the fairway and green-in-regulation toggles while scoring and
                  these fill in.
                </ThemedText>
              )}
              {summary.puttsPerRound !== null && (
                <ThemedText variant="caption" tone="secondary">
                  {summary.puttsPerRound} putts per round
                  {summary.puttsPerRound > 32
                    ? ' — the flat stick is where the strokes are.'
                    : summary.puttsPerRound < 30
                      ? ' — strong putting.'
                      : '.'}
                </ThemedText>
              )}
            </Card>

            {/* ─── Where strokes are lost ──────────────────────────────── */}
            {summary.strokesByPar.length > 0 && (
              <Card eyebrow="By hole type" title="Strokes over par" style={styles.block}>
                {summary.strokesByPar.map((p) => (
                  <BarRow
                    key={p.par}
                    label={`Par ${p.par}`}
                    // Bars compare on a fixed 2-over scale so par 3s and par 5s
                    // are read against the same ruler.
                    value={Math.max(0, p.avgOverPar)}
                    max={2}
                    display={`${p.avgOverPar > 0 ? '+' : ''}${p.avgOverPar.toFixed(2)} avg · ${p.holes} holes`}
                    color={p.avgOverPar > 1 ? colors.warning : undefined}
                  />
                ))}
                <ThemedText variant="caption" tone="muted">
                  Average strokes over par per hole. The longest bar is costing you most.
                </ThemedText>
              </Card>
            )}

            {/* ─── Practice volume ─────────────────────────────────────── */}
            <Card eyebrow="Practice" title="Work put in" style={styles.block}>
              <View style={styles.metaGrid}>
                <View style={styles.meta}>
                  <ThemedText variant="stat" style={styles.metaValue}>
                    {summary.practiceDays}
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted" uppercase>
                    Practice days
                  </ThemedText>
                </View>
                <View style={styles.meta}>
                  <ThemedText variant="stat" style={styles.metaValue}>
                    {summary.completedSessions}
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted" uppercase>
                    Sessions done
                  </ThemedText>
                </View>
                <View style={styles.meta}>
                  <ThemedText variant="stat" style={styles.metaValue}>
                    {summary.shotsLogged}
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted" uppercase>
                    Shots logged
                  </ThemedText>
                </View>
              </View>
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: Spacing.three, gap: Spacing.three },
  cta: { marginTop: Spacing.three },
  metaGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { alignItems: 'center', gap: 2 },
  metaValue: { fontSize: 24 },
});
