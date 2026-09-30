import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Body, Heading, Muted } from '@/components/Typography';
import { POLICIES, PolicySlug, SUPPORT_EMAIL } from '@/constants/policies';
import { useAuth } from '@/features/auth/AuthContext';
import { PolicyModal } from '@/features/policies/PolicyModal';

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [policy, setPolicy] = useState<PolicySlug | null>(null);
  const profile = user?.profile;

  async function logout() {
    await signOut();
    router.replace('/');
  }

  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Profile
      </Heading>
      <GlassCard>
        <Heading level={2}>{profile?.display_name}</Heading>
        <Muted style={{ marginTop: 4 }}>{profile?.full_name}</Muted>
        <View style={{ marginTop: 16, gap: 6 }}>
          <Body>{profile?.campus}</Body>
          <Body>{profile?.year_of_study}</Body>
          <Body>{profile?.course}</Body>
          <Muted>Your student email is private: {user?.email}</Muted>
        </View>
      </GlassCard>

      <Heading level={2} style={{ marginTop: 24, marginBottom: 12 }}>
        Policies and support
      </Heading>
      <View style={{ gap: 10 }}>
        {POLICIES.map((item) => (
          <Button key={item.slug} title={item.title} variant="secondary" onPress={() => setPolicy(item.slug)} />
        ))}
        <Button
          title="Email support"
          variant="secondary"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </View>

      <View style={{ marginTop: 24, gap: 10 }}>
        {user?.is_admin ? (
          <Button title="Admin console" variant="secondary" onPress={() => router.push('/admin')} />
        ) : null}
        <Button title="Log out" onPress={logout} />
      </View>
      <PolicyModal slug={policy} onClose={() => setPolicy(null)} />
    </Screen>
  );
}