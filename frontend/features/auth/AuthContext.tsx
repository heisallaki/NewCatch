import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/services/api';
import { unregisterPush } from '@/services/push';
import { clearTokens, getTokens, setTokens } from '@/services/storage';
import type { SessionResponse, User } from '@/types';

type AuthValue = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  completeSession: (session: SessionResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api<User>('/users/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const completeSession = useCallback(async (session: SessionResponse) => {
    if (session.tokens) await setTokens(session.tokens.access_token, session.tokens.refresh_token);
    setUser(session.user);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush();
    try {
      const tokens = await getTokens();
      await api('/auth/logout', { method: 'POST', body: { refresh_token: tokens.refresh } });
    } catch {
      setUser(null);
    }
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshUser, completeSession, signOut }),
    [user, loading, refreshUser, completeSession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}