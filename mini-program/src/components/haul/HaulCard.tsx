import React from 'react';
import { View } from '@tarojs/components';
import './index.scss';

type HaulCardProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export default function HaulCard({ children, className = '', onClick }: HaulCardProps) {
  return (
    <View className={`haul-card ${className}`} onClick={onClick}>
      {children}
    </View>
  );
}
