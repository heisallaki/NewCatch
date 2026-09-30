import { View } from 'react-native';

import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { GENDERS } from '@/constants/options';

type Props = {
  gender: string;
  custom: string;
  onGender: (value: string) => void;
  onCustom: (value: string) => void;
};

export function GenderField({ gender, custom, onGender, onCustom }: Props) {
  return (
    <View>
      <Select label="Gender" value={gender} options={GENDERS} onChange={onGender} placeholder="Select gender" />
      {gender === 'Custom' ? (
        <TextField label="Describe your gender" value={custom} onChangeText={onCustom} maxLength={30} />
      ) : null}
    </View>
  );
}