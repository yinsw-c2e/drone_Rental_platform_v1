// Web mock for react-native-linear-gradient
import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';

interface LinearGradientProps {
  colors: string[];
  start?: {x: number; y: number};
  end?: {x: number; y: number};
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

const getGradientAngle = (start?: {x: number; y: number}, end?: {x: number; y: number}) => {
  const from = start || {x: 0, y: 0};
  const to = end || {x: 0, y: 1};
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return 180;
  }
  return Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);
};

export default function LinearGradient({colors, start, end, style, children}: LinearGradientProps) {
  const flatStyle = StyleSheet.flatten(style as any) || {};
  const gradientStyle: ViewStyle & {backgroundImage: string} = {
    ...(flatStyle as any),
    backgroundImage: `linear-gradient(${getGradientAngle(start, end)}deg, ${colors.join(', ')})`,
  };

  return <View style={gradientStyle}>{children}</View>;
}
