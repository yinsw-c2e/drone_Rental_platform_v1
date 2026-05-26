import React from 'react';
import {StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {haulTokens} from '../../theme/haulTokens';

type AppGradientHeaderProps = {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function AppGradientHeader({
  title,
  left,
  right,
  children,
  style,
}: AppGradientHeaderProps) {
  return (
    <LinearGradient
      colors={[haulTokens.colors.navyDeep, haulTokens.colors.primaryDeep]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={[styles.header, style]}>
      <View style={styles.navRow}>
        <View style={styles.side}>{left}</View>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.side, styles.rightSide]}>{right}</View>
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: haulTokens.spacing.pageX,
    paddingTop: 14,
    paddingBottom: 92,
  },
  navRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: {
    width: 82,
    minHeight: 30,
    justifyContent: 'center',
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
});
