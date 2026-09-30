import { useRouter } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Seo, SITE_URL } from '@/components/Seo';
import { TextLink } from '@/components/TextLink';
import { Body, Heading, Muted } from '@/components/Typography';
import { POLICIES, SUPPORT_EMAIL } from '@/constants/policies';
import { useAuth } from '@/features/auth/AuthContext';

const steps = [
  { title: 'Catch ❤️', text: 'See someone you would like to know? Catch them. They will not be told unless they Catch you too.' },
  { title: 'Swerve ✕', text: 'Not a fit? Swerve and move on. No awkwardness, no explanations.' },
  { title: "It's a New Catch! 🎉", text: 'When two students Catch each other, chat opens and you can start talking.' },
];

const features = [
  { title: 'Verified JKUAT students only', text: 'Every member signs up with a @student.jkuat.ac.ke email and confirms it with a one-time code.' },
  { title: 'Your email stays private', text: 'Others browse your preferred name. Your student email is never shown to anyone.' },
  { title: 'A New Catch Match you can understand', text: 'We show why you might click, such as shared interests, music and campus. No black box.' },
  { title: 'Friends, study buddies and more', text: 'Choose what you are looking for, from networking and activity partners to dating or just exploring.' },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'New Catch', url: SITE_URL },
    { '@type': 'Organization', name: 'New Catch', url: SITE_URL, email: SUPPORT_EMAIL },
    {
      '@type': 'WebApplication',
      name: 'New Catch',
      url: SITE_URL,
      applicationCategory: 'SocialNetworkingApplication',
      operatingSystem: 'Web, Android, iOS',
      description: 'A social discovery app for verified JKUAT students.',
    },
  ],
};

export default function Landing() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  return (
    <Screen maxWidth={1000}>
      <Seo
        title="New Catch | Meet and discover JKUAT students"
        description="New Catch is the social discovery app for verified JKUAT students. Meet people through shared interests, hobbies and music."
        path="/"
        jsonLd={jsonLd}
      />
      <View style={styles.hero}>
        <Heading level={1} style={[styles.title, wide && styles.titleWide]}>
          Meet JKUAT students who share your world
        </Heading>
        <Body style={styles.subtitle}>
          New Catch helps verified JKUAT students discover friends, study buddies, networking contacts and more, based
          on what you actually have in common.
        </Body>
        <View style={[styles.actions, wide && styles.actionsWide]}>
          {user ? (
            <Button title="Open New Catch" onPress={() => router.push('/member/discover')} style={styles.action} />
          ) : (
            <>
              <Button title="Create account" onPress={() => router.push('/register')} style={styles.action} />
              <Button title="Log in" variant="secondary" onPress={() => router.push('/login')} style={styles.action} />
            </>
          )}
        </View>
      </View>

      <Heading level={2} style={styles.sectionTitle}>
        How it works
      </Heading>
      <View style={styles.grid}>
        {steps.map((step) => (
          <View key={step.title} style={styles.cell}>
            <GlassCard style={styles.fullHeight}>
              <Heading level={3}>{step.title}</Heading>
              <Body style={styles.cardText}>{step.text}</Body>
            </GlassCard>
          </View>
        ))}
      </View>

      <Heading level={2} style={styles.sectionTitle}>
        Built for the JKUAT community
      </Heading>
      <View style={styles.grid}>
        {features.map((feature) => (
          <View key={feature.title} style={styles.cell}>
            <GlassCard style={styles.fullHeight}>
              <Heading level={3}>{feature.title}</Heading>
              <Body style={styles.cardText}>{feature.text}</Body>
            </GlassCard>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          {POLICIES.filter((policy) => policy.slug !== 'contact').map((policy) => (
            <TextLink key={policy.slug} href={`/policies/${policy.slug}`} newTab>
              {policy.title}
            </TextLink>
          ))}
          <TextLink href="/policies/contact" newTab>
            Contact
          </TextLink>
        </View>
        <Muted style={styles.footerNote}>
          Support, privacy questions, reports and appeals: {SUPPORT_EMAIL}
        </Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: 32 },
  title: { fontSize: 34, lineHeight: 42 },
  titleWide: { fontSize: 52, lineHeight: 60 },
  subtitle: { marginTop: 16, fontSize: 18, lineHeight: 27, maxWidth: 680 },
  actions: { marginTop: 28, gap: 12 },
  actionsWide: { flexDirection: 'row' },
  action: { minWidth: 180 },
  sectionTitle: { marginTop: 32, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { flexGrow: 1, flexBasis: 260 },
  fullHeight: { flex: 1 },
  cardText: { marginTop: 8, color: 'rgba(255,255,255,0.8)' },
  footer: { marginTop: 48, gap: 12 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  footerNote: { marginTop: 4 },
});