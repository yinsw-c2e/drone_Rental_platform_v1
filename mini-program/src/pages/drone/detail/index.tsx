import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import { droneService } from '../../../services/drone';
import { Drone } from '../../../types';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const statusMap: Record<string, { label: string; tone: string }> = {
  available: { label: '可用', tone: 'green' },
  rented: { label: '忙碌中', tone: 'orange' },
  maintenance: { label: '维护中', tone: 'red' },
  offline: { label: '不可用', tone: 'gray' },
};

const getQualificationStatus = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'verified') {
    return { statusLabel: '已通过', tone: 'verified' };
  }
  if (normalized === 'pending') {
    return { statusLabel: '审核中', tone: 'pending' };
  }
  return { statusLabel: '未提交', tone: 'empty' };
};

const getQualificationItems = (drone: Drone) => [
  { name: 'UOM 实名', ...getQualificationStatus(drone.uom_verified) },
  { name: '保险', ...getQualificationStatus(drone.insurance_verified) },
  { name: '适航', ...getQualificationStatus(drone.airworthiness_verified) },
];

export default function DroneDetailPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const id = Number(params.id || 0);

  const [drone, setDrone] = useState<Drone | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (id > 0) {
      droneService.getById(id).then((res: any) => {
        setDrone(res.data || res);
      }).catch(e => {
        Taro.showToast({ title: '加载失败', icon: 'none' });
      }).finally(() => setLoading(false));
    }
  });

  const handleDelete = () => {
    Taro.showModal({
      title: '删除无人机',
      content: '确定要删除此无人机吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            Taro.showLoading({ title: '删除中' });
            await droneService.delete(id);
            Taro.hideLoading();
            Taro.showToast({ title: '删除成功', icon: 'success' });
            setTimeout(() => Taro.navigateBack(), 1500);
          } catch (e: any) {
            Taro.hideLoading();
            Taro.showToast({ title: friendlyErrorMessage(e, '删除失败'), icon: 'none' });
          }
        }
      }
    });
  };

  if (loading) {
    return <View className="drone-detail-wrap"><View className="empty-state"><Text className="empty-state-text">加载中...</Text></View></View>;
  }

  if (!drone) {
    return <View className="drone-detail-wrap"><View className="empty-state"><Text className="empty-state-text">未找到无人机信息</Text></View></View>;
  }

  const availability = statusMap[drone.availability_status || 'offline'] || statusMap.offline;
  const qualificationItems = getQualificationItems(drone);
  const qualificationComplete = qualificationItems.every(item => item.tone === 'verified');

  return (
    <ScrollView scrollY className="drone-detail-wrap">
      {/* ── 头部信息 ── */}
      <View className="detail-hero">
        <View className="detail-hero-top">
          <Text className="drone-title">{drone.brand} {drone.model}</Text>
          <View className="status-badge" style={{ backgroundColor: availability.tone === 'green' ? '#F6FFED' : availability.tone === 'orange' ? '#FFF7E6' : availability.tone === 'red' ? '#FFF1F0' : '#F3F4F6' }}>
            <Text style={{ color: availability.tone === 'green' ? '#52C41A' : availability.tone === 'orange' ? '#FA8C16' : availability.tone === 'red' ? '#F5222D' : '#9CA3AF', fontSize: '12px' }}>
              {availability.label}
            </Text>
          </View>
        </View>
        <Text className="drone-sn">SN: {drone.serial_number || '未设置'}</Text>
      </View>

      {/* ── 图片 ── */}
      {(drone.images && drone.images.length > 0) && (
        <ScrollView scrollX className="images-scroll">
          <View className="images-row">
            {drone.images.map((img, idx) => (
              <Image key={idx} src={img} className="drone-image" mode="aspectFill" onClick={() => Taro.previewImage({ current: img, urls: drone.images || [] })} />
            ))}
          </View>
        </ScrollView>
      )}

      <View className="drone-detail-qualification-card" onClick={() => Taro.navigateTo({ url: `/pages/drone/certification/index?id=${drone.id}` })}>
        <View className="drone-detail-qualification-header">
          <View className="drone-detail-qualification-title-group">
            <Text className="drone-detail-qualification-title">资质认证</Text>
            <Text className="drone-detail-qualification-subtitle">UOM 实名、保险、适航证明</Text>
          </View>
          <Text className="drone-detail-qualification-action">{qualificationComplete ? '查看资质' : '去补充'}</Text>
        </View>
        <View className="drone-detail-qualification-pills">
          {qualificationItems.map(item => (
            <View key={item.name} className={`drone-detail-qualification-pill drone-detail-qualification-pill-${item.tone}`}>
              <Text className="drone-detail-qualification-pill-name">{item.name}</Text>
              <Text className={`drone-detail-qualification-pill-status drone-detail-qualification-pill-status-${item.tone}`}>{item.statusLabel}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 基本参数 ── */}
      <View className="info-card">
        <Text className="section-title">基本参数</Text>
        <View className="info-row">
          <Text className="info-label">起飞重量</Text>
          <Text className="info-value">{drone.mtow_kg || 0} kg</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">最大载重</Text>
          <Text className="info-value">{drone.max_load || drone.max_payload_kg || 0} kg</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">最大续航</Text>
          <Text className="info-value">{drone.max_flight_time || 0} 分钟</Text>
        </View>
        <View className="info-row" style={{ borderBottomWidth: 0 }}>
          <Text className="info-label">所在城市</Text>
          <Text className="info-value">{drone.city || '未设置'}</Text>
        </View>
      </View>

      {/* ── 租赁信息 ── */}
      <View className="info-card">
        <Text className="section-title">租赁信息</Text>
        <View className="info-row">
          <Text className="info-label">日租金</Text>
          <Text className="info-value">¥{((drone.daily_price || 0) / 100).toFixed(2)}</Text>
        </View>
        <View className="info-row">
          <Text className="info-label">时租金</Text>
          <Text className="info-value">¥{((drone.hourly_price || 0) / 100).toFixed(2)}</Text>
        </View>
        <View className="info-row" style={{ borderBottomWidth: 0 }}>
          <Text className="info-label">押金</Text>
          <Text className="info-value">¥{((drone.deposit || 0) / 100).toFixed(2)}</Text>
        </View>
      </View>

      {/* ── 资质与维护入口 ── */}
      <View className="action-list">
        <View className="action-item" onClick={() => Taro.navigateTo({ url: `/pages/drone/maintenance/index?id=${drone.id}` })}>
          <Text className="action-text">维护记录</Text>
          <Text className="action-arrow">{'>'}</Text>
        </View>
      </View>

      <View className="bottom-bar">
        <View className="btn-outline" onClick={handleDelete}>
          <Text className="btn-outline-text">删除设备</Text>
        </View>
        <View className="btn-primary" onClick={() => Taro.navigateTo({ url: `/pages/drone/edit/index?id=${drone.id}` })}>
          <Text className="btn-primary-text">编辑信息</Text>
        </View>
      </View>
    </ScrollView>
  );
}
