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
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});

const headingStyles = {
  1: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  2: { color: colors.text, fontSize: 18, lineHeight: 25, fontWeight: '700' as const },
  3: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '700' as const },
};