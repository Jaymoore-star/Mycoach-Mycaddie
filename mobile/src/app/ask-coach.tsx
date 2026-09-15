import { usePaginatedQuery, useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowUp, RotateCcw, Square, Volume2, X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/convex/_generated/api';
import type { CoachId } from '@/convex/lib/coachLevels';

import { RichText } from '@/components/ui/rich-text';
import { ThemedText } from '@/components/ui/text';
import { TypingDots } from '@/components/ui/typing-dots';
import { MicCircle } from '@/components/ui/voice-controls';
import { getCoachById } from '@/constants/coaches';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLiveDictation } from '@/hooks/use-live-dictation';
import { useSpeech } from '@/hooks/use-voice';

/**
 * Ask your coach - the conversational half of My Coach.
 *
 * Presented as a modal so it can be opened from the Home bubble over whatever
 * the golfer was looking at, and closed back to it. The list is inverted: new
 * messages arrive at the bottom and older ones page in above, which is both
 * what a chat should feel like and what `usePaginatedQuery` wants, since the
 * backend returns newest first.
 */

/** One screenful plus a little, so the first page never looks short. */
const PAGE_SIZE = 25;

const STARTERS = [
  'I keep slicing my driver - where do I start?',
  'What should I work on today?',
  'My chipping is costing me shots around the green.',
  'How do I stop three-putting?',
];

type ChatMessage = {
  key: string;
  role: 'user' | 'assistant';
  text: string;
  pending: boolean;
};

export default function AskCoachScreen() {
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const profile = useQuery(api.profiles.getMyProfile, {});
  const coach = getCoachById(profile?.coachId);

  const { results, status, loadMore } = usePaginatedQuery(
    api.coachChat.listMessages,
    profile ? { profileId: profile._id } : 'skip',
    { initialNumItems: PAGE_SIZE },
  );

  // The reply as it is being written. A separate single-row query rather than
  // part of `listMessages`, so a token does not invalidate the whole paginated
  // conversation six times a second.
  const streaming = useQuery(
    api.coachChat.streamingReply,
    profile ? { profileId: profile._id } : 'skip',
  );

  const sendMessage = useMutation(api.coachChat.sendMessage);
  const clearConversation = useMutation(api.coachChat.clearConversation);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // ─── Voice ────────────────────────────────────────────────────────────
  // Reading a coaching reply out loud is the same feature the web app called
  // `getCoachResponse`, arrived at from the other side: the reply already
  // exists with the full persona and the golfer's data behind it, so it only
  // needs a voice, not a second generation.

  const speech = useSpeech(profile?.coachId as CoachId | undefined);
  const [spokenKey, setSpokenKey] = useState<string | null>(null);

  function speakMessage(message: ChatMessage) {
    if (spokenKey === message.key && speech.isBusy) {
      speech.stop();
      setSpokenKey(null);
      return;
    }
    setSpokenKey(message.key);
    void speech.speak(message.text);
  }

  /**
   * What was typed before the microphone was tapped.
   *
   * Dictation reports the whole transcript each time it changes, not a delta,
   * so it cannot simply be appended - it would repeat the sentence on every
   * update. Holding the prefix separately means the golfer can type half a
   * question, speak the rest, and keep both.
   */
  // A ref rather than state, and the distinction is the whole bug it fixes.
  // `toggleMic` sets this and starts the session in the same tick, so a state
  // setter would not have landed yet - and the session binds its handlers once,
  // at start, so `onText` kept the value from the render *before* the tap for
  // the rest of the session. Dictating twice without sending therefore replaced
  // the first transcript instead of continuing it. A ref is read when the words
  // arrive, not when the closure was made.
  const typedBeforeSpeaking = useRef('');

  // Dictating into the composer rather than sending: what a coach is asked
  // should be read back before it goes, and a misheard question wastes a turn
  // of the conversation.
  const dictation = useLiveDictation({
    onText: useCallback((text: string) => {
      const prefix = typedBeforeSpeaking.current.trim();
      setDraft(prefix ? `${prefix} ${text}` : text);
    }, []),
  });

  function toggleMic() {
    if (dictation.isRecording) {
      void dictation.stop();
      return;
    }
    // Whatever is in the composer now - typed, or dictated a moment ago and
    // not yet sent - is what the new words get added to.
    typedBeforeSpeaking.current = draft;
    void dictation.start();
  }

  /**
   * Keyboard height, tracked by hand.
   *
   * `KeyboardAvoidingView` is not enough here. Android is edge-to-edge from
   * Expo 57 on, so the window no longer resizes for the keyboard and the
   * `behavior` prop has nothing to act on - the composer ends up underneath
   * it. Padding the container by the measured height works the same way on
   * both platforms. iOS uses the `Will` events so the lift animates with the
   * keyboard rather than snapping after it.
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /**
   * The component stores a message per generation step, so an assistant turn
   * can arrive as several rows. Only the text ones are worth rendering, and
   * a row with no text yet is the reply still being written.
   */
  const messages = useMemo<ChatMessage[]>(() => {
    const stored = results
      .filter((m) => m.message?.role === 'user' || m.message?.role === 'assistant')
      .map((m) => ({
        key: m._id,
        role: m.message?.role === 'user' ? ('user' as const) : ('assistant' as const),
        text: m.text ?? '',
        pending: m.status === 'pending',
      }))
      .filter((m) => m.text.length > 0 || m.pending);

    if (!streaming) return stored;

    // The list is inverted, so the newest row goes first. One fixed key, so
    // React updates this bubble in place as the words arrive instead of
    // remounting it on every change.
    return [
      { key: 'streaming', role: 'assistant' as const, text: streaming.text, pending: true },
      // The component files a pending placeholder of its own while generating;
      // showing both would give the golfer two coaches answering at once.
      ...stored.filter((m) => !(m.pending && m.text.length === 0)),
    ];
  }, [results, streaming]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!profile || trimmed.length === 0 || sending) return;

      setDraft('');
      // The keyboard deliberately stays up. Dismissing it here re-laid out the
      // whole list - once on the way down and again when the golfer tapped
      // back in - which is most of what made sending feel slow. The list is
      // inverted, so the newest message already sits directly above the
      // composer and stays in view with the keyboard open.
      setSending(true);
      void sendMessage({ profileId: profile._id, prompt: trimmed })
        .catch((error: unknown) => {
          setDraft(trimmed); // Give the message back rather than losing it.
          const message =
            error instanceof Error && 'data' in error
              ? String((error as { data?: { message?: string } }).data?.message ?? '')
              : '';
          Alert.alert(
            'Message not sent',
            message.length > 0 ? message : 'Please try again.',
          );
        })
        .finally(() => setSending(false));
    },
    [profile, sendMessage, sending],
  );

  function confirmClear() {
    if (!profile || messages.length === 0) return;
    Alert.alert(
      `Clear your conversation with ${coach.name}?`,
      'Every message in this thread is deleted. Your rounds, sessions and swing history are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void clearConversation({ profileId: profile._id }).catch(() =>
              Alert.alert('Could not clear', 'Please try again.'),
            );
          },
        },
      ],
    );
  }

  const loading = profile === undefined || status === 'LoadingFirstPage';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.three, borderBottomColor: colors.border },
        ]}>
        <Image source={coach.image} style={styles.headerAvatar} contentFit="cover" />
        <View style={styles.headerText}>
          <ThemedText variant="heading">{coach.name}</ThemedText>
          <ThemedText variant="caption" tone="muted">
            {coach.title} · {coach.levelSpec.breakingScore}
          </ThemedText>
        </View>
        <Pressable
          onPress={confirmClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear conversation">
          <RotateCcw size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.root, { paddingBottom: keyboardHeight }]}>
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <Empty coachName={coach.name} tagline={coach.tagline} onPick={send} />
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.key}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (status === 'CanLoadMore') loadMore(PAGE_SIZE);
            }}
            // Tuned for a chat that grows while it is on screen. The defaults
            // render far more rows than a phone shows, and every incoming
            // token re-runs the list.
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={9}
            renderItem={({ item }) => (
              <Bubble
                message={item}
                accent={coach.accent}
                name={coach.name}
                onSpeak={speakMessage}
                speaking={spokenKey === item.key && speech.isSpeaking}
                loadingSpeech={spokenKey === item.key && speech.state === 'loading'}
              />
            )}
          />
        )}

        {(dictation.error || dictation.isBusy) && (
          <View style={[styles.voiceError, { borderTopColor: colors.border }]}>
            <ThemedText
              variant="caption"
              style={dictation.error ? { color: colors.destructive } : undefined}
              tone={dictation.error ? 'default' : 'muted'}>
              {dictation.error ??
                (dictation.state === 'connecting'
                  ? 'Opening the microphone…'
                  : dictation.state === 'transcribing'
                    ? 'Finishing what you said…'
                    : dictation.isDegraded
                      ? // The socket did not come up, so nothing appears until
                        // the recording is finished and sent off in one piece.
                        'Recording - tap the square when you are done.'
                      : 'Listening - tap the square when you are done.')}
            </ThemedText>
          </View>
        )}

        <View
          style={[
            styles.composer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              // The home-indicator gutter belongs below the composer only
              // while the keyboard is down; with it up the keyboard occupies
              // that space and the extra padding reads as a gap.
              paddingBottom: keyboardHeight > 0 ? Spacing.three : insets.bottom + Spacing.three,
            },
          ]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Ask ${coach.name} anything`}
            placeholderTextColor={colors.textMuted}
            multiline
            // Send is an explicit button press: Enter inserts a newline so a
            // long description of a miss can be written in paragraphs.
            style={[
              styles.input,
              { backgroundColor: colors.input, color: colors.text, borderColor: colors.border },
            ]}
          />
          <MicCircle
            state={dictation.state}
            isRecording={dictation.isRecording}
            onPress={toggleMic}
            label="Dictate your question"
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={draft.trim().length === 0 || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[
              styles.send,
              {
                backgroundColor:
                  draft.trim().length === 0 ? colors.backgroundElement : colors.primary,
              },
            ]}>
            {sending ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <ArrowUp
                size={20}
                color={draft.trim().length === 0 ? colors.textMuted : colors.primaryText}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Memoised on purpose.
 *
 * A reply arrives as a stream of updates, and each one re-runs the list. Only
 * the last bubble is actually changing, so without this every message in the
 * thread re-parses its markdown on every token.
 */
const Bubble = memo(function Bubble({
  message,
  accent,
  name,
  onSpeak,
  speaking,
  loadingSpeech,
}: {
  message: ChatMessage;
  accent: string;
  name: string;
  onSpeak: (message: ChatMessage) => void;
  speaking: boolean;
  loadingSpeech: boolean;
}) {
  const colors = useTheme();
  const mine = message.role === 'user';

  if (message.pending && message.text.length === 0) {
    return (
      <View style={[styles.row, styles.rowThem]}>
        <View style={[styles.bubble, { backgroundColor: colors.card }]}>
          <TypingDots label={`${name} is thinking`} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, mine ? styles.rowMe : styles.rowThem]}>
      {!mine && (
        <ThemedText variant="caption" style={[styles.author, { color: accent }]} uppercase>
          {name}
        </ThemedText>
      )}
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: Radius.sm }
            : {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderBottomLeftRadius: Radius.sm,
              },
        ]}>
        {/* The golfer's own message is exactly what they typed, so it needs no
            parsing. The coach's may carry emphasis worth rendering. */}
        {mine ? (
          <ThemedText variant="body" style={{ color: colors.primaryText }}>
            {message.text}
          </ThemedText>
        ) : (
          <RichText>{message.text}</RichText>
        )}

        {/* Still arriving. The dots sit under the text so the golfer can read
            what is written while the rest comes in. */}
        {!mine && message.pending && message.text.length > 0 && (
          <View style={styles.stillWriting}>
            <TypingDots />
          </View>
        )}

        {/* The coach's own words, spoken. Nothing to gain from replaying
            the golfer's own message back at them, so it is one-sided. */}
        {!mine && !message.pending && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speaking ? `Stop ${name}` : `Hear ${name} say this`}
            accessibilityState={{ busy: loadingSpeech }}
            onPress={() => onSpeak(message)}
            hitSlop={10}
            style={styles.speakRow}>
            {loadingSpeech ? (
              <ActivityIndicator size="small" color={accent} />
            ) : speaking ? (
              <Square size={12} color={accent} fill={accent} />
            ) : (
              <Volume2 size={14} color={colors.textMuted} />
            )}
            <ThemedText variant="caption" tone="muted">
              {loadingSpeech ? 'One moment' : speaking ? 'Stop' : 'Hear it'}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
});

function Empty({
  coachName,
  tagline,
  onPick,
}: {
  coachName: string;
  tagline: string;
  onPick: (text: string) => void;
}) {
  const colors = useTheme();

  return (
    <View style={styles.empty}>
      <ThemedText variant="title">Ask {coachName}</ThemedText>
      <ThemedText variant="body" tone="secondary" style={styles.emptyLine}>
        {tagline}
      </ThemedText>
      <ThemedText variant="caption" tone="muted" style={styles.emptyLine}>
        {coachName} can see your rounds, practice sessions, logged shots and swing notes.
        Describe a miss and you will get a fix.
      </ThemedText>

      <View style={styles.starters}>
        {STARTERS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            style={({ pressed }) => [
              styles.starter,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.backgroundElement : colors.card,
              },
            ]}>
            <ThemedText variant="label" tone="secondary">
              {s}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: Radius.pill },
  headerText: { flex: 1, gap: 1 },

  listContent: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  row: { maxWidth: '86%' },
  rowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowThem: { alignSelf: 'flex-start' },
  author: { marginBottom: Spacing.one, marginLeft: Spacing.half },
  bubble: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.xl,
  },

  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.one,
  },
  emptyLine: { marginTop: Spacing.one },
  starters: { marginTop: Spacing.five, gap: Spacing.two },
  starter: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    fontSize: FontSize.base,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stillWriting: { marginTop: Spacing.two },
  voiceError: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  speakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});
