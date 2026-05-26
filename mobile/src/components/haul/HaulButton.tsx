import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import {haulTokens} from '../../theme/haulTokens';

type HaulButtonVariant = 'primary' | 'orange' | 'ghost';

type HaulButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: HaulButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function HaulButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: HaulButtonProps) {
  const isGhost = variant === 'ghost';
  const bgColor =
    variant === 'orange' ? haulTokens.colors.orange : haulTokens.colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        isGhost ? styles.ghostButton : {backgroundColor: bgColor},
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={isGhost ? haulTokens.colors.primary : '#FFFFFF'}
        />
      ) : (
        <Text style={[styles.text, isGhost && styles.ghostText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  ghostButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: haulTokens.colors.lineStrong,
  },
  disabled: {
    opacity: 0.48,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  ghostText: {
    color: haulTokens.colors.text,
  },
});
