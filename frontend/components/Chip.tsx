import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type Props = { label: string; selected?: boolean; highlight?: boolean; onPress?: () => void };

export function Chip({ label, selected = false, highlight = false, onPress }: Props) {
  const style = [styles.chip, selected && styles.selected, highlight && styles.highlight];
  if (!onPress) {
    return (
      <View style={style}>
        <Text style={styles.text}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={4}
      onPress={onPress}
      style={style}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: 'rgba(255,77,141,0.35)', borderColor: colors.accent },
  highlight: { backgroundColor: 'rgba(255,138,92,0.3)', borderColor: colors.accentAlt },
  text: { color: colors.text, fontSize: 14, fontWeight: '600' },
});