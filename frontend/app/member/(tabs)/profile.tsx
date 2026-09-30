import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Body, Heading, Muted } from '@/components/Typography';
import { POLICIES, PolicySlug, SUPPORT_EMAIL } from '@/constants/policies';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { PolicyModal } from '@/features/policies/PolicyModal';
import { api } from '@/services/api';
import { mediaUrl } from '@/services/media';
import type { OwnProfile } from '@/types';

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [policy, setPolicy] = useState<PolicySlug | null>(null);
  const [profile, setProfile] = useState<OwnProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      api<OwnProfile>('/profiles/me')
        .then(setProfile)
        .catch(() => setProfile(null));
    }, [])
  );

  async function logout() {
    await signOut();
    router.replace('/');
  }

  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Profile
      </Heading>
      {profile && !profile.complete ? (
        <Notice
          tone="info"
          message="Your profile is not complete yet, so you cannot discover people. Add a photo, interests and what you are looking for."
          actionLabel="Complete profile"
          onAction={() => router.push('/member/edit-profile')}
        />
      ) : null}
      <GlassCard>
        {profile?.photos[0] ? (
          <Image
            source={{ uri: mediaUrl(profile.photos[0].url) }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel="Your main photo"
          />
        ) : null}
        <Heading level={2} style={{ marginTop: 12 }}>
          {user?.profile?.display_name}
        </Heading>
        <Muted style={{ marginTop: 2 }}>{user?.profile?.full_name}</Muted>
        <View style={{ marginTop: 12, gap: 4 }}>
          <Body>{user?.profile?.campus}</Body>
          <Body>{user?.profile?.year_of_study}</Body>
          <Body>{user?.profile?.course}</Body>
        </View>
        {profile ? (
          <View style={styles.chips}>
            {profile.interests.map((item) => (
              <Chip key={item} label={item} />
            ))}
          </View>
        ) : null}
        <Muted style={{ marginTop: 12 }}>Your student email is private and never shown to other users.</Muted>
        <View style={{ marginTop: 16 }}>
          <Button title="Edit profile" onPress={() => router.push('/member/edit-profile')} />
        </View>
      </GlassCard>

      <Heading level={2} style={{ marginTop: 24, marginBottom: 12 }}>
        Policies and support
      </Heading>
      <View style={{ gap: 10 }}>
        {POLICIES.map((item) => (
          <Button key={item.slug} title={item.title} variant="secondary" onPress={() => setPolicy(item.slug)} />
        ))}
        <Button title="Email support" variant="secondary" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </View>

      <View style={{ marginTop: 24, gap: 10 }}>
        {user?.is_admin ? <Button title="Admin console" variant="secondary" onPress={() => router.push('/admin')} /> : null}
        <Button title="Log out" onPress={logout} />
      </View>
      <PolicyModal slug={policy} onClose={() => setPolicy(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 320, borderRadius: radius.md, backgroundColor: colors.inputBg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});