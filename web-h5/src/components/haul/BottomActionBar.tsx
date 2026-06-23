import React from 'react';
import { View } from '@tarojs/components';
import './index.scss';

type BottomActionBarProps = {
  children: React.ReactNode;
  className?: string;
};

export default function BottomActionBar({ children, className = '' }: BottomActionBarProps) {
  return <View className={`haul-bottom-bar ${className}`}>{children}</View>;
}
