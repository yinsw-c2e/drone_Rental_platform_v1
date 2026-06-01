import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { droneService } from '../../../services/drone';
import { Drone } from '../../../types';
import './index.scss';

const statusMap: Record<string, { label: string; tone: string }> = {
  available: { label: '可用', tone: 'green' },
  rented: { label: '忙碌中', tone: 'orange' },
  maintenance: { label: '维护中', tone: 'red' },
  offline: { label: '不可用', tone: 'gray' },
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

const isQualificationVerified = (status?: string | null) => String(status || '').toLowerCase() === 'verified';

const getQualificationSummary = (drone: Drone) => {
  const verifiedCount = [
    drone.uom_verified,
    drone.insurance_verified,
    drone.airworthiness_verified,
  ].filter(isQualificationVerified).length;

  return {
    verifiedCount,
    complete: verifiedCount === 3,
    label: verifiedCount === 3 ? '资质齐全' : `资质待补 ${verifiedCount}/3`,
  };
};

const openCertification = (droneId: number, event?: { stopPropagation?: () => void }) => {
  event?.stopPropagation?.();
  Taro.navigateTo({ url: `/pages/drone/certification/index?id=${droneId}` });
};

export default function MyDronesPage() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(true);
    droneService.myDrones({ page: 1, page_size: 50 }).then((res: any) => {
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
              <Text className='empty-state-text'>还没有添加无人机，添加设备后可用于接单资质审核</Text>
            </View>
          </View>
        ) : (
          drones.map(d => {
            const availability = statusMap[d.availability_status || 'offline'] || statusMap.offline;
            const mtow = d.mtow_kg || 0;
            const payload = d.max_payload_kg || d.max_load || 0;
            const qualification = getQualificationSummary(d);

            return (
              <View key={d.id} className='list-item my-drones-item' onClick={() => Taro.navigateTo({ url: `/pages/drone/detail/index?id=${d.id}` })}>
                <View className='list-item-header'>
                  <View className='md-header-text'>
                    <Text className='list-item-title'>{d.brand} {d.model}</Text>
                  </View>
                  <StatusBadge label={availability.label} tone={availability.tone} />
                </View>
                <View className='md-spec-grid'>
                  <View className='md-spec-item'>
                    <Text className='md-spec-label'>起飞重量</Text>
                    <Text className='md-spec-value'>{mtow}kg</Text>
                  </View>
                  <View className='md-spec-item'>
                    <Text className='md-spec-label'>最大吊重</Text>
                    <Text className='md-spec-value'>{payload}kg</Text>
                  </View>
                </View>
                <View className='md-meta-row'>
                  <Text className='md-meta-label'>城市</Text>
                  <Text className='md-meta-value'>{d.city || '未设置'}</Text>
                  <Text className='md-meta-label md-meta-label-right'>状态</Text>
                  <Text className='md-meta-value md-meta-value-right'>{availability.label}</Text>
                </View>
                <View className='md-meta-row md-meta-row-single'>
                  <Text className='md-meta-label'>序列号</Text>
                  <Text className='md-meta-value'>{d.serial_number || '-'}</Text>
                </View>
                <View
                  className={`md-meta-row md-meta-row-single my-drones-qualification-row${qualification.complete ? '' : ' my-drones-qualification-row-active'}`}
                  onClick={qualification.complete ? undefined : (event) => openCertification(d.id, event)}
                >
                  <Text className='md-meta-label'>资质</Text>
                  <Text className={`md-meta-value my-drones-qualification-value ${qualification.complete ? 'my-drones-qualification-value-complete' : 'my-drones-qualification-value-pending'}`}>
                    {qualification.label}
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
