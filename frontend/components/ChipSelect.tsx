import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/theme';

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  max?: number;
  allowCustom?: boolean;
  hint?: string;
};

export function ChipSelect({ label, options, selected, onChange, max, allowCustom = false, hint }: Props) {
  const [custom, setCustom] = useState('');
  const extras = selected.filter((value) => !options.includes(value));
  const all = [...options, ...extras];
  const full = max !== undefined && selected.length >= max;

  function toggle(value: string) {
    if (selected.includes(value)) onChange(selected.filter((item) => item !== value));
    else if (!full) onChange([...selected, value]);
  }

  function addCustom() {
    const value = custom.trim().replace(/\s+/g, ' ');
    if (value.length < 2) return;
    const exists = selected.some((item) => item.toLowerCase() === value.toLowerCase());
    if (!exists && !full) onChange([...selected, value]);
    setCustom('');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {all.map((value) => (
          <Chip key={value} label={value} selected={selected.includes(value)} onPress={() => toggle(value)} />
        ))}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {allowCustom ? (
        <View style={styles.custom}>
          <TextField
            label="Add your own"
            value={custom}
            onChangeText={setCustom}
            maxLength={30}
            onSubmitEditing={addCustom}
          />
          <Button title="Add" variant="secondary" onPress={addCustom} disabled={full} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 8 },
  custom: { marginTop: 12 },
});