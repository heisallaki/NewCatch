import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { TextLink } from '@/components/TextLink';
import { Body, Heading } from '@/components/Typography';
import { useAction } from '@/hooks/useAction';
import { api } from '@/services/api';
import type { BlockedUser } from '@/types';

export default function Blocked() {
  const [rows, setRows] = useState<BlockedUser[] | null>(null);
  const { busy, error, run } = useAction();

  const load = useCallback(() => {
    run(async () => {
      setRows(await api<BlockedUser[]>('/safety/blocks'));
    });
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  function unblock(userId: number) {
    run(async () => {
      await api(`/safety/block/${userId}`, { method: 'DELETE' });
      setRows(await api<BlockedUser[]>('/safety/blocks'));
    });
  }

  return (
    <Screen>
      <TextLink href="/member/profile">← Back to profile</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        Blocked users
      </Heading>
      <ErrorNotice error={error} />
      {rows && rows.length === 0 ? (
        <GlassCard>
          <Body>You have not blocked anyone.</Body>
        </GlassCard>
      ) : null}
      <View style={{ gap: 12 }}>
        {rows?.map((row) => (
          <GlassCard key={row.user_id}>
            <View style={styles.row}>
              <Body style={{ flex: 1 }}>{row.display_name}</Body>
              <Button title="Unblock" variant="secondary" onPress={() => unblock(row.user_id)} disabled={busy} />
            </View>
          </GlassCard>
        ))}
      </View>
      <Body style={{ marginTop: 16, opacity: 0.8 }}>
        Unblocking lets you see each other again. Previous matches and chats are not restored.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});