import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function ContractPage() {
  return (
    <ScrollView scrollY className="page-wrap">
      <View className="hero">
        <Text className="hero-title">电子合同</Text>
        <Text className="hero-desc">查看及签署运输协议。</Text>
      </View>
      <View className="list-content">
        <View className="empty-state">
          <Text className="empty-state-text">合同加载中...</Text>
        </View>
      </View>
    </ScrollView>
  );
}
