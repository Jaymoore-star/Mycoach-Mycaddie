import { useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { BAG_ORDER } from '@/convex/lib/bag';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The R10 metrics worth typing in by hand. */
const FIELDS = [
  { key: 'carryYards', label: 'Carry', suffix: 'yds' },
  { key: 'totalYards', label: 'Total', suffix: 'yds' },
  { key: 'ballSpeedMph', label: 'Ball speed', suffix: 'mph' },
  { key: 'clubSpeedMph', label: 'Club speed', suffix: 'mph' },
  { key: 'smashFactor', label: 'Smash', suffix: '' },
  { key: 'spinRpm', label: 'Spin', suffix: 'rpm' },
  { key: 'launchAngleDeg', label: 'Launch', suffix: '°' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

export default function LaunchSessionScreen() {
  const colors = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id as Id<'launchSessions'>;

  const session = useQuery(api.launchMonitor.getSession, { sessionId });
  const shots = useQuery(api.launchMonitor.getShots, { sessionId });

  const addShot = useMutation(api.launchMonitor.addShot);
  const deleteShot = useMutation(api.launchMonitor.deleteShot);

  const [club, setClub] = useState<string>('7-Iron');
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [busy, setBusy] = useState(false);

  function setField(key: FieldKey, text: string) {
    setValues((v) => ({ ...v, [key]: text }));
  }

  async function handleAdd() {
    // Empty strings mean "not measured" - send undefined so the average
    // ignores them rather than treating a blank as zero.
    const parsed: Partial<Record<FieldKey, number>> = {};
    for (const f of FIELDS) {
      const raw = values[f.key]?.trim();
      if (!raw) continue;
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n)) {
        Alert.alert('Invalid number', `${f.label} must be a number.`);
        return;
      }
      parsed[f.key] = n;
    }

    if (Object.keys(parsed).length === 0) {
      Alert.alert('Nothing to save', 'Enter at least one measurement.');
      return;
    }

    setBusy(true);
    try {
      await addShot({ sessionId, club, ...parsed });
      setValues({});
    } catch {
      Alert.alert('Could not add shot', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Session' }} />
        <Screen title="Loading…">
          <Card>
            <ThemedText variant="body" tone="secondary">
              Fetching your session…
            </ThemedText>
          </Card>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: session.label ?? 'Session' }} />
      <Screen
        eyebrow={session.date}
        title={session.label ?? 'Range session'}
        subtitle={
          session.shotCount > 0
            ? `${session.shotCount} shots · ${session.avgCarryYards ?? '-'} yds avg carry · smash ${
                session.avgSmashFactor ?? '-'
              }`
            : 'No shots logged yet.'
        }>
        {/* ─── Club picker ────────────────────────────────────────────── */}
        <ThemedText variant="caption" tone="muted" uppercase>
          Club
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clubRow}>
          {BAG_ORDER.filter((c) => c !== 'Putter').map((c) => (
            <Pressable
              key={c}
              onPress={() => setClub(c)}
              style={[
                styles.chip,
                {
                  borderColor: club === c ? colors.primary : colors.border,
                  backgroundColor: club === c ? colors.primary : 'transparent',
                },
              ]}>
              <ThemedText
                variant="caption"
                style={{ color: club === c ? colors.primaryText : colors.textSecondary }}>
                {c}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {/* ─── Metric entry ───────────────────────────────────────────── */}
        <Card eyebrow="Add a shot" title={club} style={styles.block}>
          <View style={styles.fieldGrid}>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <ThemedText variant="caption" tone="muted">
                  {f.label} {f.suffix ? `(${f.suffix})` : ''}
                </ThemedText>
                <TextInput
                  value={values[f.key] ?? ''}
                  onChangeText={(t) => setField(f.key, t)}
                  keyboardType="decimal-pad"
                  placeholder="-"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundElement,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          <Button
            label="Add shot"
            icon={<Plus size={18} color={colors.primaryText} />}
            onPress={() => void handleAdd()}
            loading={busy}
            disabled={busy}
            style={styles.addBtn}
          />
        </Card>

        {/* ─── Logged shots ───────────────────────────────────────────── */}
        {shots && shots.length > 0 && (
          <>
            <ThemedText variant="heading" style={styles.sectionHeading}>
              Shots ({shots.length})
            </ThemedText>
            <View style={styles.list}>
              {shots.map((s, i) => (
                <Card key={s._id} style={styles.shot}>
                  <View style={styles.shotHead}>
                    <ThemedText variant="label">
                      {i + 1}. {s.club}
                    </ThemedText>
                    <Pressable
                      onPress={() => void deleteShot({ shotId: s._id })}
                      hitSlop={8}>
                      <Trash2 size={14} color={colors.destructive} />
                    </Pressable>
                  </View>
                  <View style={styles.metricWrap}>
                    {s.carryYards != null && <Metric label="Carry" value={`${s.carryYards} yds`} />}
                    {s.totalYards != null && <Metric label="Total" value={`${s.totalYards} yds`} />}
                    {s.ballSpeedMph != null && (
                      <Metric label="Ball" value={`${s.ballSpeedMph} mph`} />
                    )}
                    {s.smashFactor != null && <Metric label="Smash" value={String(s.smashFactor)} />}
                    {s.spinRpm != null && <Metric label="Spin" value={`${s.spinRpm} rpm`} />}
                    {s.launchAngleDeg != null && (
                      <Metric label="Launch" value={`${s.launchAngleDeg}°`} />
                    )}
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}
      </Screen>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
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
  clubRow: { gap: Spacing.two, paddingVertical: Spacing.two, paddingRight: Spacing.five },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  block: { marginTop: Spacing.three },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  field: { flexBasis: '47%', gap: Spacing.one },
  input: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.base,
  },
  addBtn: { marginTop: Spacing.three },

  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  list: { gap: Spacing.two },
  shot: { gap: Spacing.two },
  shotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  metric: { gap: 1 },
});
