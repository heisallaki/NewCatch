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

export const EMAIL_DOMAIN = '@student.jkuat.ac.ke';

export function isJkuatEmail(value: string): boolean {
  return /^[a-z0-9._%+-]{1,64}@student\.jkuat\.ac\.ke$/i.test(value.trim());
}

export function isStrongPassword(value: string): boolean {
  return value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);
}