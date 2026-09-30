import { StyleSheet, Text, TextProps } from 'react-native';

import { colors } from '@/constants/theme';

export function Heading({ level = 1, style, ...props }: TextProps & { level?: 1 | 2 | 3 }) {
  return <Text role="heading" aria-level={level} style={[headingStyles[level], style]} {...props} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text style={[styles.body, style]} {...props} />;
}

export function Muted({ style, ...props }: TextProps) {
  return <Text style={[styles.muted, style]} {...props} />;
}

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});

const headingStyles = {
  1: { color: colors.text, fontSize: 32, lineHeight: 40, fontWeight: '800' as const },
  2: { color: colors.text, fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  3: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700' as const },
};