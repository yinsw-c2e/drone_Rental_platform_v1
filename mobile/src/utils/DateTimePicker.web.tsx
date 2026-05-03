import React from 'react';

type DateTimePickerWebProps = {
  value?: Date;
  mode?: 'date' | 'time' | 'datetime';
  onChange?: (event: {type: 'set'; target: {value: string}}, date?: Date) => void;
  style?: React.CSSProperties;
};

const toInputValue = (value?: Date, mode?: DateTimePickerWebProps['mode']) => {
  if (!value || Number.isNaN(value.getTime())) {
    return '';
  }
  if (mode === 'time') {
    return value.toISOString().slice(11, 16);
  }
  if (mode === 'date') {
    return value.toISOString().slice(0, 10);
  }
  return value.toISOString().slice(0, 16);
};

export default function DateTimePickerWeb({value, mode, onChange, style}: DateTimePickerWebProps) {
  const inputType = mode === 'time' ? 'time' : mode === 'date' ? 'date' : 'datetime-local';

  return (
    <input
      type={inputType}
      value={toInputValue(value, mode)}
      style={style}
      onChange={event => {
        const nextDate = event.target.value ? new Date(event.target.value) : undefined;
        onChange?.({type: 'set', target: {value: event.target.value}}, nextDate);
      }}
    />
  );
}
