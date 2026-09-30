import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipSelect } from '@/components/ChipSelect';
import { ErrorNotice } from '@/components/ErrorNotice';
import { GenderField } from '@/components/GenderField';
import { GlassCard } from '@/components/GlassCard';
import { Notice } from '@/components/Notice';
import { Loader, Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { TextLink } from '@/components/TextLink';
import { Heading, Muted } from '@/components/Typography';
import {
  CAMPUSES,
  INTEREST_SUGGESTIONS,
  labelFor,
  LOOKING_FOR,
  MUSIC_GENRES,
  NAME_OPTIONS,
  SCOPE_OPTIONS,
  valueFor,
  VISIBILITY_OPTIONS,
  YEARS,
} from '@/constants/options';
import { PhotoManager } from '@/features/profile/PhotoManager';
import { api, describeError, Failure } from '@/services/api';
import type { OwnProfile } from '@/types';

type Form = {
  fullName: string;
  displayName: string;
  openedName: string;
  gender: string;
  genderCustom: string;
  campus: string;
  year: string;
  course: string;
  gradYear: string;
  bio: string;
  interests: string[];
  genres: string[];
  artist: string;
  lookingFor: string[];
  visibility: string;
  scope: string;
};

const missingLabels: Record<string, string> = {
  photo: 'add at least one photo',
  gender: 'choose your gender',
  interests: 'pick at least one interest',
  looking_for: 'choose what you are looking for',
};

function fromProfile(profile: OwnProfile): Form {
  return {
    fullName: profile.full_name,
    displayName: profile.display_name,
    openedName: labelFor(NAME_OPTIONS, profile.opened_name),
    gender: profile.gender ?? '',
    genderCustom: profile.gender_custom ?? '',
    campus: profile.campus,
    year: profile.year_of_study,
    course: profile.course,
    gradYear: profile.graduation_year ? String(profile.graduation_year) : '',
    bio: profile.bio ?? '',
    interests: profile.interests,
    genres: profile.music_genres,
    artist: profile.favourite_artist ?? '',
    lookingFor: profile.looking_for,
    visibility: labelFor(VISIBILITY_OPTIONS, profile.visibility),
    scope: labelFor(SCOPE_OPTIONS, profile.discovery_scope),
  };
}

export default function EditProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  useEffect(() => {
    api<OwnProfile>('/profiles/me')
      .then((data) => {
        setProfile(data);
        setForm(fromProfile(data));
      })
      .catch((e) => setError(describeError(e)));
  }, []);

  if (!profile || !form) {
    if (error) {
      return (
        <Screen>
          <ErrorNotice error={error} />
        </Screen>
      );
    }
    return <Loader />;
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setSaved(false);
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function fail(message: string) {
    setError({ message, code: 'client' });
  }

  async function save() {
    if (!form) return;
    if (form.fullName.trim().length < 2) return fail('Enter your name.');
    if (form.displayName.trim().length < 2) return fail('Enter a preferred name.');
    if (!form.campus || !form.year) return fail('Select your campus and year of study.');
    if (!form.gender) return fail('Select your gender.');
    if (form.gender === 'Custom' && form.genderCustom.trim().length < 2) return fail('Describe your gender in a few words.');
    if (form.course.trim().length < 2) return fail('Enter your course.');
    if (form.gradYear && !/^20\d{2}$/.test(form.gradYear)) return fail('Enter a valid graduation year, for example 2028.');
    setBusy(true);
    setError(null);
    try {
      const updated = await api<OwnProfile>('/profiles/me', {
        method: 'PUT',
        body: {
          full_name: form.fullName.trim(),
          display_name: form.displayName.trim(),
          opened_name: valueFor(NAME_OPTIONS, form.openedName),
          gender: form.gender,
          gender_custom: form.gender === 'Custom' ? form.genderCustom.trim() : null,
          campus: form.campus,
          year_of_study: form.year,
          course: form.course.trim(),
          graduation_year: form.gradYear ? Number(form.gradYear) : null,
          bio: form.bio.trim() || null,
          interests: form.interests,
          music_genres: form.genres,
          favourite_artist: form.artist.trim() || null,
          looking_for: form.lookingFor,
          visibility: valueFor(VISIBILITY_OPTIONS, form.visibility),
          discovery_scope: valueFor(SCOPE_OPTIONS, form.scope),
        },
      });
      setProfile(updated);
      setSaved(true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TextLink href="/member/profile">← Back to profile</TextLink>
      <Heading level={1} style={{ marginVertical: 16 }}>
        Edit profile
      </Heading>
      <ErrorNotice error={error} />
      {saved ? (
        <Notice
          tone="success"
          message={
            profile.complete
              ? 'Profile saved. You are ready to discover people.'
              : `Profile saved. To start discovering, ${profile.missing.map((item) => missingLabels[item]).join(', ')}.`
          }
          actionLabel={profile.complete ? 'Go to Discover' : undefined}
          onAction={profile.complete ? () => router.replace('/member/discover') : undefined}
        />
      ) : null}

      <GlassCard style={{ marginBottom: 16 }}>
        <Heading level={2} style={{ marginBottom: 12 }}>
          Photos
        </Heading>
        <PhotoManager photos={profile.photos} onChange={setProfile} />
      </GlassCard>

      <GlassCard style={{ marginBottom: 16 }}>
        <Heading level={2} style={{ marginBottom: 12 }}>
          About you
        </Heading>
        <TextField label="Full name" value={form.fullName} onChangeText={(v) => set('fullName', v)} />
        <TextField
          label="Preferred name (shown while browsing)"
          value={form.displayName}
          onChangeText={(v) => set('displayName', v)}
          maxLength={40}
        />
        <Select
          label="Name shown when someone opens your profile"
          value={form.openedName}
          options={NAME_OPTIONS.map((option) => option.label)}
          onChange={(v) => set('openedName', v)}
        />
        <Select label="Campus" value={form.campus} options={CAMPUSES} onChange={(v) => set('campus', v)} />
        <Select label="Year of study" value={form.year} options={YEARS} onChange={(v) => set('year', v)} />
        <GenderField gender={form.gender} custom={form.genderCustom} onGender={(v) => set('gender', v)} onCustom={(v) => set('genderCustom', v)} />
        <TextField label="Course" value={form.course} onChangeText={(v) => set('course', v)} />
        <TextField
          label="Expected graduation year (optional)"
          value={form.gradYear}
          onChangeText={(v) => set('gradYear', v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
        />
        <TextField
          label="Bio"
          value={form.bio}
          onChangeText={(v) => set('bio', v)}
          multiline
          maxLength={500}
          hint={`${form.bio.length}/500`}
        />
      </GlassCard>

      <GlassCard style={{ marginBottom: 16 }}>
        <Heading level={2} style={{ marginBottom: 12 }}>
          Interests, music and goals
        </Heading>
        <ChipSelect
          label="Interests and hobbies"
          options={INTEREST_SUGGESTIONS}
          selected={form.interests}
          onChange={(v) => set('interests', v)}
          max={20}
          allowCustom
        />
        <ChipSelect
          label="Favourite music genres"
          options={MUSIC_GENRES}
          selected={form.genres}
          onChange={(v) => set('genres', v)}
          max={10}
        />
        <TextField label="Favourite artist" value={form.artist} onChangeText={(v) => set('artist', v)} maxLength={100} />
        <ChipSelect
          label="Looking for"
          options={LOOKING_FOR}
          selected={form.lookingFor}
          onChange={(v) => set('lookingFor', v)}
          hint="Not every Catch is romantic. Pick everything that fits."
        />
      </GlassCard>

      <GlassCard style={{ marginBottom: 16 }}>
        <Heading level={2} style={{ marginBottom: 12 }}>
          Privacy
        </Heading>
        <Select
          label="Who can see my profile"
          value={form.visibility}
          options={VISIBILITY_OPTIONS.map((option) => option.label)}
          onChange={(v) => set('visibility', v)}
        />
        <Muted style={{ marginBottom: 16 }}>
          People matching my preferences means only people who are looking for something similar can see you.
        </Muted>
        <Select
          label="Who I discover"
          value={form.scope}
          options={SCOPE_OPTIONS.map((option) => option.label)}
          onChange={(v) => set('scope', v)}
        />
        <Muted>Choosing My campus only also stops people from other campuses seeing you.</Muted>
      </GlassCard>

      <View style={{ gap: 10 }}>
        <Button title="Save profile" onPress={save} loading={busy} />
        <Button title="Cancel" variant="secondary" onPress={() => router.replace('/member/profile')} />
      </View>
    </Screen>
  );
}