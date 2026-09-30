import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
};

export function Select({ label, value, options, onChange, placeholder = 'Select', error }: Props) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = Math.max(240, height - insets.top - insets.bottom - 64);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not selected'}`}
        onPress={() => setOpen(true)}
        style={[styles.input, !!error && styles.errorBorder]}
      >
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Close"
          style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
          onPress={() => setOpen(false)}
        >
          <Pressable style={[styles.sheet, { maxHeight }]} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={styles.list}>
              {options.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option === value }}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  style={[styles.option, option === value && styles.optionSelected]}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBorder: { borderColor: colors.danger },
  value: { color: colors.text, fontSize: 16, flex: 1 },
  placeholder: { color: 'rgba(255,255,255,0.45)' },
  caret: { color: colors.muted, fontSize: 16, marginLeft: 8 },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(28,16,60,0.97)',
    padding: 16,
    overflow: 'hidden',
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  list: { flexGrow: 0 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.sm },
  optionSelected: { backgroundColor: colors.glassStrong },
  optionText: { color: colors.text, fontSize: 16 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
});