import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, TextStyle } from 'react-native';

import { colors } from '@/constants/theme';

type Props = { href: string; children: ReactNode; newTab?: boolean; style?: StyleProp<TextStyle> };

export function TextLink({ href, children, newTab = false, style }: Props) {
  return (
    <Link href={href as never} target={newTab ? '_blank' : undefined} style={[styles.link, style]}>
      {children}
    </Link>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.accentAlt, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});