import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ActionToast, Toast } from '@/components/ActionToast';
import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors } from '@/constants/theme';
import { MatchModal } from '@/features/discovery/MatchModal';
import { ProfileCard } from '@/features/discovery/ProfileCard';
import { SwipeCard, SwipeCardHandle, SwipeDirection } from '@/features/discovery/SwipeCard';
import { api, describeError, Failure } from '@/services/api';
import type { Card, SwipeResult } from '@/types';

export default function Discover() {
  const router = useRouter();
  const deckRef = useRef<SwipeCardHandle>(null);
  const seenRef = useRef<Set<number>>(new Set());
  const matchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [incomplete, setIncomplete] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [matched, setMatched] = useState<Card | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async (replace: boolean) => {
    try {
      const data = (await api<Card[]>('/discovery/cards?limit=10')).filter(
        (card) => !seenRef.current.has(card.user_id)
      );
      setCards((current) => {
        if (replace) return data;
        const known = new Set(current.map((card) => card.user_id));
        return [...current, ...data.filter((card) => !known.has(card.user_id))];
      });
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
      load(true);
      return () => {
        if (matchTimer.current) clearTimeout(matchTimer.current);
      };
    }, [load])
  );

  async function handleSwiped(card: Card, direction: SwipeDirection) {
    const action = direction === 'right' ? 'catch' : 'swerve';
    seenRef.current.add(card.user_id);
    setError(null);
    setToast({ key: Date.now(), label: action === 'catch' ? 'Catch! ❤️' : 'Swerve ✕', tone: action });
    setCards((current) => current.filter((item) => item.user_id !== card.user_id));
    if (cards.length - 1 < 3) load(false);
    try {
      const result = await api<SwipeResult>('/discovery/swipe', {
        method: 'POST',
        body: { user_id: card.user_id, action },
      });
      if (result.matched && result.person) {
        const person = result.person;
        setToast({ key: Date.now(), label: 'New Catch! 🎉', tone: 'match' });
        matchTimer.current = setTimeout(() => setMatched(person), 900);
      }
    } catch (e) {
      const failure = describeError(e);
      if (failure.code !== 'not_found' && failure.code !== 'already_swiped') {
        seenRef.current.delete(card.user_id);
        setCards((current) => [card, ...current.filter((item) => item.user_id !== card.user_id)]);
      }
      setError(failure);
    }
  }

  const current = cards[0];

  return (
    <Screen overlay={<ActionToast toast={toast} />}>
      <Heading level={1} style={{ marginBottom: 10 }}>
        Discover
      </Heading>
      <ErrorNotice error={error} />

      {loading ? <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Loading" /> : null}

      {!loading && incomplete ? (
        <GlassCard>
          <Notice
            tone="info"
            message="Add a photo, choose your gender, pick your interests and say what you are looking for to start discovering people."
          />
          <Button title="Complete your profile" onPress={() => router.push('/member/edit-profile')} />
        </GlassCard>
      ) : null}

      {!loading && !incomplete && !current ? (
        <GlassCard>
          <Heading level={2}>You're all caught up</Heading>
          <Body style={{ marginVertical: 10 }}>
            No new people to show right now. Check back soon or widen who you discover in your profile settings.
          </Body>
          <Button title="Refresh" variant="secondary" onPress={() => load(true)} />
        </GlassCard>
      ) : null}

      {!loading && !incomplete && current ? (
        <View>
          <SwipeCard key={current.user_id} ref={deckRef} onSwiped={(direction) => handleSwiped(current, direction)}>
            <ProfileCard card={current} onOpen={() => router.push(`/member/people/${current.user_id}`)} />
          </SwipeCard>
          <View style={styles.actions}>
            <Button title="Swerve ✕" variant="secondary" onPress={() => deckRef.current?.swipe('left')} style={styles.action} />
            <Button title="Catch ❤️" onPress={() => deckRef.current?.swipe('right')} style={styles.action} />
          </View>
          <Muted style={styles.hint}>Swipe right to Catch, left to Swerve</Muted>
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
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1 },
  hint: { textAlign: 'center', marginTop: 8 },
});