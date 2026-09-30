import { View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Seo } from '@/components/Seo';
import { TextLink } from '@/components/TextLink';
import { Body, Heading } from '@/components/Typography';
import { POLICIES } from '@/constants/policies';

export default function PoliciesIndex() {
  return (
    <Screen maxWidth={760}>
      <Seo
        title="Policies | New Catch"
        description="Read the New Catch privacy policy, terms of use, community guidelines, safety policy and reporting and appeals information."
        path="/policies"
      />
      <TextLink href="/">← New Catch</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        Policies
      </Heading>
      <View style={{ gap: 16 }}>
        {POLICIES.map((policy) => (
          <GlassCard key={policy.slug}>
            <Heading level={2}>{policy.title}</Heading>
            <Body style={{ marginVertical: 8 }}>{policy.summary}</Body>
            <TextLink href={`/policies/${policy.slug}`}>Read {policy.title}</TextLink>
          </GlassCard>
        ))}
      </View>
    </Screen>
  );
}