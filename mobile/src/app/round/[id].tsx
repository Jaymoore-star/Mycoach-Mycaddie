import { useAction, useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Flag,
  Minus,
  Plus,
  RotateCcw,
  Wind,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  type CaddieConditions,
  type TendencyProfile,
  buildCaddieRecommendation,
} from '@/convex/lib/caddie';
import type { CoachId } from '@/convex/lib/coachLevels';
import { type TeeBox, describeBreak } from '@/convex/lib/courses';
import { buildShotBrief } from '@/convex/lib/voice';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipRow, type ChipOption } from '@/components/ui/chip-row';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { MicButton, SpeakButton, VoiceTranscript } from '@/components/ui/voice-controls';
import { FontSize, GOLD, Radius, Spacing } from '@/constants/theme';
import { useCourse } from '@/hooks/use-courses';
import { useTheme } from '@/hooks/use-theme';
import { useLiveDictation } from '@/hooks/use-live-dictation';
import { usePlayback, useSpeech, voiceErrorMessage } from '@/hooks/use-voice';

const NO_TENDENCIES: TendencyProfile = {
  dominantMiss: null,
  avgMissYards: 0,
  favoriteShape: null,
  commonClubs: [],
  weaknesses: [],
};

type Lie = CaddieConditions['lie'];
type WindDir = CaddieConditions['windDirection'];
type PinPos = CaddieConditions['pinPosition'];
type Firmness = CaddieConditions['greenFirmness'];

const LIES: readonly ChipOption<Lie>[] = [
  { value: 'tee', label: 'Tee' },
  { value: 'fairway', label: 'Fairway' },
  { value: 'rough', label: 'Rough' },
  { value: 'bunker', label: 'Bunker' },
  { value: 'hardpan', label: 'Hardpan' },
  { value: 'upslope', label: 'Uphill lie' },
  { value: 'downslope', label: 'Downhill lie' },
  { value: 'sidehill', label: 'Sidehill' },
];

const WIND_DIRS: readonly ChipOption<WindDir>[] = [
  { value: 'none', label: 'Calm' },
  { value: 'headwind', label: 'Into' },
  { value: 'tailwind', label: 'Downwind' },
  { value: 'crosswind_left', label: 'Cross L' },
  { value: 'crosswind_right', label: 'Cross R' },
];

const PIN_POSITIONS: readonly ChipOption<PinPos>[] = [
  { value: 'front', label: 'Front' },
  { value: 'middle', label: 'Middle' },
  { value: 'back', label: 'Back' },
];

const FIRMNESS: readonly ChipOption<Firmness>[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'firm', label: 'Firm' },
];

/**
 * Conditions that change shot to shot, tagged with the hole they belong to.
 *
 * Wind speed, green firmness and temperature are deliberately NOT here: they
 * hold for the whole round, and resetting them every hole meant re-entering
 * them eighteen times.
 */
type ShotConditions = {
  hole: number;
  distance: number;
  lie: Lie;
  windDir: WindDir;
  elevation: number;
  pinPos: PinPos;
};

/** A full tee shot on the given hole. Module scope keeps the identity stable. */
function defaultsFor(hole: number, yards: number): ShotConditions {
  return { hole, distance: yards, lie: 'tee', windDir: 'none', elevation: 0, pinPos: 'middle' };
}

export default function RoundScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roundId = id as Id<'roundScores'>;

  const round = useQuery(api.rounds.getRound, { roundId });
  const profile = useQuery(api.profiles.getMyProfile, {});
  const tendencies = useQuery(
    api.rounds.getPlayerTendencies,
    profile ? { profileId: profile._id } : 'skip',
  );

  const logHole = useMutation(api.rounds.logHoleScore);
  const finishRound = useMutation(api.rounds.finishRound);

  const [busy, setBusy] = useState(false);
  const [showConditions, setShowConditions] = useState(false);

  /** First hole with no score logged, or 18 once the card is full. */
  const firstUnplayed = (() => {
    if (!round) return 1;
    const played = new Set(round.holes.map((h) => h.hole));
    let next = 1;
    while (next <= 18 && played.has(next)) next++;
    return next > 18 ? 18 : next;
  })();

  // Resuming lands on the next hole to play rather than back at the tee.
  // Derived rather than assigned in an effect: null simply means "the golfer
  // hasn't navigated yet", so there is no setState-during-mount cascade.
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const holeNumber = selectedHole ?? firstUnplayed;

  // Resolves a built-in course or one the golfer added. Null while their own
  // courses load, and null for good if they have since deleted this one - the
  // round keeps its own par, rating and slope either way, so only the caddie's
  // hole yardages are missing.
  const course = useCourse(round?.courseId);
  const courseHole = course?.holes.find((h) => h.hole === holeNumber);
  const tee = (round?.teeBox ?? 'regular') as TeeBox;
  const holeYards = courseHole?.yards[tee] ?? 400;

  const logged = round?.holes.find((h) => h.hole === holeNumber);
  const par = courseHole?.par ?? 4;

  // ─── Shot conditions ──────────────────────────────────────────────────
  const [shotDraft, setShotDraft] = useState<ShotConditions | null>(null);
  const [windSpeed, setWindSpeed] = useState(0);
  const [firmness, setFirmness] = useState<Firmness>('medium');
  const [temperature, setTemperature] = useState(70);

  // Keyed to the hole: a draft from another hole is ignored, which resets the
  // shot cleanly without an effect. Carrying a previous hole's lie forward
  // would silently produce wrong yardages. Memoized so the recommendation
  // below has a stable dependency instead of six destructured fields.
  const shot =
    shotDraft && shotDraft.hole === holeNumber
      ? shotDraft
      : defaultsFor(holeNumber, holeYards);

  const { distance, lie, windDir, elevation, pinPos } = shot;
  const patchShot = (patch: Partial<ShotConditions>) => setShotDraft({ ...shot, ...patch });

  /** Back to a full tee shot on this hole. */
  function resetConditions() {
    setShotDraft(defaultsFor(holeNumber, holeYards));
    setWindSpeed(0);
    setFirmness('medium');
  }

  // ─── Score entry ──────────────────────────────────────────────────────
  const [score, setScore] = useState<number | null>(null);
  const [putts, setPutts] = useState<number | null>(null);
  const [fairway, setFairway] = useState<boolean | null>(null);
  const [gir, setGir] = useState<boolean | null>(null);

  const effectiveScore = score ?? logged?.score ?? par;
  const effectivePutts = putts ?? logged?.putts ?? 2;
  const effectiveFairway = fairway ?? logged?.fairwayHit ?? null;
  const effectiveGir = gir ?? logged?.girHit ?? null;

  const recommendation = (() => {
    if (!profile) return null;

    const conditions: CaddieConditions = {
      distanceToPin: distance,
      elevation,
      windSpeedMph: windSpeed,
      windDirection: windDir,
      lie,
      pinPosition: pinPos,
      greenFirmness: firmness,
      temperature,
      altitude: course?.altitudeFt ?? 0,
    };

    return buildCaddieRecommendation(
      profile.displayName,
      profile.skillLevel,
      tendencies ?? NO_TENDENCIES,
      conditions,
      // Personal carry distances override the generic per-skill chart.
      profile.clubDistances
        ? Object.fromEntries(
            Object.entries(profile.clubDistances).map(([club, d]) => [club, d.carry]),
          )
        : undefined,
    );
  })();

  // ─── Voice ────────────────────────────────────────────────────────────
  // The brief is spoken from the recommendation already on screen rather than
  // recomputed on the server, so the audio and the card can never disagree.

  const coachId = profile?.coachId as CoachId | undefined;
  const speech = useSpeech(coachId);
  const reply = usePlayback();
  const askCaddie = useAction(api.voice.askCaddie);

  const [heard, setHeard] = useState('');
  const [caddieAnswer, setCaddieAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  // A plain function, not a `useCallback`: the React Compiler is on for this
  // project and memoizes it, and a hand-written dependency list over values it
  // considers mutable (`lie`, `recommendation`) makes it bail out of
  // optimising the whole screen.
  async function handleQuestion(transcript: string) {
    if (!profile) return;

    setHeard(transcript);
    setCaddieAnswer('');
    setAsking(true);
    try {
      // The caddie hears the same situation the card was built from, so its
      // answer argues with the recommendation only when it means to.
      const answer = await askCaddie({
        profileId: profile._id,
        transcript,
        holeNumber,
        par,
        distanceToPin: distance,
        windMph: windSpeed,
        windDirection: windDir,
        lie,
        ...(recommendation
          ? {
              primaryClub: recommendation.primaryClub,
              adjustedYardage: recommendation.adjustedYardage,
              aimAdjustment: recommendation.aimAdjustment,
            }
          : {}),
      });
      setCaddieAnswer(answer.text);
      await reply.play(answer.url);
    } catch (error) {
      Alert.alert(
        'Your caddie could not answer',
        voiceErrorMessage(error, 'Please try again.'),
      );
    } finally {
      setAsking(false);
    }
  }

  // `onFinal` only: the caddie is asked once, when the golfer stops talking.
  // Firing on every word would send a fresh question per syllable.
  const dictation = useLiveDictation({ onFinal: (text) => void handleQuestion(text) });

  function hearTheBrief() {
    if (!recommendation) return;
    void speech.speak(buildShotBrief(recommendation, holeNumber, par));
  }

  function goToHole(n: number) {
    if (n < 1 || n > 18) return;
    setScore(null);
    setPutts(null);
    setFairway(null);
    setGir(null);
    setSelectedHole(n);
  }

  async function saveHole(advance: boolean) {
    setBusy(true);
    try {
      await logHole({
        roundId,
        hole: holeNumber,
        par,
        score: effectiveScore,
        putts: effectivePutts,
        fairwayHit: par === 3 ? undefined : (effectiveFairway ?? undefined),
        girHit: effectiveGir ?? undefined,
        distanceToPin: holeYards,
        pinSide: 'center',
        pinDepth: pinPos,
      });
      if (advance && holeNumber < 18) {
        goToHole(holeNumber + 1);
      } else {
        setScore(null);
        setPutts(null);
        setFairway(null);
        setGir(null);
      }
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    setBusy(true);
    try {
      const result = await finishRound({ roundId });
      Alert.alert(
        'Round complete',
        `${result.totalScore} strokes (${result.scoreDifferential > 0 ? '+' : ''}${
          result.scoreDifferential
        } to par).`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Could not finish', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!round) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Round' }} />
        <Screen title="Loading…">
          <Card>
            <ThemedText variant="body" tone="secondary">
              Fetching your round…
            </ThemedText>
          </Card>
        </Screen>
      </>
    );
  }

  const holesLogged = round.holes.length;
  const conditionsSummary = [
    `${distance} yds`,
    LIES.find((l) => l.value === lie)?.label,
    windDir === 'none' ? 'calm' : `${windSpeed}mph ${WIND_DIRS.find((w) => w.value === windDir)?.label}`,
    elevation !== 0 ? `${elevation > 0 ? '+' : ''}${elevation} elev` : null,
    `${PIN_POSITIONS.find((p) => p.value === pinPos)?.label} pin`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: round.courseName }} />
      <Screen
        eyebrow={`Hole ${holeNumber} · Par ${par}`}
        title={`${holeYards} yards`}
        subtitle={
          courseHole ? `Stroke index ${courseHole.strokeIndex} · ${tee} tees` : undefined
        }>
        {/* ─── Hole navigation ────────────────────────────────────────── */}
        <View style={styles.holeNav}>
          <Pressable
            onPress={() => goToHole(holeNumber - 1)}
            disabled={holeNumber === 1}
            style={[styles.navBtn, { opacity: holeNumber === 1 ? 0.3 : 1 }]}
            hitSlop={8}>
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>

          <View style={styles.holeDots}>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => {
              const done = round.holes.some((h) => h.hole === n);
              return (
                <Pressable key={n} onPress={() => goToHole(n)} hitSlop={4}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          n === holeNumber
                            ? colors.primary
                            : done
                              ? colors.success
                              : colors.backgroundElement,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => goToHole(holeNumber + 1)}
            disabled={holeNumber === 18}
            style={[styles.navBtn, { opacity: holeNumber === 18 ? 0.3 : 1 }]}
            hitSlop={8}>
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* ─── Shot conditions ────────────────────────────────────────── */}
        <Card style={styles.block}>
          <Pressable onPress={() => setShowConditions((v) => !v)} style={styles.rowBetween}>
            <View style={styles.conditionsHead}>
              <ThemedText variant="caption" tone="accent" uppercase>
                Shot conditions
              </ThemedText>
              <ThemedText variant="caption" tone="secondary">
                {conditionsSummary}
              </ThemedText>
            </View>
            {showConditions ? (
              <ChevronUp size={18} color={colors.textMuted} />
            ) : (
              <ChevronDown size={18} color={colors.textMuted} />
            )}
          </Pressable>

          {showConditions && (
            <View style={[styles.conditionsBody, { borderTopColor: colors.border }]}>
              <Stepper
                label="Distance to pin"
                value={distance}
                min={5}
                max={700}
                step={5}
                suffix=" yds"
                onChange={(n) => patchShot({ distance: n })}
              />
              <ChipRow label="Lie" options={LIES} value={lie} onChange={(v) => patchShot({ lie: v })} />
              <ChipRow label="Wind" options={WIND_DIRS} value={windDir} onChange={(v) => patchShot({ windDir: v })} />
              {windDir !== 'none' && (
                <Stepper
                  label="Wind speed"
                  value={windSpeed}
                  min={0}
                  max={50}
                  step={1}
                  suffix=" mph"
                  onChange={setWindSpeed}
                />
              )}
              <Stepper
                label="Elevation"
                value={elevation}
                min={-60}
                max={60}
                step={5}
                suffix=" yds"
                signed
                onChange={(n) => patchShot({ elevation: n })}
              />
              <ChipRow label="Pin position" options={PIN_POSITIONS} value={pinPos} onChange={(v) => patchShot({ pinPos: v })} />
              <ChipRow label="Green" options={FIRMNESS} value={firmness} onChange={setFirmness} />
              <Stepper
                label="Temperature"
                value={temperature}
                min={20}
                max={120}
                step={5}
                suffix="°F"
                onChange={setTemperature}
              />

              <Button
                label="Reset to tee shot"
                variant="ghost"
                icon={<RotateCcw size={16} color={colors.text} />}
                onPress={resetConditions}
              />
            </View>
          )}
        </Card>

        {/* ─── Caddie recommendation ──────────────────────────────────── */}
        {recommendation && (
          <Card eyebrow="Your caddie says" title={recommendation.primaryClub} style={styles.block}>
            <ThemedText variant="caption" tone="secondary">
              {recommendation.caddieQuip}
            </ThemedText>

            <SpeakButton
              state={speech.state}
              onSpeak={hearTheBrief}
              onStop={speech.stop}
              label={speech.state === 'speaking' ? 'Stop' : 'Hear the brief'}
              style={styles.speakButton}
            />

            <View style={styles.yardageRow}>
              <View>
                <ThemedText variant="stat" style={styles.yardage}>
                  {recommendation.adjustedYardage}
                </ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase>
                  Playing yards
                </ThemedText>
              </View>
              <View style={styles.alt}>
                <ThemedText variant="label" tone="accent">
                  {recommendation.alternateClub ?? '-'}
                </ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase>
                  Alternate
                </ThemedText>
              </View>
            </View>

            {recommendation.yardageAdjustments.length > 0 && (
              <View style={[styles.adjustments, { borderTopColor: colors.border }]}>
                <ThemedText variant="caption" tone="muted" uppercase>
                  {recommendation.rawYardage} yds actual
                </ThemedText>
                {recommendation.yardageAdjustments.map((a) => (
                  <View key={a.reason} style={styles.rowBetween}>
                    <ThemedText variant="caption" tone="muted">
                      {a.reason}
                    </ThemedText>
                    <ThemedText
                      variant="caption"
                      style={{ color: a.yards > 0 ? colors.warning : colors.success }}>
                      {a.yards > 0 ? '+' : ''}
                      {a.yards} yds
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.details, { borderTopColor: colors.border }]}>
              <Detail icon={<Compass size={13} color={colors.primary} />} text={recommendation.aimAdjustment} />
              <Detail icon={<Flag size={13} color={colors.primary} />} text={recommendation.landingTarget} />
              <Detail icon={<Wind size={13} color={colors.primary} />} text={recommendation.courseManagementNote} />
              {recommendation.layupRecommendation && (
                <Detail
                  icon={<ChevronDown size={13} color={colors.warning} />}
                  text={recommendation.layupRecommendation}
                />
              )}
            </View>

            {recommendation.preShotCues.length > 0 && (
              <View style={[styles.cues, { borderTopColor: colors.border }]}>
                <ThemedText variant="caption" tone="accent" uppercase>
                  Pre-shot
                </ThemedText>
                {recommendation.preShotCues.map((cue) => (
                  <ThemedText key={cue} variant="caption" tone="secondary">
                    • {cue}
                  </ThemedText>
                ))}
              </View>
            )}

            <View style={[styles.cues, { borderTopColor: colors.border }]}>
              <ThemedText variant="caption" tone="accent" uppercase>
                On the green
              </ThemedText>
              <ThemedText variant="caption" tone="secondary">
                {recommendation.greenReading}
              </ThemedText>
              {courseHole && (
                <ThemedText variant="caption" tone="muted">
                  {describeBreak(courseHole.green)}
                </ThemedText>
              )}
            </View>
          </Card>
        )}

        {/* ─── Ask your caddie ────────────────────────────────────────── */}
        {profile && (
          <Card
            eyebrow="Ask your caddie"
            title="Talk it through"
            style={styles.block}>
            <ThemedText variant="caption" tone="secondary">
              Tap the mic and ask, then tap stop. Your caddie knows the hole, the
              wind and the club it just gave you.
            </ThemedText>

            <MicButton
              state={dictation.state}
              onStart={() => void dictation.start()}
              onStop={() => void dictation.stop()}
              {...(asking ? { label: 'Thinking it over' } : {})}
              style={styles.micButton}
            />

            {dictation.error && (
              <ThemedText variant="caption" style={{ color: colors.destructive }}>
                {dictation.error}
              </ThemedText>
            )}

            {heard ? <VoiceTranscript text={heard} speaker="You said" /> : null}
            {caddieAnswer ? (
              <VoiceTranscript text={caddieAnswer} speaker="Your caddie" />
            ) : null}
          </Card>
        )}

        {/* ─── Score entry ────────────────────────────────────────────── */}
        <Card eyebrow="Score" title={`Hole ${holeNumber}`} style={styles.block}>
          <Stepper
            label="Strokes"
            value={effectiveScore}
            min={1}
            max={15}
            onChange={setScore}
            highlight={effectiveScore - par}
          />
          <Stepper label="Putts" value={effectivePutts} min={0} max={10} onChange={setPutts} />

          {par !== 3 && (
            <Toggle label="Fairway hit" value={effectiveFairway} onChange={setFairway} />
          )}
          <Toggle label="Green in regulation" value={effectiveGir} onChange={setGir} />

          <View style={styles.actions}>
            <Button
              label="Save"
              variant="secondary"
              onPress={() => void saveHole(false)}
              disabled={busy}
              style={styles.action}
            />
            <Button
              label={holeNumber === 18 ? 'Save last hole' : 'Save & next'}
              onPress={() => void saveHole(true)}
              loading={busy}
              disabled={busy}
              style={styles.action}
            />
          </View>
        </Card>

        {/* ─── Scorecard summary ──────────────────────────────────────── */}
        <Card eyebrow="Round total" title={`${round.totalScore} strokes`} style={styles.block}>
          <ThemedText variant="caption" tone="secondary">
            {holesLogged} of 18 holes logged
            {holesLogged > 0 &&
              ` · ${round.scoreDifferential > 0 ? '+' : ''}${round.scoreDifferential} to par`}
          </ThemedText>
        </Card>

        <Button
          label="Finish round"
          onPress={() => void handleFinish()}
          disabled={busy || holesLogged === 0}
          style={styles.finish}
        />
        {holesLogged < 18 && holesLogged > 0 && (
          <ThemedText variant="caption" tone="muted" style={styles.hint}>
            Rounds under 18 holes don&apos;t count toward your handicap.
          </ThemedText>
        )}
      </Screen>
    </>
  );
}

function Detail({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.detail}>
      {icon}
      <ThemedText variant="caption" tone="secondary" style={styles.detailText}>
        {text}
      </ThemedText>
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  signed,
  onChange,
  highlight,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  /** Show a leading + for positive values (elevation). */
  signed?: boolean;
  onChange: (n: number) => void;
  /** Strokes relative to par, used to colour the number. */
  highlight?: number;
}) {
  const colors = useTheme();

  const color =
    highlight === undefined
      ? colors.text
      : highlight < 0
        ? colors.success
        : highlight === 0
          ? colors.text
          : colors.warning;

  return (
    <View style={styles.rowBetween}>
      <ThemedText variant="label">{label}</ThemedText>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - step))}
          style={[styles.stepBtn, { borderColor: colors.border }]}
          hitSlop={6}>
          <Minus size={16} color={colors.text} />
        </Pressable>
        <ThemedText variant="stat" style={[styles.stepValue, { color }]}>
          {signed && value > 0 ? '+' : ''}
          {value}
          {suffix}
        </ThemedText>
        <Pressable
          onPress={() => onChange(Math.min(max, value + step))}
          style={[styles.stepBtn, { borderColor: colors.border }]}
          hitSlop={6}>
          <Plus size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const colors = useTheme();

  return (
    <View style={styles.rowBetween}>
      <ThemedText variant="label">{label}</ThemedText>
      <View style={styles.toggleGroup}>
        {[true, false].map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={String(option)}
              onPress={() => onChange(option)}
              style={[
                styles.toggle,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : 'transparent',
                },
              ]}>
              <ThemedText
                variant="caption"
                style={{ color: active ? colors.primaryText : colors.textSecondary }}>
                {option ? 'Yes' : 'No'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: Spacing.three },
  speakButton: { marginTop: Spacing.two },
  micButton: { marginTop: Spacing.two },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  holeNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  navBtn: { padding: Spacing.one },
  holeDots: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },

  conditionsHead: { flex: 1, gap: 2 },
  conditionsBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },

  yardageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  yardage: { fontSize: FontSize['3xl'], color: GOLD },
  alt: { alignItems: 'flex-end' },
  adjustments: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  detailText: { flex: 1 },
  cues: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    marginTop: Spacing.two,
    gap: Spacing.one,
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
  stepValue: { minWidth: 72, textAlign: 'center', fontSize: FontSize.lg },

  toggleGroup: { flexDirection: 'row', gap: Spacing.two },
  toggle: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
  },

  actions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  action: { flex: 1 },
  finish: { marginTop: Spacing.five },
  hint: { textAlign: 'center', marginTop: Spacing.two },
});
