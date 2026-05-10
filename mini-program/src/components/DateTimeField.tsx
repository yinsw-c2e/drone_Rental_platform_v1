import React from 'react';
import { Picker, Text, View } from '@tarojs/components';
import './DateTimeField.scss';

type DateTimeFieldMode = 'date' | 'datetime';

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: DateTimeFieldMode;
  placeholder?: string;
  required?: boolean;
};

const pad = (value: number) => String(value).padStart(2, '0');

export const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatDateTime = (date: Date) =>
  `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const splitValue = (value: string, mode: DateTimeFieldMode) => {
  const [date = '', time = ''] = String(value || '').split(/\s+/);
  return {
    date,
    time: mode === 'datetime' ? (time || '09:00') : '',
  };
};

export default function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  placeholder = mode === 'date' ? '请选择日期' : '请选择日期和时间',
  required,
}: DateTimeFieldProps) {
  const current = splitValue(value, mode);
  const display = value || placeholder;

  const updateDate = (date: string) => {
    if (mode === 'date') {
      onChange(date);
      return;
    }
    onChange(`${date} ${current.time || '09:00'}`);
  };

  const updateTime = (time: string) => {
    const date = current.date || formatDate(new Date());
    onChange(`${date} ${time}`);
  };

  return (
    <View className='dt-field'>
      <Text className='dt-label'>
        {label}
        {required ? <Text className='dt-required'> *</Text> : null}
      </Text>
      <View className='dt-control-row'>
        <Picker mode='date' value={current.date} onChange={(e) => updateDate(String(e.detail.value || ''))}>
          <View className={`dt-control ${current.date ? '' : 'dt-placeholder'}`}>
            <Text className='dt-control-text'>{current.date || display}</Text>
          </View>
        </Picker>
        {mode === 'datetime' ? (
          <Picker mode='time' value={current.time} onChange={(e) => updateTime(String(e.detail.value || ''))}>
            <View className={`dt-control dt-time ${current.time ? '' : 'dt-placeholder'}`}>
              <Text className='dt-control-text'>{current.time || '时间'}</Text>
            </View>
          </Picker>
        ) : null}
      </View>
    </View>
  );
}
