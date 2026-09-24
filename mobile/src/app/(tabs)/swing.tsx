import { useAction, useMutation, useQuery } from 'convex/react';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ChevronDown, ChevronUp, Flag, Sparkles, Trash2, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { BAG_ORDER } from '@/convex/lib/bag';
import { swingAnalysisTarget } from '@/convex/lib/reports';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { reportAiContent, useReportedTargets } from '@/lib/report';

const MAX_SECONDS = 15;

/**
 * Sample at ~10fps - every third frame of a 30fps clip. Dense enough that
 * takeaway, top, transition, impact and finish each land on their own frame,
 * which 250ms spacing stepped straight over. The cap bounds both the token cost
 * of the analysis and how long extraction ties up the phone; past it spacing
 * widens and the model is told to report the gaps.
 */
const TARGET_INTERVAL_MS = 100;
const MIN_FRAMES = 12;
/**
 * Matches the server's per-request frame budget, which is set by the OpenAI
 * account's tokens-per-minute allowance. Uploading more than the analysis can
 * spend just costs storage and the golfer's time. Raise both together if the
 * account tier goes up.
 */
const MAX_FRAMES = 24;

/** How many extractions/uploads to run at once. Sequential is far too slow at
 * 40 frames; unbounded parallelism starves the JS thread and stalls the UI. */
const CONCURRENCY = 5;

/**
 * Target short side of each uploaded frame. OpenAI bills a high-detail image by
 * tile count after scaling the short side to 768px, so a 1080x1920 phone frame
 * costs 6 tiles. At a 512 short side it costs 2, for ~60% fewer tokens - and
 * 512px is still ample to read spine angle, shaft position and rotation.
 * Compression alone saves nothing here: the price follows dimensions, not file
 * size.
 */
const FRAME_SHORT_SIDE = 512;

/**
 * Constrain the short side, whichever way the clip was filmed. Constraining
 * width outright would shrink the long side of a landscape clip and throw away
 * detail that costs nothing to keep.
 */
function resizeTarget(width: number, height: number) {
  return height >= width
    ? { width: FRAME_SHORT_SIDE }
    : { height: FRAME_SHORT_SIDE };
}

/** Evenly spaced sample points, inset half a step from each end. */
function framePoints(durationMs: number) {
  const wanted = Math.round(durationMs / TARGET_INTERVAL_MS);
  const count = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, wanted));
  // The very first and last frames are often blank or badly blurred, so the
  // half-step inset keeps every sample usable.
  return Array.from({ length: count }, (_, i) => (i + 0.5) / count);
}

/**
 * Maps with a bounded worker pool, preserving input order. Order is the whole
 * point here - the model reads these frames as a sequence.
 */
async function mapPooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R | null>,
): Promise<R[]> {
  const results = new Array<R | null>(items.length).fill(null);
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results.filter((r): r is R => r !== null);
}

export default function SwingScreen() {
  const colors = useTheme();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const videos = useQuery(
    api.swingVideos.listRecordings,
    profile ? { profileId: profile._id } : 'skip',
  );

  const generateUploadUrl = useMutation(api.swingVideos.generateUploadUrl);
  // An action, not a mutation - it cleans up a rejected upload before failing.
  const saveRecording = useAction(api.swingVideos.saveRecording);
  const deleteRecording = useMutation(api.swingVideos.deleteRecording);
  const analyzeSwing = useAction(api.swingVideos.analyzeSwing);
  const reportSwingAnalysis = useMutation(api.reports.reportSwingAnalysis);
  const reported = useReportedTargets();
  const analysisReported = (video: Doc<'swingVideos'>) =>
    !!video.aiFeedback &&
    reported.has(swingAnalysisTarget(video._id, video.aiFeedback.analyzedAt));

  const [label, setLabel] = useState<string>('Driver');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  function toggleOpen(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** Asks the coach model for notes on this club, then stores them. */
  async function requestNotes(video: Doc<'swingVideos'>) {
    setAnalyzing(video._id);
    try {
      await analyzeSwing({ videoId: video._id });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[swing notes]', detail);
      Alert.alert('Could not get notes', detail);
    } finally {
      setAnalyzing(null);
    }
  }

  /** Puts one local file in Convex storage and returns its id. */
  async function uploadToStorage(uri: string, contentType: string) {
    const uploadUrl = await generateUploadUrl();
    const read = await fetch(uri);
    const raw = await read.blob();

    // A blob read from a file:// URI carries no type, and React Native derives
    // the request's content-type from the blob rather than from our header - an
    // untyped blob sends an empty content-type, which Convex rejects as
    // BadHeader. Re-wrap so the type travels with the body.
    const body = raw.type ? raw : new Blob([raw], { type: contentType });

    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!upload.ok) {
      const detail = await upload.text().catch(() => '');
      throw new Error(`Upload failed: ${upload.status} ${detail.slice(0, 200)}`);
    }

    const { storageId } = (await upload.json()) as { storageId: string };
    return storageId;
  }

  /**
   * Pulls stills off the clip so the model has something to actually read.
   * Best-effort: a clip that yields no frames still saves, and the analysis
   * falls back to club-level guidance clearly labelled as such.
   */
  async function extractFrames(asset: ImagePicker.ImagePickerAsset) {
    const durationMs = asset.duration ?? 0;
    if (durationMs <= 0) return [];

    const points = framePoints(durationMs);
    let done = 0;

    const ids = await mapPooled(points, CONCURRENCY, async (point) => {
      try {
        const frame = await VideoThumbnails.getThumbnailAsync(asset.uri, {
          time: Math.round(durationMs * point),
          quality: 1,
        });

        // Downscale before upload - see FRAME_WIDTH. Height follows the aspect
        // ratio automatically, so nothing is squashed.
        const shrunk = await ImageManipulator.manipulate(frame.uri)
          .resize(resizeTarget(frame.width, frame.height))
          .renderAsync();
        const saved = await shrunk.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

        const id = await uploadToStorage(saved.uri, 'image/jpeg');
        setProgress(`Reading frame ${++done} of ${points.length}`);
        return id;
      } catch (error) {
        // One unreadable timestamp should not cost the whole recording.
        done++;
        console.warn('[swing frames] skipped', point, error);
        return null;
      }
    });

    return ids;
  }

  /** Records or picks a clip, uploads it, then stores the metadata. */
  async function capture(mode: 'camera' | 'library') {
    if (!profile) return;

    // Android's system photo picker needs no permission at all. Asking for one
    // anyway requests the storage permission on Android 12 and below, which
    // the app does not declare - so Android refused without a dialog and the
    // library button did nothing. iOS still wants photo access up front.
    const needsPermission = mode === 'camera' || Platform.OS === 'ios';
    const permission = !needsPermission
      ? { granted: true }
      : mode === 'camera'
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

    // A device with no camera app, or no gallery, throws here rather than
    // returning - and an unhandled rejection is a button that does nothing.
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await picker({
        mediaTypes: ['videos'],
        videoMaxDuration: MAX_SECONDS,
        quality: 1,
      });
    } catch (error) {
      console.error('[swing picker]', error);
      Alert.alert(
        mode === 'camera' ? 'Could not open the camera' : 'Could not open your videos',
        errorMessage(error, 'Please try again.'),
      );
      return;
    }

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setBusy(true);
    try {
      // Guard the header value: the picker is not contractually bound to report a
      // well-formed type, and an illegal one is rejected outright as BadHeader.
      const reported = asset.mimeType?.trim();
      const contentType =
        reported && /^[\w.+-]+\/[\w.+-]+$/.test(reported) ? reported : 'video/mp4';

      setProgress('Uploading clip');
      const storageId = await uploadToStorage(asset.uri, contentType);
      const frameStorageIds = await extractFrames(asset);

      await saveRecording({
        storageId: storageId as Doc<'swingVideos'>['storageId'],
        profileId: profile._id,
        label,
        // expo-image-picker reports milliseconds.
        durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : 0,
        recordedAt: new Date().toISOString(),
        frameStorageIds: frameStorageIds as Doc<'swingVideos'>['frameStorageIds'],
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[swing capture]', detail);
      Alert.alert('Could not save', detail);
    } finally {
      setBusy(false);
      setProgress(null);
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
          {MAX_SECONDS} seconds - a tight clip reads best, since frames are sampled
          across whatever you give it.
        </ThemedText>
        {progress && (
          <ThemedText variant="caption" tone="accent">
            {progress}
          </ThemedText>
        )}
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

      <Card eyebrow="How this works" title="What the analysis can see" style={styles.block}>
        <ThemedText variant="caption" tone="secondary">
          Frames are sampled at up to 10 per second, 24 a clip, and read in order - so
          tempo, sequencing and head movement come from what changes between them. Keep
          the clip tight: 24 frames across 3 seconds resolves the swing far better than 24
          across 10. Numbers like clubhead speed and face angle are not visible in a video
          - those come from the launch monitor.
        </ThemedText>
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
        {videos?.map((v) => {
          const isOpen = open.has(v._id);

          return (
          <Card key={v._id} style={styles.video}>
            <View style={styles.videoHead}>
              <Video size={16} color={colors.primary} />
              <Pressable
                style={styles.videoText}
                onPress={() => toggleOpen(v._id)}
                disabled={!v.aiFeedback}
                accessibilityRole={v.aiFeedback ? 'button' : undefined}
                accessibilityState={v.aiFeedback ? { expanded: isOpen } : undefined}
                accessibilityHint={
                  v.aiFeedback ? 'Shows or hides the analysis for this swing' : undefined
                }>
                <ThemedText variant="label">{v.label}</ThemedText>
                <ThemedText variant="caption" tone="muted">
                  {new Date(v.recordedAt).toLocaleDateString()}
                  {v.durationSeconds > 0 && ` · ${v.durationSeconds}s`}
                </ThemedText>
              </Pressable>
              {v.aiFeedback && (
                <Pressable onPress={() => toggleOpen(v._id)} hitSlop={8}>
                  {isOpen ? (
                    <ChevronUp size={16} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={16} color={colors.textSecondary} />
                  )}
                </Pressable>
              )}
              <Pressable onPress={() => confirmDelete(v)} hitSlop={8}>
                <Trash2 size={14} color={colors.destructive} />
              </Pressable>
            </View>

            {v.notes && (!v.aiFeedback || isOpen) && (
              <ThemedText variant="caption" tone="secondary">
                {v.notes}
              </ThemedText>
            )}

            {v.aiFeedback && !isOpen && (
              // Closed cards still need to be tellable apart, so keep one line
              // of the summary rather than collapsing to just a date.
              <ThemedText variant="caption" tone="muted" numberOfLines={1}>
                {v.aiFeedback.summary}
              </ThemedText>
            )}

            {v.aiFeedback && isOpen && (
              <View style={[styles.feedback, { borderTopColor: colors.border }]}>
                <ThemedText variant="caption" tone="accent" uppercase>
                  {v.aiFeedback.basis === 'video'
                    ? `Read from your ${v.label} swing`
                    : `General ${v.label} guidance`}
                </ThemedText>
                <ThemedText variant="caption" tone="secondary">
                  {v.aiFeedback.summary}
                </ThemedText>

                {v.aiFeedback.basis !== 'video' && (
                  <ThemedText variant="caption" tone="muted">
                    No frames were read for this clip, so this is club-level advice rather
                    than a look at your swing.
                  </ThemedText>
                )}

                {v.aiFeedback.observations && v.aiFeedback.observations.length > 0 && (
                  <View style={styles.feedbackList}>
                    <ThemedText variant="caption" tone="muted" uppercase>
                      Through the swing
                    </ThemedText>
                    {v.aiFeedback.observations.map((o) => (
                      <ThemedText key={o.position + o.detail} variant="caption" tone="secondary">
                        {o.position}: {o.detail}
                      </ThemedText>
                    ))}
                  </View>
                )}

                {v.aiFeedback.strengths.length > 0 && (
                  <FeedbackList
                    title={v.aiFeedback.basis === 'video' ? 'Doing well' : 'Look for'}
                    items={v.aiFeedback.strengths}
                  />
                )}
                {v.aiFeedback.improvements.length > 0 && (
                  <FeedbackList
                    title={v.aiFeedback.basis === 'video' ? 'Work on' : 'Check for'}
                    items={v.aiFeedback.improvements}
                  />
                )}
                {v.aiFeedback.drills.length > 0 && (
                  <FeedbackList title="Drills" items={v.aiFeedback.drills} />
                )}

                {/* Google Play requires a way to flag what the AI wrote. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    analysisReported(v)
                      ? 'You have reported this analysis'
                      : `Report the analysis of this ${v.label} swing`
                  }
                  onPress={() =>
                    reportAiContent((reason) => reportSwingAnalysis({ videoId: v._id, reason }), {
                      alreadyReported: analysisReported(v),
                    })
                  }
                  hitSlop={10}
                  style={styles.report}>
                  <Flag
                    size={13}
                    color={colors.textMuted}
                    fill={analysisReported(v) ? colors.textMuted : 'transparent'}
                  />
                  <ThemedText variant="caption" tone="muted">
                    {analysisReported(v) ? 'Reported' : 'Report this analysis'}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {!v.aiFeedback && (
              <Button
                label={
                  v.aiAnalysisStatus === 'error'
                    ? 'Try analysis again'
                    : v.frameStorageIds?.length
                      ? 'Analyse this swing'
                      : 'Get club guidance'
                }
                variant="secondary"
                icon={<Sparkles size={16} color={colors.text} />}
                loading={analyzing === v._id}
                disabled={analyzing !== null}
                onPress={() => void requestNotes(v)}
              />
            )}
          </Card>
          );
        })}
      </View>

    </Screen>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.feedbackList}>
      <ThemedText variant="caption" tone="muted" uppercase>
        {title}
      </ThemedText>
      {items.map((item) => (
        <ThemedText key={item} variant="caption" tone="secondary">
          - {item}
        </ThemedText>
      ))}
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
  feedbackList: { gap: 2, marginTop: Spacing.two },
  report: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.three,
    alignSelf: 'flex-start',
  },
});
