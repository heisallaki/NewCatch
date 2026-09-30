import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { colors, radius } from '@/constants/theme';
import { api, describeError, Failure } from '@/services/api';
import { mediaUrl } from '@/services/media';
import type { OwnProfile, PhotoRef } from '@/types';

const MAX_PHOTOS = 6;

type Props = { photos: PhotoRef[]; onChange: (profile: OwnProfile) => void };

export function PhotoManager({ photos, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  async function run(action: () => Promise<OwnProfile | null>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      if (updated) onChange(updated);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  function addPhoto() {
    run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (result.canceled) return null;
      const asset = result.assets[0];
      const image = asset.base64 ?? (asset.uri.startsWith('data:') ? asset.uri : null);
      if (!image) {
        setError({ message: 'Could not read that photo. Try another one.', code: 'client' });
        return null;
      }
      return api<OwnProfile>('/profiles/me/photos', {
        method: 'POST',
        body: { image, mime_type: asset.mimeType ?? null },
      });
    });
  }

  function remove(id: number) {
    run(() => api<OwnProfile>(`/profiles/me/photos/${id}`, { method: 'DELETE' }));
  }

  function makeMain(id: number) {
    run(() => api<OwnProfile>(`/profiles/me/photos/${id}/primary`, { method: 'POST' }));
  }

  return (
    <View>
      <ErrorNotice error={error} />
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={photo.id} style={styles.item}>
            <Image
              source={{ uri: mediaUrl(photo.url) }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={`Your photo ${index + 1}`}
            />
            {index === 0 ? <Text style={styles.main}>Main photo</Text> : null}
            <View style={styles.actions}>
              {index > 0 ? (
                <Button title="Make main" variant="secondary" onPress={() => makeMain(photo.id)} disabled={busy} style={styles.small} />
              ) : null}
              <Button title="Remove" variant="danger" onPress={() => remove(photo.id)} disabled={busy} style={styles.small} />
            </View>
          </View>
        ))}
      </View>
      {photos.length < MAX_PHOTOS ? (
        <Button title={photos.length === 0 ? 'Add your first photo' : 'Add photo'} onPress={addPhoto} loading={busy} />
      ) : null}
      <Text style={styles.hint}>JPEG, PNG or WebP. Photos are resized and location data is removed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  item: { width: 150 },
  image: { width: 150, height: 190, borderRadius: radius.md, backgroundColor: colors.inputBg },
  main: { color: colors.accentAlt, fontWeight: '700', fontSize: 12, marginTop: 6 },
  actions: { gap: 6, marginTop: 8 },
  small: { minHeight: 40, paddingHorizontal: 12 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 10 },
});