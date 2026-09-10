import { useMutation, useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { Check, Pencil, RotateCcw, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { BAG_ORDER } from '@/convex/lib/bag';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function BagScreen() {
  const colors = useTheme();
  const profile = useQuery(api.profiles.getMyProfile, {});
  const clubs = useQuery(
    api.clubs.getClubProfile,
    profile ? { profileId: profile._id } : 'skip',
  );

  const saveOverride = useMutation(api.clubs.saveClubOverride);
  const clearOverride = useMutation(api.clubs.clearClubOverride);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function commit(club: string) {
    if (!profile) return;
    const carry = Number.parseInt(draft, 10);
    if (!Number.isFinite(carry) || carry <= 0 || carry > 450) {
      Alert.alert('Invalid distance', 'Enter a carry between 1 and 450 yards.');
      return;
    }
    setBusy(true);
    try {
      await saveOverride({ profileId: profile._id, club, carry });
      setEditing(null);
      setDraft('');
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function reset(club: string) {
    if (!profile) return;
    setBusy(true);
    try {
      await clearOverride({ profileId: profile._id, club });
    } catch {
      Alert.alert('Could not reset', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const known = new Set(clubs?.map((c) => c.club) ?? []);
  const missing = BAG_ORDER.filter((c) => c !== 'Putter' && !known.has(c));

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'My Bag' }} />
      <Screen
        eyebrow="Equipment"
        title="My Bag"
        subtitle="Your real carry distances - these drive every caddie recommendation.">
        {clubs === undefined && (
          <Card>
            <ThemedText variant="body" tone="secondary">
              Loading your bag…
            </ThemedText>
          </Card>
        )}

        {clubs?.length === 0 && (
          <Card title="No clubs yet">
            <ThemedText variant="body" tone="secondary">
              Log a Launch Monitor session and your carry distances appear here automatically.
              You can also set them by hand below if you already know your numbers.
            </ThemedText>
          </Card>
        )}

        {clubs && clubs.length > 0 && (
          <View style={styles.list}>
            {clubs.map((c) => {
              const isEditing = editing === c.club;

              return (
                <Card key={c.club} style={styles.club}>
                  <View style={styles.rowBetween}>
                    <View style={styles.clubName}>
                      <ThemedText variant="heading">{c.club}</ThemedText>
                      {c.brand && (
                        <ThemedText variant="caption" tone="muted">
                          {c.brand}
                        </ThemedText>
                      )}
                    </View>

                    {isEditing ? (
                      <View style={styles.editRow}>
                        <TextInput
                          value={draft}
                          onChangeText={setDraft}
                          keyboardType="number-pad"
                          autoFocus
                          placeholder={String(c.avgCarry || '')}
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
                        <Pressable onPress={() => void commit(c.club)} disabled={busy} hitSlop={8}>
                          <Check size={20} color={colors.success} />
                        </Pressable>
                        <Pressable onPress={() => setEditing(null)} hitSlop={8}>
                          <X size={20} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setEditing(c.club);
                          setDraft(c.avgCarry ? String(c.avgCarry) : '');
                        }}
                        style={styles.editRow}
                        hitSlop={8}>
                        <ThemedText variant="stat" style={styles.carry}>
                          {c.avgCarry || '-'}
                        </ThemedText>
                        <ThemedText variant="caption" tone="muted">
                          yds
                        </ThemedText>
                        <Pencil size={14} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>

                  {/* Measured spread - only meaningful with logged shots. */}
                  {c.shotCount > 0 && (
                    <View style={[styles.stats, { borderTopColor: colors.border }]}>
                      <View style={styles.rowBetween}>
                        <ThemedText variant="caption" tone="muted">
                          {c.shotCount} shot{c.shotCount === 1 ? '' : 's'} · {c.minCarry}–
                          {c.maxCarry} yds
                        </ThemedText>
                        <ThemedText variant="caption" tone="muted">
                          ±{c.stdDev} yds
                        </ThemedText>
                      </View>

                      <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${c.consistencyScore}%`,
                              backgroundColor:
                                c.consistencyScore >= 70
                                  ? colors.success
                                  : c.consistencyScore >= 40
                                    ? colors.warning
                                    : colors.destructive,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText variant="caption" tone="muted">
                        {c.consistencyScore}% consistent
                      </ThemedText>
                    </View>
                  )}

                  {c.manual && (
                    <View style={[styles.manualRow, { borderTopColor: colors.border }]}>
                      <ThemedText variant="caption" tone="accent">
                        Set by hand
                        {c.measuredCarry > 0 && ` · measured ${c.measuredCarry} yds`}
                      </ThemedText>
                      <Pressable
                        onPress={() => void reset(c.club)}
                        style={styles.resetBtn}
                        hitSlop={8}>
                        <RotateCcw size={12} color={colors.textMuted} />
                        <ThemedText variant="caption" tone="muted">
                          Use measured
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* ─── Clubs not yet in the bag ────────────────────────────────── */}
        {missing.length > 0 && (
          <>
            <ThemedText variant="heading" style={styles.sectionHeading}>
              Add a club
            </ThemedText>
            <Card>
              <ThemedText variant="caption" tone="secondary">
                Tap a club to set its carry distance.
              </ThemedText>
              <View style={styles.chipWrap}>
                {missing.map((club) => (
                  <Pressable
                    key={club}
                    onPress={() => {
                      setEditing(club);
                      setDraft('');
                    }}
                    style={[styles.chip, { borderColor: colors.border }]}>
                    <ThemedText variant="caption" tone="secondary">
                      {club}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {editing && !known.has(editing) && (
                <View style={styles.newClub}>
                  <ThemedText variant="label">{editing}</ThemedText>
                  <View style={styles.editRow}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      keyboardType="number-pad"
                      autoFocus
                      placeholder="Carry yards"
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
                    <Button
                      label="Save"
                      onPress={() => void commit(editing)}
                      disabled={busy}
                      style={styles.saveBtn}
                    />
                  </View>
                </View>
              )}
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  club: { gap: Spacing.two },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clubName: { flex: 1, gap: 2 },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  carry: { fontSize: FontSize.xl },
  input: {
    width: 88,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.base,
    textAlign: 'center',
  },
  saveBtn: { flex: 1, height: 42 },

  stats: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },

  manualRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },

  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  newClub: { marginTop: Spacing.four, gap: Spacing.two },
});
