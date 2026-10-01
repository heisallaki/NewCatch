import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { GlassCard } from '@/components/GlassCard';
import { Body, Heading, Muted } from '@/components/Typography';
import { colors, radius } from '@/constants/theme';
import { mediaUrl } from '@/services/media';
import type { Card, MatchInfo } from '@/types';

export function MatchBadge({ match }: { match: MatchInfo }) {
  return (
    <View style={styles.badgeWrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>New Catch Match {match.score}%</Text>
      </View>
      <Muted style={{ marginTop: 5 }}>{match.explanation}</Muted>
    </View>
  );
}

export function ProfileCard({ card, onOpen }: { card: Card; onOpen?: () => void }) {
  const { height } = useWindowDimensions();
  const photoHeight = Math.round(Math.min(340, Math.max(180, height * 0.32)));

  return (
    <GlassCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${card.display_name}'s profile`}
        onPress={onOpen}
      >
        {card.photo ? (
          <Image
            source={{ uri: mediaUrl(card.photo.url) }}
            style={[styles.photo, { height: photoHeight }]}
            resizeMode="cover"
            accessibilityLabel={`Photo of ${card.display_name}`}
          />
        ) : (
          <View style={[styles.photo, styles.noPhoto, { height: photoHeight }]}>
            <Muted>No photo</Muted>
          </View>
        )}
        <Heading level={2} style={{ marginTop: 10 }}>
          {card.display_name}
        </Heading>
        <Body style={{ marginTop: 1 }}>{card.course}</Body>
        <Muted>
          {card.gender ? `${card.gender} · ` : ''}
          {card.year_of_study} · {card.campus}
        </Muted>
        <MatchBadge match={card.match} />
        <View style={styles.chips}>
          {card.interests.slice(0, 6).map((interest) => (
            <Chip key={interest} label={interest} highlight={card.match.shared_interests.includes(interest)} />
          ))}
          {card.music_genres.slice(0, 3).map((genre) => (
            <Chip key={`music-${genre}`} label={`🎵 ${genre}`} />
          ))}
        </View>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', borderRadius: radius.md, backgroundColor: colors.inputBg },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  badgeWrap: { marginTop: 10 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,77,141,0.35)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  badgeText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
});