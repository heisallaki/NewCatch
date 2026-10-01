import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { api } from './api';
import { clearPushToken, getPushToken, setPushToken } from './storage';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

let cached: NotificationsModule | null | undefined;
let handledResponseId: string | null = null;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (cached !== undefined) return cached;
  const expoGoAndroid =
    Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (Platform.OS === 'web' || expoGoAndroid) {
    cached = null;
    return null;
  }
  try {
    cached = await import('expo-notifications');
  } catch {
    cached = null;
  }
  return cached;
}

export async function configureNotifications(): Promise<void> {
  const notifications = await loadNotifications();
  if (!notifications) return;
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });
}

export async function registerForPush(): Promise<void> {
  const notifications = await loadNotifications();
  if (!notifications) return;
  try {
    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.log('Push notifications skipped: no EAS project ID. Run "npx eas-cli init" in the frontend folder.');
      return;
    }
    const { data: token } = await notifications.getExpoPushTokenAsync({ projectId });
    await api('/push/register', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    await setPushToken(token);
  } catch (error) {
    console.log('Push registration skipped:', error);
  }
}

export async function unregisterPush(): Promise<void> {
  const token = await getPushToken();
  if (!token) return;
  try {
    await api('/push/unregister', { method: 'POST', body: { token } });
  } catch {
    await clearPushToken();
    return;
  }
  await clearPushToken();
}

export async function listenForNotificationTaps(onOpen: (matchId: number) => void): Promise<() => void> {
  const notifications = await loadNotifications();
  if (!notifications) return () => undefined;

  function open(response: NotificationResponse | null) {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (id === handledResponseId) return;
    handledResponseId = id;
    const data = response.notification.request.content.data as { type?: unknown; match_id?: unknown };
    if (data?.type === 'message' && typeof data.match_id === 'number') onOpen(data.match_id);
  }

  notifications.getLastNotificationResponseAsync().then(open);
  const subscription = notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}