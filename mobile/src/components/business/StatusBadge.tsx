import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {BadgeMeta, getTonePalette, VisualTone} from './visuals';
import {useTheme} from '../../theme/ThemeContext';

type Props = {
  label: string;
  tone?: VisualTone;
  meta?: BadgeMeta;
};

export default function StatusBadge({label, tone, meta}: Props) {
  const {theme} = useTheme();
  const finalTone = meta?.tone || tone || 'gray';
  const finalLabel = meta?.label || label;
  const palette = getTonePalette(finalTone, theme.isDark);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}>
      <Text style={[styles.text, {color: palette.text}]}>{finalLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
