import React from 'react';
import { Text, View } from '@tarojs/components';
import './index.scss';

type RoleAwareTabOption<T extends string> = {
  key: T;
  label: string;
};

type RoleAwareTabBarProps<T extends string> = {
  value: T;
  options: RoleAwareTabOption<T>[];
  onChange: (value: T) => void;
};

export default function RoleAwareTabBar<T extends string>({
  value,
  options,
  onChange,
}: RoleAwareTabBarProps<T>) {
  return (
    <View className='haul-role-tabs'>
      {options.map(option => {
        const active = value === option.key;
        return (
          <View
            key={option.key}
            className={`haul-role-tab ${active ? 'haul-role-tab-active' : ''}`}
            onClick={() => onChange(option.key)}
          >
            <Text className='haul-role-tab-text'>{option.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
