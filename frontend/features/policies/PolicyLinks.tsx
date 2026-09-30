import { View } from 'react-native';

import { Muted } from '@/components/Typography';
import { TextLink } from '@/components/TextLink';
import { POLICIES, PolicySlug } from '@/constants/policies';

export function PolicyLinks({ current }: { current?: PolicySlug }) {
  return (
    <View style={{ marginTop: 24, gap: 10 }}>
      <Muted>More about New Catch</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {POLICIES.filter((policy) => policy.slug !== current).map((policy) => (
          <TextLink key={policy.slug} href={`/policies/${policy.slug}`} newTab>
            {policy.title}
          </TextLink>
        ))}
      </View>
    </View>
  );
}