import Taro from '@tarojs/taro';
import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function CargoDetailPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const id = params.id;

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="empty-state">
        <Text className="empty-state-text">货单详情暂未开放</Text>
      </View>
    </ScrollView>
  );
}
