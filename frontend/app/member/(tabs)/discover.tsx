import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Body, Heading } from '@/components/Typography';
import { colors } from '@/constants/theme';
import { MatchModal } from '@/features/discovery/MatchModal';
import { ProfileCard } from '@/features/discovery/ProfileCard';
import { api, describeError, Failure } from '@/services/api';
import type { Card, SwipeResult } from '@/types';

export default function Discover() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [matched, setMatched] = useState<Card | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Card[]>('/discovery/cards?limit=10');
      setCards(data);
      setIncomplete(false);
      setError(null);
    } catch (e) {
      const failure = describeError(e);
      if (failure.code === 'profile_incomplete') setIncomplete(true);
      else setError(failure);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function respond(action: 'catch' | 'swerve') {
    const current = cards[0];
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<SwipeResult>('/discovery/swipe', {
        method: 'POST',
        body: { user_id: current.user_id, action },
      });
      const remaining = cards.slice(1);
      setCards(remaining);
      if (result.matched && result.person) setMatched(result.person);
      if (remaining.length < 3) load();
    } catch (e) {
      const failure = describeError(e);
      if (failure.code === 'not_found' || failure.code === 'already_swiped') setCards(cards.slice(1));
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  const current = cards[0];

  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Discover
      </Heading>
      <ErrorNotice error={error} />

      {loading ? <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Loading" /> : null}

      {!loading && incomplete ? (
        <GlassCard>
          <Notice tone="info" message="Add a photo, pick your interests and choose what you are looking for to start discovering people." />
          <Button title="Complete your profile" onPress={() => router.push('/member/edit-profile')} />
        </GlassCard>
      ) : null}

      {!loading && !incomplete && !current ? (
        <GlassCard>
          <Heading level={2}>You're all caught up</Heading>
          <Body style={{ marginVertical: 12 }}>No new people to show right now. Check back soon or widen who you discover in your profile settings.</Body>
          <Button title="Refresh" variant="secondary" onPress={load} />
        </GlassCard>
      ) : null}

      {!loading && !incomplete && current ? (
        <View>
          <ProfileCard card={current} onOpen={() => router.push(`/member/people/${current.user_id}`)} />
          <View style={styles.actions}>
            <Button title="Swerve ✕" variant="secondary" onPress={() => respond('swerve')} disabled={busy} style={{ flex: 1 }} />
            <Button title="Catch ❤️" onPress={() => respond('catch')} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      <MatchModal
        person={matched}
        onKeepGoing={() => setMatched(null)}
        onViewCatches={() => {
          setMatched(null);
          router.push('/member/catches');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});