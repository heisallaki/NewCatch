import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Seo } from '@/components/Seo';
import { TextLink } from '@/components/TextLink';
import { Heading } from '@/components/Typography';
import { findPolicy, PolicySlug } from '@/constants/policies';
import { PolicyBody } from './PolicyBody';
import { PolicyLinks } from './PolicyLinks';

export function PolicyPage({ slug }: { slug: PolicySlug }) {
  const policy = findPolicy(slug);
  return (
    <Screen maxWidth={760}>
      <Seo title={`${policy.title} | New Catch`} description={policy.summary} path={`/policies/${slug}`} />
      <TextLink href="/">← New Catch</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        {policy.title}
      </Heading>
      <GlassCard>
        <PolicyBody policy={policy} />
      </GlassCard>
      <PolicyLinks current={slug} />
    </Screen>
  );
}