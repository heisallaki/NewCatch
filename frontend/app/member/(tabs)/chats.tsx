import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors } from '@/constants/theme';
import { useChatSocket } from '@/features/chat/useChatSocket';
import { api, describeError, Failure } from '@/services/api';
import { mediaUrl } from '@/services/media';
import type { ChatEvent, Conversation } from '@/types';

export default function Chats() {
  const router = useRouter();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<Conversation[]>('/chat/conversations'));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useChatSocket(
    useCallback(
      (event: ChatEvent) => {
        if (event.type === 'message' || event.type === 'chat_closed') load();
      },
      [load]
    )
  );

  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Chats
      </Heading>
      <ErrorNotice error={error} />
      {items && items.length === 0 ? (
        <GlassCard>
          <Body>No chats yet. When you get a New Catch, you can start talking here.</Body>
        </GlassCard>
      ) : null}
      {items?.map((item) => (
        <Pressable
          key={item.match_id}
          accessibilityRole="button"
          accessibilityLabel={`Open chat with ${item.person.display_name}`}
          onPress={() => router.push(`/member/chat/${item.match_id}`)}
        >
          <GlassCard style={{ marginBottom: 12 }}>
            <View style={styles.row}>
              {item.person.photo ? (
                <Image source={{ uri: mediaUrl(item.person.photo.url) }} style={styles.thumb} accessibilityLabel={`Photo of ${item.person.display_name}`} />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={{ flex: 1 }}>
                <Heading level={3}>{item.person.display_name}</Heading>
                <Muted numberOfLines={1}>
                  {item.last_message
                    ? `${item.last_message.mine ? 'You: ' : ''}${item.last_message.body}`
                    : "It's a New Catch! Say hi."}
                </Muted>
              </View>
            </View>
          </GlassCard>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.inputBg },
});