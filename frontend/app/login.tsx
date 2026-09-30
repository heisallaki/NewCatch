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
import { EMAIL_DOMAIN, isJkuatEmail } from '@/constants/options';
import { useAuth } from '@/features/auth/AuthContext';
import { api, describeError, Failure } from '@/services/api';
import type { SessionResponse } from '@/types';

export default function Login() {
  const router = useRouter();
  const { completeSession } = useAuth();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState('');
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

  function submitCredentials() {
    if (!isJkuatEmail(email)) {
      setError({ message: `Use your ${EMAIL_DOMAIN} email address.`, code: 'client' });
      return;
    }
    if (!password) {
      setError({ message: 'Enter your password.', code: 'client' });
      return;
    }
    run(async () => {
      const data = await api<{ challenge_token: string; message: string }>('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      setChallenge(data.challenge_token);
      setInfo(data.message);
      setOtp('');
      setStep('otp');
    });
  }

  function submitOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setError({ message: 'Enter the 6-digit code from your email.', code: 'client' });
      return;
    }
    run(async () => {
      const data = await api<SessionResponse>('/auth/login/verify', {
        method: 'POST',
        body: { challenge_token: challenge, otp },
      });
      await completeSession(data);
      router.replace(data.user.status === 'deactivated' ? '/member/deactivated' : '/member/discover');
    });
  }

  return (
    <Screen>
      <Seo title="Log in | New Catch" description="Log in to New Catch with your JKUAT student email." path="/login" noindex />
      <TextLink href="/">← New Catch</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        Log in
      </Heading>
      <GlassCard>
        <ErrorNotice error={error} />
        {step === 'credentials' ? (
          <View>
            <TextField
              label="JKUAT student email"
              value={email}
              onChangeText={setEmail}
              placeholder={`name${EMAIL_DOMAIN}`}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              onSubmitEditing={submitCredentials}
            />
            <Button title="Continue" onPress={submitCredentials} loading={busy} />
            <View style={{ marginTop: 20, gap: 12 }}>
              <TextLink href="/forgot-password">Forgot Password?</TextLink>
              <TextLink href="/register">New here? Create an account</TextLink>
            </View>
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
              onSubmitEditing={submitOtp}
            />
            <Button title="Verify and log in" onPress={submitOtp} loading={busy} />
            <View style={{ marginTop: 16 }}>
              <Button
                title="Back and resend code"
                variant="secondary"
                onPress={() => {
                  setStep('credentials');
                  setError(null);
                }}
              />
            </View>
            <Body style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
              You can request a new code once a minute.
            </Body>
          </View>
        )}
      </GlassCard>
    </Screen>
  );
}