import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { Trash2, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { BAG_ORDER } from '@/convex/lib/bag';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_SECONDS = 15;

export default function SwingScreen() {
  const colors = useTheme();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const videos = useQuery(
    api.swingVideos.listRecordings,
    profile ? { profileId: profile._id } : 'skip',
  );

  const generateUploadUrl = useMutation(api.swingVideos.generateUploadUrl);
  const saveRecording = useMutation(api.swingVideos.saveRecording);
  const deleteRecording = useMutation(api.swingVideos.deleteRecording);

  const [label, setLabel] = useState<string>('Driver');
  const [busy, setBusy] = useState(false);

  /** Records or picks a clip, uploads it, then stores the metadata. */
  async function capture(mode: 'camera' | 'library') {
    if (!profile) return;

    const permission =
      mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        mode === 'camera'
          ? 'Allow camera access to record a swing.'
          : 'Allow photo access to choose a clip.',
      );
      return;
    }

    const picker =
      mode === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;

    const result = await picker({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_SECONDS,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setBusy(true);
    try {
      // Convex storage takes the bytes directly via a short-lived signed URL.
      const uploadUrl = await generateUploadUrl();
      const file = await fetch(asset.uri);
      const blob = await file.blob();

      const upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': asset.mimeType ?? 'video/mp4' },
        body: blob,
      });
      if (!upload.ok) throw new Error(`Upload failed: ${upload.status}`);

      const { storageId } = (await upload.json()) as { storageId: string };

      await saveRecording({
        storageId: storageId as Doc<'swingVideos'>['storageId'],
        profileId: profile._id,
        label,
        // expo-image-picker reports milliseconds.
        durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : 0,
        recordedAt: new Date().toISOString(),
      });
    } catch {
      Alert.alert('Could not save', 'The clip did not upload. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(video: { _id: Doc<'swingVideos'>['_id']; label: string }) {
    Alert.alert('Delete this recording?', `"${video.label}" will be removed permanently.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteRecording({ videoId: video._id }).catch(() =>
            Alert.alert('Could not delete', 'Please try again.'),
          );
        },
      },
    ]);
  }

  return (
    <Screen
      eyebrow="Video analysis"
      title="My Swing"
      subtitle="Record a swing, keep a library, and compare it against itself over time.">
      {/* ─── Club label ──────────────────────────────────────────────── */}
      <ThemedText variant="caption" tone="muted" uppercase>
        Club
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.clubRow}>
        {BAG_ORDER.map((c) => (
          <Pressable
            key={c}
            onPress={() => setLabel(c)}
            style={[
              styles.chip,
              {
                borderColor: label === c ? colors.primary : colors.border,
                backgroundColor: label === c ? colors.primary : 'transparent',
              },
            ]}>
            <ThemedText
              variant="caption"
              style={{ color: label === c ? colors.primaryText : colors.textSecondary }}>
              {c}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <Card eyebrow="New recording" title={label} style={styles.block}>
        <ThemedText variant="caption" tone="secondary">
          Film from behind the ball or face-on, with the whole swing in frame. Up to{' '}
          {MAX_SECONDS} seconds.
        </ThemedText>
        <View style={styles.actions}>
          <Button
            label="Record"
            icon={<Video size={18} color={colors.primaryText} />}
            onPress={() => void capture('camera')}
            loading={busy}
            disabled={busy || !profile}
            style={styles.action}
          />
          <Button
            label="Choose clip"
            variant="secondary"
            onPress={() => void capture('library')}
            disabled={busy || !profile}
            style={styles.action}
          />
        </View>
      </Card>

      {/* ─── Library ─────────────────────────────────────────────────── */}
      <ThemedText variant="heading" style={styles.sectionHeading}>
        Your swings {videos ? `(${videos.length})` : ''}
      </ThemedText>

      {videos?.length === 0 && (
        <Card>
          <ThemedText variant="body" tone="secondary">
            Nothing recorded yet. A clip a week through a phase is enough to see the
            change your coach is asking for.
          </ThemedText>
        </Card>
      )}

      <View style={styles.list}>
        {videos?.map((v) => (
          <Card key={v._id} style={styles.video}>
            <View style={styles.videoHead}>
              <Video size={16} color={colors.primary} />
              <View style={styles.videoText}>
                <ThemedText variant="label">{v.label}</ThemedText>
                <ThemedText variant="caption" tone="muted">
                  {new Date(v.recordedAt).toLocaleDateString()}
                  {v.durationSeconds > 0 && ` · ${v.durationSeconds}s`}
                </ThemedText>
              </View>
              <Pressable onPress={() => confirmDelete(v)} hitSlop={8}>
                <Trash2 size={14} color={colors.destructive} />
              </Pressable>
            </View>

            {v.notes && (
              <ThemedText variant="caption" tone="secondary">
                {v.notes}
              </ThemedText>
            )}

            {v.aiFeedback && (
              <View style={[styles.feedback, { borderTopColor: colors.border }]}>
                <ThemedText variant="caption" tone="accent" uppercase>
                  Coach feedback
                </ThemedText>
                <ThemedText variant="caption" tone="secondary">
                  {v.aiFeedback.summary}
                </ThemedText>
              </View>
            )}
          </Card>
        ))}
      </View>

      <Card eyebrow="Coming next" title="Automatic swing analysis" style={styles.block}>
        <ThemedText variant="caption" tone="secondary">
          Frame-by-frame AI feedback - strengths, fixes and drills against the
          P-position checkpoints - needs an OpenAI API key on the Convex deployment.
          Recording, storing and reviewing your library all work without it.
        </ThemedText>
      </Card>
    </Screen>
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
  actions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  action: { flex: 1 },
  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  list: { gap: Spacing.two },
  video: { gap: Spacing.two },
  videoHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  videoText: { flex: 1, gap: 2 },
  feedback: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
});
