import { usePaginatedQuery, useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowUp, RotateCcw, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { ThemedText } from '@/components/ui/text';
import { getCoachById } from '@/constants/coaches';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  const sendMessage = useMutation(api.coachChat.sendMessage);
  const clearConversation = useMutation(api.coachChat.clearConversation);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

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
  const messages = useMemo<ChatMessage[]>(
    () =>
      results
        .filter((m) => m.message?.role === 'user' || m.message?.role === 'assistant')
        .map((m) => ({
          key: m._id,
          role: m.message?.role === 'user' ? ('user' as const) : ('assistant' as const),
          text: m.text ?? '',
          pending: m.status === 'pending',
        }))
        .filter((m) => m.text.length > 0 || m.pending),
    [results],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!profile || trimmed.length === 0 || sending) return;

      setDraft('');
      // The reply takes a few seconds and is worth reading; holding the
      // keyboard up would cover most of it.
      Keyboard.dismiss();
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
            renderItem={({ item }) => (
              <Bubble message={item} accent={coach.accent} name={coach.name} />
            )}
          />
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

function Bubble({
  message,
  accent,
  name,
}: {
  message: ChatMessage;
  accent: string;
  name: string;
}) {
  const colors = useTheme();
  const mine = message.role === 'user';

  if (message.pending && message.text.length === 0) {
    return (
      <View style={[styles.row, styles.rowThem]}>
        <View style={[styles.bubble, { backgroundColor: colors.card }]}>
          <ThemedText variant="caption" tone="muted">
            {name} is thinking…
          </ThemedText>
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
        <ThemedText variant="body" style={mine ? { color: colors.primaryText } : undefined}>
          {message.text}
        </ThemedText>
      </View>
    </View>
  );
}

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
});
