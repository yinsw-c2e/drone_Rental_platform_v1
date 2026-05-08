import Taro from '@tarojs/taro';
import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import './index.scss';

export default function FulfillmentHubPage() {
  const navigateTo = (url: string) => Taro.navigateTo({ url });

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="hero">
        <Text className="hero-title">履约中心</Text>
        <Text className="hero-desc">集中管理您的运单、航班、派单和物流进度。</Text>
      </View>

      <View className="menu-group">
        <Text className="group-title">履约单管理</Text>
        <View className="menu-item" onClick={() => navigateTo('/pages/orders/detail/index')}>
          <View className="menu-left">
            <Text className="menu-icon">📦</Text>
            <Text className="menu-label">我的运单</Text>
          </View>
          <Text className="menu-arrow">{'>'}</Text>
        </View>
        <View className="menu-item border-none" onClick={() => navigateTo('/pages/cargo/list/index')}>
          <View className="menu-left">
            <Text className="menu-icon">🚚</Text>
            <Text className="menu-label">物流与货单</Text>
          </View>
          <Text className="menu-arrow">{'>'}</Text>
        </View>
      </View>

      <View className="menu-group">
        <Text className="group-title">执行与派发</Text>
        <View className="menu-item" onClick={() => navigateTo('/pages/dispatch/list/index')}>
          <View className="menu-left">
            <Text className="menu-icon">📡</Text>
            <Text className="menu-label">派单调度</Text>
          </View>
          <Text className="menu-arrow">{'>'}</Text>
        </View>
        <View className="menu-item border-none" onClick={() => navigateTo('/pages/pilot/workbench/index')}>
          <View className="menu-left">
            <Text className="menu-icon">🕹️</Text>
            <Text className="menu-label">飞手工作台</Text>
          </View>
          <Text className="menu-arrow">{'>'}</Text>
        </View>
      </View>

      <View className="menu-group">
        <Text className="group-title">飞行监控</Text>
        <View className="menu-item" onClick={() => navigateTo('/pages/flight/monitor/index')}>
          <View className="menu-left">
            <Text className="menu-icon">🛰️</Text>
            <Text className="menu-label">飞行监控</Text>
          </View>
          <Text className="menu-arrow">{'>'}</Text>
        </View>
        <View className="menu-item border-none" onClick={() => navigateTo('/pages/flight/records/index')}>
          <View className="menu-left">
            <Text className="menu-icon">📜</Text>
            <Text className="menu-label">飞行日志</Text>
          </View>
          <Text className="menu-arrow">{'>'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
