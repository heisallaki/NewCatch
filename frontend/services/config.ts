function stripSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

const apiUrl = stripSlash(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000');
const wsOverride = process.env.EXPO_PUBLIC_WS_URL ?? '';
const mediaOverride = process.env.EXPO_PUBLIC_MEDIA_URL ?? '';

function deriveWs(url: string): string {
  return /^https?:\/\//.test(url) ? url.replace(/^http/, 'ws') : '';
}

export const API_URL = apiUrl;
export const WS_URL = stripSlash(wsOverride || deriveWs(apiUrl));
export const MEDIA_URL = stripSlash(mediaOverride || apiUrl);