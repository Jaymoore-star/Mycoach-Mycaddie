import { useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { Target } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BarRow, HeroStat } from '@/components/ui/chart';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Turns a snake_case enum value into something readable. */
const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default function StatsScreen() {
  const colors = useTheme();
  const router = useRouter();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const stats = useQuery(api.shots.getShotStats, profile ? { profileId: profile._id } : 'skip');
  const shots = useQuery(
    api.shots.getRecentShots,
    profile ? { profileId: profile._id, limit: 20 } : 'skip',
  );

  const breakdown = (counts: Record<string, number> | undefined) => {
    if (!counts) return [];
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 0;
    const total = entries.reduce((s, [, n]) => s + n, 0);
    return entries.map(([key, n]) => ({
      key,
      n,
      max,
      pct: total > 0 ? Math.round((n / total) * 100) : 0,
    }));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'My Stats' }} />
      <Screen
        eyebrow="Performance"
        title="My Stats"
        subtitle="Dispersion, contact quality and skills-test pass rate from your logged shots.">
        {stats === undefined && (
          <Card>
            <ThemedText variant="body" tone="secondary">
              Loading your shots…
            </ThemedText>
          </Card>
        )}

        {stats === null && (
          <Card title="No shots logged yet">
            <ThemedText variant="body" tone="secondary">
              Stats are built from individual shots - the distance you were aiming for
              against the distance you actually hit. Log shots during a practice session
              or import a Launch Monitor session to get started.
            </ThemedText>
            <Button
              label="Open Launch Monitor"
              variant="secondary"
              onPress={() => router.push('/launch')}
              style={styles.cta}
            />
          </Card>
        )}

        {stats && (
          <>
            <Card>
              <HeroStat
                value={stats.passRate === null ? '-' : `${stats.passRate}%`}
                label="Skills-test pass rate"
                hint={
                  stats.passRate === null
                    ? 'No shots judged against a threshold yet'
                    : `${stats.judgedCount} shot${stats.judgedCount === 1 ? '' : 's'} judged against your level's accuracy threshold`
                }
              />
            </Card>

            <View style={styles.statRow}>
              <Card style={styles.tile}>
                <Target size={18} color={colors.primary} />
                <ThemedText variant="stat">{stats.avgOffTargetYards}</ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase>
                  Avg yds off
                </ThemedText>
              </Card>
              <Card style={styles.tile}>
                <Target size={18} color={colors.primary} />
                <ThemedText variant="stat">{stats.shotCount}</ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase>
                  Shots logged
                </ThemedText>
              </Card>
            </View>

            {/* ─── Miss pattern ────────────────────────────────────────── */}
            {breakdown(stats.missBreakdown).length > 0 && (
              <Card
                eyebrow="Where you miss"
                title={stats.dominantMiss ? humanize(stats.dominantMiss) : 'Miss pattern'}
                style={styles.block}>
                {breakdown(stats.missBreakdown).map((b) => (
                  <BarRow
                    key={b.key}
                    label={humanize(b.key)}
                    value={b.n}
                    max={b.max}
                    display={`${b.n} · ${b.pct}%`}
                  />
                ))}
              </Card>
            )}

            {/* ─── Shot shape ──────────────────────────────────────────── */}
            {breakdown(stats.shapeBreakdown).length > 0 && (
              <Card
                eyebrow="Ball flight"
                title={stats.dominantShape ? humanize(stats.dominantShape) : 'Shot shape'}
                style={styles.block}>
                {breakdown(stats.shapeBreakdown).map((b) => (
                  <BarRow
                    key={b.key}
                    label={humanize(b.key)}
                    value={b.n}
                    max={b.max}
                    display={`${b.n} · ${b.pct}%`}
                  />
                ))}
              </Card>
            )}

            {/* ─── Contact ─────────────────────────────────────────────── */}
            {breakdown(stats.contactBreakdown).length > 0 && (
              <Card
                eyebrow="Strike quality"
                title={stats.dominantContact ? humanize(stats.dominantContact) : 'Contact'}
                style={styles.block}>
                {breakdown(stats.contactBreakdown).map((b) => (
                  <BarRow
                    key={b.key}
                    label={humanize(b.key)}
                    value={b.n}
                    max={b.max}
                    display={`${b.n} · ${b.pct}%`}
                    color={b.key === 'solid' ? colors.success : undefined}
                  />
                ))}
              </Card>
            )}

            {/* ─── Recent shots ────────────────────────────────────────── */}
            {shots && shots.length > 0 && (
              <>
                <ThemedText variant="heading" style={styles.sectionHeading}>
                  Recent shots
                </ThemedText>
                <View style={styles.list}>
                  {shots.map((s) => (
                    <Card key={s._id} style={styles.shot}>
                      <View style={styles.shotHead}>
                        <ThemedText variant="label">{s.club}</ThemedText>
                        <ThemedText
                          variant="caption"
                          style={{
                            color:
                              s.skillTestResult === 'pass'
                                ? colors.success
                                : s.skillTestResult === 'fail'
                                  ? colors.warning
                                  : colors.textMuted,
                          }}>
                          {s.skillTestResult ? s.skillTestResult.toUpperCase() : '-'}
                        </ThemedText>
                      </View>
                      <ThemedText variant="caption" tone="muted">
                        {s.actualDistanceYards} yds vs {s.targetDistanceYards} target ·{' '}
                        {s.distanceFromTargetYards} off · {humanize(s.shotShape)}
                      </ThemedText>
                      {s.aiInsight && (
                        <ThemedText variant="caption" tone="secondary">
                          {s.aiInsight}
                        </ThemedText>
                      )}
                    </Card>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: Spacing.three, gap: Spacing.three },
  statRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  tile: { flex: 1, gap: Spacing.one },
  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  list: { gap: Spacing.two },
  shot: { gap: Spacing.one },
  shotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { marginTop: Spacing.three },
});
