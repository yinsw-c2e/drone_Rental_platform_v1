import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function CargoListPage() {
  const [cargos] = useState<any[]>([]);

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="hero">
        <Text className="hero-title">物流与货单</Text>
        <Text className="hero-desc">管理所有的货单流转、装卸交接状态。</Text>
      </View>
      <View className="list-content">
        {cargos.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-text">暂无相关物流货单</Text>
          </View>
        ) : (
          cargos.map(item => (
            <View key={item.id} className="cargo-card">
              <Text>{item.id}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
