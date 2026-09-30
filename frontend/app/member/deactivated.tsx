import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Body, Heading, Muted } from '@/components/Typography';
import { SUPPORT_EMAIL } from '@/constants/policies';
import { useAuth } from '@/features/auth/AuthContext';
import { api, describeError, Failure } from '@/services/api';
import type { AccountStatus } from '@/types';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '';
}

export default function Deactivated() {
  const router = useRouter();
  const { refreshUser, signOut } = useAuth();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<AccountStatus>('/users/me/account-status');
      setStatus(data);
      if (data.status === 'active') await refreshUser();
    } catch (e) {
      setError(describeError(e));
    }
  }, [refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  const appealState = status?.latest_appeal?.status;

  useEffect(() => {
    if (appealState !== 'pending') return;
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [appealState, load]);

  async function submitAppeal() {
    if (message.trim().length < 20) {
      setError({ message: 'Please explain your appeal in at least 20 characters.', code: 'client' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api<AccountStatus>('/users/me/appeals', { method: 'POST', body: { message: message.trim() } });
      setStatus(data);
      setShowForm(false);
      setMessage('');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut();
    router.replace('/');
  }

  const latest = status?.latest_appeal ?? null;

  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Account deactivated
      </Heading>
      <GlassCard>
        <ErrorNotice error={error} />
        <Notice
          tone="error"
          message="Your New Catch account has been deactivated by an administrator. This is not a technical error. You cannot use the app while your account is deactivated."
        />
        {status?.reason ? (
          <View style={{ marginBottom: 16 }}>
            <Heading level={3}>Reason given</Heading>
            <Body style={{ marginTop: 6 }}>{status.reason}</Body>
            {status.deactivated_at ? <Muted style={{ marginTop: 6 }}>Deactivated on {formatDate(status.deactivated_at)}</Muted> : null}
          </View>
        ) : null}

        {latest?.status === 'pending' ? (
          <Notice tone="info" message={`Your appeal was submitted on ${formatDate(latest.created_at)} and is waiting for review. This page updates automatically.`} />
        ) : null}

        {latest?.status === 'rejected' ? (
          <Notice
            tone="error"
            message={`Your appeal was reviewed on ${formatDate(latest.reviewed_at)} and rejected.${
              latest.admin_response ? ` Message from moderators: ${latest.admin_response}` : ''
            }${status?.next_appeal_at ? ` You can appeal again after ${formatDate(status.next_appeal_at)}.` : ''}`}
          />
        ) : null}

        {status?.can_appeal && !showForm ? <Button title="Appeal" onPress={() => setShowForm(true)} /> : null}

        {status?.can_appeal && showForm ? (
          <View>
            <TextField
              label="Why should this decision be reviewed?"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
              hint="Minimum 20 characters."
            />
            <Button title="Submit appeal" onPress={submitAppeal} loading={busy} />
            <View style={{ marginTop: 12 }}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowForm(false)} />
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 24, gap: 12 }}>
          <Button title="Check status" variant="secondary" onPress={load} />
          <Button
            title="Contact support"
            variant="secondary"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('New Catch account appeal')}`)}
          />
          <Button title="Log out" variant="secondary" onPress={logout} />
        </View>
      </GlassCard>
    </Screen>
  );
}