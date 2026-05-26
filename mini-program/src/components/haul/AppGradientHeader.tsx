import React from 'react';
import { Text, View } from '@tarojs/components';
import './index.scss';

type AppGradientHeaderProps = {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export default function AppGradientHeader({
  title,
  left,
  right,
  children,
  className = '',
}: AppGradientHeaderProps) {
  return (
    <View className={`haul-gradient-header ${className}`}>
      <View className='haul-gradient-nav'>
        <View className='haul-gradient-side'>{left}</View>
        <Text className='haul-gradient-title'>{title}</Text>
        <View className='haul-gradient-side haul-gradient-side-right'>{right}</View>
      </View>
      {children}
    </View>
  );
}
