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
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastSentRef = useRef('');
  const lastIdRef = useRef(0);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const known = new Set(current.map((item) => item.id));
      const fresh = incoming.filter((item) => !known.has(item.id));
      return fresh.length ? [...current, ...fresh].sort((a, b) => a.id - b.id) : current;
    });
  }, []);

  useEffect(() => {
    lastIdRef.current = messages.length ? messages[messages.length - 1].id : 0;
  }, [messages]);

  const onEvent = useCallback(
    (event: ChatEvent) => {
      if (event.type === 'message') {
        if (event.message.match_id === id) merge([event.message]);
      } else if (event.type === 'chat_closed') {
        if (event.match_id === id) setClosed('This conversation has ended.');
      } else if (event.type === 'error') {
        setNotice(event.detail);
        setText((current) => current || lastSentRef.current);
      }
    },
    [id, merge]
  );

  const { status, connected, send } = useChatSocket(onEvent);

  useEffect(() => {
    api<{ other: MiniPerson; messages: ChatMessage[] }>(`/chat/${id}/messages`)
      .then((data) => {
        setOther(data.other);
        setMessages(data.messages);
      })
      .catch((e) => setClosed(describeError(e).message))
      .finally(() => setLoading(false));
  }, [id]);

  const catchUp = useCallback(async () => {
    try {
      const data = await api<{ messages: ChatMessage[] }>(`/chat/${id}/messages?after_id=${lastIdRef.current}`);
      merge(data.messages);
    } catch (e) {
      const failure = describeError(e);
      if (failure.code === 'not_found') setClosed(failure.message);
    }
  }, [id, merge]);

  useEffect(() => {
    if (loading || closed) return;
    if (connected) {
      catchUp();
      return;
    }
    const timer = setInterval(catchUp, 4000);
    return () => clearInterval(timer);
  }, [loading, closed, connected, catchUp]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/member/chats');
  }

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setNotice(null);
    lastSentRef.current = body;
    if (connected && send({ type: 'message', match_id: id, body })) {
      setText('');
      return;
    }
    setSending(true);
    try {
      const message = await api<ChatMessage>(`/chat/${id}/messages`, { method: 'POST', body: { body } });
      merge([message]);
      setText('');
    } catch (e) {
      const failure = describeError(e);
      if (failure.code === 'unavailable') setClosed(failure.message);
      else setNotice(failure.message);
    } finally {
      setSending(false);
    }
  }

  function onKeyPress(event: any) {
    if (Platform.OS !== 'web') return;
    const native = event.nativeEvent;
    if (native?.key === 'Enter' && !native.shiftKey) {
      event.preventDefault();
      submit();
    }
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

        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.column}>
            {closed ? <Notice tone="error" message={closed} /> : null}
            {notice ? <Notice tone="error" message={notice} /> : null}
            {!closed && status !== 'connected' ? (
              <Muted style={{ marginBottom: 6 }}>
                {status === 'connecting' ? 'Connecting...' : 'Reconnecting... your messages still send.'}
              </Muted>
            ) : null}
            {!closed ? (
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Message"
                  value={text}
                  onChangeText={setText}
                  onKeyPress={onKeyPress}
                  placeholder="Write a message"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  multiline
                  maxLength={1000}
                  style={styles.input}
                />
                <Button title="Send" onPress={submit} loading={sending} disabled={!text.trim()} style={styles.send} />
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
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: { minHeight: 40, paddingHorizontal: 14 },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  list: { flexGrow: 1, alignItems: 'center', padding: 14 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  empty: { textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', marginBottom: 6 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  bubbleMine: { backgroundColor: 'rgba(255,77,141,0.55)' },
  bubbleTheirs: { backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.border },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  time: { color: colors.muted, fontSize: 11, marginTop: 3, alignSelf: 'flex-end' },
  composer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    color: colors.text,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  send: { minHeight: 44, paddingHorizontal: 18 },
});