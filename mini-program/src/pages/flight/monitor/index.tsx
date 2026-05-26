import Taro, { useDidShow } from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { orderV2Service } from '../../../services/orderV2';
import { dispatchV2Service } from '../../../services/dispatchV2';
import { V2OrderMonitor } from '../../../types';
import './index.scss';

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

function formatSpeed(s?: number) {
  if (!s || s <= 0) return '-';
  return `${s.toFixed(1)} m/s`;
}

function formatDateTime(v?: string | null) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function FlightMonitorPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const initialOrderId = Number(params.orderId || 0);
  const dispatchId = Number(params.dispatchId || 0);
  const [resolvedOrderId, setResolvedOrderId] = useState(initialOrderId);
  const [monitor, setMonitor] = useState<V2OrderMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resolveOrderId = async () => {
    if (initialOrderId > 0) { setResolvedOrderId(initialOrderId); return; }
    if (dispatchId > 0) {
      try {
        const res: any = await dispatchV2Service.get(dispatchId);
        const id = Number(res?.order?.id || res?.dispatch_task?.order?.id || 0);
        setResolvedOrderId(id);
      } catch { setResolvedOrderId(0); }
    }
  };

  const loadData = async () => {
    try {
      await resolveOrderId();
      if (!resolvedOrderId) { setMonitor(null); return; }
      const res = await orderV2Service.getMonitor(resolvedOrderId);
      setMonitor(res as any);
    } catch { setMonitor(null); }
    finally { setLoading(false); }
  };

  useDidShow(() => { loadData(); });

  useEffect(() => {
    if (!autoRefresh) return;
    timerRef.current = setInterval(() => loadData(), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, resolvedOrderId]);

  const order = monitor?.order;
  const position = monitor?.latest_position;
  const stats = monitor?.flight_stats;
  const alerts = monitor?.active_alerts || [];
  const orderNo = order?.order_no || '-';
  const orderStatus = order?.status || '-';
  const orderTitle = order?.title || '飞行监控';

  const avgSpeed = stats?.avg_speed != null ? stats.avg_speed
    : (stats?.actual_flight_duration && stats?.actual_flight_distance)
      ? Number(stats.actual_flight_distance) / Number(stats.actual_flight_duration)
      : undefined;

  if (loading) {
    return (
      <View className="monitor-wrap">
        <View className="empty-state">
          <Text className="empty-state-text">加载中...</Text>
        </View>
      </View>
    );
  }

  if (!resolvedOrderId || !order) {
    return (
      <View className="monitor-wrap">
        <View className="empty-state">
          <Text className="empty-state-icon">📡</Text>
          <Text className="empty-state-text">请从订单或履约详情进入飞行监控</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView scrollY className="monitor-wrap">
      {/* ── Hero：订单信息 ── */}
      <View className="page-hero monitor-hero">
        <View className="page-hero-top">
          <View className="monitor-hero-tags">
            <Text className="status-badge" style={{ backgroundColor: '#FFFFFF', color: '#1677FF' }}>{orderStatus}</Text>
          </View>
          <Text className="page-hero-no">{orderNo}</Text>
        </View>
        <Text className="page-hero-title">{orderTitle}</Text>
        <Text className="monitor-hero-route">
          {order.service_address || '未设置起点'}
          {order.dest_address ? ` → ${order.dest_address}` : ''}
        </Text>
        <View className="monitor-hero-actions">
          <View className={`monitor-live-chip ${autoRefresh ? 'monitor-live-active' : ''}`}
            onClick={() => setAutoRefresh(v => !v)}>
            <Text className={`monitor-live-text ${autoRefresh ? 'monitor-live-text-active' : ''}`}>
              {autoRefresh ? '自动同步中' : '已暂停同步'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 飞信概览 ── */}
      <View className="card">
        <Text className="section-title">飞行概览</Text>
        <View className="detail-row">
          <Text className="detail-row-label">订单状态</Text>
          <Text className="detail-row-value">{orderStatus}</Text>
        </View>
        <View className="detail-row">
          <Text className="detail-row-label">累计时长</Text>
          <Text className="detail-row-value">{formatDuration(stats?.actual_flight_duration)}</Text>
        </View>
        <View className="detail-row">
          <Text className="detail-row-label">累计距离</Text>
          <Text className="detail-row-value">{formatDistance(stats?.actual_flight_distance)}</Text>
        </View>
        <View className="detail-row">
          <Text className="detail-row-label">最高高度</Text>
          <Text className="detail-row-value">{stats?.max_altitude != null ? `${stats.max_altitude}m` : '-'}</Text>
        </View>
        <View className="detail-row" style={{ borderBottomWidth: 0 }}>
          <Text className="detail-row-label">平均速度</Text>
          <Text className="detail-row-value">{avgSpeed != null ? `${Number(avgSpeed).toFixed(1)} m/s` : '-'}</Text>
        </View>
      </View>

      {/* ── 最新位置 ── */}
      <View className="card">
        <Text className="section-title">最新位置</Text>
        {position ? (
          <View>
            <View className="monitor-coord-row">
              <View className="monitor-coord-item">
                <Text className="monitor-coord-label">纬度</Text>
                <Text className="monitor-coord-value">{Number(position.latitude || 0).toFixed(6)}</Text>
              </View>
              <View className="monitor-coord-item">
                <Text className="monitor-coord-label">经度</Text>
                <Text className="monitor-coord-value">{Number(position.longitude || 0).toFixed(6)}</Text>
              </View>
              <View className="monitor-coord-item">
                <Text className="monitor-coord-label">高度</Text>
                <Text className="monitor-coord-value">{Number(position.altitude || 0).toFixed(1)}m</Text>
              </View>
            </View>
            <View className="monitor-metric-grid">
              <View className="monitor-metric-item">
                <Text className="monitor-metric-label">速度</Text>
                <Text className="monitor-metric-value">{formatSpeed(position.speed)}</Text>
              </View>
              <View className="monitor-metric-item">
                <Text className="monitor-metric-label">航向</Text>
                <Text className="monitor-metric-value">{position.heading != null ? `${Number(position.heading).toFixed(0)}°` : '-'}</Text>
              </View>
              <View className="monitor-metric-item">
                <Text className="monitor-metric-label">电池</Text>
                <Text className="monitor-metric-value">{position.battery_level != null ? `${position.battery_level}%` : '-'}</Text>
              </View>
              <View className="monitor-metric-item">
                <Text className="monitor-metric-label">信号</Text>
                <Text className="monitor-metric-value">{position.signal_strength != null ? `${position.signal_strength}%` : '-'}</Text>
              </View>
            </View>
            <Text className="monitor-latest-time">最近上报：{formatDateTime(position.recorded_at)}</Text>
          </View>
        ) : (
          <Text className="empty-state-text">当前还没有位置上报数据。</Text>
        )}
      </View>

      {/* ── 活跃告警 ── */}
      <View className="card">
        <Text className="section-title">告警与风险</Text>
        {alerts.length === 0 ? (
          <Text className="empty-state-text">当前没有活跃告警。</Text>
        ) : alerts.map(a => {
          const level = String(a.alert_level || '').toLowerCase();
          const bg = level === 'critical' || level === 'danger' ? '#FFF2F0' : level === 'warning' ? '#FFFBE6' : '#F0F7FF';
          const border = level === 'critical' || level === 'danger' ? '#F5222D' : level === 'warning' ? '#FA8C16' : '#1677FF';
          const textColor = level === 'critical' || level === 'danger' ? '#F5222D' : level === 'warning' ? '#FA8C16' : '#1677FF';
          return (
            <View key={a.id} className="monitor-alert-item" style={{ backgroundColor: bg, borderColor: border }}>
              <View className="monitor-alert-header">
                <Text className="monitor-alert-level" style={{ color: textColor }}>{a.alert_level}</Text>
                <Text className="monitor-alert-time">{formatDateTime(a.triggered_at)}</Text>
              </View>
              <Text className="monitor-alert-title">{a.title || a.alert_type || '告警'}</Text>
              <Text className="monitor-alert-desc">{a.description || '当前存在需要关注的监控异常。'}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
