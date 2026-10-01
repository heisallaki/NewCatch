import { MEDIA_URL } from './config';

export function mediaUrl(path: string): string {
  return `${MEDIA_URL}${path}`;
}