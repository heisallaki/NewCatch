export const CAMPUSES = [
  'Main Campus',
  'Nairobi CBD Campus',
  'Karen Campus',
  'Westlands Campus',
  'Mombasa CBD Campus',
  'Nakuru CBD Campus',
  'Kisumu CBD Campus',
  'Eldoret CBD Campus',
  'Kisii CBD Campus',
  'Kakamega Campus',
  'Kitale Campus',
];

export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'Other'];

export const INTEREST_SUGGESTIONS = [
  'Photography',
  'Gaming',
  'Football',
  'Basketball',
  'Fitness',
  'Cars',
  'Motorcycles',
  'Technology',
  'Art',
  'Movies',
  'Reading',
  'Travel',
  'Cooking',
  'Music',
  'Fashion',
];

export const MUSIC_GENRES = [
  'R&B',
  'Afrobeats',
  'Hip-Hop',
  'Amapiano',
  'Gospel',
  'Reggae',
  'Dancehall',
  'Gengetone',
  'Jazz',
  'Rock',
  'Pop',
  'Classical',
  'Country',
  'Electronic',
  'Soul',
  'Blues',
  'Alternative',
  'Other',
];

export const LOOKING_FOR = [
  'Friendship',
  'Networking',
  'Study buddy',
  'Activity partner',
  'Dating',
  'New people',
  "I'm just exploring",
];

export type Option = { value: string; label: string };

export const VISIBILITY_OPTIONS: Option[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'matching', label: 'People matching my preferences' },
  { value: 'hidden', label: 'Hidden' },
];

export const SCOPE_OPTIONS: Option[] = [
  { value: 'all', label: 'All JKUAT campuses' },
  { value: 'my_campus', label: 'My campus only' },
];

export const NAME_OPTIONS: Option[] = [
  { value: 'full_name', label: 'My full name' },
  { value: 'display_name', label: 'My preferred name' },
];

export function labelFor(options: Option[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? '';
}

export function valueFor(options: Option[], label: string): string {
  return options.find((option) => option.label === label)?.value ?? options[0].value;
}

export const EMAIL_DOMAIN = '@students.jkuat.ac.ke';

export function isJkuatEmail(value: string): boolean {
  return /^[a-z0-9._%+-]{1,64}@students\.jkuat\.ac\.ke$/i.test(value.trim());
}

export function isStrongPassword(value: string): boolean {
  return value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
export const GENDERS = ['Male', 'Female', 'Nonbinary', 'Custom'];

export function genderLabel(gender: string | null, custom: string | null): string {
  if (!gender) return '';
  return gender === 'Custom' && custom ? custom : gender;
}
