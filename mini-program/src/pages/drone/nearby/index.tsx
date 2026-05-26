import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { droneService } from '../../../services/drone';
import { Drone } from '../../../types';
import './index.scss';

export default function NearbyDronesPage() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrones = async () => {
    setLoading(true);
    try {
      // In mini-program, use Taro.getLocation
      const pos = await Taro.getLocation({ type: 'gcj02' });
      const res: any = await droneService.nearby(pos.latitude, pos.longitude, 50);
      setDrones(res.data?.list || res.list || []);
    } catch (e: any) {
      Taro.showToast({ title: '定位失败或加载异常', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    fetchDrones();
  });

  return (
    <View className="page-root">
      {/* Hero */}
      <View className="page-hero nearby-hero">
        <Text className="page-hero-title">附近无人机</Text>
        <Text className="page-hero-sub">寻找周边的可用设备</Text>
      </View>

      <ScrollView scrollY className="list-content">
        {loading ? (
          <View className="empty-state"><Text className="empty-state-text">加载中...</Text></View>
        ) : drones.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-icon">🚁</Text>
            <Text className="empty-state-text">附近暂无可租用的无人机</Text>
          </View>
        ) : (
          drones.map(item => (
            <View key={item.id} className="drone-card" onClick={() => Taro.navigateTo({ url: `/pages/drone/detail/index?id=${item.id}` })}>
              <View className="drone-icon"><Text style={{ fontSize: '24px' }}>🚁</Text></View>
              <View className="drone-info">
                <Text className="drone-name">{item.brand} {item.model}</Text>
                <Text className="drone-meta">{item.owner?.nickname || '服务商'} · ⭐{item.rating || '5.0'}</Text>
                <Text className="drone-address">{item.address || item.city || '位置未知'}</Text>
              </View>
              <View className="drone-price">
                <Text className="price-text">¥{(Number(item.daily_price || 0) / 100).toFixed(0)}/天</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
