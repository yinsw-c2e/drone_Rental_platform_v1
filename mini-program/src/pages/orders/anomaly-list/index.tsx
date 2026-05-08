import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function OrderAnomalyListPage() {
  const [anomalies] = useState<any[]>([]);

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="hero">
        <Text className="hero-title">异常记录</Text>
        <Text className="hero-desc">订单履约过程中的所有异常记录。</Text>
      </View>
      <View className="list-content">
        {anomalies.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-text">暂无订单异常</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
