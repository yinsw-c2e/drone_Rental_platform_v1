// Web mock for react-native-linear-gradient
import React from 'react';
import { View, ViewStyle } from 'react-native';

interface LinearGradientProps {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle;
  children?: React.ReactNode;
}

export default function LinearGradient({ colors, style, children }: LinearGradientProps) {
  const gradientStyle: ViewStyle = {
    ...style as any,
    backgroundImage: `linear-gradient(180deg, ${colors.join(', ')})`,
  };

  return <View style={gradientStyle}>{children}</View>;
}
