import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {haulTokens} from '../../theme/haulTokens';

type StatusBadgeTone = 'blue' | 'orange' | 'green' | 'gray';

const toneMap: Record<StatusBadgeTone, {bg: string; fg: string}> = {
  blue: {bg: '#E8F1FF', fg: haulTokens.colors.primary},
  orange: {bg: '#FFF0E8', fg: haulTokens.colors.orange},
  green: {bg: '#E9F8F0', fg: haulTokens.colors.success},
  gray: {bg: '#EEF2F7', fg: haulTokens.colors.textSub},
};

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
};

export default function StatusBadge({label, tone = 'blue'}: StatusBadgeProps) {
  const palette = toneMap[tone];
  return (
    <View style={[styles.badge, {backgroundColor: palette.bg}]}>
      <Text style={[styles.text, {color: palette.fg}]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
});
