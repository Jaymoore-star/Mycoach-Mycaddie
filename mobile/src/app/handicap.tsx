import { useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { CircleAlert, Target } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';

import { Card } from '@/components/ui/card';
import { HeroStat, Sparkline } from '@/components/ui/chart';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HandicapScreen() {
  const colors = useTheme();
  const profile = useQuery(api.profiles.getMyProfile, {});
  const data = useQuery(
    api.rounds.getHandicapData,
    profile ? { profileId: profile._id } : 'skip',
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'My Handicap' }} />
      <Screen
        eyebrow="World Handicap System"
        title="My Handicap"
        subtitle="Calculated from your best score differentials, to WHS Rule 5.2.">
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
              {data.handicapIndex === null ? (
                <>
                  <HeroStat value="-" label="Handicap index" tone="default" />
                  <ThemedText variant="body" tone="secondary" style={styles.centered}>
                    WHS needs at least three acceptable scores before it issues an index.
                    {data.scoresNeeded > 0 &&
                      ` ${data.scoresNeeded} more to go.`}
                  </ThemedText>
                </>
              ) : (
                <>
                  <HeroStat
                    value={data.handicapIndex.toFixed(1)}
                    label="Handicap index"
                    hint={`Average of your best ${data.roundsUsed} of ${data.eligibleRounds} differential${
                      data.eligibleRounds === 1 ? '' : 's'
                    }`}
                  />
                  {data.lowestIndex !== null && data.lowestIndex < data.handicapIndex && (
                    <ThemedText variant="caption" tone="muted" style={styles.centered}>
                      Low index {data.lowestIndex.toFixed(1)}
                    </ThemedText>
                  )}
                </>
              )}
            </Card>

            {/* ─── Why some rounds don't count ──────────────────────────── */}
            {data.ineligibleRounds > 0 && (
              <Card style={[styles.notice, { borderColor: colors.warning }]}>
                <View style={styles.noticeHead}>
                  <CircleAlert size={16} color={colors.warning} />
                  <ThemedText variant="label" style={{ color: colors.warning }}>
                    {data.ineligibleRounds} round
                    {data.ineligibleRounds === 1 ? '' : 's'} not counted
                  </ThemedText>
                </View>
                <ThemedText variant="caption" tone="secondary">
                  A differential needs the course rating and slope. Rounds logged without
                  them can&apos;t be scored, so they are left out rather than estimated.
                </ThemedText>
              </Card>
            )}

            {/* ─── Trend ───────────────────────────────────────────────── */}
            {data.trend.length >= 2 && (
              <Card eyebrow="Over time" title="Index trend" style={styles.block}>
                <Sparkline values={data.trend.map((t) => t.index)} unit="" lowerIsBetter />
              </Card>
            )}

            {/* ─── Scoring record ──────────────────────────────────────── */}
            {data.contributingRounds.length > 0 && (
              <>
                <ThemedText variant="heading" style={styles.sectionHeading}>
                  Scoring record
                </ThemedText>
                <ThemedText variant="caption" tone="muted" style={styles.sectionNote}>
                  Gold rows are the differentials your index is built from.
                </ThemedText>

                <View style={styles.list}>
                  {data.contributingRounds.map((r, i) => (
                    <Card
                      key={`${r.date}-${r.courseName}-${i}`}
                      style={[
                        styles.round,
                        r.contributing && { borderColor: colors.primary, borderWidth: 1 },
                      ]}>
                      {r.contributing && <Target size={14} color={colors.primary} />}
                      <View style={styles.roundText}>
                        <ThemedText variant="label">{r.courseName}</ThemedText>
                        <ThemedText variant="caption" tone="muted">
                          {new Date(r.date).toLocaleDateString()} · {r.grossScore} strokes
                        </ThemedText>
                      </View>
                      <ThemedText
                        variant="stat"
                        style={[
                          styles.diff,
                          { color: r.contributing ? colors.primary : colors.textSecondary },
                        ]}>
                        {r.differential.toFixed(1)}
                      </ThemedText>
                    </Card>
                  ))}
                </View>
              </>
            )}

            {/* ─── How it works ────────────────────────────────────────── */}
            <Card eyebrow="How this is worked out" style={styles.block}>
              <ThemedText variant="caption" tone="secondary">
                Each round becomes a score differential:
              </ThemedText>
              <ThemedText variant="caption" tone="accent" style={styles.formula}>
                (gross − course rating) × 113 ÷ slope
              </ThemedText>
              <ThemedText variant="caption" tone="secondary">
                Your index is the average of the lowest differentials in your last 20
                rounds - one of them at 5 rounds, three at 9, up to the best eight at 20.
                Short records get a downward adjustment. Only 18-hole rounds count.
              </ThemedText>
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  block: { marginTop: Spacing.three },
  notice: { borderWidth: 1, gap: Spacing.one, marginTop: Spacing.three },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionHeading: { marginTop: Spacing.five },
  sectionNote: { marginBottom: Spacing.two },
  list: { gap: Spacing.two },
  round: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  roundText: { flex: 1, gap: 2 },
  diff: { fontSize: 20, minWidth: 56, textAlign: 'right' },
  formula: { fontFamily: undefined, marginVertical: Spacing.one },
});
