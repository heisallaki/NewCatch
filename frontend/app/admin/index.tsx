import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Loader, Screen } from '@/components/Screen';
import { Seo } from '@/components/Seo';
import { TextField } from '@/components/TextField';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { api, describeError, Failure } from '@/services/api';
import type { AdminAppeal, AdminUser, AdminUserDetail } from '@/types';

type Tab = 'appeals' | 'users';
type ActionKind = 'deactivate' | 'reactivate' | 'blacklist';

const actionLabels: Record<string, string> = {
  deactivated: 'Deactivated',
  reactivated: 'Reactivated',
  blacklisted: 'Blacklisted',
  appeal_accepted: 'Appeal accepted',
  appeal_rejected: 'Appeal rejected',
  admin_promoted: 'Promoted to admin',
  admin_revoked: 'Admin revoked',
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function StatusPill({ status }: { status: string }) {
  const color = status === 'active' ? colors.success : status === 'deactivated' ? colors.warning : colors.danger;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{status}</Text>
    </View>
  );
}

function UserLine({ user }: { user: AdminUser }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.rowBetween}>
        <Heading level={3} style={{ flex: 1, marginRight: 8 }}>
          {user.profile?.display_name ?? user.email}
        </Heading>
        <StatusPill status={user.status} />
      </View>
      <Body>{user.email}</Body>
      {user.profile ? (
        <Muted>
          {user.profile.full_name} · {user.profile.campus} · {user.profile.year_of_study} · {user.profile.course}
        </Muted>
      ) : null}
      <Muted>
        Joined {formatDate(user.created_at)} · Last login {formatDate(user.last_login_at)}
      </Muted>
    </View>
  );
}

function AppealsPanel() {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [rows, setRows] = useState<AdminAppeal[]>([]);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api<AdminAppeal[]>(`/admin/appeals?status=${filter}`));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id: number, decision: 'accept' | 'reject') {
    const response = (responses[id] ?? '').trim();
    if (response.length < 3) {
      setError({ message: 'Write a short response for the user first.', code: 'client' });
      return;
    }
    setBusyId(id);
    try {
      await api(`/admin/appeals/${id}/review`, { method: 'POST', body: { decision, response } });
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.row}>
        <Button
          title="Pending"
          variant={filter === 'pending' ? 'primary' : 'secondary'}
          onPress={() => setFilter('pending')}
          style={{ flex: 1 }}
        />
        <Button
          title="All appeals"
          variant={filter === 'all' ? 'primary' : 'secondary'}
          onPress={() => setFilter('all')}
          style={{ flex: 1 }}
        />
      </View>
      <ErrorNotice error={error} />
      {rows.length === 0 ? (
        <GlassCard>
          <Body>No appeals to show.</Body>
        </GlassCard>
      ) : null}
      {rows.map((appeal) => (
        <GlassCard key={appeal.id}>
          <UserLine user={appeal.user} />
          <View style={styles.block}>
            <Heading level={3}>Deactivation reason</Heading>
            <Body style={{ marginTop: 4 }}>{appeal.user.deactivation_reason ?? 'Not on record'}</Body>
          </View>
          <View style={styles.block}>
            <Heading level={3}>Appeal submitted {formatDate(appeal.created_at)}</Heading>
            <Body style={{ marginTop: 4 }}>{appeal.message}</Body>
          </View>
          {appeal.status === 'pending' ? (
            <View style={styles.block}>
              <TextField
                label="Response shown to the user"
                value={responses[appeal.id] ?? ''}
                onChangeText={(value) => setResponses((current) => ({ ...current, [appeal.id]: value }))}
                multiline
                maxLength={1000}
              />
              <View style={styles.row}>
                <Button
                  title="Accept"
                  loading={busyId === appeal.id}
                  onPress={() => review(appeal.id, 'accept')}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Reject"
                  variant="danger"
                  loading={busyId === appeal.id}
                  onPress={() => review(appeal.id, 'reject')}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.block}>
              <Heading level={3}>
                {appeal.status === 'accepted' ? 'Accepted' : 'Rejected'} {formatDate(appeal.reviewed_at)}
              </Heading>
              <Body style={{ marginTop: 4 }}>{appeal.admin_response}</Body>
            </View>
          )}
        </GlassCard>
      ))}
    </View>
  );
}

function UsersPanel() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [prompt, setPrompt] = useState<{ user: AdminUser; kind: ActionKind } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api<AdminUser[]>(`/admin/users?q=${encodeURIComponent(query.trim())}`));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, [query]);

  useEffect(() => {
    load();
  }, []);

  async function toggleDetail(user: AdminUser) {
    if (detail?.user.id === user.id) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await api<AdminUserDetail>(`/admin/users/${user.id}`));
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function confirm() {
    if (!prompt) return;
    if (reason.trim().length < 5) {
      setError({ message: 'Enter a reason of at least 5 characters.', code: 'client' });
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/users/${prompt.user.id}/${prompt.kind}`, { method: 'POST', body: { reason: reason.trim() } });
      setPrompt(null);
      setReason('');
      setDetail(null);
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <View>
        <TextField
          label="Search by name or email"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          onSubmitEditing={load}
        />
        <Button title="Search" variant="secondary" onPress={load} />
      </View>
      <ErrorNotice error={error} />
      {rows.map((user) => (
        <GlassCard key={user.id}>
          <UserLine user={user} />
          {user.deactivation_reason ? (
            <Muted style={{ marginTop: 6 }}>Reason on record: {user.deactivation_reason}</Muted>
          ) : null}
          <View style={[styles.row, { marginTop: 12, flexWrap: 'wrap' }]}>
            <Button title="History" variant="secondary" onPress={() => toggleDetail(user)} style={styles.small} />
            {!user.is_admin && user.status === 'active' ? (
              <Button
                title="Deactivate"
                variant="danger"
                onPress={() => {
                  setPrompt({ user, kind: 'deactivate' });
                  setReason('');
                }}
                style={styles.small}
              />
            ) : null}
            {!user.is_admin && user.status === 'deactivated' ? (
              <Button
                title="Reactivate"
                onPress={() => {
                  setPrompt({ user, kind: 'reactivate' });
                  setReason('');
                }}
                style={styles.small}
              />
            ) : null}
            {!user.is_admin && user.status !== 'blacklisted' ? (
              <Button
                title="Blacklist"
                variant="danger"
                onPress={() => {
                  setPrompt({ user, kind: 'blacklist' });
                  setReason('');
                }}
                style={styles.small}
              />
            ) : null}
          </View>

          {prompt?.user.id === user.id ? (
            <View style={styles.block}>
              {prompt.kind === 'blacklist' ? (
                <Body style={{ marginBottom: 12, color: colors.danger }}>
                  Permanent. This email will never be able to register again.
                </Body>
              ) : null}
              <TextField
                label={`Reason to ${prompt.kind}`}
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={500}
              />
              <View style={styles.row}>
                <Button title="Confirm" loading={busy} onPress={confirm} style={{ flex: 1 }} />
                <Button title="Cancel" variant="secondary" onPress={() => setPrompt(null)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}

          {detail?.user.id === user.id ? (
            <View style={styles.block}>
              <Heading level={3}>Moderation history</Heading>
              {detail.actions.length === 0 ? <Muted style={{ marginTop: 4 }}>No actions recorded.</Muted> : null}
              {detail.actions.map((action) => (
                <View key={action.id} style={{ marginTop: 8 }}>
                  <Body>
                    {actionLabels[action.action] ?? action.action} · {formatDate(action.created_at)}
                  </Body>
                  <Muted>
                    By {action.admin_email ?? 'server script'}
                    {action.reason ? ` · ${action.reason}` : ''}
                  </Muted>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>
      ))}
    </View>
  );
}

function AdminConsole() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('appeals');
  return (
    <Screen maxWidth={900}>
      <Seo title="New Catch" description="New Catch" path="/admin" noindex />
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <Heading level={1}>Admin console</Heading>
        <Button title="Back to app" variant="secondary" onPress={() => router.replace('/member/discover')} />
      </View>
      <View style={[styles.row, { marginBottom: 16 }]}>
        <Button
          title="Appeals"
          variant={tab === 'appeals' ? 'primary' : 'secondary'}
          onPress={() => setTab('appeals')}
          style={{ flex: 1 }}
        />
        <Button
          title="Users"
          variant={tab === 'users' ? 'primary' : 'secondary'}
          onPress={() => setTab('users')}
          style={{ flex: 1 }}
        />
      </View>
      {tab === 'appeals' ? <AppealsPanel /> : <UsersPanel />}
    </Screen>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    api('/admin/me')
      .then(() => setAllowed(true))
      .catch(() => router.replace('/member/discover'));
  }, [loading, user]);

  if (!allowed) return <Loader />;
  return <AdminConsole />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  block: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  small: { minHeight: 44, paddingHorizontal: 16 },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
});