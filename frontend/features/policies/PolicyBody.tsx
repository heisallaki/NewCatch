import { View } from 'react-native';

import { Body, Heading, Muted } from '@/components/Typography';
import { Policy, POLICY_VERSION } from '@/constants/policies';

export function PolicyBody({ policy }: { policy: Policy }) {
  return (
    <View>
      <Muted>Version {POLICY_VERSION}</Muted>
      <Body style={{ marginTop: 8 }}>{policy.summary}</Body>
      {policy.sections.map((section) => (
        <View key={section.heading} style={{ marginTop: 20 }}>
          <Heading level={2}>{section.heading}</Heading>
          {section.body.map((paragraph, index) => (
            <Body key={index} style={{ marginTop: 8 }}>
              {paragraph}
            </Body>
          ))}
        </View>
      ))}
    </View>
  );
}