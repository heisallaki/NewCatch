import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export function Screen({ children, maxWidth = 560 }: { children: ReactNode; maxWidth?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={colors.gradient} style={styles.fill}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View style={[styles.column, { maxWidth }]}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

export function Loader() {
  return (
    <LinearGradient colors={colors.gradient} style={[styles.fill, styles.center]}>
      <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Loading" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 16 },
  column: { width: '100%' },
});