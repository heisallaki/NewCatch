import { useCallback, useState } from 'react';

import { describeError, Failure } from '@/services/api';

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const fail = useCallback((message: string) => setError({ message, code: 'client' }), []);

  return { busy, error, run, fail, setError };
}