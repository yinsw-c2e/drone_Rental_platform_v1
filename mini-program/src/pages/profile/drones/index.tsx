import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { droneService } from '../../../services/drone';
import { VERIFY_STATUS } from '../../../constants';
import { Drone } from '../../../types';
import { formatUnknownEnumLabel } from '../../../utils';
import './index.scss';

const statusMap: Record<string, { label: string; tone: string }> = {
  available: { label: '可用', tone: 'green' },
  rented: { label: '忙碌中', tone: 'orange' },
  maintenance: { label: '维护中', tone: 'red' },
  offline: { label: '不可用', tone: 'gray' },
};

const CERTIFICATION_STATUS_LABELS: Record<string, string> = {
  draft: '未提交',
  pending: '审核中',
  approved: '已认证',
  rejected: '未通过',
  verified: '已认证',
  unverified: '未认证',
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const bgMap: Record<string, string> = {
    green: '#52c41a',
    orange: '#fa8c16',
    red: '#f5222d',
    gray: '#9ca3af',
    blue: '#1677ff',
  };
  return (
    <View className='drone-status-badge' style={{ backgroundColor: bgMap[tone] || '#9ca3af' }}>
      <Text className='drone-status-badge-text'>{label}</Text>
    </View>
  );
}

export default function MyDronesPage() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(true);
    droneService.myDrones({ page: 1, page_size: 100 }).then((res: any) => {
      setDrones(res.list || res.data?.list || res.items || []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  });

  return (
    <View className="page-root">
      <ScrollView
        scrollY
        className='my-drones-wrap'
    >
        {/* Hero - 蓝色 */}
        <View className='page-hero my-drones-hero'>
          <Text className='page-hero-title'>我的无人机</Text>
          <Text className='page-hero-sub'>管理设备与资质</Text>
        </View>

        {loading ? (
          <View className='empty-state'>
            <Text className='empty-state-text'>加载中...</Text>
          </View>
        ) : drones.length === 0 ? (
          <View className='card'>
            <View className='empty-state'>
              <Text className='empty-state-icon'>🛩️</Text>
              <Text className='empty-state-text'>还没有添加无人机</Text>
            </View>
          </View>
        ) : (
          drones.map(d => {
            const availability = statusMap[d.availability_status || 'offline'] || statusMap.offline;
            const mtow = d.mtow_kg || 0;
            const payload = d.max_payload_kg || d.max_load || 0;

            return (
              <View key={d.id} className='list-item my-drones-item' onClick={() => Taro.navigateTo({ url: `/pages/drone/detail/index?id=${d.id}` })}>
                <View className='list-item-header'>
                  <View className='md-header-text'>
                    <Text className='list-item-title'>{d.brand} {d.model}</Text>
                  </View>
                  <StatusBadge label={availability.label} tone={availability.tone} />
                </View>
                <View className='list-item-meta'>
                  <Text className='list-item-meta-text'>起飞重量：{mtow}kg</Text>
                  <Text className='list-item-meta-text'>最大吊重：{payload}kg</Text>
                </View>
                <View className='list-item-meta'>
                  <Text className='list-item-meta-text'>城市：{d.city || '未设置'}</Text>
                  <Text className='list-item-meta-text'>状态：{availability.label}</Text>
                </View>
                <View className='list-item-meta'>
                  <Text className='list-item-meta-text'>序列号：{d.serial_number || '-'}</Text>
                  <Text className='list-item-meta-text'>
                    认证：{CERTIFICATION_STATUS_LABELS[String(d.certification_status || '').toLowerCase()] || VERIFY_STATUS[String(d.certification_status || '').toLowerCase()] || formatUnknownEnumLabel(d.certification_status, '状态未知')}
                  </Text>
                </View>
                <View className='md-footer' />
              </View>
            );
          })
        )}
      </ScrollView>
      <View className="bottom-fixed-bar">
        <View className="btn-primary" onClick={() => Taro.navigateTo({ url: '/pages/drone/add/index' })}>
          <Text className="btn-text">添加无人机</Text>
        </View>
      </View>
    </View>
  );
}
