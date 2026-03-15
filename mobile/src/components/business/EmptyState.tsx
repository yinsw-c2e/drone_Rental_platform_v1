import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

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
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionText && onAction ? (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
          <Text style={styles.actionText}>{actionText}</Text>
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
    color: '#262626',
    fontWeight: '700',
    textAlign: 'center',
  },
  desc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#8c8c8c',
    textAlign: 'center',
  },
  actionBtn: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: '#1677ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
