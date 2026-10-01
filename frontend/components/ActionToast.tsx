import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

export type Toast = { key: number; label: string; tone: 'catch' | 'swerve' | 'match' };

const NATIVE = Platform.OS !== 'web';

const toneColor = {
  catch: 'rgba(255,77,141,0.94)',
  swerve: 'rgba(71,78,104,0.94)',
  match: 'rgba(255,138,92,0.96)',
};

export function ActionToast({ toast }: { toast: Toast | null }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    scale.setValue(0.8);
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: NATIVE }),
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: NATIVE }),
      ]),
      Animated.delay(560),
      Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: NATIVE }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [toast?.key]);

  if (!toast) return null;

  return (
    <View style={styles.wrap}>
      <Animated.View
        accessibilityRole="alert"
        style={[styles.pill, { backgroundColor: toneColor[toast.tone], opacity, transform: [{ scale }] }]}
      >
        <Text style={styles.text}>{toast.label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: '36%', alignItems: 'center' },
  pill: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  text: { color: '#fff', fontSize: 20, fontWeight: '800' },
});