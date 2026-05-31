import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import {orderV2Service} from '../../services/orderV2';
import {V2OrderDetail, V2OrderLive} from '../../types';
import {friendlyErrorMessage} from '../../utils/errorMessage';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type MapPoint = {
  latitude: number;
  longitude: number;
};

const TERMINAL_STATUSES = ['delivered', 'completed', 'cancelled', 'provider_rejected'];

const normalizePayload = <T,>(res: T | {data?: T}): T => ((res as any)?.data || res) as T;

const isValidPoint = (point?: MapPoint | null) => {
  if (!point) return false;
  const {latitude, longitude} = point;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return latitude !== 0 || longitude !== 0;
};

const readNumber = (payload: any, keys: string[]) => {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => acc?.[part], payload);
    const num = Number(value);
    if (Number.isFinite(num) && num !== 0) return num;
  }
  return undefined;
};

const maybeParseJSON = (value: any) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const resolveSnapshot = (detail: any) => {
  const snapshots = detail?.source_info?.snapshots || {};
  const pricing = maybeParseJSON(snapshots?.pricing?.price_breakdown_json || detail?.price_breakdown_json);
  const demand = snapshots?.demand || {};
  return {snapshots, pricing, demand};
};

const resolvePoint = (detail: any, kind: 'origin' | 'destination'): MapPoint | null => {
  const {snapshots, pricing, demand} = resolveSnapshot(detail);
  const source = {detail, snapshots, pricing, demand};
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

  const point = latitude !== undefined && longitude !== undefined ? {latitude, longitude} : null;
  return isValidPoint(point) ? point : null;
};

const statusTextOf = (status?: string) => {
  if (status === 'pending_dispatch' || status === 'auto_assigning') return '已下单，等待服务商接单';
  if (status === 'assigned') return '服务商已接单';
  if (status === 'preparing') return '准备起飞';
  if (status === 'in_transit') return '飞行中';
  if (status === 'delivered' || status === 'completed') return '已送达';
  if (status === 'cancelled') return '订单已取消';
  if (status === 'provider_rejected') return '服务未确认';
  return '等待服务开始';
};

const statusStepOf = (status?: string) => {
  if (status === 'assigned') return 2;
  if (status === 'preparing') return 3;
  if (status === 'in_transit') return 4;
  if (status === 'delivered' || status === 'completed') return 5;
  return 1;
};

const formatEta = (seconds: number | null | undefined) => {
  if (seconds === 0) return '即将到达';
  if (seconds === null || seconds === undefined) return '等待开始飞行';
  const safe = Math.max(0, Math.round(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  if (min <= 0) return `预计 ${sec} 秒到达`;
  return `预计 ${min} 分 ${sec} 秒到达`;
};

const formatRecordedAt = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(5, 19);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const progressOf = (value?: number) => {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
};

const orderAgeSeconds = (value?: string) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
};

export default function OrderLiveScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const orderId = Number(route?.params?.orderId || route?.params?.id || 0);
  const [order, setOrder] = useState<V2OrderDetail | null>(null);
  const [live, setLive] = useState<V2OrderLive | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [increasingPrice, setIncreasingPrice] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef('');
  const liveRef = useRef<V2OrderLive | null>(null);
  const focusedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const shouldStopPolling = useCallback((nextStatus?: string, nextLive?: V2OrderLive | null) => {
    const resolvedStatus = String(nextStatus || statusRef.current || '');
    const resolvedLive = nextLive === undefined ? liveRef.current : nextLive;
    if (TERMINAL_STATUSES.includes(resolvedStatus)) return true;
    return resolvedLive?.eta_seconds === 0 && progressOf(resolvedLive?.progress_pct) >= 100;
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
      liveRef.current = nextLive;
      setLive(nextLive);
      if (maybeStatus) {
        statusRef.current = maybeStatus;
        setStatus(maybeStatus);
      }
      if (shouldStopPolling(maybeStatus, nextLive)) stopPolling();
    } catch {
      // Keep the last successful snapshot; the next interval will retry.
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
      setErrorText('缺少订单信息，无法查看订单进度');
      stopPolling();
      return;
    }
    setLoading(true);
    setErrorText('');
    try {
      const res = await orderV2Service.get(orderId);
      const detail = normalizePayload<V2OrderDetail>(res);
      const nextStatus = String(detail?.status || '');
      const nextLive = detail?.live || null;
      setOrder(detail);
      setLive(nextLive);
      setStatus(nextStatus);
      statusRef.current = nextStatus;
      liveRef.current = nextLive;
      if (shouldStopPolling(nextStatus, nextLive)) {
        stopPolling();
      } else {
        startPolling();
      }
    } catch (error: any) {
      setErrorText(friendlyErrorMessage(error, '订单进度加载失败'));
    } finally {
      setLoading(false);
    }
  }, [orderId, shouldStopPolling, startPolling, stopPolling]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      loadInitial();
      return () => {
        focusedRef.current = false;
        stopPolling();
      };
    }, [loadInitial, stopPolling]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (!focusedRef.current) return;
      if (state === 'background' || state === 'inactive') {
        stopPolling();
      } else if (state === 'active') {
        if (order) startPolling();
        else loadInitial();
      }
    });
    return () => {
      sub.remove();
      stopPolling();
    };
  }, [loadInitial, order, startPolling, stopPolling]);

  const origin = useMemo(() => resolvePoint(order, 'origin'), [order]);
  const destination = useMemo(() => resolvePoint(order, 'destination'), [order]);
  const activeStep = statusStepOf(status);
  const progress = progressOf(live?.progress_pct);
  const pollingStopped = shouldStopPolling(status, live);
  const canSuggestPriceIncrease =
    !!order &&
    String((order as any).order_mode || '') === 'instant' &&
    status === 'pending_dispatch' &&
    orderAgeSeconds(order.created_at) >= 90;

  const increasePrice = useCallback((amount: number) => {
    if (increasingPrice) return;
    Alert.alert('确认加价', `加价 ¥${Math.round(amount / 100)} 后继续匹配服务商。`, [
      {text: '取消', style: 'cancel'},
      {
        text: '确认加价',
        onPress: async () => {
          setIncreasingPrice(true);
          try {
            await orderV2Service.increasePrice(orderId, {
              amount,
              reason: '附近运力紧张，客户主动加价',
              method: 'mock',
            });
            Alert.alert('已加价', '已继续匹配服务商');
            loadInitial();
          } catch (error: any) {
            Alert.alert('加价失败', friendlyErrorMessage(error, '加价失败'));
          } finally {
            setIncreasingPrice(false);
          }
        },
      },
    ]);
  }, [increasingPrice, loadInitial, orderId]);

  const openIncreaseSheet = useCallback(() => {
    Alert.alert('附近运力紧张', '适当加价可提升服务商接单速度', [
      {text: '加价 ¥20', onPress: () => increasePrice(2000)},
      {text: '加价 ¥50', onPress: () => increasePrice(5000)},
      {text: '加价 ¥100', onPress: () => increasePrice(10000)},
      {text: '取消', style: 'cancel'},
    ]);
  }, [increasePrice]);

  if (loading && !order) {
    return (
      <SafeAreaView style={[styles.container, styles.center, {backgroundColor: theme.bg}]}>
        <ActivityIndicator color={theme.primary} />
        <Text style={styles.stateText}>正在同步订单进度</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, styles.center, {backgroundColor: theme.bg}]}>
        <Text style={styles.emptyTitle}>无法查看订单进度</Text>
        <Text style={styles.emptyDesc}>{errorText || '订单不存在或当前账号无权查看。'}</Text>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.ghostBtnText}>返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View>
            <Text style={styles.statusTitle}>{statusTextOf(status)}</Text>
            <Text style={styles.orderNo}>{order.order_no}</Text>
          </View>
          <View style={[styles.pollBadge, pollingStopped ? styles.pollBadgeStopped : styles.pollBadgeActive]}>
            <Text style={[styles.pollBadgeText, pollingStopped ? styles.pollTextStopped : styles.pollTextActive]}>
              {pollingStopped ? '已停止刷新' : '自动刷新'}
            </Text>
          </View>
        </View>

        <View style={styles.routeCard}>
          <Text style={styles.cardTitle}>路线进度</Text>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, {backgroundColor: theme.success}]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>起点</Text>
              <Text style={styles.routeText}>{order.service_address || '起点待确认'}</Text>
              {origin ? <Text style={styles.coordinateText}>{origin.latitude}, {origin.longitude}</Text> : null}
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, {backgroundColor: theme.danger}]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>终点</Text>
              <Text style={styles.routeText}>{order.dest_address || '终点待确认'}</Text>
              {destination ? <Text style={styles.coordinateText}>{destination.latitude}, {destination.longitude}</Text> : null}
            </View>
          </View>
          {!destination ? <Text style={styles.routeHint}>终点信息缺失</Text> : null}
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.cardTitle}>订单阶段</Text>
          <View style={styles.steps}>
            {['已下单', '已接单', '准备中', '飞行中', '已送达'].map((label, index) => {
              const done = activeStep >= index + 1;
              return (
                <View style={styles.stepItem} key={label}>
                  <View style={[styles.stepDot, done && styles.stepDotActive]} />
                  <Text style={[styles.stepText, done && styles.stepTextActive]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {canSuggestPriceIncrease ? (
          <View style={styles.priceCard}>
            <View style={styles.priceTextWrap}>
              <Text style={styles.priceTitle}>附近运力紧张</Text>
              <Text style={styles.priceDesc}>适当加价可提升服务商接单速度</Text>
            </View>
            <TouchableOpacity
              style={[styles.priceButton, increasingPrice && styles.priceButtonDisabled]}
              disabled={increasingPrice}
              onPress={openIncreaseSheet}>
              <Text style={styles.priceButtonText}>{increasingPrice ? '处理中' : '加价试试'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>预计到达</Text>
            <Text style={styles.metricValue}>{formatEta(live?.eta_seconds)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>服务进度</Text>
            <Text style={styles.metricValue}>{progress}%</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${progress}%`}]} />
        </View>

        <View style={styles.liveCard}>
          <Text style={styles.cardTitle}>最新位置</Text>
          {live?.last_position ? (
            <>
              <Text style={styles.liveLine}>坐标：{live.last_position.latitude}, {live.last_position.longitude}</Text>
              <Text style={styles.liveLine}>高度：{live.last_position.altitude}m · 速度：{live.last_position.speed}m/s</Text>
              <Text style={styles.liveLine}>电量：{live.last_position.battery_level}% · 信号：{live.last_position.signal_strength}%</Text>
              <Text style={styles.liveTime}>更新时间：{formatRecordedAt(live.last_position.recorded_at)}</Text>
            </>
          ) : (
            <Text style={styles.liveLine}>设备端位置上报接入后，将在此显示服务实时轨迹。</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  stateText: {
    color: theme.textSub,
    fontSize: 14,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyDesc: {
    color: theme.textSub,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  hero: {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusTitle: {
    color: theme.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  orderNo: {
    marginTop: 6,
    color: theme.textSub,
    fontSize: 13,
    fontWeight: '600',
  },
  pollBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pollBadgeActive: {
    backgroundColor: theme.primaryBg,
  },
  pollBadgeStopped: {
    backgroundColor: theme.bgTertiary,
  },
  pollBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pollTextActive: {
    color: theme.primaryText,
  },
  pollTextStopped: {
    color: theme.textHint,
  },
  routeCard: {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 5,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    color: theme.textHint,
    fontSize: 12,
    fontWeight: '700',
  },
  routeText: {
    marginTop: 2,
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  coordinateText: {
    marginTop: 3,
    color: theme.textHint,
    fontSize: 12,
  },
  routeLine: {
    width: 1,
    height: 24,
    marginLeft: 5.5,
    marginVertical: 4,
    backgroundColor: theme.divider,
  },
  routeHint: {
    marginTop: 12,
    color: theme.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  stepCard: {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.divider,
  },
  stepDotActive: {
    backgroundColor: theme.primary,
  },
  stepText: {
    color: theme.textHint,
    fontSize: 12,
    fontWeight: '600',
  },
  stepTextActive: {
    color: theme.primaryText,
  },
  priceCard: {
    backgroundColor: theme.warning + '16',
    borderColor: theme.warning + '55',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceTextWrap: {
    flex: 1,
  },
  priceTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
  },
  priceDesc: {
    marginTop: 4,
    color: theme.textSub,
    fontSize: 13,
  },
  priceButton: {
    borderRadius: 12,
    backgroundColor: theme.warning,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  priceButtonDisabled: {
    opacity: 0.65,
  },
  priceButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
  },
  metric: {
    flex: 1,
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  metricLabel: {
    color: theme.textHint,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 8,
    color: theme.text,
    fontSize: 18,
    fontWeight: '900',
  },
  progressTrack: {
    height: 10,
    backgroundColor: theme.divider,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.primary,
  },
  liveCard: {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  liveLine: {
    color: theme.textSub,
    fontSize: 13,
    lineHeight: 20,
  },
  liveTime: {
    marginTop: 8,
    color: theme.textHint,
    fontSize: 12,
  },
  ghostBtn: {
    marginTop: 8,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: theme.primaryBg,
  },
  ghostBtnText: {
    color: theme.primaryText,
    fontWeight: '800',
  },
});
