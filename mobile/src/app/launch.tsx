import { useMutation, useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Plus, Radio, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localDate } from '@/lib/date';

export default function LaunchScreen() {
  const colors = useTheme();
  const router = useRouter();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const sessions = useQuery(
    api.launchMonitor.listSessions,
    profile ? { profileId: profile._id } : 'skip',
  );
  const averages = useQuery(
    api.launchMonitor.getClubAverages,
    profile ? { profileId: profile._id } : 'skip',
  );

  const createSession = useMutation(api.launchMonitor.createSession);
  const deleteSession = useMutation(api.launchMonitor.deleteSession);

  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!profile) return;
    setBusy(true);
    try {
      const sessionId = await createSession({
        profileId: profile._id,
        date: localDate(),
        label: `Session ${(sessions?.length ?? 0) + 1}`,
      });
      router.push({ pathname: '/launch/[id]', params: { id: sessionId } });
    } catch {
      Alert.alert('Could not create session', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(session: Doc<'launchSessions'>) {
    Alert.alert(
      'Delete session?',
      `${session.shotCount} shot${session.shotCount === 1 ? '' : 's'} will be deleted. This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteSession({ sessionId: session._id }).catch(() =>
              Alert.alert('Could not delete', 'Please try again.'),
            );
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Launch Monitor' }} />
      <Screen
        eyebrow="Garmin R10 · range sessions"
        title="Launch Monitor"
        subtitle="Log ball speed, carry, smash factor and spin - the numbers that don't lie.">
        <Button
          label="New session"
          icon={<Plus size={18} color={colors.primaryText} />}
          onPress={() => void handleCreate()}
          loading={busy}
          disabled={busy || !profile}
        />

        {/* ─── Club averages ──────────────────────────────────────────── */}
        {averages && averages.length > 0 && (
          <>
            <ThemedText variant="heading" style={styles.sectionHeading}>
              Club averages
            </ThemedText>
            <Card style={styles.table}>
              <View style={styles.headerRow}>
                <ThemedText variant="caption" tone="muted" uppercase style={styles.colClub}>
                  Club
                </ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase style={styles.col}>
                  Carry
                </ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase style={styles.col}>
                  Ball
                </ThemedText>
                <ThemedText variant="caption" tone="muted" uppercase style={styles.col}>
                  Smash
                </ThemedText>
              </View>

              {averages.map((a) => (
                <View key={a.club} style={[styles.dataRow, { borderTopColor: colors.border }]}>
                  <ThemedText variant="label" style={styles.colClub}>
                    {a.club}
                  </ThemedText>
                  <ThemedText variant="caption" tone="secondary" style={styles.col}>
                    {a.avgCarry ?? '-'}
                  </ThemedText>
                  <ThemedText variant="caption" tone="secondary" style={styles.col}>
                    {a.avgBallSpeed ?? '-'}
                  </ThemedText>
                  <ThemedText variant="caption" tone="secondary" style={styles.col}>
                    {a.avgSmash ?? '-'}
                  </ThemedText>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* ─── Sessions ───────────────────────────────────────────────── */}
        <ThemedText variant="heading" style={styles.sectionHeading}>
          Sessions
        </ThemedText>

        {sessions?.length === 0 && (
          <Card title="No sessions yet">
            <ThemedText variant="body" tone="secondary">
              Create a session, then add each shot as you hit it. Carry distances roll up into
              My Bag automatically.
            </ThemedText>
          </Card>
        )}

        <View style={styles.list}>
          {sessions?.map((s) => (
            <Card key={s._id} style={styles.session}>
              <Pressable
                onPress={() => router.push({ pathname: '/launch/[id]', params: { id: s._id } })}
                style={styles.sessionMain}>
                <Radio size={18} color={colors.primary} />
                <View style={styles.sessionText}>
                  <ThemedText variant="label">{s.label ?? 'Session'}</ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    {s.date} · {s.shotCount} shot{s.shotCount === 1 ? '' : 's'}
                    {s.avgCarryYards != null && ` · ${s.avgCarryYards} yds avg`}
                  </ThemedText>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={() => confirmDelete(s)}
                style={[styles.delete, { borderTopColor: colors.border }]}>
                <Trash2 size={14} color={colors.destructive} />
                <ThemedText variant="caption" tone="destructive">
                  Delete
                </ThemedText>
              </Pressable>
            </Card>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  list: { gap: Spacing.two },

  table: { gap: 0, paddingVertical: Spacing.two },
  headerRow: { flexDirection: 'row', paddingBottom: Spacing.two },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
  },
  colClub: { flex: 2 },
  col: { flex: 1, textAlign: 'right', fontSize: FontSize.sm },

  session: { padding: 0, gap: 0, overflow: 'hidden' },
  sessionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  sessionText: { flex: 1, gap: 2 },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
});
