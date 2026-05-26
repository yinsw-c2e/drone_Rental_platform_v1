import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {haulTokens} from '../../theme/haulTokens';

type BottomActionBarProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function BottomActionBar({children, style}: BottomActionBarProps) {
  return <View style={[styles.bar, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: haulTokens.spacing.pageX,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: haulTokens.colors.line,
  },
});
