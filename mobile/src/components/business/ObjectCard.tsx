import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

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
  const content = (
    <View
      style={[
        styles.card,
        backgroundColor ? {backgroundColor} : null,
        highlightColor ? {borderColor: highlightColor, borderWidth: 1.5} : null,
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#102a43',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
});
