import React from 'react';
import { Text, View } from '@tarojs/components';
import './index.scss';

type HaulButtonVariant = 'primary' | 'orange' | 'ghost';

type HaulButtonProps = {
  title: string;
  onClick?: () => void;
  variant?: HaulButtonVariant;
  disabled?: boolean;
  className?: string;
};

export default function HaulButton({
  title,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
}: HaulButtonProps) {
  const variantClass =
    variant === 'orange'
      ? 'haul-button-orange'
      : variant === 'ghost'
        ? 'haul-button-ghost'
        : '';

  return (
    <View
      className={`haul-button ${variantClass} ${disabled ? 'haul-button-disabled' : ''} ${className}`}
      onClick={disabled ? undefined : onClick}
    >
      <Text className='haul-button-text'>{title}</Text>
    </View>
  );
}
