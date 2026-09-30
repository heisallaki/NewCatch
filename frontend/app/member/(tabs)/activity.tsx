import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors } from '@/constants/theme';
import { api, describeError, Failure } from '@/services/api';
import { mediaUrl } from '@/services/media';
import type { ActivityItem } from '@/types';

export default function Activity() {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  useFocusEffect(
    useCallback(() => {
      api<ActivityItem[]>('/chat/activity')
        .then((data) => {
          setItems(data);
          setError(null);
        })
        .catch((e) => setError(describeError(e)));
    }, [])
  );

  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Activity
      </Heading>
      <ErrorNotice error={error} />
      {items && items.length === 0 ? (
        <GlassCard>
          <Body>Nothing yet. New Catches and messages will show up here.</Body>
        </GlassCard>
      ) : null}
      {items?.map((item, index) => (
        <Pressable
          key={`${item.type}-${item.match_id}-${index}`}
          accessibilityRole="button"
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
                <Body>
                  {item.type === 'match'
                    ? `It's a New Catch with ${item.person.display_name}! 🎉`
                    : `${item.person.display_name} sent you a message`}
                </Body>
                {item.preview ? <Muted numberOfLines={1}>{item.preview}</Muted> : null}
                <Muted>{new Date(item.at).toLocaleString()}</Muted>
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
  thumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.inputBg },
});