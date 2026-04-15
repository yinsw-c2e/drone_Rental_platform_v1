import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import { getObjectStatusMeta } from '../../components/business/visuals';
import { dispatchV2Service } from '../../services/dispatchV2';
import { orderV2Service } from '../../services/orderV2';
import {
  V2DispatchTaskSummary,
  V2FlightAlertSummary,
  V2FlightPositionSummary,
  V2OrderMonitor,
  V2OrderTimelineItem,
} from '../../types';
import { getResponsiveTwoColumnLayout } from '../../utils/responsiveGrid';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/index';

const ALERT_LEVEL_META: Record<
  string,
  { label: string; colorKey: 'info' | 'warning' | 'danger' }
> = {
  info: { label: '信息', colorKey: 'info' },
  warning: { label: '警告', colorKey: 'warning' },
  danger: { label: '危险', colorKey: 'danger' },
  critical: { label: '严重', colorKey: 'danger' },
};

const ACTIVE_EXECUTION_STATUSES = [
  'assigned',
  'confirmed',
  'airspace_applying',
  'airspace_approved',
  'loading',
  'in_transit',
  'delivered',
  'completed',
];

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

const formatDuration = (seconds?: number) => {
  const value = Number(seconds || 0);
  if (value <= 0) {
    return '-';
  }
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${value % 60}s`;
};

const formatDistance = (meters?: number) => {
  const value = Number(meters || 0);
  if (value <= 0) {
    return '-';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }
  return `${value.toFixed(0)} m`;
};

const formatSpeed = (speed?: number) => {
  const value = Number(speed || 0);
  if (value <= 0) {
    return '-';
  }
  return `${value.toFixed(1)} m/s`;
};

function DetailRow({ label, value }: { label: string; value?: string }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '-'}</Text>
    </View>
  );
}

function DispatchSection({ task }: { task?: V2DispatchTaskSummary | null }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  if (!task) {
    return (
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>当前没有在途正式派单</Text>
        <Text style={styles.noticeDesc}>
          如果订单需要调度执行方，后续生成的新正式派单会在这里同步展示。
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.noticeBox}>
      <View style={styles.dispatchTopRow}>
        <Text style={styles.noticeTitle}>{task.dispatch_no}</Text>
        <StatusBadge
          label=""
          meta={getObjectStatusMeta('dispatch_task', task.status)}
        />
      </View>
      <Text style={styles.noticeDesc}>
        派单来源：{task.dispatch_source || '-'}
      </Text>
      <Text style={styles.noticeDesc}>
        目标飞手：
        {task.target_pilot?.nickname ||
          (task.target_pilot?.user_id
            ? `飞手 #${task.target_pilot.user_id}`
            : '待确认')}
      </Text>
      <Text style={styles.noticeDesc}>
        发出时间：{formatDateTime(task.sent_at)}
      </Text>
    </View>
  );
}

function AlertSection({ alerts }: { alerts?: V2FlightAlertSummary[] }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  if (!alerts || alerts.length === 0) {
    return <Text style={styles.emptyHint}>当前没有活跃告警。</Text>;
  }

  return (
    <>
      {alerts.map(alert => {
        const meta =
          ALERT_LEVEL_META[String(alert.alert_level || '').toLowerCase()] ||
          ALERT_LEVEL_META.info;
        return (
          <View
            key={alert.id}
            style={[
              styles.alertItem,
              {
                backgroundColor: theme[meta.colorKey] + '22',
                borderColor: theme[meta.colorKey],
              },
            ]}
          >
            <View style={styles.alertHeader}>
              <Text
                style={[styles.alertLevel, { color: theme[meta.colorKey] }]}
              >
                {meta.label}
              </Text>
              <Text style={styles.alertTime}>
                {formatDateTime(alert.triggered_at)}
              </Text>
            </View>
            <Text style={styles.alertTitle}>
              {alert.title || alert.alert_type || '告警'}
            </Text>
            <Text style={styles.alertDesc}>
              {alert.description || '当前存在需要关注的监控异常。'}
            </Text>
          </View>
        );
      })}
    </>
  );
}

function PositionSection({
  position,
  metricItemWidth,
}: {
  position?: V2FlightPositionSummary | null;
  metricItemWidth: number;
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  if (!position) {
    return (
      <Text style={styles.emptyHint}>
        当前还没有位置上报数据。测试环境下，可先到飞手执行工作台启动一段测试飞行。
      </Text>
    );
  }

  return (
    <>
      <View style={styles.coordRow}>
        <View style={styles.coordItem}>
          <Text style={styles.coordLabel}>纬度</Text>
          <Text style={styles.coordValue}>
            {Number(position.latitude || 0).toFixed(6)}
          </Text>
        </View>
        <View style={styles.coordItem}>
          <Text style={styles.coordLabel}>经度</Text>
          <Text style={styles.coordValue}>
            {Number(position.longitude || 0).toFixed(6)}
          </Text>
        </View>
        <View style={styles.coordItem}>
          <Text style={styles.coordLabel}>高度</Text>
          <Text style={styles.coordValue}>
            {Number(position.altitude || 0).toFixed(1)}m
          </Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={[styles.metricItem, { width: metricItemWidth }]}>
          <Text style={styles.metricLabel}>速度</Text>
          <Text style={styles.metricValue}>{formatSpeed(position.speed)}</Text>
        </View>
        <View style={[styles.metricItem, { width: metricItemWidth }]}>
          <Text style={styles.metricLabel}>航向</Text>
          <Text style={styles.metricValue}>
            {position.heading != null
              ? `${Number(position.heading).toFixed(0)}°`
              : '-'}
          </Text>
        </View>
        <View style={[styles.metricItem, { width: metricItemWidth }]}>
          <Text style={styles.metricLabel}>电池</Text>
          <Text style={styles.metricValue}>
            {position.battery_level != null
              ? `${position.battery_level}%`
              : '-'}
          </Text>
        </View>
        <View style={[styles.metricItem, { width: metricItemWidth }]}>
          <Text style={styles.metricLabel}>信号</Text>
          <Text style={styles.metricValue}>
            {position.signal_strength != null
              ? `${position.signal_strength}%`
              : '-'}
          </Text>
        </View>
      </View>

      <Text style={styles.latestTime}>
        最近上报：{formatDateTime(position.recorded_at)}
      </Text>
    </>
  );
}

function TimelineSection({ items }: { items?: V2OrderTimelineItem[] }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  if (!items || items.length === 0) {
    return <Text style={styles.emptyHint}>当前还没有可展示的进度时间线。</Text>;
  }

  return (
    <>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <View key={`${item.id}-${index}`} style={styles.timelineItem}>
            <View style={styles.timelineAxis}>
              <View style={styles.timelineDot} />
              {!isLast ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>
                {item.note || getObjectStatusMeta('order', item.status).label}
              </Text>
              <Text style={styles.timelineMeta}>
                {formatDateTime(item.created_at)}
                {item.operator_type ? ` · ${item.operator_type}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

export default function FlightMonitoringScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { width: viewportWidth } = useWindowDimensions();
  const initialOrderId = Number(route?.params?.orderId || 0);
  const dispatchId = Number(route?.params?.dispatchId || 0);
  const [resolvedOrderId, setResolvedOrderId] =
    useState<number>(initialOrderId);
  const [monitor, setMonitor] = useState<V2OrderMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resolveOrderId = useCallback(async () => {
    if (initialOrderId > 0) {
      setResolvedOrderId(initialOrderId);
      return initialOrderId;
    }
    if (dispatchId > 0) {
      const res = await dispatchV2Service.get(dispatchId);
      const orderId = Number(
        res.data?.order?.id ||
          res.data?.dispatch_task?.order?.id ||
          res.data?.dispatch_task?.order_id ||
          0,
      );
      setResolvedOrderId(orderId);
      return orderId;
    }
    setResolvedOrderId(0);
    return 0;
  }, [dispatchId, initialOrderId]);

  const loadData = useCallback(async () => {
    try {
      const orderId = await resolveOrderId();
      if (!orderId) {
        setMonitor(null);
        return;
      }
      const res = await orderV2Service.getMonitor(orderId);
      setMonitor(res.data || null);
    } catch (error) {
      console.error('获取飞行监控数据失败:', error);
      setMonitor(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveOrderId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      loadData();
    }, 5000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, loadData]);

  const order = monitor?.order;
  const latestPosition = monitor?.latest_position;
  const currentDispatch = monitor?.current_dispatch;
  const stats = monitor?.flight_stats;
  const flightStartTime =
    stats?.flight_start_time ||
    monitor?.active_flight_record?.takeoff_at ||
    monitor?.latest_flight_record?.takeoff_at ||
    null;
  const flightEndTime =
    stats?.flight_end_time ||
    monitor?.active_flight_record?.landing_at ||
    monitor?.latest_flight_record?.landing_at ||
    null;
  const flightDuration =
    stats?.actual_flight_duration != null
      ? stats.actual_flight_duration
      : (stats as any)?.flight_duration;
  const flightDistance =
    stats?.actual_flight_distance != null
      ? stats.actual_flight_distance
      : (stats as any)?.flight_distance;
  const averageSpeed =
    stats?.avg_speed != null
      ? stats.avg_speed
      : flightDuration && flightDistance
      ? Number(flightDistance) / Number(flightDuration)
      : undefined;
  const activeStatus = String(order?.status || '').toLowerCase();
  const canOpenTrajectory = Boolean(resolvedOrderId > 0);
  const canOpenDispatchDetail = Boolean(currentDispatch?.id);
  const orderStatusLabel = getObjectStatusMeta('order', order?.status).label;
  const isActiveExecution = ACTIVE_EXECUTION_STATUSES.includes(activeStatus);

  const recentPositionCount = useMemo(
    () => monitor?.recent_positions?.length || 0,
    [monitor?.recent_positions],
  );
  const recentFlightCount = useMemo(
    () => monitor?.flight_records?.length || 0,
    [monitor?.flight_records],
  );
  const metricLayout = useMemo(
    () =>
      getResponsiveTwoColumnLayout({
        viewportWidth,
        totalHorizontalPadding: 60,
        gap: 10,
        minItemWidth: 118,
      }),
    [viewportWidth],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!resolvedOrderId || !order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>
            请从订单详情或正式派单详情进入飞行监控。
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTagRow}>
              <SourceTag
                source={
                  order.order_source === 'supply_direct' ? 'supply' : 'order'
                }
              />
              <StatusBadge
                label=""
                meta={getObjectStatusMeta('order', order.status)}
              />
            </View>
            <Text style={styles.heroOrderNo}>{order.order_no}</Text>
          </View>
          <Text style={styles.heroTitle}>{order.title || '飞行监控'}</Text>
          <Text style={styles.heroRoute}>
            {order.service_address || '未设置起点'}
            {order.dest_address ? ` -> ${order.dest_address}` : ''}
          </Text>
          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={[styles.liveChip, autoRefresh && styles.liveChipActive]}
              onPress={() => setAutoRefresh(value => !value)}
            >
              <Text
                style={[
                  styles.liveChipText,
                  autoRefresh && styles.liveChipTextActive,
                ]}
              >
                {autoRefresh ? '数据同步中' : '已暂停自动同步'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                navigation.navigate('OrderDetail', {
                  id: order.id,
                  orderId: order.id,
                })
              }
            >
              <Text style={styles.secondaryBtnText}>查看订单</Text>
            </TouchableOpacity>
            {canOpenDispatchDetail ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() =>
                  navigation.navigate('DispatchTaskDetail', {
                    id: currentDispatch?.id,
                    dispatchId: currentDispatch?.id,
                  })
                }
              >
                <Text style={styles.secondaryBtnText}>查看派单</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>飞行概览</Text>
          <DetailRow label="订单状态" value={orderStatusLabel} />
          <DetailRow
            label="执行状态"
            value={
              isActiveExecution ? '处于履约监控窗口' : '当前不在活跃履约窗口'
            }
          />
          <DetailRow label="飞行开始" value={formatDateTime(flightStartTime)} />
          <DetailRow label="最近落地" value={formatDateTime(flightEndTime)} />
          <DetailRow label="累计时长" value={formatDuration(flightDuration)} />
          <DetailRow label="累计距离" value={formatDistance(flightDistance)} />
          <DetailRow
            label="最高高度"
            value={stats?.max_altitude != null ? `${stats.max_altitude}m` : '-'}
          />
          <DetailRow
            label="平均速度"
            value={
              averageSpeed != null
                ? `${Number(averageSpeed).toFixed(1)} m/s`
                : '-'
            }
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>当前正式派单</Text>
          <DispatchSection task={currentDispatch} />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>最新位置</Text>
          <PositionSection
            position={latestPosition}
            metricItemWidth={metricLayout.itemWidth}
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>告警与风险</Text>
          <AlertSection alerts={monitor?.active_alerts} />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>飞行留痕</Text>
          <DetailRow label="飞行记录数" value={String(recentFlightCount)} />
          <DetailRow label="最近轨迹点" value={String(recentPositionCount)} />
          <DetailRow
            label="当前飞行记录"
            value={
              monitor?.active_flight_record?.flight_no ||
              monitor?.latest_flight_record?.flight_no ||
              '-'
            }
          />
          {canOpenTrajectory ? (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() =>
                navigation.navigate('TrajectoryRecord', {
                  orderId: resolvedOrderId,
                  dispatchId,
                })
              }
            >
              <Text style={styles.linkButtonText}>查看轨迹记录</Text>
            </TouchableOpacity>
          ) : null}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>执行时间线</Text>
          <TimelineSection items={monitor?.timeline} />
        </ObjectCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgSecondary,
    },
    centerState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.textSub,
      textAlign: 'center',
    },
    content: {
      padding: 14,
      paddingBottom: 28,
    },
    hero: {
      backgroundColor: theme.primary,
      borderRadius: 24,
      padding: 20,
      marginBottom: 12,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroOrderNo: {
      fontSize: 12,
      color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)',
      fontWeight: '600',
    },
    heroTitle: {
      marginTop: 14,
      fontSize: 24,
      lineHeight: 30,
      color: theme.btnPrimaryText,
      fontWeight: '800',
    },
    heroRoute: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
    },
    heroActionRow: {
      marginTop: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    liveChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    liveChipActive: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderColor: 'rgba(255,255,255,0.4)',
    },
    liveChipText: {
      fontSize: 12,
      color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)',
      fontWeight: '700',
    },
    liveChipTextActive: {
      color: theme.btnPrimaryText,
    },
    secondaryBtn: {
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    secondaryBtnText: {
      fontSize: 12,
      color: theme.btnPrimaryText,
      fontWeight: '700',
    },
    sectionCard: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      color: theme.text,
      fontWeight: '800',
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    rowLabel: {
      width: 92,
      fontSize: 13,
      color: theme.textSub,
    },
    rowValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: 14,
      lineHeight: 20,
      color: theme.text,
      fontWeight: '600',
    },
    noticeBox: {
      borderRadius: 16,
      backgroundColor: theme.bgSecondary,
      padding: 12,
    },
    dispatchTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    noticeTitle: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '800',
    },
    noticeDesc: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
    },
    emptyHint: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.textSub,
    },
    coordRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    coordItem: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: theme.bgSecondary,
      padding: 12,
    },
    coordLabel: {
      fontSize: 12,
      color: theme.textSub,
    },
    coordValue: {
      marginTop: 6,
      fontSize: 14,
      color: theme.text,
      fontWeight: '800',
    },
    metricGrid: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricItem: {
      borderRadius: 16,
      backgroundColor: theme.bgSecondary,
      padding: 12,
    },
    metricLabel: {
      fontSize: 12,
      color: theme.textSub,
    },
    metricValue: {
      marginTop: 6,
      fontSize: 14,
      color: theme.text,
      fontWeight: '800',
    },
    latestTime: {
      marginTop: 10,
      fontSize: 12,
      color: theme.textSub,
    },
    alertItem: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      marginBottom: 10,
    },
    alertHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    alertLevel: {
      fontSize: 12,
      fontWeight: '800',
    },
    alertTime: {
      fontSize: 11,
      color: theme.textSub,
    },
    alertTitle: {
      marginTop: 8,
      fontSize: 14,
      color: theme.text,
      fontWeight: '800',
    },
    alertDesc: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
    },
    linkButton: {
      marginTop: 14,
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: theme.primaryBg,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    linkButtonText: {
      fontSize: 12,
      color: theme.primaryText,
      fontWeight: '700',
    },
    timelineItem: {
      flexDirection: 'row',
      minHeight: 56,
    },
    timelineAxis: {
      width: 20,
      alignItems: 'center',
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primary,
      marginTop: 4,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: theme.divider,
      marginTop: 4,
    },
    timelineContent: {
      flex: 1,
      paddingLeft: 10,
      paddingBottom: 16,
    },
    timelineTitle: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '700',
    },
    timelineMeta: {
      marginTop: 4,
      fontSize: 12,
      color: theme.textSub,
    },
  });
