import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { Loader } from '@/components/Screen';
import { Seo } from '@/components/Seo';
import { useAuth } from '@/features/auth/AuthContext';
import { usePushNotifications } from '@/features/notifications/usePushNotifications';

export default function MemberLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];
  const onDeactivatedScreen = segments[1] === 'deactivated';
  const deactivated = user?.status === 'deactivated';
  const misrouted = (deactivated && !onDeactivatedScreen) || (!deactivated && onDeactivatedScreen);

  usePushNotifications(user?.status === 'active');

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (deactivated && !onDeactivatedScreen) router.replace('/member/deactivated');
    else if (!deactivated && onDeactivatedScreen) router.replace('/member/discover');
  }, [loading, user, deactivated, onDeactivatedScreen]);

  if (loading || !user || misrouted) return <Loader />;

  return (
    <>
      <Seo title="New Catch" description="New Catch" path="/member" noindex />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}