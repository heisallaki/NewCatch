import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors } from '@/constants/theme';
import { api, describeError, Failure } from '@/services/api';
import { mediaUrl } from '@/services/media';
import type { Card, CatchesResponse } from '@/types';

function CatchRow({ card, label, onPress }: { card: Card; label?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${card.display_name}`} onPress={onPress}>
      <GlassCard style={{ marginBottom: 12 }}>
        <View style={styles.row}>
          {card.photo ? (
            <Image source={{ uri: mediaUrl(card.photo.url) }} style={styles.thumb} accessibilityLabel={`Photo of ${card.display_name}`} />
          ) : (
            <View style={styles.thumb} />
          )}
          <View style={{ flex: 1 }}>
            <Heading level={3}>{card.display_name}</Heading>
            <Muted>{card.campus}</Muted>
            <Muted>New Catch Match {card.match.score}%</Muted>
            {label ? <Body style={styles.label}>{label}</Body> : null}
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

export default function Catches() {
  const router = useRouter();
  const [tab, setTab] = useState<'matches' | 'waiting'>('matches');
  const [data, setData] = useState<CatchesResponse | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<CatchesResponse>('/discovery/catches'));
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

  const open = (id: number) => router.push(`/member/people/${id}`);

  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Catches
      </Heading>
      <View style={styles.tabs}>
        <Button
          title={`New Catches${data ? ` (${data.matches.length})` : ''}`}
          variant={tab === 'matches' ? 'primary' : 'secondary'}
          onPress={() => setTab('matches')}
          style={{ flex: 1 }}
        />
        <Button
          title={`Waiting${data ? ` (${data.waiting.length})` : ''}`}
          variant={tab === 'waiting' ? 'primary' : 'secondary'}
          onPress={() => setTab('waiting')}
          style={{ flex: 1 }}
        />
      </View>
      <ErrorNotice error={error} />

      {tab === 'matches' && data && data.matches.length === 0 ? (
        <GlassCard>
          <Body>No New Catches yet. When you and someone else Catch each other, it appears here.</Body>
        </GlassCard>
      ) : null}
      {tab === 'matches'
        ? data?.matches.map((match) => (
            <CatchRow key={match.match_id} card={match.person} label="It's a New Catch! 🎉" onPress={() => open(match.person.user_id)} />
          ))
        : null}

      {tab === 'waiting' && data && data.waiting.length === 0 ? (
        <GlassCard>
          <Body>People you Catch appear here while you wait to see if they Catch you back.</Body>
        </GlassCard>
      ) : null}
      {tab === 'waiting'
        ? data?.waiting.map((card) => <CatchRow key={card.user_id} card={card} onPress={() => open(card.user_id)} />)
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 72, height: 90, borderRadius: 12, backgroundColor: colors.inputBg },
  label: { color: colors.accentAlt, fontWeight: '700', marginTop: 4 },
});