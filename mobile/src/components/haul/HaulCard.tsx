import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {haulTokens} from '../../theme/haulTokens';

type HaulCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export default function HaulCard({children, style, onPress}: HaulCardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onPress}
        style={[styles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: haulTokens.colors.card,
    borderRadius: haulTokens.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(213, 222, 236, 0.72)',
    shadowColor: haulTokens.shadow.color,
    shadowOffset: haulTokens.shadow.offset,
    shadowOpacity: haulTokens.shadow.opacity,
    shadowRadius: haulTokens.shadow.radius,
    elevation: haulTokens.shadow.elevation,
  },
});
