import React, {useMemo, useState} from 'react';
import {Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type DateOnlyFieldProps = {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  theme: any;
  containerStyle?: StyleProp<ViewStyle>;
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value?: string): Date {
  if (!value) {
    return new Date();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return new Date();
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function DateOnlyField({
  label,
  value,
  onChange,
  placeholder = '请选择日期',
  required = false,
  theme,
  containerStyle,
}: DateOnlyFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = useMemo(() => parseDate(value), [value]);
  const styles = useMemo(() => getStyles(theme), [theme]);

  const handleChange = (event: any, selected?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }
    if (event?.type === 'dismissed' || !selected) {
      return;
    }
    onChange(formatDate(selected));
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}{required ? ' *' : ''}</Text> : null}
      <TouchableOpacity style={styles.input} activeOpacity={0.75} onPress={() => setShowPicker(true)}>
        <Text style={[styles.inputText, !value && styles.placeholder]}>{value || placeholder}</Text>
      </TouchableOpacity>
      {showPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
    opacity: 0.9,
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    borderRadius: 14,
    backgroundColor: theme.bgSecondary,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '700',
  },
  placeholder: {
    color: theme.textHint,
    fontWeight: '500',
  },
});
