import React from 'react';
import {StyleProp, StyleSheet, ViewStyle} from 'react-native';

import EmptyState from './EmptyState';
import ObjectCard from './ObjectCard';

type Props = {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function ProviderAccessNotice({
  icon = '🔐',
  title,
  description,
  actionText,
  onAction,
  style,
}: Props) {
  return (
    <ObjectCard style={[styles.card, style]}>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        actionText={actionText}
        onAction={onAction}
      />
    </ObjectCard>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
  },
});
