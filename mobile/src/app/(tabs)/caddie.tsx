import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ChevronRight, Flag, MapPin, Play, Search, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import {
  COURSE_LIBRARY,
  type GolfCourse,
  type TeeBox,
  getCoursePar,
  getCourseYardage,
  searchCourses,
} from '@/convex/lib/courses';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { FontSize, GOLD, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TEES: { value: TeeBox; label: string }[] = [
  { value: 'championship', label: 'Championship' },
  { value: 'regular', label: 'Regular' },
  { value: 'forward', label: 'Forward' },
];

export default function CaddieScreen() {
  const colors = useTheme();
  const router = useRouter();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const rounds = useQuery(api.rounds.getRounds, profile ? { profileId: profile._id } : 'skip');
  const startRound = useMutation(api.rounds.startRound);
  const deleteRound = useMutation(api.rounds.deleteRound);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<GolfCourse | null>(null);
  const [tee, setTee] = useState<TeeBox>('regular');
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => (query.trim() ? searchCourses(query) : COURSE_LIBRARY), [query]);

  // Every round under 18 holes is still open - not just the most recent one.
  const active = useMemo(() => rounds?.filter((r) => r.holes.length < 18) ?? [], [rounds]);
  const finished = useMemo(() => rounds?.filter((r) => r.holes.length >= 18) ?? [], [rounds]);

  function openRound(id: Id<'roundScores'>) {
    router.push({ pathname: '/round/[id]', params: { id } });
  }

  async function createRound() {
    if (!profile || !selected) return;
    setBusy(true);
    try {
      const roundId = await startRound({
        profileId: profile._id,
        courseName: selected.name,
        courseId: selected.id,
        teeBox: tee,
        totalPar: getCoursePar(selected),
      });
      setSelected(null);
      setQuery('');
      openRound(roundId);
    } catch {
      Alert.alert('Could not start round', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleStart() {
    if (!selected) return;

    // An open round at this same course is that round - resume it rather than
    // asking. The server enforces this too, so the two can't disagree.
    const sameCourse = active.find((r) => r.courseId === selected.id);
    if (sameCourse) {
      setSelected(null);
      setQuery('');
      openRound(sameCourse._id);
      return;
    }

    // A round open at a *different* course is a real choice: stacking
    // unfinished scorecards silently is how they get lost.
    if (active.length > 0) {
      const other = active[0];
      Alert.alert(
        'Round already in progress',
        `You have an unfinished round at ${other.courseName} (${other.holes.length} of 18 holes).`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Resume that one', onPress: () => openRound(other._id) },
          { text: 'Start new anyway', style: 'destructive', onPress: () => void createRound() },
        ],
      );
      return;
    }

    void createRound();
  }

  function confirmDiscard(round: Doc<'roundScores'>) {
    Alert.alert(
      'Discard this round?',
      round.holes.length === 0
        ? `No holes were logged at ${round.courseName}.`
        : `${round.holes.length} logged hole${round.holes.length === 1 ? '' : 's'} at ${
            round.courseName
          } will be deleted. This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            void deleteRound({ roundId: round._id }).catch(() =>
              Alert.alert('Could not discard', 'Please try again.'),
            );
          },
        },
      ],
    );
  }

  return (
    <Screen
      eyebrow="On the course"
      title="My Caddie"
      subtitle="Club selection, wind, elevation and hole-by-hole scoring.">
      {/* ─── Rounds still open ───────────────────────────────────────── */}
      {active.length > 0 && (
        <>
          <ThemedText variant="heading" style={styles.firstHeading}>
            {active.length === 1 ? 'Round in progress' : `${active.length} rounds in progress`}
          </ThemedText>

          <View style={styles.list}>
            {active.map((r) => (
              <View
                key={r._id}
                style={[
                  styles.activeRound,
                  { borderColor: colors.primary, backgroundColor: colors.card },
                ]}>
                <Pressable onPress={() => openRound(r._id)} style={styles.activeMain}>
                  <View style={styles.courseText}>
                    <ThemedText variant="label">{r.courseName}</ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      {r.holes.length === 0
                        ? 'No holes logged yet'
                        : `${r.holes.length} of 18 holes · ${r.totalScore} strokes`}
                      {' · '}
                      {new Date(r.date).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <ChevronRight size={18} color={colors.primary} />
                </Pressable>

                <Pressable
                  onPress={() => confirmDiscard(r)}
                  style={[styles.discard, { borderTopColor: colors.border }]}>
                  <Trash2 size={14} color={colors.destructive} />
                  <ThemedText variant="caption" tone="destructive">
                    Discard
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ─── Course picker ───────────────────────────────────────────── */}
      <ThemedText variant="heading" style={styles.sectionHeading}>
        Start a round
      </ThemedText>

      <View style={styles.search}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search courses"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.backgroundElement,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        />
      </View>

      <View style={styles.list}>
        {results.map((course) => {
          const isSelected = selected?.id === course.id;
          return (
            <Pressable
              key={course.id}
              onPress={() => setSelected(isSelected ? null : course)}
              style={[
                styles.course,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? `${GOLD}14` : colors.card,
                },
              ]}>
              <View style={styles.rowBetween}>
                <View style={styles.courseText}>
                  <ThemedText variant="label">{course.name}</ThemedText>
                  <View style={styles.metaRow}>
                    <MapPin size={11} color={colors.textMuted} />
                    <ThemedText variant="caption" tone="muted">
                      {course.location}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.parBlock}>
                  <ThemedText variant="caption" tone="accent">
                    Par {getCoursePar(course)}
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    {getCourseYardage(course, tee)} yds
                  </ThemedText>
                </View>
              </View>

              {isSelected && (
                <View style={[styles.teeRow, { borderTopColor: colors.border }]}>
                  <ThemedText variant="caption" tone="muted" uppercase>
                    Tees
                  </ThemedText>
                  <View style={styles.teeChips}>
                    {TEES.map((t) => (
                      <Pressable
                        key={t.value}
                        onPress={() => setTee(t.value)}
                        style={[
                          styles.chip,
                          {
                            borderColor: tee === t.value ? colors.primary : colors.border,
                            backgroundColor: tee === t.value ? colors.primary : 'transparent',
                          },
                        ]}>
                        <ThemedText
                          variant="caption"
                          style={{ color: tee === t.value ? colors.primaryText : colors.text }}>
                          {t.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  <ThemedText variant="caption" tone="muted">
                    Rating {course.rating[tee]} · Slope {course.slope[tee]} · {course.altitudeFt} ft
                  </ThemedText>

                  <Button
                    label="Start round"
                    icon={<Play size={18} color={colors.primaryText} />}
                    onPress={handleStart}
                    loading={busy}
                    disabled={busy}
                    style={styles.startButton}
                  />
                </View>
              )}
            </Pressable>
          );
        })}

        {results.length === 0 && (
          <Card>
            <ThemedText variant="body" tone="secondary">
              No courses match “{query.trim()}”.
            </ThemedText>
          </Card>
        )}
      </View>

      {/* ─── Completed rounds ────────────────────────────────────────── */}
      {finished.length > 0 && (
        <>
          <ThemedText variant="heading" style={styles.sectionHeading}>
            Completed rounds
          </ThemedText>
          <View style={styles.list}>
            {finished.map((r) => (
              <Card key={r._id} onPress={() => openRound(r._id)} style={styles.round}>
                <Flag size={18} color={colors.primary} />
                <View style={styles.courseText}>
                  <ThemedText variant="label">{r.courseName}</ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    {new Date(r.date).toLocaleDateString()} · 18 holes
                  </ThemedText>
                </View>
                <View style={styles.parBlock}>
                  <ThemedText variant="stat" style={styles.roundScore}>
                    {r.totalScore}
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    {r.scoreDifferential > 0 ? '+' : ''}
                    {r.scoreDifferential}
                  </ThemedText>
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  firstHeading: { marginBottom: Spacing.two },
  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: Spacing.two },

  activeRound: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  activeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  discard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },

  search: { justifyContent: 'center', marginBottom: Spacing.three },
  searchIcon: { position: 'absolute', left: Spacing.four, zIndex: 1 },
  searchInput: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingLeft: 46,
    paddingRight: Spacing.four,
    fontSize: FontSize.base,
  },

  course: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.four },
  courseText: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  parBlock: { alignItems: 'flex-end' },

  teeRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  teeChips: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },

  startButton: { marginTop: Spacing.two },
  round: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  roundScore: { fontSize: FontSize.xl },
});
