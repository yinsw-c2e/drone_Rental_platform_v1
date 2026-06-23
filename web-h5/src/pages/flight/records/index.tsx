import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { pilotV2Service } from '../../../services/pilotV2';
import { formatUnknownEnumLabel, getObjectStatusMeta } from '../../../utils';
import './index.scss';

const FLIGHT_STATUS_LABELS: Record<string, string> = {
  pending: '待开始',
  recording: '飞行中',
  completed: '已完成',
  failed: '已失败',
  cancelled: '已取消',
};

function formatDuration(s?: number) {
  if (!s || s <= 0) return '-';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function formatDistance(m?: number) {
  if (!m || m <= 0) return '-';
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;
}

function formatDateTime(v?: string | null) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function FlightRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    pilotV2Service.listAllFlightRecords({ page_size: 50 }).then(res => {
      setRecords(Array.isArray(res) ? res : []);
    }).catch(() => setRecords([])).finally(() => setLoading(false));
  });

  const totalFlights = records.length;
  const totalDuration = records.reduce((s, r) => s + (r.total_duration_seconds || 0), 0);
  const totalDistance = records.reduce((s, r) => s + (r.total_distance_m || 0), 0);
  const maxAltitude = records.reduce((max, r) => Math.max(max, r.max_altitude_m || 0), 0);

  return (
    <ScrollView scrollY className="records-wrap">
      {/* ── 飞行统计 ── */}
      <View className="card">
        <Text className="records-stats-title">飞行统计</Text>
        <View className="records-stats-grid">
          <View className="records-stat-item">
            <Text className="records-stat-value">{totalFlights}</Text>
            <Text className="records-stat-label">总飞行次数</Text>
          </View>
          <View className="records-stat-item">
            <Text className="records-stat-value">{formatDuration(totalDuration)}</Text>
            <Text className="records-stat-label">总飞行时长</Text>
          </View>
          <View className="records-stat-item">
            <Text className="records-stat-value">{formatDistance(totalDistance)}</Text>
            <Text className="records-stat-label">总飞行距离</Text>
          </View>
          <View className="records-stat-item">
            <Text className="records-stat-value">{Math.round(maxAltitude)}m</Text>
            <Text className="records-stat-label">最高飞行高度</Text>
          </View>
        </View>
      </View>

      {/* ── 提示卡片 ── */}
      <View className="card records-tip-card">
        <Text className="records-tip-title">履约飞行记录</Text>
        <Text className="records-tip-text">
          这里只展示订单执行中自动沉淀的飞行留痕，不再支持手动补录，避免统计口径和履约数据不一致。
        </Text>
      </View>

      <Text className="section-title">飞行记录</Text>

      {/* ── 记录列表 ── */}
      {loading ? (
        <View className="empty-state"><Text className="empty-state-text">加载中...</Text></View>
      ) : records.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-state-icon">🛫</Text>
          <Text className="empty-state-text">暂无飞行记录</Text>
        </View>
      ) : records.map(r => (
        <View key={r.id} className="list-item">
          <View className="list-item-header">
            <View className="records-header-left">
              <Text className="list-item-no">{r.flight_no || `飞行记录 #${r.id}`}</Text>
              <View className="records-tags">
                <Text className="status-badge" style={{ backgroundColor: r.status === 'completed' ? '#52C41A' : '#1677FF' }}>
                  {FLIGHT_STATUS_LABELS[String(r.status || '').toLowerCase()] || formatUnknownEnumLabel(r.status, '进行中')}
                </Text>
                {r.order?.status && (
                  <Text className="status-badge" style={{ backgroundColor: '#13C2C2' }}>
                    {getObjectStatusMeta('order', r.order.status).label}
                  </Text>
                )}
              </View>
            </View>
            <Text className="list-item-meta-text">{formatDateTime(r.takeoff_at || r.created_at)}</Text>
          </View>
          <Text className="list-item-title">{r.order?.title || '履约飞行记录'}</Text>
          {r.order?.order_no && <Text className="records-order-no">关联订单 {r.order.order_no}</Text>}
          <View className="records-metric-row">
            <View className="records-metric-item">
              <Text className="records-metric-label">飞行时长</Text>
              <Text className="records-metric-value">{formatDuration(r.total_duration_seconds)}</Text>
            </View>
            <View className="records-metric-item">
              <Text className="records-metric-label">飞行距离</Text>
              <Text className="records-metric-value">{formatDistance(r.total_distance_m)}</Text>
            </View>
          </View>
          <View className="records-metric-row">
            <View className="records-metric-item">
              <Text className="records-metric-label">最高高度</Text>
              <Text className="records-metric-value">{Math.round(r.max_altitude_m || 0)}米</Text>
            </View>
            <View className="records-metric-item">
              <Text className="records-metric-label">落地时间</Text>
              <Text className="records-metric-value">{formatDateTime(r.landing_at)}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
