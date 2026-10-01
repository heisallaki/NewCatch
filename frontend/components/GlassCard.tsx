import { BlurView } from 'expo-blur';
import { StyleSheet, View, ViewProps } from 'react-native';

import { colors, radius, shadow } from '@/constants/theme';

export function GlassCard({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.outer, style]} {...rest}>
      <View style={styles.clip}>
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.inner}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', borderRadius: radius.lg, ...shadow },
  clip: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  inner: { padding: 16 },
});