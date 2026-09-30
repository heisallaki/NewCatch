import { Image, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Body, Heading } from '@/components/Typography';
import { colors, radius, shadow } from '@/constants/theme';
import { mediaUrl } from '@/services/media';
import type { Card } from '@/types';

type Props = { person: Card | null; onKeepGoing: () => void; onViewCatches: () => void };

export function MatchModal({ person, onKeepGoing, onViewCatches }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={!!person} animationType="fade" onRequestClose={onKeepGoing}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        {person ? (
          <View style={styles.sheet}>
            <Heading level={1} style={styles.center}>
              It's a New Catch! 🎉
            </Heading>
            {person.photo ? (
              <Image
                source={{ uri: mediaUrl(person.photo.url) }}
                style={styles.photo}
                accessibilityLabel={`Photo of ${person.display_name}`}
              />
            ) : null}
            <Body style={[styles.center, { marginBottom: 20 }]}>
              You and {person.display_name} Caught each other.
            </Body>
            <View style={{ gap: 10 }}>
              <Button title="View Catches" onPress={onViewCatches} />
              <Button title="Keep discovering" variant="secondary" onPress={onKeepGoing} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(28,16,60,0.97)',
    padding: 24,
    ...shadow,
  },
  center: { textAlign: 'center' },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignSelf: 'center',
    marginVertical: 20,
    borderWidth: 3,
    borderColor: colors.accent,
  },
});