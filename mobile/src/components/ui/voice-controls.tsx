/**
 * The voice affordances, shared by every screen that has a voice.
 *
 * `MicCircle` is a toggle: tap to start, tap to stop. It was hold-to-talk at
 * first, on the reasoning that a recording left running by a missed second tap
 * costs money - but holding a phone still with one thumb while talking through
 * a shot turned out to be the worse problem, and a recording that is visibly
 * running is not one you forget about.
 *
 * `VoiceComposer` is a field plus that mic plus a submit button. Speaking is
 * the fast path, but it must never be the *only* path - a golfer in a quiet
 * clubhouse, or one whose microphone permission is off, still has a question
 * to ask. It is also where the two are reconciled: dictation fills the field
 * rather than firing, so what was heard can be read and corrected before it is
 * acted on.
 *
 * `SpeakButton` is a single control with two jobs: start the line, or cut it
 * off. A caddie you cannot interrupt is worse than one that stays quiet.
 */
import { Loader, Mic, Square, Volume2 } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/ui/text';
import { FontSize, GOLD, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLiveDictation, type LiveDictationState } from '@/hooks/use-live-dictation';
import type { SpeechState } from '@/hooks/use-voice';

import { Button } from './button';

/**
 * A gold wash behind the compact microphone.
 *
 * Gold, but not the solid gold of a submit button - that one is the primary
 * action and should stay the only filled thing in a composer. A tint plus a
 * gold ring and a gold icon is unmistakably live without setting up two
 * buttons that look equally like the thing to press. `1F` is about 12% over
 * whichever background the theme supplies, which lands on both.
 */
const MIC_TINT = `${GOLD}1F`;

type MicCircleProps = {
  state: LiveDictationState;
  /** True from the tap until the session ends, connecting included. */
  isRecording: boolean;
  onPress: () => void;
  /** What the control is for, read out when it is not recording. */
  label: string;
};

/**
 * The compact microphone, for sitting beside a text field.
 *
 * It used to sit on `backgroundElement` with a muted icon - the exact pair a
 * disabled submit button uses - so a working microphone read as an inert part
 * of the composer and golfers did not try it. The flat treatment is now
 * reserved for when the mic genuinely cannot be tapped.
 */
export function MicCircle({ state, isRecording, onPress, label }: MicCircleProps) {
  const colors = useTheme();

  const working = state === 'transcribing' || state === 'connecting';
  const off = state === 'transcribing' || state === 'denied';

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'Stop dictating' : label}
      accessibilityState={{ busy: working, disabled: off }}
      style={[
        styles.circle,
        {
          backgroundColor: isRecording
            ? colors.destructive
            : off
              ? colors.backgroundElement
              : MIC_TINT,
          borderColor: isRecording ? colors.destructive : off ? colors.border : colors.primary,
        },
      ]}>
      {working ? (
        <ActivityIndicator size="small" color={isRecording ? colors.primaryText : colors.primary} />
      ) : isRecording ? (
        // A stop square while recording: the same tap now ends it.
        <Square size={16} color={colors.primaryText} fill={colors.primaryText} />
      ) : (
        <Mic size={20} color={off ? colors.textMuted : colors.primary} />
      )}
    </Pressable>
  );
}

type VoiceComposerProps = {
  placeholder: string;
  /** Label on the submit button. */
  submitLabel: string;
  /** Called with the trimmed text. The field is cleared before this runs. */
  onSubmit: (text: string) => void;
  /** True while the caller is still working on the last submission. */
  busy?: boolean;
  /** Shown under the field when nothing else needs saying. */
  hint?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A field you can type into or talk into, and a button that acts on it. */
export function VoiceComposer({
  placeholder,
  submitLabel,
  onSubmit,
  busy,
  hint,
  icon,
  style,
}: VoiceComposerProps) {
  const colors = useTheme();
  const [text, setText] = useState('');

  /**
   * What was in the field when the microphone was tapped.
   *
   * A ref rather than state, and the distinction matters: `toggleMic` sets this
   * and starts the session in the same tick, and the session binds its handlers
   * once at start - so a state setter would not have landed, and every session
   * would use the value from the render before the tap. Dictating twice without
   * submitting would then replace the first transcript instead of continuing
   * it. A ref is read when the words arrive, not when the closure was made.
   */
  const typedBeforeSpeaking = useRef('');

  const dictation = useLiveDictation({
    // Dictation reports the whole transcript each time it changes, not a delta,
    // so it cannot simply be appended - it would repeat the sentence on every
    // update. Holding the prefix separately means the golfer can type half of
    // it, speak the rest, and keep both.
    onText: useCallback((spoken: string) => {
      const prefix = typedBeforeSpeaking.current.trim();
      setText(prefix ? `${prefix} ${spoken}` : spoken);
    }, []),
  });

  function toggleMic() {
    if (dictation.isRecording) {
      void dictation.stop();
      return;
    }
    // Whatever is in the field now - typed, or dictated a moment ago and not
    // yet submitted - is what the new words get added to.
    typedBeforeSpeaking.current = text;
    void dictation.start();
  }

  function submit() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || busy) return;

    setText('');
    typedBeforeSpeaking.current = '';
    onSubmit(trimmed);
  }

  const status = dictation.error
    ? dictation.error
    : dictation.state === 'connecting'
      ? 'Opening the microphone…'
      : dictation.state === 'transcribing'
        ? 'Finishing what you said…'
        : dictation.isRecording
          ? dictation.isDegraded
            ? // The socket did not come up, so nothing appears until the
              // recording is finished and sent off in one piece.
              'Recording - tap the square when you are done.'
            : 'Listening - tap the square when you are done.'
          : hint;

  return (
    <View style={[styles.composer, style]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        style={[
          styles.composerInput,
          { backgroundColor: colors.input, color: colors.text, borderColor: colors.border },
        ]}
      />

      <View style={styles.composerRow}>
        <MicCircle
          state={dictation.state}
          isRecording={dictation.isRecording}
          onPress={toggleMic}
          label={placeholder}
        />
        <Button
          label={submitLabel}
          onPress={submit}
          disabled={text.trim().length === 0 || !!busy}
          loading={!!busy}
          {...(icon ? { icon } : {})}
          style={styles.composerSubmit}
        />
      </View>

      {status ? (
        <ThemedText
          variant="caption"
          tone={dictation.error ? 'default' : 'muted'}
          {...(dictation.error ? { style: { color: colors.destructive } } : {})}>
          {status}
        </ThemedText>
      ) : null}
    </View>
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
  circle: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: { gap: Spacing.two, marginTop: Spacing.two },
  composerInput: {
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    fontSize: FontSize.base,
  },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  composerSubmit: { flex: 1 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
