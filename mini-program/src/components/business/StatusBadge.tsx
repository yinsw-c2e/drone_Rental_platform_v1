import React from 'react';
import { Text, View } from '@tarojs/components';

export type StatusBadgeTone = 'info' | 'success' | 'warning' | 'muted' | 'error' | 'blue' | 'green' | 'orange' | 'gray' | 'red' | 'teal' | 'purple' | string;

const TONE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  info: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  success: { bg: '#ECFDF3', text: '#047857', border: '#A7F3D0' },
  warning: { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  muted: { bg: '#F8FAFC', text: '#64748B', border: '#CBD5E1' },
  error: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  green: { bg: '#ECFDF3', text: '#047857', border: '#A7F3D0' },
  orange: { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  red: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  gray: { bg: '#F8FAFC', text: '#64748B', border: '#CBD5E1' },
  blue: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  teal: { bg: '#E6FFFB', text: '#0F766E', border: '#99F6E4' },
  purple: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
};

type Props = {
  label: string;
  tone?: StatusBadgeTone;
};

export default function StatusBadge({ label, tone = 'gray' }: Props) {
  const colors = TONE_MAP[tone] || TONE_MAP.gray;

  return (
    <View
      style={{
        paddingTop: '4px',
        paddingBottom: '4px',
        paddingLeft: '10px',
        paddingRight: '10px',
        borderRadius: '999px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: colors.border,
        backgroundColor: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: '11px',
          fontWeight: '700',
          lineHeight: '14px',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
