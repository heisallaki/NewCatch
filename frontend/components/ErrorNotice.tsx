import { useRouter } from 'expo-router';

import { Notice } from '@/components/Notice';
import type { Failure } from '@/services/api';

export function ErrorNotice({ error, email }: { error: Failure | null; email?: string }) {
  const router = useRouter();
  if (!error) return null;
  if (error.code === 'email_blacklisted') {
    return (
      <Notice
        tone="error"
        message={error.message}
        actionLabel="Appeal"
        onAction={() => router.push({ pathname: '/appeal', params: email ? { email: email.trim() } : {} } as never)}
      />
    );
  }
  return <Notice tone="error" message={error.message} />;
}