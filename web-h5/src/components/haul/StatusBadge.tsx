import React from 'react';
import { Text, View } from '@tarojs/components';
import './index.scss';

type StatusBadgeTone = 'blue' | 'orange' | 'green' | 'gray';

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
};

export default function StatusBadge({ label, tone = 'blue' }: StatusBadgeProps) {
  return (
    <View className={`haul-badge haul-badge-${tone}`}>
      <Text className='haul-badge-text'>{label}</Text>
    </View>
  );
}
