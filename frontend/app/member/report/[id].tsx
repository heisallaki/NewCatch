import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { Body, Heading, Muted } from '@/components/Typography';
import { SUPPORT_EMAIL } from '@/constants/policies';
import { colors, radius } from '@/constants/theme';
import { useAction } from '@/hooks/useAction';
import { api } from '@/services/api';

const REASONS = ['Harassment', 'Inappropriate content', 'Fake account', 'Spam', 'Impersonation', 'Other'];

type Screenshot = { data: string; mime: string | null; uri: string };

export default function ReportUser() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [done, setDone] = useState(false);
  const { busy, error, run, fail } = useAction();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/member/discover');
  }

  function pickScreenshot() {
    run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const data = asset.base64 ?? (asset.uri.startsWith('data:') ? asset.uri : null);
      if (!data) {
        fail('Could not read that image. Try another one.');
        return;
      }
      setScreenshot({ data, mime: asset.mimeType ?? null, uri: asset.uri });
    });
  }

  function submit() {
    if (!reason) return fail('Choose a reason for your report.');
    if (description.trim().length < 10) return fail('Please describe what happened in at least 10 characters.');
    run(async () => {
      await api('/reports', {
        method: 'POST',
        body: {
          reported_user_id: Number(id),
          reason,
          description: description.trim(),
          screenshot: screenshot?.data ?? null,
          screenshot_mime: screenshot?.mime ?? null,
        },
      });
      setDone(true);
    });
  }

  if (done) {
    return (
      <Screen>
        <Heading level={1} style={{ marginBottom: 16 }}>
          Report sent
        </Heading>
        <GlassCard>
          <Notice tone="success" message="Thank you. A moderator will review your report. We do not share moderation details publicly." />
          <Body style={{ marginBottom: 16 }}>You can also block this person from their profile so they cannot see or contact you.</Body>
          <Button title="Done" onPress={goBack} />
        </GlassCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <Button title="← Back" variant="secondary" onPress={goBack} style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
      <Heading level={1} style={{ marginBottom: 16 }}>
        Report user
      </Heading>
      <GlassCard>
        <ErrorNotice error={error} />
        <Select label="Reason" value={reason} options={REASONS} onChange={setReason} placeholder="Choose a reason" />
        <TextField
          label="What happened?"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
          hint={`${description.length}/1000`}
        />
        <Body style={{ marginBottom: 8 }}>Screenshot (recommended)</Body>
        <Muted style={{ marginBottom: 12 }}>Screenshots help moderators act faster. Do not include anything you would not want us to see.</Muted>
        {screenshot ? <Image source={{ uri: screenshot.uri }} style={styles.preview} resizeMode="cover" accessibilityLabel="Selected screenshot" /> : null}
        <View style={{ gap: 10, marginBottom: 16 }}>
          <Button title={screenshot ? 'Choose a different screenshot' : 'Attach screenshot'} variant="secondary" onPress={pickScreenshot} disabled={busy} />
          {screenshot ? <Button title="Remove screenshot" variant="secondary" onPress={() => setScreenshot(null)} disabled={busy} /> : null}
        </View>
        <Button title="Submit report" onPress={submit} loading={busy} />
        <View style={{ marginTop: 16 }}>
          <Button title="Contact support instead" variant="secondary" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        </View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.inputBg, marginBottom: 12 },
});