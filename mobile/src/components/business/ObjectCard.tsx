import React from 'react';
import {
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';

type Props = {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  highlightColor?: string;
  backgroundColor?: string;
};

export default function ObjectCard({
  onPress,
  children,
  style,
  highlightColor,
  backgroundColor,
}: Props) {
  const {theme} = useTheme();
  const content = (
    <View
      style={[
        {
          backgroundColor: backgroundColor ?? theme.card,
          borderRadius: 18,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: highlightColor ?? theme.cardBorder,
        },
        style,
      ]}>
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}
