import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'nc_access_token';
const REFRESH_KEY = 'nc_refresh_token';
const PUSH_KEY = 'nc_push_token';
const isNative = Platform.OS !== 'web';

export async function getTokens(): Promise<{ access: string | null; refresh: string | null }> {
  if (!isNative) return { access: null, refresh: null };
  return {
    access: await SecureStore.getItemAsync(ACCESS_KEY),
    refresh: await SecureStore.getItemAsync(REFRESH_KEY),
  };
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  if (!isNative) return;
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  if (!isNative) return;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getPushToken(): Promise<string | null> {
  if (!isNative) return null;
  return SecureStore.getItemAsync(PUSH_KEY);
}

export async function setPushToken(token: string): Promise<void> {
  if (!isNative) return;
  await SecureStore.setItemAsync(PUSH_KEY, token);
}

export async function clearPushToken(): Promise<void> {
  if (!isNative) return;
  await SecureStore.deleteItemAsync(PUSH_KEY);
}