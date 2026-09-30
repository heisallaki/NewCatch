import { Platform } from 'react-native';

import { clearTokens, getTokens, setTokens } from './storage';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const isWeb = Platform.OS === 'web';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Failure = { message: string; code: string };

export function describeError(error: unknown): Failure {
  if (error instanceof ApiError) return { message: error.message, code: error.code };
  return { message: 'Something went wrong. Please try again.', code: 'unknown' };
}

type RequestOptions = { method?: string; body?: unknown };

async function send(path: string, method: string, body: unknown, accessToken: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Type': isWeb ? 'web' : 'native',
  };
  if (isWeb) headers['X-Requested-With'] = 'NewCatch';
  if (!isWeb && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: isWeb ? 'include' : 'omit',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server. Check your connection and try again.');
  }
}

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const tokens = await getTokens();
      if (!isWeb && !tokens.refresh) return false;
      const response = await send('/auth/refresh', 'POST', isWeb ? {} : { refresh_token: tokens.refresh }, null);
      if (!response.ok) {
        await clearTokens();
        return false;
      }
      const data = await response.json();
      if (!isWeb && data.tokens) await setTokens(data.tokens.access_token, data.tokens.refresh_token);
      return true;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  let tokens = await getTokens();
  let response = await send(path, method, options.body, tokens.access);
  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      tokens = await getTokens();
      response = await send(path, method, options.body, tokens.access);
    }
  }
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.code ?? 'error',
      typeof data?.detail === 'string' ? data.detail : 'Something went wrong. Please try again.'
    );
  }
  return data as T;
}