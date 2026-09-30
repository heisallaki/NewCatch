import { Linking } from 'react-native';

import { Notice } from '@/components/Notice';
import { SUPPORT_EMAIL } from '@/constants/policies';
import type { Failure } from '@/services/api';

export function ErrorNotice({ error }: { error: Failure | null }) {
  if (!error) return null;
  if (error.code === 'email_blacklisted') {
    return (
      <Notice
        tone="error"
        message={error.message}
        actionLabel="Appeal"
        onAction={() =>
          Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('New Catch blacklist appeal')}`)
        }
      />
    );
  }
  return <Notice tone="error" message={error.message} />;
}