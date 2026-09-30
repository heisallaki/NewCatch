import { useRouter } from 'expo-router';
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
import { Body, Heading } from '@/components/Typography';
import { EMAIL_DOMAIN, isJkuatEmail, isStrongPassword } from '@/constants/options';
import { useAuth } from '@/features/auth/AuthContext';
import { api, describeError, Failure } from '@/services/api';
import type { SessionResponse } from '@/types';

export default function ForgotPassword() {
  const router = useRouter();
  const { completeSession } = useAuth();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  function fail(message: string) {
    setError({ message, code: 'client' });
  }

  function requestCode() {
    if (!isJkuatEmail(email)) return fail(`Use your ${EMAIL_DOMAIN} email address.`);
    run(async () => {
      const data = await api<{ message: string }>('/auth/password/forgot', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setInfo(data.message);
      setOtp('');
      setStep('reset');
    });
  }

  function resetPassword() {
    if (!/^\d{6}$/.test(otp)) return fail('Enter the 6-digit code from your email.');
    if (!isStrongPassword(password)) return fail('Password must be at least 10 characters and include a letter and a number.');
    if (password !== confirm) return fail('Passwords do not match.');
    run(async () => {
      const data = await api<SessionResponse>('/auth/password/reset', {
        method: 'POST',
        body: { email: email.trim(), otp, new_password: password },
      });
      await completeSession(data);
      router.replace(data.user.status === 'deactivated' ? '/member/deactivated' : '/member/discover');
    });
  }

  return (
    <Screen>
      <Seo title="Reset password | New Catch" description="Reset your New Catch password." path="/forgot-password" noindex />
      <TextLink href="/login">← Back to log in</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        Reset your password
      </Heading>
      <GlassCard>
        <ErrorNotice error={error} email={email} />
        {step === 'email' ? (
          <View>
            <Body style={{ marginBottom: 16 }}>Enter your JKUAT email and we will send a reset code.</Body>
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
            <Button title="Send reset code" onPress={requestCode} loading={busy} />
          </View>
        ) : (
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
            />
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              hint="At least 10 characters with a letter and a number."
            />
            <TextField
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <Button title="Reset password and continue" onPress={resetPassword} loading={busy} />
            <View style={{ marginTop: 16 }}>
              <Button
                title="Use a different email"
                variant="secondary"
                onPress={() => {
                  setStep('email');
                  setError(null);
                }}
              />
            </View>
          </View>
        )}
      </GlassCard>
    </Screen>
  );
}