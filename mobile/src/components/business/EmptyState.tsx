import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '../../theme/ThemeContext';

type Props = {
  icon?: string;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
};

export default function EmptyState({
  icon = '·',
  title,
  description,
  actionText,
  onAction,
}: Props) {
  const {theme} = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
      {description ? (
        <Text style={[styles.desc, {color: theme.textSub}]}>{description}</Text>
      ) : null}
      {actionText && onAction ? (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {backgroundColor: theme.primaryBg, borderColor: theme.primaryBorder},
          ]}
          onPress={onAction}>
          <Text style={[styles.actionText, {color: theme.primaryText}]}>
            {actionText}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 28,
  },
  icon: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  desc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionBtn: {
    marginTop: 18,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
