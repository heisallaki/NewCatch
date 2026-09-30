import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Seo } from '@/components/Seo';
import { TextField } from '@/components/TextField';
import { TextLink } from '@/components/TextLink';
import { Body, Heading, Muted } from '@/components/Typography';
import { EMAIL_DOMAIN, isJkuatEmail } from '@/constants/options';
import { useAction } from '@/hooks/useAction';
import { api } from '@/services/api';
import type { AccountStatus } from '@/types';

type Step = 'email' | 'otp' | 'appeal';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '';
}

export default function Appeal() {
  const router = useRouter();
  const { email: prefill } = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(typeof prefill === 'string' ? prefill : '');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState('');
  const { busy, error, run, fail } = useAction();

  function requestCode() {
    if (!isJkuatEmail(email)) return fail(`Use your ${EMAIL_DOMAIN} email address.`);
    run(async () => {
      const data = await api<{ message: string }>('/appeals/blacklist/request', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setInfo(data.message);
      setOtp('');
      setStep('otp');
    });
  }

  function verifyCode() {
    if (!/^\d{6}$/.test(otp)) return fail('Enter the 6-digit code from your email.');
    run(async () => {
      const data = await api<{ appeal_token: string; status: AccountStatus }>('/appeals/blacklist/verify', {
        method: 'POST',
        body: { email: email.trim(), otp },
      });
      setToken(data.appeal_token);
      setStatus(data.status);
      setStep('appeal');
    });
  }

  function submitAppeal() {
    if (message.trim().length < 20) return fail('Please explain your appeal in at least 20 characters.');
    run(async () => {
      const data = await api<AccountStatus>('/appeals/blacklist', {
        method: 'POST',
        body: { appeal_token: token, message: message.trim() },
      });
      setStatus(data);
      setMessage('');
    });
  }

  const latest = status?.latest_appeal ?? null;

  return (
    <Screen>
      <Seo title="Appeal | New Catch" description="Appeal a New Catch blacklist decision." path="/appeal" noindex />
      <TextLink href="/login">← Back to log in</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        Appeal a blacklist decision
      </Heading>
      <GlassCard>
        <ErrorNotice error={error} />
        {step === 'email' ? (
          <View>
            <Body style={{ marginBottom: 16 }}>
              Enter the JKUAT email that was blacklisted. We will email you a code to confirm it is yours.
            </Body>
            <TextField
              label="JKUAT student email"
              value={email}
              onChangeText={setEmail}
              placeholder={`name${EMAIL_DOMAIN}`}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={requestCode}
            />
            <Button title="Send verification code" onPress={requestCode} loading={busy} />
            <Muted style={{ marginTop: 16 }}>
              If your appeal was already accepted, you will have received an email and can simply log in.
            </Muted>
          </View>
        ) : null}

        {step === 'otp' ? (
          <View>
            {info ? <Notice tone="info" message={info} /> : null}
            <TextField
              label="6-digit code"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={verifyCode}
            />
            <Button title="Verify" onPress={verifyCode} loading={busy} />
            <View style={{ marginTop: 16 }}>
              <Button title="Use a different email" variant="secondary" onPress={() => setStep('email')} />
            </View>
          </View>
        ) : null}

        {step === 'appeal' ? (
          <View>
            <Notice
              tone="error"
              message="This email has been blacklisted by a New Catch administrator, so it cannot be used to sign in or register."
            />
            {latest?.status === 'pending' ? (
              <Notice
                tone="info"
                message={`Your appeal was submitted on ${formatDate(latest.created_at)} and is waiting for review. We will email you the result. You can come back to this page and verify again to check.`}
              />
            ) : null}
            {latest?.status === 'rejected' ? (
              <Notice
                tone="error"
                message={`Your appeal was reviewed on ${formatDate(latest.reviewed_at)} and rejected.${
                  latest.admin_response ? ` Message from moderators: ${latest.admin_response}` : ''
                }${status?.next_appeal_at ? ` You can appeal again after ${formatDate(status.next_appeal_at)}.` : ''}`}
              />
            ) : null}
            {status?.can_appeal ? (
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
              </View>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <Button title="Back to home" variant="secondary" onPress={() => router.replace('/')} />
            </View>
          </View>
        ) : null}
      </GlassCard>
    </Screen>
  );
}