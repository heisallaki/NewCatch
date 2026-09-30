import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Loader } from '@/components/Screen';
import { Muted } from '@/components/Typography';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { useChatSocket } from '@/features/chat/useChatSocket';
import { api, describeError } from '@/services/api';
import type { ChatEvent, ChatMessage, MiniPerson } from '@/types';

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const id = Number(matchId);
  const [other, setOther] = useState<MiniPerson | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [closed, setClosed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const onEvent = useCallback(
    (event: ChatEvent) => {
      if (event.type === 'message' && event.message.match_id === id) {
        setMessages((current) =>
          current.some((item) => item.id === event.message.id) ? current : [...current, event.message]
        );
      } else if (event.type === 'chat_closed' && event.match_id === id) {
        setClosed('This conversation has ended.');
      } else if (event.type === 'error') {
        setNotice(event.detail);
      }
    },
    [id]
  );

  const { connected, send } = useChatSocket(onEvent);

  useEffect(() => {
    api<{ other: MiniPerson; messages: ChatMessage[] }>(`/chat/${id}/messages`)
      .then((data) => {
        setOther(data.other);
        setMessages(data.messages);
      })
      .catch((e) => setClosed(describeError(e).message))
      .finally(() => setLoading(false));
  }, [id]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/member/chats');
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    if (!send({ type: 'message', match_id: id, body })) {
      setNotice('Not connected yet. Please wait a moment and try again.');
      return;
    }
    setNotice(null);
    setText('');
  }

  if (loading) return <Loader />;

  return (
    <LinearGradient colors={colors.gradient} style={styles.fill}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Button title="←" variant="secondary" onPress={goBack} style={styles.headerButton} />
          <Text style={styles.title} numberOfLines={1}>
            {other?.display_name ?? 'Chat'}
          </Text>
          {other ? (
            <Button
              title="Profile"
              variant="secondary"
              onPress={() => router.push(`/member/people/${other.user_id}`)}
              style={styles.headerButton}
            />
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.column}>
            {messages.length === 0 && !closed ? (
              <Muted style={styles.empty}>It's a New Catch! Say hi to {other?.display_name}.</Muted>
            ) : null}
            {messages.map((message) => {
              const mine = message.sender_id === user?.id;
              return (
                <View key={message.id} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={styles.body}>{message.body}</Text>
                    <Text style={styles.time}>{formatTime(message.created_at)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.column}>
            {closed ? <Notice tone="error" message={closed} /> : null}
            {notice ? <Notice tone="error" message={notice} /> : null}
            {!connected && !closed ? <Muted style={{ marginBottom: 6 }}>Connecting...</Muted> : null}
            {!closed ? (
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Message"
                  value={text}
                  onChangeText={setText}
                  placeholder="Write a message"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  multiline
                  maxLength={1000}
                  style={styles.input}
                />
                <Button title="Send" onPress={submit} disabled={!connected || !text.trim()} style={styles.send} />
              </View>
            ) : (
              <Button title="Back to chats" variant="secondary" onPress={() => router.replace('/member/chats')} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: { minHeight: 44, paddingHorizontal: 16 },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  list: { flexGrow: 1, alignItems: 'center', padding: 16 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  empty: { textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', marginBottom: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  bubbleMine: { backgroundColor: 'rgba(255,77,141,0.55)' },
  bubbleTheirs: { backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.border },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  time: { color: colors.muted, fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    minHeight: 50,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    color: colors.text,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 16,
  },
  send: { minHeight: 50, paddingHorizontal: 20 },
});