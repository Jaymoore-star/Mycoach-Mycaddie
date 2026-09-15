/**
 * The two voice affordances, shared by every screen that has a voice.
 *
 * `MicButton` is a toggle: tap to start, tap to stop. It was hold-to-talk at
 * first, on the reasoning that a recording left running by a missed second tap
 * costs money - but holding a phone still with one thumb while talking through
 * a shot turned out to be the worse problem, and a recording that is visibly
 * running is not one you forget about.
 *
 * `SpeakButton` is a single control with two jobs: start the line, or cut it
 * off. A caddie you cannot interrupt is worse than one that stays quiet.
 */
import { Loader, Mic, Square, Volume2 } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LiveDictationState } from '@/hooks/use-live-dictation';
import type { SpeechState } from '@/hooks/use-voice';

type MicButtonProps = {
  state: LiveDictationState;
  onStart: () => void;
  onStop: () => void;
  /** Shown beside the mic. Defaults to the state's own wording. */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function MicButton({ state, onStart, onStop, label, style }: MicButtonProps) {
  const colors = useTheme();

  const connecting = state === 'connecting';
  const recording = state === 'recording';
  const transcribing = state === 'transcribing';
  const blocked = state === 'denied';
  const live = connecting || recording;

  const caption =
    label ??
    (recording
      ? 'Listening - tap to stop'
      : connecting
        ? 'Opening the microphone'
        : transcribing
          ? 'Working out what you said'
          : blocked
            ? 'Microphone is off'
            : 'Tap to talk');

  const tint = live ? colors.destructive : blocked ? colors.textMuted : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={live ? 'Stop recording' : 'Start talking to your caddie'}
      accessibilityState={{ busy: transcribing || connecting, disabled: blocked }}
      disabled={transcribing || blocked}
      onPress={live ? onStop : onStart}
      style={({ pressed }) => [
        styles.mic,
        {
          backgroundColor: live ? `${colors.destructive}1A` : colors.backgroundElement,
          borderColor: live ? colors.destructive : colors.border,
        },
        pressed && styles.pressed,
        (transcribing || blocked) && styles.disabled,
        style,
      ]}>
      <View style={[styles.dot, { backgroundColor: tint }]}>
        {transcribing || connecting ? (
          <ActivityIndicator size="small" color={colors.primaryText} />
        ) : recording ? (
          // A stop square, because that is what the tap will now do.
          <Square size={14} color={colors.primaryText} fill={colors.primaryText} />
        ) : (
          <Mic size={18} color={colors.primaryText} />
        )}
      </View>
      <ThemedText variant="label">{caption}</ThemedText>
    </Pressable>
  );
}

type SpeakButtonProps = {
  state: SpeechState;
  onSpeak: () => void;
  onStop: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function SpeakButton({ state, onSpeak, onStop, label, style }: SpeakButtonProps) {
  const colors = useTheme();

  const loading = state === 'loading';
  const speaking = state === 'speaking';
  const active = loading || speaking;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Stop your caddie' : 'Hear it from your caddie'}
      accessibilityState={{ busy: loading }}
      onPress={active ? onStop : onSpeak}
      style={({ pressed }) => [
        styles.speak,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <Loader size={15} color={colors.primary} />
      ) : speaking ? (
        <Square size={13} color={colors.primary} fill={colors.primary} />
      ) : (
        <Volume2 size={15} color={colors.primary} />
      )}
      <ThemedText variant="label">
        {label ?? (speaking ? 'Stop' : loading ? 'One moment' : 'Hear it')}
      </ThemedText>
    </Pressable>
  );
}

/** A transcript or a spoken reply, shown so the golfer can see it was heard right. */
export function VoiceTranscript({ text, speaker }: { text: string; speaker?: string }) {
  const colors = useTheme();
  if (!text) return null;

  return (
    <View
      style={[
        styles.transcript,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
      ]}>
      {speaker ? (
        <ThemedText variant="caption" tone="muted" uppercase>
          {speaker}
        </ThemedText>
      ) : null}
      <ThemedText>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  mic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 52,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 38,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  transcript: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
