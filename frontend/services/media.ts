import { API_URL } from './api';

export function mediaUrl(path: string): string {
  return `${API_URL}${path}`;
}