import React from 'react';
import { Text, View } from '@tarojs/components';
import './ProviderAccessNotice.scss';

type Props = {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
};

export default function ProviderAccessNotice({
  title,
  description,
  actionText,
  onAction,
}: Props) {
  return (
    <View className="provider-access-wrap">
      <View className="provider-access-card">
        <View className="provider-access-icon">锁</View>
        <Text className="provider-access-title">{title}</Text>
        <Text className="provider-access-desc">{description}</Text>
        {actionText && onAction ? (
          <View className="provider-access-action" onClick={onAction}>
            <Text className="provider-access-action-text">{actionText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
