// @ts-nocheck
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map, Text, View } from '@tarojs/components';
import { orderV2Service } from '../../../services/orderV2';
import { V2OrderDetail, V2OrderLive } from '../../../types';
import './index.scss';

import pinStart from '../../../assets/quick-order/icons/pin_start.png';
import pinEnd from '../../../assets/quick-order/icons/pin_end.png';

type MapPoint = {
  latitude: number;
  longitude: number;
};

const terminalStatuses = ['delivered', 'completed', 'cancelled', 'provider_rejected'];

function normalizePayload<T>(res: T | { data?: T }): T {
  return (res as any)?.data || res;
}

function isValidPoint(point?: MapPoint | null) {
  if (!point) return false;
  const { latitude, longitude } = point;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return latitude !== 0 || longitude !== 0;
}

function readNumber(payload: any, keys: string[]) {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => acc?.[part], payload);
    const num = Number(value);
    if (Number.isFinite(num) && num !== 0) return num;
  }
  return undefined;
}

function maybeParseJSON(value: any) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function resolveSnapshot(detail: any) {
  const snapshots = detail?.source_info?.snapshots || {};
  const pricing = maybeParseJSON(snapshots?.pricing?.price_breakdown_json || detail?.price_breakdown_json);
  const demand = snapshots?.demand || {};
  return { snapshots, pricing, demand };
}

function resolvePoint(detail: any, kind: 'origin' | 'destination'): MapPoint | null {
  const { snapshots, pricing, demand } = resolveSnapshot(detail);
  const source = {
    detail,
    snapshots,
    pricing,
    demand,
  };

  const latitude = kind === 'origin'
    ? readNumber(source, [
        'detail.service_latitude',
        'detail.origin_latitude',
        'detail.origin.latitude',
        'pricing.origin.latitude',
        'snapshots.departure_address.latitude',
        'snapshots.pickup_address.latitude',
        'demand.departure_address_snapshot.latitude',
        'demand.service_address_snapshot.latitude',
      ])
    : readNumber(source, [
        'detail.dest_latitude',
        'detail.destination_latitude',
        'detail.destination.latitude',
        'pricing.destination.latitude',
        'snapshots.destination_address.latitude',
        'snapshots.dropoff_address.latitude',
        'demand.destination_address_snapshot.latitude',
      ]);

  const longitude = kind === 'origin'
    ? readNumber(source, [
        'detail.service_longitude',
        'detail.origin_longitude',
        'detail.origin.longitude',
        'pricing.origin.longitude',
        'snapshots.departure_address.longitude',
        'snapshots.pickup_address.longitude',
        'demand.departure_address_snapshot.longitude',
        'demand.service_address_snapshot.longitude',
      ])
    : readNumber(source, [
        'detail.dest_longitude',
        'detail.destination_longitude',
        'detail.destination.longitude',
        'pricing.destination.longitude',
        'snapshots.destination_address.longitude',
        'snapshots.dropoff_address.longitude',
        'demand.destination_address_snapshot.longitude',
      ]);

  const point = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null;
  return isValidPoint(point) ? point : null;
}

function statusTextOf(status?: string) {
  if (status === 'pending_dispatch' || status === 'auto_assigning') return '已下单，等待服务商接单';
  if (status === 'assigned') return '服务商已接单';
  if (status === 'preparing') return '准备起飞';
  if (status === 'in_transit') return '飞行中';
  if (status === 'delivered' || status === 'completed') return '已送达';
  if (status === 'cancelled') return '订单已取消';
  if (status === 'provider_rejected') return '服务未确认';
  return '等待服务开始';
}

function statusStepOf(status?: string) {
  if (status === 'assigned') return 2;
  if (status === 'preparing') return 3;
  if (status === 'in_transit') return 4;
  if (status === 'delivered' || status === 'completed') return 5;
  return 1;
}

function formatEta(seconds: number | null | undefined) {
  if (seconds === 0) return '即将到达';
  if (seconds === null || seconds === undefined) return '等待开始飞行';
  const safe = Math.max(0, Math.round(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  if (min <= 0) return `预计 ${sec} 秒到达`;
  return `预计 ${min} 分 ${sec} 秒到达`;
}

function formatRecordedAt(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(5, 19);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function progressOf(value?: number) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function orderAgeSeconds(value?: string) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

export default function OrderLivePage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [order, setOrder] = useState<V2OrderDetail | null>(null);
  const [live, setLive] = useState<V2OrderLive | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [increasingPrice, setIncreasingPrice] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef('');
  const mapRefitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const shouldStopPolling = useCallback((nextStatus?: string, nextLive?: V2OrderLive | null) => {
    if (terminalStatuses.includes(String(nextStatus || statusRef.current))) return true;
    return nextLive?.eta_seconds === 0 && progressOf(nextLive?.progress_pct) >= 100;
  }, []);

  const refreshMapBounds = useCallback((points: MapPoint[]) => {
    const includePoints = points.filter(isValidPoint);
    if (includePoints.length <= 1) return;
    if (mapRefitTimer.current) clearTimeout(mapRefitTimer.current);
    mapRefitTimer.current = setTimeout(() => {
      const map = Taro.createMapContext('order-live-map');
      map?.includePoints?.({
        points: includePoints,
        padding: [48, 48, 48, 48],
      });
    }, 100);
  }, []);

  const loadLive = useCallback(async () => {
    if (!orderId || shouldStopPolling()) {
      stopPolling();
      return;
    }
    try {
      const res = await orderV2Service.getLive(orderId);
      const nextLive = normalizePayload<V2OrderLive>(res);
      const maybeStatus = String((nextLive as any)?.status || statusRef.current || '');
      setLive(nextLive);
      if (maybeStatus) {
        statusRef.current = maybeStatus;
        setStatus(maybeStatus);
      }
      if (shouldStopPolling(maybeStatus, nextLive)) stopPolling();
    } catch {
      // 飞行中不要反复打扰用户，保留最后一次成功数据并等待下一轮。
    }
  }, [orderId, shouldStopPolling, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    if (!orderId || shouldStopPolling()) return;
    timerRef.current = setInterval(() => {
      loadLive();
    }, 5000);
  }, [loadLive, orderId, shouldStopPolling, stopPolling]);

  const loadInitial = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      setErrorText('缺少订单ID，无法查看订单进度');
      return;
    }
    setLoading(true);
    setErrorText('');
    try {
      const res = await orderV2Service.get(orderId);
      const detail = normalizePayload<V2OrderDetail>(res);
      setOrder(detail);
      setLive(detail?.live || null);
      const nextStatus = String(detail?.status || '');
      setStatus(nextStatus);
      statusRef.current = nextStatus;
      if (shouldStopPolling(nextStatus, detail?.live || null)) stopPolling();
      else startPolling();
    } catch (error: any) {
      setErrorText(error?.message || '订单进度加载失败');
    } finally {
      setLoading(false);
    }
  }, [orderId, shouldStopPolling, startPolling, stopPolling]);

  useDidShow(() => {
    if (order) {
      startPolling();
      return;
    }
    loadInitial();
  });

  useDidHide(() => {
    stopPolling();
  });

  useEffect(() => () => {
    stopPolling();
    if (mapRefitTimer.current) clearTimeout(mapRefitTimer.current);
  }, [stopPolling]);

  const origin = useMemo(() => resolvePoint(order, 'origin'), [order]);
  const destination = useMemo(() => resolvePoint(order, 'destination'), [order]);

  const includePoints = useMemo(() => [origin, destination].filter(isValidPoint), [origin, destination]);

  useEffect(() => {
    refreshMapBounds(includePoints);
  }, [includePoints, refreshMapBounds]);

  const markers = useMemo(() => {
    const items: any[] = [];
    if (origin) {
      items.push({
        id: 1,
        latitude: origin.latitude,
        longitude: origin.longitude,
        iconPath: pinStart,
        width: 34,
        height: 34,
        label: {
          content: '起点',
          color: '#1677ff',
          fontSize: 12,
          anchorX: -8,
          anchorY: -34,
          bgColor: '#ffffff',
          borderRadius: 4,
          padding: 4,
        },
      });
    }
    if (destination) {
      items.push({
        id: 2,
        latitude: destination.latitude,
        longitude: destination.longitude,
        iconPath: pinEnd,
        width: 34,
        height: 34,
        label: {
          content: '终点',
          color: '#ff4d4f',
          fontSize: 12,
          anchorX: -8,
          anchorY: -34,
          bgColor: '#ffffff',
          borderRadius: 4,
          padding: 4,
        },
      });
    }
    // TODO: 等设备端位置上报接入后恢复实时地图卡片。
    return items;
  }, [destination, origin]);

  const polyline = useMemo(() => {
    if (!origin || !destination) return [];
    return [{
      points: [origin, destination],
      color: '#1677ff',
      width: 4,
      dottedLine: true,
      arrowLine: true,
    }];
  }, [destination, origin]);

  const mapCenter = origin || destination || { latitude: 22.543096, longitude: 114.057865 };
  const activeStep = statusStepOf(status);
  const progress = progressOf(live?.progress_pct);
  const canSuggestPriceIncrease =
    !!order &&
    String(order.order_mode || '') === 'instant' &&
    status === 'pending_dispatch' &&
    orderAgeSeconds(order.created_at) >= 90;

  const increasePrice = async () => {
    if (increasingPrice) return;
    const options = ['加价 ¥20', '加价 ¥50', '加价 ¥100'];
    const result = await Taro.showActionSheet({ itemList: options }).catch(() => null);
    if (!result || typeof result.tapIndex !== 'number') return;
    const amounts = [2000, 5000, 10000];
    const amount = amounts[result.tapIndex] || 2000;
    try {
      setIncreasingPrice(true);
      await orderV2Service.increasePrice(orderId, {
        amount,
        reason: '附近运力紧张，客户主动加价',
        method: 'mock',
      });
      Taro.showToast({ title: '已加价，继续匹配服务商', icon: 'none' });
      loadInitial();
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '加价失败'), icon: 'none' });
    } finally {
      setIncreasingPrice(false);
    }
  };

  if (loading && !order) {
    return (
      <View className="order-live-page order-live-empty-page">
        <Text className="order-live-empty-title">正在同步订单进度</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="order-live-page order-live-empty-page">
        <Text className="order-live-empty-title">无法查看订单进度</Text>
        <Text className="order-live-empty-desc">{errorText || '订单不存在或当前账号无权查看。'}</Text>
      </View>
    );
  }

  return (
    <View className="order-live-page">
      <View className="order-live-map-wrap">
        <Map
          id="order-live-map"
          className="order-live-map"
          latitude={mapCenter.latitude}
          longitude={mapCenter.longitude}
          scale={14}
          markers={markers}
          polyline={polyline}
          includePoints={includePoints}
          showLocation={false}
        />
      </View>

      <View className="order-live-panel">
        <View className="order-live-status-head">
          <Text className="order-live-status-title">{statusTextOf(status)}</Text>
          <Text className="order-live-status-sub">{order.order_no}</Text>
        </View>

        <View className="order-live-steps">
          {['已下单', '已接单', '准备中', '飞行中', '已送达'].map((label, index) => {
            const done = activeStep >= index + 1;
            return (
              <View className="order-live-step" key={label}>
                <View className={`order-live-step-dot ${done ? 'order-live-step-dot-active' : ''}`} />
                <Text className={`order-live-step-text ${done ? 'order-live-step-text-active' : ''}`}>{label}</Text>
              </View>
            );
          })}
        </View>

        {!destination ? (
          <View className="order-live-hint">
            <Text>终点信息缺失</Text>
          </View>
        ) : null}

        {canSuggestPriceIncrease ? (
          <View className="order-live-price-increase">
            <View>
              <Text className="order-live-price-title">附近运力紧张</Text>
              <Text className="order-live-price-desc">适当加价可提升服务商响应速度</Text>
            </View>
            <View className={`order-live-price-button ${increasingPrice ? 'is-disabled' : ''}`} onClick={increasePrice}>
              <Text>{increasingPrice ? '处理中' : '加价试试'}</Text>
            </View>
          </View>
        ) : null}

        <View className="order-live-metrics">
          <View className="order-live-metric">
            <Text className="order-live-metric-label">预计到达</Text>
            <Text className="order-live-metric-value">{formatEta(live?.eta_seconds)}</Text>
          </View>
          <View className="order-live-metric">
            <Text className="order-live-metric-label">服务进度</Text>
            <Text className="order-live-metric-value">{progress}%</Text>
          </View>
        </View>

        <View className="order-live-progress">
          <View className="order-live-progress-fill" style={{ width: `${progress}%` }} />
        </View>

        <View className="order-live-meta">
          <Text>设备端位置上报接入后，将在此显示服务实时轨迹。</Text>
        </View>
      </View>
    </View>
  );
}
