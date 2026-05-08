import Taro from '@tarojs/taro';
import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function CargoAcceptPage() {
  const params = Taro.getCurrentInstance().router?.params || {};

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="empty-state">
        <Text className="empty-state-text">收发货确认模块开发中...</Text>
      </View>
    </ScrollView>
  );
}
