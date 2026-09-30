import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { Body, Heading } from '@/components/Typography';

export function ComingSoon({ title, message }: { title: string; message: string }) {
  return (
    <Screen>
      <Heading level={1} style={{ marginBottom: 16 }}>
        {title}
      </Heading>
      <GlassCard>
        <Body>{message}</Body>
      </GlassCard>
    </Screen>
  );
}