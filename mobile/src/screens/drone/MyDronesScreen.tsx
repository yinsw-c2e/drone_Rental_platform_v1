import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {droneService} from '../../services/drone';
import {orderV2Service} from '../../services/orderV2';
import {Drone, V2OrderSummary} from '../../types';
import {getResponsiveTwoColumnLayout} from '../../utils/responsiveGrid';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const STATUS_GROUPS = [
  {key: 'all', label: '全部'},
  {key: 'available', label: '可用'},
  {key: 'rented', label: '忙碌'},
  {key: 'maintenance', label: '维护中'},
  {key: 'offline', label: '不可用'},
] as const;

const CHANGEABLE_STATUSES = [
  {key: 'available', label: '可用（可接单）'},
  {key: 'maintenance', label: '维护中'},
  {key: 'offline', label: '不可用（下线）'},
] as const;

const DRONE_PAGE_HELP =
  '这里可以查看每台无人机能不能接单、是否正在执行任务，以及运营资质、保险、适航证明等材料是否齐全。资质越完整，越方便上架服务、参与报价和承接订单。';

type StatusKey = (typeof STATUS_GROUPS)[number]['key'];

const statusMap: Record<string, {label: string; tone: 'green' | 'orange' | 'red' | 'gray' | 'blue'}> = {
  available: {label: '可用', tone: 'green'},
  rented: {label: '忙碌中', tone: 'orange'},
  maintenance: {label: '维护中', tone: 'red'},
  offline: {label: '不可用', tone: 'gray'},
};

const verifyTone = (status?: string): 'green' | 'orange' | 'red' | 'gray' => {
  if (status === 'approved' || status === 'verified') {
    return 'green';
  }
  if (status === 'pending') {
    return 'orange';
  }
  if (status === 'rejected') {
    return 'red';
  }
  return 'gray';
};

const verifyLabel = (status?: string, fallback = '未提交') => {
  if (status === 'approved' || status === 'verified') {
    return '已通过';
  }
  if (status === 'pending') {
    return '审核中';
  }
  if (status === 'rejected') {
    return '未通过';
  }
  return fallback;
};

const TERMINAL_ORDER_STATUSES = new Set([
  'completed',
  'cancelled',
  'refunded',
  'provider_rejected',
  'rejected',
]);

const getOrderDroneId = (order: V2OrderSummary) => Number(order.drone_id || order.drone?.id || 0);

const isDroneStillOccupiedByOrder = (order: V2OrderSummary) =>
  !TERMINAL_ORDER_STATUSES.has(String(order.status || '').toLowerCase());

export default function MyDronesScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {width: viewportWidth} = useWindowDimensions();
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGroup, setActiveGroup] = useState<StatusKey>('all');
  const summaryLayout = useMemo(
    () =>
      getResponsiveTwoColumnLayout({
        viewportWidth,
        totalHorizontalPadding: 68,
        gap: 10,
        minItemWidth: 118,
      }),
    [viewportWidth],
  );

  const handleChangeStatus = useCallback((drone: Drone) => {
    Alert.alert('更改状态', `当前：${statusMap[drone.availability_status || 'offline']?.label || '状态未知'}`, [
      ...CHANGEABLE_STATUSES.filter(s => s.key !== drone.availability_status).map(s => ({
        text: s.label,
        onPress: async () => {
          try {
            await droneService.updateAvailability(drone.id, s.key);
            setDrones(prev => prev.map(d => d.id === drone.id ? {...d, availability_status: s.key} : d));
          } catch (e: any) {
            Alert.alert('更改失败', e.message || '请稍后重试');
          }
        },
      })),
      {text: '取消', style: 'cancel'},
    ]);
  }, []);

  const showPageHelp = useCallback(() => {
    Alert.alert('我的无人机', DRONE_PAGE_HELP);
  }, []);

  const handleViewActiveOrder = useCallback(async (droneId: number) => {
    try {
      const res = await orderV2Service.list({role: 'owner', page: 1, page_size: 50});
      const list = res.data?.items || [];
      const matched = list
        .filter((order: V2OrderSummary) => getOrderDroneId(order) === droneId && isDroneStillOccupiedByOrder(order))
        .sort((left, right) => {
          const leftTime = new Date(left.updated_at || left.created_at).getTime();
          const rightTime = new Date(right.updated_at || right.created_at).getTime();
          return rightTime - leftTime;
        })[0];

      if (matched) {
        navigation.navigate('OrderDetail', {id: matched.id});
      } else {
        Alert.alert('未找到', '当前未找到该无人机的执行中订单，可能已完成或数据延迟。');
      }
    } catch (e: any) {
      Alert.alert('查询失败', e.message || '请稍后重试');
    }
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('AddDrone')} style={{paddingHorizontal: 16}}>
          <Text style={{fontSize: 26, color: theme.primaryText}}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme.primaryText]);

  const fetchDrones = useCallback(async () => {
    try {
      const res = await droneService.myDrones({page: 1, page_size: 50});
      setDrones(res.data?.list || []);
    } catch (e) {
      console.warn('获取无人机列表失败:', e);
      setDrones([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDrones();
  }, [fetchDrones]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDrones();
  }, [fetchDrones]);

  const filteredDrones = useMemo(
    () => drones.filter(item => activeGroup === 'all' || (item.availability_status || 'offline') === activeGroup),
    [activeGroup, drones],
  );

  const summary = useMemo(() => ({
    available: drones.filter(item => item.availability_status === 'available').length,
    active: drones.filter(item => item.certification_status === 'approved' || item.certification_status === 'verified').length,
    suppliesReady: drones.filter(item => item.uom_verified === 'approved' && item.insurance_verified === 'approved' && item.airworthiness_verified === 'approved').length,
  }), [drones]);

  const renderDrone = ({item}: {item: Drone}) => {
    const availability = statusMap[item.availability_status || 'offline'] || statusMap.offline;
    const mtow = item.mtow_kg || 0;
    const payload = item.max_payload_kg || item.max_load || 0;

    return (
      <ObjectCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.droneName}>{item.brand} {item.model}</Text>
            <Text style={styles.droneMeta}>SN: {item.serial_number || '-'}</Text>
          </View>
          <StatusBadge label={availability.label} tone={availability.tone} />
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricText}>起飞重量：{mtow}kg</Text>
          <Text style={styles.metricText}>最大吊重：{payload}kg</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricText}>城市：{item.city || '未设置'}</Text>
          <Text style={styles.metricText}>状态：{availability.label}</Text>
        </View>

        <View style={styles.badgeRow}>
          <StatusBadge label={`基础资质 ${verifyLabel(item.certification_status)}`} tone={verifyTone(item.certification_status)} />
          <StatusBadge label={`UOM ${verifyLabel(item.uom_verified)}`} tone={verifyTone(item.uom_verified)} />
          <StatusBadge label={`保险 ${verifyLabel(item.insurance_verified)}`} tone={verifyTone(item.insurance_verified)} />
          <StatusBadge label={`适航 ${verifyLabel(item.airworthiness_verified)}`} tone={verifyTone(item.airworthiness_verified)} />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('DroneDetail', {id: item.id})}>
            <Text style={styles.secondaryBtnText}>设备详情</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('EditDrone', {id: item.id})}>
            <Text style={styles.secondaryBtnText}>编辑信息</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('DroneCertification', {id: item.id})}>
            <Text style={styles.secondaryBtnText}>资质管理</Text>
          </TouchableOpacity>
          {item.availability_status === 'rented' ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.busyBtn]}
              onPress={() => handleViewActiveOrder(item.id)}>
              <Text style={styles.busyBtnText}>执行中订单</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.secondaryBtn, styles.statusBtn]} onPress={() => handleChangeStatus(item)}>
              <Text style={styles.statusBtnText}>更改状态</Text>
            </TouchableOpacity>
          )}
        </View>
      </ObjectCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={filteredDrones}
        keyExtractor={item => String(item.id)}
        renderItem={renderDrone}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <View style={styles.heroHeader}>
                <View style={styles.heroTitleWrap}>
                  <Text style={styles.heroEyebrow}>我的无人机</Text>
                  <Text style={styles.heroTitle}>管理设备与资质</Text>
                </View>
                <TouchableOpacity
                  style={styles.helpIcon}
                  activeOpacity={0.75}
                  onPress={showPageHelp}>
                  <Text style={styles.helpIconText}>?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.summaryRow}>
                <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
                  <Text style={styles.summaryValue}>{drones.length}</Text>
                  <Text style={styles.summaryLabel}>总设备</Text>
                </View>
                <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
                  <Text style={styles.summaryValue}>{summary.available}</Text>
                  <Text style={styles.summaryLabel}>可用</Text>
                </View>
                <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
                  <Text style={styles.summaryValue}>{summary.active}</Text>
                  <Text style={styles.summaryLabel}>资质通过</Text>
                </View>
                <View style={[styles.summaryItem, {width: summaryLayout.itemWidth}]}>
                  <Text style={styles.summaryValue}>{summary.suppliesReady}</Text>
                  <Text style={styles.summaryLabel}>可上架</Text>
                </View>
              </View>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>设备分组</Text>
              <View style={styles.filterRow}>
                {STATUS_GROUPS.map(group => (
                  <TouchableOpacity
                    key={group.key}
                    style={[styles.filterChip, activeGroup === group.key && styles.filterChipActive]}
                    onPress={() => setActiveGroup(group.key)}>
                    <Text style={[styles.filterChipText, activeGroup === group.key && styles.filterChipTextActive]}>
                      {group.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <ObjectCard>
              <EmptyState
                icon="🛩️"
                title={activeGroup === 'all' ? '还没有添加无人机' : '这个分组下暂无无人机'}
                actionText="添加无人机"
                onAction={() => navigation.navigate('AddDrone')}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  content: {padding: 14, paddingBottom: 28},
  hero: {backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary, borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: theme.isDark ? 1 : 0, borderColor: theme.isDark ? theme.primaryBorder : 'transparent'},
  heroHeader: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12},
  heroTitleWrap: {flex: 1},
  heroEyebrow: {fontSize: 12, color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)', fontWeight: '700'},
  heroTitle: {marginTop: 8, fontSize: 24, lineHeight: 30, color: theme.isDark ? theme.text : '#FFFFFF', fontWeight: '800'},
  helpIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.isDark ? theme.primaryBg : 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: theme.isDark ? theme.primaryBorder : 'rgba(255,255,255,0.28)',
  },
  helpIconText: {fontSize: 15, fontWeight: '800', color: theme.isDark ? theme.primaryText : '#FFFFFF'},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18},
  summaryItem: {
    minWidth: 68,
    backgroundColor: theme.isDark ? theme.primaryBg : 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryValue: {fontSize: 18, fontWeight: '800', color: theme.isDark ? theme.primary : '#FFFFFF'},
  summaryLabel: {marginTop: 4, fontSize: 12, textAlign: 'center', color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)'},
  filterCard: {marginBottom: 12},
  filterTitle: {fontSize: 14, color: theme.text, fontWeight: '700', marginBottom: 12},
  filterRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  filterChip: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.primaryBg},
  filterChipActive: {backgroundColor: theme.primaryBg},
  filterChipText: {fontSize: 13, fontWeight: '600', color: theme.textSub},
  filterChipTextActive: {color: theme.primaryText},
  card: {marginBottom: 12, gap: 12},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12},
  cardHeaderText: {flex: 1},
  droneName: {fontSize: 18, fontWeight: '800', color: theme.text},
  droneMeta: {marginTop: 4, fontSize: 12, color: theme.textSub},
  metricRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12},
  metricText: {flex: 1, fontSize: 13, color: theme.text},
  badgeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  footer: {flexDirection: 'row', gap: 10},
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    backgroundColor: theme.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryBtnText: {fontSize: 14, fontWeight: '700', color: theme.primaryText},
    statusBtn: {borderColor: theme.warning},
    statusBtnText: {fontSize: 14, fontWeight: '700', color: theme.warning},
    busyBtn: {borderColor: theme.primary},
    busyBtnText: {fontSize: 14, fontWeight: '700', color: theme.primaryText},
});
