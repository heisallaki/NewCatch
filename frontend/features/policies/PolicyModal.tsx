import { BlurView } from 'expo-blur';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Heading } from '@/components/Typography';
import { colors, radius, shadow } from '@/constants/theme';
import { findPolicy, PolicySlug } from '@/constants/policies';
import { PolicyBody } from './PolicyBody';

type Props = { slug: PolicySlug | null; onClose: () => void };

export function PolicyModal({ slug, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const policy = slug ? findPolicy(slug) : null;
  const maxHeight = Math.max(280, height - insets.top - insets.bottom - 48);

  return (
    <Modal transparent visible={!!policy} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        {policy ? (
          <View style={[styles.sheet, { maxHeight }]}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.header}>
              <Heading level={2} style={styles.title} numberOfLines={2}>
                {policy.title}
              </Heading>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close policy"
                hitSlop={10}
                onPress={onClose}
                style={styles.close}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <PolicyBody policy={policy} />
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 680,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(28,16,60,0.94)',
    overflow: 'hidden',
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, marginRight: 12 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
  },
  closeText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  scroll: { flexShrink: 1 },
  scrollContent: { padding: 20 },
});