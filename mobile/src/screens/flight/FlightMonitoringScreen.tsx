import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  getLatestPosition,
  getPositionHistory,
  getActiveAlerts,
  acknowledgeAlert,
  resolveAlert,
  simulateFlight,
  FlightPosition,
  FlightAlert,
} from '../../services/flight';

const ALERT_LEVEL_MAP: Record<string, {label: string; color: string; bg: string}> = {
  info: {label: '信息', color: '#1890ff', bg: '#e6f7ff'},
  warning: {label: '警告', color: '#faad14', bg: '#fffbe6'},
  danger: {label: '危险', color: '#ff4d4f', bg: '#fff2f0'},
  critical: {label: '严重', color: '#cf1322', bg: '#fff1f0'},
};

const ALERT_TYPE_MAP: Record<string, string> = {
  low_battery: '低电量',
  weak_signal: '信号弱',
  geofence_violation: '越界告警',
  altitude_warning: '高度告警',
  weather_warning: '天气告警',
  obstacle: '障碍物告警',
  system: '系统告警',
};

export default function FlightMonitoringScreen({route, navigation}: any) {
  const orderId = route?.params?.orderId;
  const [position, setPosition] = useState<FlightPosition | null>(null);
  const [alerts, setAlerts] = useState<FlightAlert[]>([]);
  const [positionHistory, setPositionHistory] = useState<FlightPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async () => {
    if (!orderId) return;
    try {
      const [pos, alertList, history] = await Promise.all([
        getLatestPosition(orderId).catch(() => null),
        getActiveAlerts(orderId).catch(() => []),
        getPositionHistory(orderId).catch(() => []),
      ]);
      if (pos) setPosition(pos);
      setAlerts(alertList || []);
      setPositionHistory((history || []).slice(-20));
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [orderId]),
  );

  // Auto refresh every 5 seconds when enabled
  useEffect(() => {
    if (autoRefresh && orderId) {
      timerRef.current = setInterval(loadData, 5000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, orderId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await acknowledgeAlert(alertId);
      loadData();
    } catch (e: any) {
      Alert.alert('操作失败', e.message);
    }
  };

  const handleResolve = async (alertId: number) => {
    Alert.alert('确认解决', '确定此告警已解决？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认',
        onPress: async () => {
          try {
            await resolveAlert(alertId);
            loadData();
          } catch (e: any) {
            Alert.alert('操作失败', e.message);
          }
        },
      },
    ]);
  };

  const handleSimulateFlight = async () => {
    if (!orderId) return;
    Alert.alert(
      '模拟飞行',
      '将导加模拟飞行数据，共 20 步，每 3 秒更新一次位置。\n注：订单必须处于“运输中”状态。',
      [
        {text: '取消', style: 'cancel'},
        {
          text: '开始模拟',
          onPress: async () => {
            try {
              setSimulating(true);
              const result = await simulateFlight(orderId);
              Alert.alert(
                '模拟已启动',
                result.message + '\n\n订单状态会在模拟完成后自动变为“已送达”',
              );
            } catch (e: any) {
              Alert.alert('模拟失败', e.message || '请确保订单处于运输中状态');
            } finally {
              setSimulating(false);
            }
          },
        },
      ],
    );
  };

  const getBatteryColor = (level: number): string => {
    if (level > 60) return '#52c41a';
    if (level > 30) return '#faad14';
    return '#ff4d4f';
  };

  const getSignalColor = (strength: number): string => {
    if (strength > 70) return '#52c41a';
    if (strength > 40) return '#faad14';
    return '#ff4d4f';
  };

  if (!orderId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>请从订单详情进入飞行监控</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* 自动刷新开关 */}
        <View style={styles.refreshBar}>
          <View style={styles.refreshIndicator}>
            <View style={[styles.liveDot, autoRefresh && styles.liveDotActive]} />
            <Text style={styles.refreshText}>
              {autoRefresh ? '实时监控中' : '已暂停'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshToggle, autoRefresh && styles.refreshToggleActive]}
            onPress={() => setAutoRefresh(!autoRefresh)}>
            <Text style={[styles.refreshToggleText, autoRefresh && styles.refreshToggleTextActive]}>
              {autoRefresh ? '暂停' : '开启'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 位置信息面板 */}
        <View style={styles.positionCard}>
          <Text style={styles.cardTitle}>当前位置</Text>
          {position ? (
            <>
              <View style={styles.coordRow}>
                <View style={styles.coordItem}>
                  <Text style={styles.coordLabel}>纬度</Text>
                  <Text style={styles.coordValue}>{position.latitude.toFixed(6)}</Text>
                </View>
                <View style={styles.coordItem}>
                  <Text style={styles.coordLabel}>经度</Text>
                  <Text style={styles.coordValue}>{position.longitude.toFixed(6)}</Text>
                </View>
                <View style={styles.coordItem}>
                  <Text style={styles.coordLabel}>高度</Text>
                  <Text style={styles.coordValue}>{position.altitude.toFixed(1)}m</Text>
                </View>
              </View>

              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>速度</Text>
                  <Text style={styles.telemetryValue}>
                    {position.speed?.toFixed(1) || '0'} m/s
                  </Text>
                </View>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>航向</Text>
                  <Text style={styles.telemetryValue}>
                    {position.heading?.toFixed(0) || '0'}°
                  </Text>
                </View>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>电池</Text>
                  <Text
                    style={[
                      styles.telemetryValue,
                      {color: getBatteryColor(position.battery_level || 0)},
                    ]}>
                    {position.battery_level || 0}%
                  </Text>
                </View>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>信号</Text>
                  <Text
                    style={[
                      styles.telemetryValue,
                      {color: getSignalColor(position.signal_strength || 0)},
                    ]}>
                    {position.signal_strength || 0}%
                  </Text>
                </View>
              </View>

              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>温度</Text>
                  <Text style={styles.envValue}>
                    {position.temperature != null ? `${position.temperature}°C` : '-'}
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>风速</Text>
                  <Text style={styles.envValue}>
                    {position.wind_speed != null ? `${position.wind_speed} m/s` : '-'}
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>更新时间</Text>
                  <Text style={styles.envValue}>
                    {position.recorded_at
                      ? new Date(position.recorded_at).toLocaleTimeString()
                      : '-'}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.noDataText}>暂无位置数据</Text>
          )}
        </View>

        {/* 告警列表 */}
        <View style={styles.alertsCard}>
          <View style={styles.alertsHeader}>
            <Text style={styles.cardTitle}>活跃告警</Text>
            {alerts.length > 0 && (
              <View style={styles.alertCountBadge}>
                <Text style={styles.alertCountText}>{alerts.length}</Text>
              </View>
            )}
          </View>
          {alerts.length === 0 ? (
            <View style={styles.noAlertContainer}>
              <Text style={styles.noAlertText}>当前无活跃告警</Text>
            </View>
          ) : (
            alerts.map(alert => {
              const level = ALERT_LEVEL_MAP[alert.alert_level] || ALERT_LEVEL_MAP.info;
              return (
                <View
                  key={alert.id}
                  style={[styles.alertItem, {backgroundColor: level.bg}]}>
                  <View style={styles.alertHeader}>
                    <View style={styles.alertTitleRow}>
                      <View style={[styles.alertLevelBadge, {backgroundColor: level.color}]}>
                        <Text style={styles.alertLevelText}>{level.label}</Text>
                      </View>
                      <Text style={styles.alertTitle}>
                        {ALERT_TYPE_MAP[alert.alert_type] || alert.alert_type}
                      </Text>
                    </View>
                    <Text style={styles.alertTime}>
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  {alert.latitude > 0 && (
                    <Text style={styles.alertLocation}>
                      位置: {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                      {alert.altitude > 0 ? ` 高度${alert.altitude.toFixed(0)}m` : ''}
                    </Text>
                  )}
                  <View style={styles.alertActions}>
                    {!alert.is_acknowledged && (
                      <TouchableOpacity
                        style={styles.ackBtn}
                        onPress={() => handleAcknowledge(alert.id)}>
                        <Text style={styles.ackBtnText}>确认收到</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => handleResolve(alert.id)}>
                      <Text style={styles.resolveBtnText}>标记解决</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 位置历史轨迹点 */}
        {positionHistory.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.cardTitle}>近期轨迹点</Text>
            {positionHistory.slice(-10).reverse().map((pos, index) => (
              <View key={pos.id || index} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyCoord}>
                    {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)} | 高度{pos.altitude.toFixed(0)}m
                  </Text>
                  <Text style={styles.historyMeta}>
                    速度 {pos.speed?.toFixed(1) || '0'}m/s | 电量 {pos.battery_level || 0}%
                  </Text>
                  <Text style={styles.historyTime}>
                    {pos.recorded_at ? new Date(pos.recorded_at).toLocaleTimeString() : '-'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 底部操作 */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('TrajectoryRecord', {orderId})}>
            <Text style={styles.actionBtnText}>轨迹记录</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => navigation.navigate('MultiPointTask', {orderId})}>
            <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>多点任务</Text>
          </TouchableOpacity>
        </View>

        {/* 开发模拟按钮（仅__DEV__环境显示） */}
        {__DEV__ && (
          <View style={styles.devSimulateSection}>
            <Text style={styles.devSectionTitle}>🛠 开发工具</Text>
            <TouchableOpacity
              style={[styles.simulateBtn, simulating && styles.simulateBtnDisabled]}
              onPress={handleSimulateFlight}
              disabled={simulating}>
              <Text style={styles.simulateBtnText}>
                {simulating ? '模拟飞行启动中...' : '🚀 模拟飞行（取货点→送货点）'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.devHint}>共 20 步 · 每 3 秒更新 · 完成后订单自动变为“已送达”</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {fontSize: 16, color: '#666'},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
  emptyText: {fontSize: 16, color: '#666'},
  refreshBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  refreshIndicator: {flexDirection: 'row', alignItems: 'center'},
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#ccc', marginRight: 8,
  },
  liveDotActive: {backgroundColor: '#52c41a'},
  refreshText: {fontSize: 14, color: '#666'},
  refreshToggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  refreshToggleActive: {borderColor: '#ff4d4f', backgroundColor: '#fff2f0'},
  refreshToggleText: {fontSize: 13, color: '#666'},
  refreshToggleTextActive: {color: '#ff4d4f'},
  positionCard: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16,
  },
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 14},
  coordRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16},
  coordItem: {alignItems: 'center', flex: 1},
  coordLabel: {fontSize: 12, color: '#999', marginBottom: 4},
  coordValue: {fontSize: 16, fontWeight: '600', color: '#333'},
  telemetryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1,
    borderTopColor: '#f0f0f0', paddingTop: 14,
  },
  telemetryItem: {width: '25%', alignItems: 'center', paddingVertical: 8},
  telemetryLabel: {fontSize: 12, color: '#999', marginBottom: 4},
  telemetryValue: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  envRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0',
    paddingTop: 12, marginTop: 4,
  },
  envItem: {flex: 1, alignItems: 'center'},
  envLabel: {fontSize: 12, color: '#999', marginBottom: 4},
  envValue: {fontSize: 14, color: '#333'},
  noDataText: {fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20},
  alertsCard: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16,
  },
  alertsHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  alertCountBadge: {
    backgroundColor: '#ff4d4f', borderRadius: 10, minWidth: 20,
    height: 20, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6, marginLeft: 8,
  },
  alertCountText: {color: '#fff', fontSize: 12, fontWeight: 'bold'},
  noAlertContainer: {paddingVertical: 16, alignItems: 'center'},
  noAlertText: {fontSize: 14, color: '#52c41a'},
  alertItem: {borderRadius: 8, padding: 12, marginBottom: 10},
  alertHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  alertTitleRow: {flexDirection: 'row', alignItems: 'center'},
  alertLevelBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 8,
  },
  alertLevelText: {color: '#fff', fontSize: 11, fontWeight: '600'},
  alertTitle: {fontSize: 14, fontWeight: '600', color: '#333'},
  alertTime: {fontSize: 12, color: '#999'},
  alertMessage: {fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 6},
  alertLocation: {fontSize: 12, color: '#999', marginBottom: 8},
  alertActions: {flexDirection: 'row', gap: 10},
  ackBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4,
    borderWidth: 1, borderColor: '#1890ff',
  },
  ackBtnText: {fontSize: 13, color: '#1890ff'},
  resolveBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4,
    backgroundColor: '#52c41a',
  },
  resolveBtnText: {fontSize: 13, color: '#fff'},
  historyCard: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16,
  },
  historyItem: {flexDirection: 'row', marginBottom: 12},
  historyDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#1890ff',
    marginTop: 6, marginRight: 12,
  },
  historyContent: {flex: 1},
  historyCoord: {fontSize: 13, color: '#333', fontWeight: '500'},
  historyMeta: {fontSize: 12, color: '#666', marginTop: 2},
  historyTime: {fontSize: 11, color: '#999', marginTop: 2},
  bottomActions: {
    flexDirection: 'row', gap: 12, margin: 16, marginBottom: 24,
  },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    backgroundColor: '#1890ff', alignItems: 'center',
  },
  actionBtnSecondary: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#1890ff'},
  actionBtnText: {fontSize: 16, color: '#fff', fontWeight: '600'},
  actionBtnTextSecondary: {color: '#1890ff'},
  // 开发模拟区域
  devSimulateSection: {
    margin: 16,
    marginBottom: 24,
    backgroundColor: '#fffbe6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  devSectionTitle: {fontSize: 13, color: '#ad6800', fontWeight: '600', marginBottom: 10},
  simulateBtn: {
    backgroundColor: '#fa8c16',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  simulateBtnDisabled: {backgroundColor: '#ffd591'},
  simulateBtnText: {fontSize: 15, color: '#fff', fontWeight: '600'},
  devHint: {fontSize: 12, color: '#ad6800', marginTop: 8, textAlign: 'center'},
});
