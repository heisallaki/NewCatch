import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Loader, Screen } from '@/components/Screen';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors, radius } from '@/constants/theme';
import { MatchModal } from '@/features/discovery/MatchModal';
import { MatchBadge } from '@/features/discovery/ProfileCard';
import { api, describeError, Failure } from '@/services/api';
import { mediaUrl } from '@/services/media';
import type { Card, OpenedProfile, SwipeResult } from '@/types';

export default function PersonProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<OpenedProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [matched, setMatched] = useState<Card | null>(null);

  useEffect(() => {
    api<OpenedProfile>(`/profiles/${id}`)
      .then(setProfile)
      .catch((e) => setError(describeError(e)));
  }, [id]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/member/discover');
  }

  async function respond(action: 'catch' | 'swerve') {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<SwipeResult>('/discovery/swipe', {
        method: 'POST',
        body: { user_id: profile.user_id, action },
      });
      if (result.matched && result.person) setMatched(result.person);
      else goBack();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    if (error) {
      return (
        <Screen>
          <Button title="Back" variant="secondary" onPress={goBack} />
          <View style={{ marginTop: 16 }}>
            <ErrorNotice error={error} />
          </View>
        </Screen>
      );
    }
    return <Loader />;
  }

  return (
    <Screen>
      <Button title="← Back" variant="secondary" onPress={goBack} style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
      <ErrorNotice error={error} />
      {profile.photos.map((photo, index) => (
        <Image
          key={photo.id}
          source={{ uri: mediaUrl(photo.url) }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={`Photo ${index + 1} of ${profile.name}`}
        />
      ))}
      <GlassCard>
        <Heading level={1}>{profile.name}</Heading>
        <Body style={{ marginTop: 4 }}>{profile.course}</Body>
        <Muted>
          {profile.year_of_study} · {profile.campus}
          {profile.graduation_year ? ` · Class of ${profile.graduation_year}` : ''}
        </Muted>
        {profile.relationship !== 'self' ? <MatchBadge match={profile.match} /> : null}

        {profile.bio ? (
          <View style={styles.section}>
            <Heading level={3}>About</Heading>
            <Body style={{ marginTop: 6 }}>{profile.bio}</Body>
          </View>
        ) : null}

        <View style={styles.section}>
          <Heading level={3}>Looking for</Heading>
          <View style={styles.chips}>
            {profile.looking_for.map((item) => (
              <Chip key={item} label={item} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Heading level={3}>Interests and hobbies</Heading>
          <View style={styles.chips}>
            {profile.interests.map((item) => (
              <Chip key={item} label={item} highlight={profile.match.shared_interests.includes(item)} />
            ))}
          </View>
        </View>

        {profile.music_genres.length > 0 || profile.favourite_artist ? (
          <View style={styles.section}>
            <Heading level={3}>Music</Heading>
            <View style={styles.chips}>
              {profile.music_genres.map((item) => (
                <Chip key={item} label={`🎵 ${item}`} />
              ))}
            </View>
            {profile.favourite_artist ? <Body style={{ marginTop: 8 }}>Favourite artist: {profile.favourite_artist}</Body> : null}
          </View>
        ) : null}
      </GlassCard>

      <View style={{ marginTop: 16 }}>
        {profile.relationship === 'matched' ? (
          <Notice tone="success" message="It's a New Catch! 🎉 You both Caught each other. Chat arrives in the next phase." />
        ) : null}
        {profile.relationship === 'caught' ? (
          <Notice tone="info" message="You Caught them. If they Catch you back, it becomes a New Catch." />
        ) : null}
        {profile.relationship === 'none' ? (
          <View style={styles.actions}>
            <Button title="Swerve ✕" variant="secondary" onPress={() => respond('swerve')} disabled={busy} style={{ flex: 1 }} />
            <Button title="Catch ❤️" onPress={() => respond('catch')} loading={busy} style={{ flex: 1 }} />
          </View>
        ) : null}
      </View>

      <MatchModal
        person={matched}
        onKeepGoing={() => {
          setMatched(null);
          goBack();
        }}
        onViewCatches={() => {
          setMatched(null);
          router.replace('/member/catches');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: '100%',
    height: 420,
    borderRadius: radius.lg,
    marginBottom: 12,
    backgroundColor: colors.inputBg,
  },
  section: { marginTop: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12 },
});