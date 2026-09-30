import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, radius } from '@/constants/theme';

type Props = {
  tone?: 'error' | 'success' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const toneColor = { error: colors.danger, success: colors.success, info: colors.info };

export function Notice({ tone = 'info', message, actionLabel, onAction }: Props) {
  return (
    <View accessibilityRole="alert" style={[styles.box, { borderColor: toneColor[tone] }]}>
      <Text style={styles.text}>{message}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
  action: { marginTop: 12 },
});