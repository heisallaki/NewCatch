import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Loader, Screen } from '@/components/Screen';
import { Seo } from '@/components/Seo';
import { TextField } from '@/components/TextField';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { useAction } from '@/hooks/useAction';
import { api, describeError, Failure } from '@/services/api';
import { mediaUrl } from '@/services/media';
import type { AdminAppeal, AdminReport, AdminUser, AdminUserDetail } from '@/types';

type Tab = 'appeals' | 'reports' | 'users';
type UserAction = 'deactivate' | 'reactivate' | 'blacklist';
type ReportAction = 'dismiss' | 'reviewed' | 'deactivate' | 'blacklist';

const actionLabels: Record<string, string> = {
  deactivated: 'Deactivated',
  reactivated: 'Reactivated',
  blacklisted: 'Blacklisted',
  appeal_accepted: 'Appeal accepted',
  appeal_rejected: 'Appeal rejected',
  admin_promoted: 'Promoted to admin',
  admin_revoked: 'Admin revoked',
  photo_removed: 'Photo removed',
  report_dismissed: 'Report dismissed',
  report_reviewed: 'Report reviewed',
  report_actioned: 'Report actioned',
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

type ConfirmProps = {
  label: string;
  danger?: boolean;
  warning?: string;
  onConfirm: (text: string) => Promise<void>;
  onCancel: () => void;
};

function ConfirmBox({ label, danger = false, warning, onConfirm, onCancel }: ConfirmProps) {
  const [text, setText] = useState('');
  const { busy, error, run, fail } = useAction();

  function submit() {
    if (text.trim().length < 5) return fail('Enter at least 5 characters.');
    run(async () => {
      await onConfirm(text.trim());
    });
  }

  return (
    <View style={styles.block}>
      {warning ? <Body style={{ marginBottom: 12, color: colors.danger }}>{warning}</Body> : null}
      <ErrorNotice error={error} />
      <TextField label={label} value={text} onChangeText={setText} multiline maxLength={500} />
      <View style={styles.row}>
        <Button title="Confirm" variant={danger ? 'danger' : 'primary'} loading={busy} onPress={submit} style={{ flex: 1 }} />
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
      </View>
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
        <Button title="Pending" variant={filter === 'pending' ? 'primary' : 'secondary'} onPress={() => setFilter('pending')} style={{ flex: 1 }} />
        <Button title="All appeals" variant={filter === 'all' ? 'primary' : 'secondary'} onPress={() => setFilter('all')} style={{ flex: 1 }} />
      </View>
      <ErrorNotice error={error} />
      {rows.length === 0 ? (
        <GlassCard>
          <Body>No appeals to show.</Body>
        </GlassCard>
      ) : null}
      {rows.map((appeal) => (
        <GlassCard key={appeal.id}>
          <Heading level={3} style={{ marginBottom: 8 }}>
            {appeal.kind === 'blacklist' ? 'Blacklist appeal' : 'Deactivation appeal'}
          </Heading>
          <UserLine user={appeal.user} />
          <View style={styles.block}>
            <Heading level={3}>{appeal.kind === 'blacklist' ? 'Blacklist reason' : 'Deactivation reason'}</Heading>
            <Body style={{ marginTop: 4 }}>
              {(appeal.kind === 'blacklist' ? appeal.blacklist_reason : appeal.user.deactivation_reason) ?? 'Not on record'}
            </Body>
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
                <Button title="Accept" loading={busyId === appeal.id} onPress={() => review(appeal.id, 'accept')} style={{ flex: 1 }} />
                <Button title="Reject" variant="danger" loading={busyId === appeal.id} onPress={() => review(appeal.id, 'reject')} style={{ flex: 1 }} />
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

function ReportsPanel() {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [rows, setRows] = useState<AdminReport[]>([]);
  const [active, setActive] = useState<{ id: number; action: ReportAction } | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api<AdminReport[]>(`/admin/reports?status=${filter}`));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: number, action: ReportAction, note: string) {
    await api(`/admin/reports/${id}/resolve`, { method: 'POST', body: { action, note } });
    setActive(null);
    await load();
  }

  const labels: Record<ReportAction, string> = {
    dismiss: 'Note for dismissing this report',
    reviewed: 'Note for marking reviewed',
    deactivate: 'Reason shown to the deactivated user',
    blacklist: 'Reason for permanent blacklist',
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.row}>
        <Button title="Open" variant={filter === 'open' ? 'primary' : 'secondary'} onPress={() => setFilter('open')} style={{ flex: 1 }} />
        <Button title="All reports" variant={filter === 'all' ? 'primary' : 'secondary'} onPress={() => setFilter('all')} style={{ flex: 1 }} />
      </View>
      <ErrorNotice error={error} />
      {rows.length === 0 ? (
        <GlassCard>
          <Body>No reports to show.</Body>
        </GlassCard>
      ) : null}
      {rows.map((report) => (
        <GlassCard key={report.id}>
          <View style={styles.rowBetween}>
            <Heading level={3} style={{ flex: 1 }}>
              {report.reason}
            </Heading>
            <StatusPill status={report.status} />
          </View>
          <Muted style={{ marginTop: 4 }}>
            Reported {formatDate(report.created_at)} by {report.reporter_email}
          </Muted>
          <Body style={{ marginTop: 10 }}>{report.description}</Body>
          {report.screenshot_url ? (
            <Image
              source={{ uri: mediaUrl(report.screenshot_url) }}
              style={styles.screenshot}
              resizeMode="contain"
              accessibilityLabel="Report screenshot"
            />
          ) : (
            <Muted style={{ marginTop: 10 }}>No screenshot attached.</Muted>
          )}
          <View style={styles.block}>
            <Heading level={3} style={{ marginBottom: 8 }}>
              Reported account
            </Heading>
            <UserLine user={report.reported} />
          </View>
          {report.status === 'open' ? (
            <View style={[styles.row, { marginTop: 12, flexWrap: 'wrap' }]}>
              <Button title="Dismiss" variant="secondary" onPress={() => setActive({ id: report.id, action: 'dismiss' })} style={styles.small} />
              <Button title="Mark reviewed" variant="secondary" onPress={() => setActive({ id: report.id, action: 'reviewed' })} style={styles.small} />
              {report.reported.status === 'active' && !report.reported.is_admin ? (
                <Button title="Deactivate user" variant="danger" onPress={() => setActive({ id: report.id, action: 'deactivate' })} style={styles.small} />
              ) : null}
              {report.reported.status !== 'blacklisted' && !report.reported.is_admin ? (
                <Button title="Blacklist user" variant="danger" onPress={() => setActive({ id: report.id, action: 'blacklist' })} style={styles.small} />
              ) : null}
            </View>
          ) : report.admin_note ? (
            <View style={styles.block}>
              <Muted>Resolved {formatDate(report.reviewed_at)}</Muted>
              <Body style={{ marginTop: 4 }}>{report.admin_note}</Body>
            </View>
          ) : null}
          {active?.id === report.id ? (
            <ConfirmBox
              label={labels[active.action]}
              danger={active.action === 'deactivate' || active.action === 'blacklist'}
              warning={active.action === 'blacklist' ? 'Permanent. This email will never be able to register again.' : undefined}
              onConfirm={(note) => resolve(report.id, active.action, note)}
              onCancel={() => setActive(null)}
            />
          ) : null}
        </GlassCard>
      ))}
    </View>
  );
}

function UsersPanel() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [prompt, setPrompt] = useState<{ user: AdminUser; kind: UserAction } | null>(null);
  const [photoPrompt, setPhotoPrompt] = useState<number | null>(null);
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

  async function openDetail(user: AdminUser) {
    try {
      setDetail(await api<AdminUserDetail>(`/admin/users/${user.id}`));
      setPhotoPrompt(null);
    } catch (e) {
      setError(describeError(e));
    }
  }

  function toggleDetail(user: AdminUser) {
    if (detail?.user.id === user.id) setDetail(null);
    else openDetail(user);
  }

  async function applyUserAction(user: AdminUser, kind: UserAction, reason: string) {
    await api(`/admin/users/${user.id}/${kind}`, { method: 'POST', body: { reason } });
    setPrompt(null);
    setDetail(null);
    await load();
  }

  async function removePhoto(user: AdminUser, photoId: number, reason: string) {
    await api(`/admin/photos/${photoId}/remove`, { method: 'POST', body: { reason } });
    setPhotoPrompt(null);
    await openDetail(user);
  }

  return (
    <View style={{ gap: 16 }}>
      <View>
        <TextField label="Search by name or email" value={query} onChangeText={setQuery} autoCapitalize="none" onSubmitEditing={load} />
        <Button title="Search" variant="secondary" onPress={load} />
      </View>
      <ErrorNotice error={error} />
      {rows.map((user) => (
        <GlassCard key={user.id}>
          <UserLine user={user} />
          {user.deactivation_reason ? <Muted style={{ marginTop: 6 }}>Reason on record: {user.deactivation_reason}</Muted> : null}
          <View style={[styles.row, { marginTop: 12, flexWrap: 'wrap' }]}>
            <Button title="History" variant="secondary" onPress={() => toggleDetail(user)} style={styles.small} />
            {!user.is_admin && user.status === 'active' ? (
              <Button title="Deactivate" variant="danger" onPress={() => setPrompt({ user, kind: 'deactivate' })} style={styles.small} />
            ) : null}
            {!user.is_admin && user.status === 'deactivated' ? (
              <Button title="Reactivate" onPress={() => setPrompt({ user, kind: 'reactivate' })} style={styles.small} />
            ) : null}
            {!user.is_admin && user.status !== 'blacklisted' ? (
              <Button title="Blacklist" variant="danger" onPress={() => setPrompt({ user, kind: 'blacklist' })} style={styles.small} />
            ) : null}
          </View>

          {prompt?.user.id === user.id ? (
            <ConfirmBox
              label={`Reason to ${prompt.kind}`}
              danger={prompt.kind !== 'reactivate'}
              warning={prompt.kind === 'blacklist' ? 'Permanent. This email will never be able to register again unless an appeal is accepted.' : undefined}
              onConfirm={(reason) => applyUserAction(prompt.user, prompt.kind, reason)}
              onCancel={() => setPrompt(null)}
            />
          ) : null}

          {detail?.user.id === user.id ? (
            <View>
              <View style={styles.block}>
                <Heading level={3}>Photos</Heading>
                {detail.photos.length === 0 ? <Muted style={{ marginTop: 4 }}>No photos.</Muted> : null}
                <View style={styles.photoGrid}>
                  {detail.photos.map((photo) => (
                    <View key={photo.id} style={{ width: 120 }}>
                      <Image source={{ uri: mediaUrl(photo.url) }} style={styles.photo} resizeMode="cover" accessibilityLabel="User photo" />
                      <Button title="Remove" variant="danger" onPress={() => setPhotoPrompt(photo.id)} style={[styles.small, { marginTop: 6 }]} />
                    </View>
                  ))}
                </View>
                {photoPrompt !== null ? (
                  <ConfirmBox
                    label="Reason for removing this photo (sent to the user)"
                    danger
                    onConfirm={(reason) => removePhoto(user, photoPrompt, reason)}
                    onCancel={() => setPhotoPrompt(null)}
                  />
                ) : null}
              </View>
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
            </View>
          ) : null}
        </GlassCard>
      ))}
    </View>
  );
}

function AdminConsole() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('reports');
  return (
    <Screen maxWidth={900}>
      <Seo title="New Catch" description="New Catch" path="/admin" noindex />
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <Heading level={1}>Admin console</Heading>
        <Button title="Back to app" variant="secondary" onPress={() => router.replace('/member/discover')} />
      </View>
      <View style={[styles.row, { marginBottom: 16 }]}>
        <Button title="Reports" variant={tab === 'reports' ? 'primary' : 'secondary'} onPress={() => setTab('reports')} style={{ flex: 1 }} />
        <Button title="Appeals" variant={tab === 'appeals' ? 'primary' : 'secondary'} onPress={() => setTab('appeals')} style={{ flex: 1 }} />
        <Button title="Users" variant={tab === 'users' ? 'primary' : 'secondary'} onPress={() => setTab('users')} style={{ flex: 1 }} />
      </View>
      {tab === 'reports' ? <ReportsPanel /> : null}
      {tab === 'appeals' ? <AppealsPanel /> : null}
      {tab === 'users' ? <UsersPanel /> : null}
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
  block: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  small: { minHeight: 44, paddingHorizontal: 16 },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
  screenshot: { width: '100%', height: 260, marginTop: 12, borderRadius: radius.md, backgroundColor: colors.inputBg },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  photo: { width: 120, height: 150, borderRadius: radius.sm, backgroundColor: colors.inputBg },
});