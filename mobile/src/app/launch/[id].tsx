import { useAction, useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { BAG_ORDER } from '@/convex/lib/bag';
import type { ParsedShot } from '@/convex/lib/voice';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { MicButton, SpeakButton, VoiceTranscript } from '@/components/ui/voice-controls';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLiveDictation } from '@/hooks/use-live-dictation';
import { usePlayback, voiceErrorMessage } from '@/hooks/use-voice';

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

  // ─── Voice ────────────────────────────────────────────────────────────

  const parseShot = useAction(api.voice.parseShot);
  const readAloud = useAction(api.voice.readAloudSession);
  const debrief = usePlayback();

  const [heard, setHeard] = useState('');
  const [spoken, setSpoken] = useState<ParsedShot | null>(null);
  const [parsing, setParsing] = useState(false);
  const [debriefText, setDebriefText] = useState('');
  const [debriefBusy, setDebriefBusy] = useState(false);

  /**
   * A spoken shot fills the form; it does not save.
   *
   * Transcription plus extraction is two chances to mishear a number, and a
   * wrong carry distance quietly skews every average the bag is built from.
   * The golfer sees what was understood and taps Add shot.
   */
  const handleSpokenShot = useCallback(
    async (transcript: string) => {
      setHeard(transcript);
      setParsing(true);
      try {
        const parsed = await parseShot({ transcript });
        setSpoken(parsed);

        if (parsed.club) setClub(parsed.club);
        setValues((v) => ({
          ...v,
          // "It went 145" is a carry number in a launch monitor session.
          ...(parsed.actualDistanceYards != null
            ? { carryYards: String(parsed.actualDistanceYards) }
            : {}),
        }));
      } catch (error) {
        Alert.alert('Could not read that shot', voiceErrorMessage(error, 'Please try again.'));
      } finally {
        setParsing(false);
      }
    },
    [parseShot],
  );

  // The shot is read once, from the finished sentence - a half-heard "one
  // forty" would otherwise fill the form in before "five" arrived.
  const dictation = useLiveDictation({ onFinal: (text) => void handleSpokenShot(text) });

  function clearSpoken() {
    setHeard('');
    setSpoken(null);
  }

  async function hearDebrief() {
    if (debrief.isPlaying) {
      debrief.stop();
      return;
    }
    setDebriefBusy(true);
    try {
      const result = await readAloud({ sessionId });
      setDebriefText(result.text);
      await debrief.play(result.url);
    } catch (error) {
      Alert.alert('Could not read that out', voiceErrorMessage(error, 'Please try again.'));
    } finally {
      setDebriefBusy(false);
    }
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
      // Shape, contact and notes have no typed input on this screen - the only
      // way they reach a launch shot is by being spoken, so they ride along
      // with whichever numbers were entered.
      await addShot({
        sessionId,
        club,
        ...parsed,
        ...(spoken?.shotShape ? { shotShape: spoken.shotShape } : {}),
        ...(spoken?.contactType ? { contactType: spoken.contactType } : {}),
        ...(spoken?.notes ? { notes: spoken.notes } : {}),
      });
      setValues({});
      clearSpoken();
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
        {/* ─── Spoken debrief ─────────────────────────────────────────── */}
        {session.shotCount > 0 && (
          <Card eyebrow="Debrief" title="Hear how it went" style={styles.debrief}>
            <ThemedText variant="caption" tone="secondary">
              Your coach reads the session back to you - the numbers, the spread and
              what to work on next.
            </ThemedText>
            <SpeakButton
              state={debriefBusy ? 'loading' : debrief.isPlaying ? 'speaking' : 'idle'}
              onSpeak={() => void hearDebrief()}
              onStop={debrief.stop}
              label={debrief.isPlaying ? 'Stop' : 'Play debrief'}
              style={styles.micButton}
            />
            {debriefText ? <VoiceTranscript text={debriefText} /> : null}
          </Card>
        )}

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
          <ThemedText variant="caption" tone="secondary">
            Tap the mic and say it - &ldquo;seven iron, one forty five, little fade,
            caught it clean&rdquo; - then tap stop. Or type the numbers in below.
          </ThemedText>

          <MicButton
            state={dictation.state}
            onStart={() => void dictation.start()}
            onStop={() => void dictation.stop()}
            {...(parsing ? { label: 'Reading the shot' } : {})}
            style={styles.micButton}
          />

          {dictation.error && (
            <ThemedText variant="caption" style={{ color: colors.destructive }}>
              {dictation.error}
            </ThemedText>
          )}

          {heard ? (
            <View style={styles.heard}>
              <VoiceTranscript text={heard} speaker="You said" />
              <View style={styles.heardFoot}>
                <ThemedText variant="caption" tone="muted">
                  {describeParsed(spoken)}
                </ThemedText>
                <Pressable onPress={clearSpoken} hitSlop={8} accessibilityRole="button">
                  <X size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          ) : null}

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

/** What the extractor actually took from the sentence, in plain words. */
function describeParsed(shot: ParsedShot | null): string {
  if (!shot) return 'Working out what you said…';

  const parts = [
    shot.club,
    shot.actualDistanceYards != null ? `${shot.actualDistanceYards} yds` : null,
    shot.shotShape,
    shot.contactType ? `${shot.contactType} contact` : null,
  ].filter(Boolean);

  // Nothing usable is a real outcome, not an error: the numbers are still
  // there to type, and saying so beats leaving a blank line under the mic.
  return parts.length > 0
    ? `Picked up: ${parts.join(' · ')}`
    : 'Nothing usable in that one - type it in instead.';
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

  debrief: { marginTop: Spacing.three, gap: Spacing.two },
  block: { marginTop: Spacing.three },
  micButton: { marginTop: Spacing.two },
  heard: { gap: Spacing.two, marginTop: Spacing.two },
  heardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
