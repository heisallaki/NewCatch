import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { configureNotifications, listenForNotificationTaps, registerForPush } from '@/services/push';

export function usePushNotifications(enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let active = true;
    let stop: () => void = () => undefined;

    configureNotifications().then(() => {
      if (!active) return;
      registerForPush();
      listenForNotificationTaps((matchId) => router.push(`/member/chat/${matchId}`)).then((remove) => {
        if (active) stop = remove;
        else remove();
      });
    });

    return () => {
      active = false;
      stop();
    };
  }, [enabled]);
}