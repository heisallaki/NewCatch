import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { Seo } from '@/components/Seo';
import { TextField } from '@/components/TextField';
import { TextLink } from '@/components/TextLink';
import { Body, Heading } from '@/components/Typography';
import { CAMPUSES, EMAIL_DOMAIN, isJkuatEmail, isStrongPassword, YEARS } from '@/constants/options';
import { PolicySlug, POLICY_VERSION } from '@/constants/policies';
import { colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthContext';
import { PolicyModal } from '@/features/policies/PolicyModal';
import { api, describeError, Failure } from '@/services/api';
import type { SessionResponse } from '@/types';

type Step = 'email' | 'otp' | 'details';

export default function Register() {
  const router = useRouter();
  const { completeSession } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [campus, setCampus] = useState('');
  const [year, setYear] = useState('');
  const [course, setCourse] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [policy, setPolicy] = useState<PolicySlug | null>(null);
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
    if (!isJkuatEmail(email)) return fail(`Only ${EMAIL_DOMAIN} email addresses can register.`);
    run(async () => {
      const data = await api<{ message: string }>('/auth/register/request', {
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
      const data = await api<{ registration_token: string }>('/auth/register/verify', {
        method: 'POST',
        body: { email: email.trim(), otp },
      });
      setToken(data.registration_token);
      setInfo('');
      setStep('details');
    });
  }

  function createAccount() {
    if (fullName.trim().length < 2) return fail('Enter your name.');
    if (displayName.trim().length < 2) return fail('Enter a preferred name.');
    if (!campus) return fail('Select your campus.');
    if (!year) return fail('Select your year of study.');
    if (course.trim().length < 2) return fail('Enter your course.');
    if (gradYear && !/^20\d{2}$/.test(gradYear)) return fail('Enter a valid graduation year, for example 2028.');
    if (!isStrongPassword(password)) return fail('Password must be at least 10 characters and include a letter and a number.');
    if (password !== confirm) return fail('Passwords do not match.');
    if (!accepted) return fail('Please accept the policies to continue.');
    run(async () => {
      const data = await api<SessionResponse>('/auth/register/complete', {
        method: 'POST',
        body: {
          registration_token: token,
          password,
          full_name: fullName.trim(),
          display_name: displayName.trim(),
          campus,
          year_of_study: year,
          course: course.trim(),
          graduation_year: gradYear ? Number(gradYear) : null,
          accepted_policy_version: POLICY_VERSION,
        },
      });
      await completeSession(data);
      router.replace('/member/discover');
    });
  }

  const linkStyle = { color: colors.accentAlt, textDecorationLine: 'underline' as const, fontWeight: '600' as const };

  return (
    <Screen>
      <Seo title="Create account | New Catch" description="Create your New Catch account with your JKUAT student email." path="/register" noindex />
      <TextLink href="/">← New Catch</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        Create your account
      </Heading>
      <GlassCard>
        <ErrorNotice error={error} />
        {step === 'email' ? (
          <View>
            <Body style={{ marginBottom: 16 }}>Only verified JKUAT students can join. We will email you a code.</Body>
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
            <View style={{ marginTop: 20 }}>
              <TextLink href="/login">Already have an account? Log in</TextLink>
            </View>
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
            <Button title="Verify email" onPress={verifyCode} loading={busy} />
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
        ) : null}

        {step === 'details' ? (
          <View>
            <Notice tone="success" message="Email verified. Now set up your profile and password." />
            <TextField label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
            <TextField
              label="Preferred name (shown while browsing)"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={40}
            />
            <Select label="Campus" value={campus} options={CAMPUSES} onChange={setCampus} placeholder="Select campus" />
            <Select label="Year of study" value={year} options={YEARS} onChange={setYear} placeholder="Select year" />
            <TextField label="Course" value={course} onChangeText={setCourse} placeholder="e.g. BSc Computer Science" />
            <TextField
              label="Expected graduation year (optional)"
              value={gradYear}
              onChangeText={(value) => setGradYear(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              hint="At least 10 characters with a letter and a number."
            />
            <TextField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <Checkbox checked={accepted} onToggle={() => setAccepted((value) => !value)} label="Accept the policies">
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
                I have read and accept the{' '}
                <Text style={linkStyle} onPress={() => setPolicy('terms')} accessibilityRole="link">
                  Terms of Use
                </Text>
                ,{' '}
                <Text style={linkStyle} onPress={() => setPolicy('privacy')} accessibilityRole="link">
                  Privacy Policy
                </Text>
                ,{' '}
                <Text style={linkStyle} onPress={() => setPolicy('community-guidelines')} accessibilityRole="link">
                  Community Guidelines
                </Text>{' '}
                and{' '}
                <Text style={linkStyle} onPress={() => setPolicy('safety')} accessibilityRole="link">
                  Safety Policy
                </Text>
                .
              </Text>
            </Checkbox>
            <Button title="Create account" onPress={createAccount} loading={busy} />
          </View>
        ) : null}
      </GlassCard>
      <PolicyModal slug={policy} onClose={() => setPolicy(null)} />
    </Screen>
  );
}