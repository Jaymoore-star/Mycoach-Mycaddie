/**
 * My Courses - add, edit and delete the golfer's own courses.
 *
 * The `customCourses` table shipped with the port but nothing wrote to it, so
 * only the eighteen built-in courses were ever playable. This is the form that
 * was missing.
 *
 * It opens on a real par-72 card rather than eighteen blanks: a golfer adding
 * their home course edits the few holes that differ instead of typing
 * seventy-two numbers. Everything is validated again on the server - a slope
 * rating feeds the WHS differential, so a typo here would quietly bend the
 * handicap for every round played at this course.
 */
import { useMutation, useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeeBox } from '@/convex/lib/courses';
import {
  type CustomCourseInput,
  type CustomHoleInput,
  TEE_BOXES,
  blankCourse,
  coursePar,
  suggestedPar,
  validateCustomCourse,
} from '@/convex/lib/customCourses';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { voiceErrorMessage } from '@/hooks/use-voice';

const TEE_LABELS: Record<TeeBox, string> = {
  championship: 'Champ',
  regular: 'Regular',
  forward: 'Forward',
};

const PARS: (3 | 4 | 5)[] = [3, 4, 5];

export default function CoursesScreen() {
  const colors = useTheme();
  const router = useRouter();

  const courses = useQuery(api.customCourses.list, {});
  const createCourse = useMutation(api.customCourses.create);
  const updateCourse = useMutation(api.customCourses.update);
  const removeCourse = useMutation(api.customCourses.remove);

  /** null = the list; otherwise the course being edited, or a blank new one. */
  const [draft, setDraft] = useState<CustomCourseInput | null>(null);
  const [editingId, setEditingId] = useState<Id<'customCourses'> | null>(null);
  const [openHole, setOpenHole] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setDraft(blankCourse());
    setEditingId(null);
    setOpenHole(1);
  }

  function startEdit(course: Doc<'customCourses'>) {
    setDraft({
      name: course.name,
      location: course.location,
      altitudeFt: course.altitudeFt,
      rating: { ...course.rating },
      slope: { ...course.slope },
      holes: course.holes.map((h) => ({ ...h, yards: { ...h.yards } })),
    });
    setEditingId(course._id);
    setOpenHole(null);
  }

  function cancel() {
    setDraft(null);
    setEditingId(null);
    setOpenHole(null);
  }

  function patchHole(hole: number, patch: Partial<CustomHoleInput>) {
    if (!draft) return;
    setDraft({
      ...draft,
      holes: draft.holes.map((h) => (h.hole === hole ? { ...h, ...patch } : h)),
    });
  }

  async function save() {
    if (!draft) return;

    // Checked here as well as on the server so the golfer sees every problem
    // at once, in the form, instead of one rejection at a time.
    const problems = validateCustomCourse(draft);
    if (problems.length > 0) {
      Alert.alert(
        problems.length === 1 ? 'One thing to fix' : `${problems.length} things to fix`,
        problems.slice(0, 6).join('\n\n'),
      );
      return;
    }

    setBusy(true);
    try {
      if (editingId) {
        await updateCourse({ courseId: editingId, ...draft });
      } else {
        await createCourse(draft);
      }
      cancel();
    } catch (error) {
      Alert.alert('Could not save the course', voiceErrorMessage(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(course: Doc<'customCourses'>) {
    Alert.alert(
      `Delete ${course.name}?`,
      'Rounds you have already played there keep their scores and handicap differential. ' +
        'Only the hole yardages your caddie uses are lost.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void removeCourse({ courseId: course._id }).catch(() =>
              Alert.alert('Could not delete', 'Please try again.'),
            );
          },
        },
      ],
    );
  }

  // ─── The form ─────────────────────────────────────────────────────────

  if (draft) {
    const par = coursePar(draft.holes);

    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: editingId ? 'Edit course' : 'New course' }}
        />
        <Screen
          eyebrow={editingId ? 'Editing' : 'New course'}
          title={draft.name.trim() || 'Untitled course'}
          subtitle={`Par ${par} · ${draft.holes.length} holes`}>
          <Card eyebrow="The course" title="Where you play" style={styles.block}>
            <Field
              label="Name"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder="Royal County Down"
            />
            <Field
              label="Location"
              value={draft.location}
              onChangeText={(location) => setDraft({ ...draft, location })}
              placeholder="Newcastle, Northern Ireland"
            />
            <NumberField
              label="Altitude (feet above sea level)"
              value={draft.altitudeFt}
              onChange={(altitudeFt) => setDraft({ ...draft, altitudeFt })}
            />
            <ThemedText variant="caption" tone="muted">
              Altitude stretches every yardage your caddie gives you. Leave it at 0 near
              the sea.
            </ThemedText>
          </Card>

          <Card eyebrow="Ratings" title="Course rating and slope" style={styles.block}>
            <ThemedText variant="caption" tone="secondary">
              Both are printed on the scorecard. They are what turn your scores into a
              handicap index, so it is worth copying them exactly.
            </ThemedText>

            {TEE_BOXES.map((tee) => (
              <View key={tee} style={styles.teeRow}>
                <ThemedText variant="label" style={styles.teeLabel}>
                  {TEE_LABELS[tee]}
                </ThemedText>
                <NumberField
                  label="Rating"
                  value={draft.rating[tee]}
                  onChange={(n) =>
                    setDraft({ ...draft, rating: { ...draft.rating, [tee]: n } })
                  }
                  decimal
                  compact
                />
                <NumberField
                  label="Slope"
                  value={draft.slope[tee]}
                  onChange={(n) => setDraft({ ...draft, slope: { ...draft.slope, [tee]: n } })}
                  compact
                />
              </View>
            ))}
          </Card>

          <ThemedText variant="heading" style={styles.sectionHeading}>
            The card
          </ThemedText>
          <ThemedText variant="caption" tone="muted" style={styles.sectionNote}>
            Tap a hole to open it. Stroke indexes must use 1 to 18 once each - that is
            what decides where you get shots.
          </ThemedText>

          <View style={styles.holeList}>
            {draft.holes.map((hole) => (
              <HoleRow
                key={hole.hole}
                hole={hole}
                open={openHole === hole.hole}
                onToggle={() => setOpenHole(openHole === hole.hole ? null : hole.hole)}
                onPatch={(patch) => patchHole(hole.hole, patch)}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={cancel} style={styles.action} />
            <Button
              label={editingId ? 'Save changes' : 'Add course'}
              onPress={() => void save()}
              loading={busy}
              disabled={busy}
              style={styles.action}
            />
          </View>
        </Screen>
      </>
    );
  }

  // ─── The list ─────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'My Courses' }} />
      <Screen
        eyebrow="My Caddie"
        title="My Courses"
        subtitle="Courses you add here sit alongside the eighteen built in, everywhere you pick a course.">
        <Button
          label="Add a course"
          icon={<Plus size={18} color={colors.primaryText} />}
          onPress={startNew}
          style={styles.block}
        />

        {courses === undefined ? (
          <Card style={styles.block}>
            <ThemedText variant="body" tone="secondary">
              Loading your courses…
            </ThemedText>
          </Card>
        ) : courses.length === 0 ? (
          <Card eyebrow="Nothing yet" title="No courses of your own" style={styles.block}>
            <ThemedText variant="body" tone="secondary">
              Add the course you actually play. Your caddie will use its real yardages,
              and your rounds there will count toward your handicap.
            </ThemedText>
          </Card>
        ) : (
          <View style={styles.list}>
            {courses.map((course) => (
              <Card key={course._id} style={styles.courseCard}>
                <View style={styles.courseHead}>
                  <View style={styles.courseName}>
                    <ThemedText variant="heading">{course.name}</ThemedText>
                    <View style={styles.locationRow}>
                      <MapPin size={12} color={colors.textMuted} />
                      <ThemedText variant="caption" tone="muted">
                        {course.location}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => confirmDelete(course)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${course.name}`}>
                    <Trash2 size={16} color={colors.destructive} />
                  </Pressable>
                </View>

                <ThemedText variant="caption" tone="secondary">
                  Par {course.holes.reduce((sum, h) => sum + h.par, 0)} · rating{' '}
                  {course.rating.regular} · slope {course.slope.regular}
                  {course.altitudeFt !== 0 ? ` · ${course.altitudeFt} ft` : ''}
                </ThemedText>

                <Button
                  label="Edit"
                  variant="secondary"
                  onPress={() => startEdit(course)}
                  style={styles.editButton}
                />
              </Card>
            ))}
          </View>
        )}

        <Button
          label="Back to My Caddie"
          variant="ghost"
          onPress={() => router.back()}
          style={styles.block}
        />
      </Screen>
    </>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function HoleRow({
  hole,
  open,
  onToggle,
  onPatch,
}: {
  hole: CustomHoleInput;
  open: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<CustomHoleInput>) => void;
}) {
  const colors = useTheme();

  // A par that disagrees with its own yardage is the mistake the built-in
  // library was full of, so it is flagged while it is still being typed.
  const suggested = suggestedPar(hole.yards.regular);
  const parLooksWrong = suggested !== hole.par;

  return (
    <View style={[styles.hole, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.holeHead}>
        <ThemedText variant="label" style={styles.holeNumber}>
          {hole.hole}
        </ThemedText>
        <ThemedText variant="caption" tone="secondary" style={styles.holeSummary}>
          Par {hole.par} · SI {hole.strokeIndex} · {hole.yards.regular} yds
        </ThemedText>
        {parLooksWrong && (
          <ThemedText variant="caption" style={{ color: colors.warning }}>
            par?
          </ThemedText>
        )}
        {open ? (
          <ChevronUp size={16} color={colors.textMuted} />
        ) : (
          <ChevronDown size={16} color={colors.textMuted} />
        )}
      </Pressable>

      {open && (
        <View style={[styles.holeBody, { borderTopColor: colors.border }]}>
          <View style={styles.parRow}>
            <ThemedText variant="caption" tone="muted" uppercase>
              Par
            </ThemedText>
            <View style={styles.parChips}>
              {PARS.map((par) => (
                <Pressable
                  key={par}
                  onPress={() => onPatch({ par })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: hole.par === par }}
                  style={[
                    styles.parChip,
                    {
                      borderColor: hole.par === par ? colors.primary : colors.border,
                      backgroundColor: hole.par === par ? colors.primary : 'transparent',
                    },
                  ]}>
                  <ThemedText
                    variant="caption"
                    style={{
                      color: hole.par === par ? colors.primaryText : colors.textSecondary,
                    }}>
                    {par}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {parLooksWrong && (
            <ThemedText variant="caption" style={{ color: colors.warning }}>
              {hole.yards.regular} yards usually plays as a par {suggested}.
            </ThemedText>
          )}

          <NumberField
            label="Stroke index (1 hardest)"
            value={hole.strokeIndex}
            onChange={(strokeIndex) => onPatch({ strokeIndex })}
          />

          <View style={styles.yardRow}>
            {TEE_BOXES.map((tee) => (
              <NumberField
                key={tee}
                label={TEE_LABELS[tee]}
                value={hole.yards[tee]}
                onChange={(n) => onPatch({ yards: { ...hole.yards, [tee]: n } })}
                compact
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const colors = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText variant="caption" tone="muted" uppercase>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
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
  );
}

/**
 * A number the golfer types.
 *
 * Holds its own text while being edited so a half-typed "-" or "7." is not
 * snapped back to a number mid-keystroke; the parsed value is pushed up on
 * every change that produces one.
 */
function NumberField({
  label,
  value,
  onChange,
  decimal,
  compact,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  decimal?: boolean;
  compact?: boolean;
}) {
  const colors = useTheme();
  const [text, setText] = useState<string | null>(null);

  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <ThemedText variant="caption" tone="muted" uppercase>
        {label}
      </ThemedText>
      <TextInput
        value={text ?? String(value)}
        onChangeText={(next) => {
          setText(next);
          const parsed = decimal ? Number.parseFloat(next) : Number.parseInt(next, 10);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        onBlur={() => setText(null)}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
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
  );
}

const styles = StyleSheet.create({
  block: { marginTop: Spacing.three },
  list: { gap: Spacing.two, marginTop: Spacing.three },

  courseCard: { gap: Spacing.two },
  courseHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  courseName: { flex: 1, gap: Spacing.half },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  editButton: { marginTop: Spacing.two, height: 40 },

  field: { gap: Spacing.one, marginTop: Spacing.two },
  fieldCompact: { flex: 1, marginTop: 0 },
  input: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.base,
  },

  teeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, marginTop: Spacing.three },
  teeLabel: { width: 64 },

  sectionHeading: { marginTop: Spacing.five },
  sectionNote: { marginTop: Spacing.one },
  holeList: { gap: Spacing.one, marginTop: Spacing.two },
  hole: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md },
  holeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  holeNumber: { width: 22 },
  holeSummary: { flex: 1 },
  holeBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  parRow: { marginTop: Spacing.three, gap: Spacing.one },
  parChips: { flexDirection: 'row', gap: Spacing.two },
  parChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  yardRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },

  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.five },
  action: { flex: 1 },
});
