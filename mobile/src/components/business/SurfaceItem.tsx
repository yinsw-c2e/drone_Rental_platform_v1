import React, { useRef } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  isLast?: boolean;
}

export default function SurfaceItem({ children, style, onPress, isLast = false }: Props) {
  const { theme } = useTheme();
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  const content = (
    <View
      style={[
        styles.item,
        !isLast && { borderBottomWidth: 1, borderBottomColor: theme.divider },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
          {content}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
});
