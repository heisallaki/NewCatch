import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type Props = { checked: boolean; onToggle: () => void; label: string; children: ReactNode };

export function Checkbox({ checked, onToggle, label, children }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        hitSlop={10}
        onPress={onToggle}
        style={[styles.box, checked && styles.boxOn]}
      >
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </Pressable>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: '#fff', fontWeight: '800' },
  content: { flex: 1 },
});