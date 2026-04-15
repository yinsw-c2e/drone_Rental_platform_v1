import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {orderV2Service} from '../../services/orderV2';
import {RootState} from '../../store/store';
import {RoleSummary, V2OrderSummary} from '../../types';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type RoleFilter = 'all' | 'client' | 'owner' | 'pilot';
type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed';

type OrderListItem = {
  order: V2OrderSummary;
  roles: RoleFilter[];
};

const STATUS_TABS: {key: StatusFilter; label: string}[] = [
  {key: 'all', label: '全部'},
  {key: 'pending', label: '待处理'},
  {key: 'in_progress', label: '进行中'},
  {key: 'completed', label: '已完成'},
];

const roleLabelMap: Record<Exclude<RoleFilter, 'all'>, string> = {
  client: '业主订单',
  owner: '机主订单',
  pilot: '飞手执行',
};

const formatAmount = (amount?: number | null) => `¥${((amount || 0) / 100).toFixed(2)}`;

const formatDateRange = (start?: string, end?: string) => {
  if (!start && !end) {
    return '未设置执行时间';
  }
  const values = [start, end]
    .filter(Boolean)
    .map(value => {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hour}:${minute}`;
    });
  return values.join(' - ');
};

const getStatusBucket = (status?: string): StatusFilter => {
  const normalized = String(status || '').toLowerCase();
  if (
    [
      'pending_provider_confirmation',
      'pending_payment',
      'pending_dispatch',
      'created',
      'accepted',
      'paid',
    ].includes(normalized)
  ) {
    return 'pending';
  }
  if (
    [
      'assigned',
      'confirmed',
      'preparing',
      'airspace_applying',
      'airspace_approved',
      'loading',
      'in_transit',
      'delivered',
    ].includes(normalized)
  ) {
    return 'in_progress';
  }
  return 'completed';
};

const buildRoleTabs = (summary: RoleSummary): {key: RoleFilter; label: string}[] => {
  const tabs: {key: RoleFilter; label: string}[] = [{key: 'all', label: '全部'}];
  if (summary.has_client_role) {
    tabs.push({key: 'client', label: roleLabelMap.client});
  }
  if (summary.has_owner_role) {
    tabs.push({key: 'owner', label: roleLabelMap.owner});
  }
  if (summary.has_pilot_role) {
    tabs.push({key: 'pilot', label: roleLabelMap.pilot});
  }
  return tabs;
};

const getRouteRoleFilter = (value: any): RoleFilter => {
  const key = String(value || 'all') as RoleFilter;
  if (key === 'client' || key === 'owner' || key === 'pilot' || key === 'all') {
    return key;
  }
  return 'all';
};

const getRouteStatusFilter = (value: any): StatusFilter => {
  const key = String(value || 'all') as StatusFilter;
  if (key === 'pending' || key === 'in_progress' || key === 'completed' || key === 'all') {
    return key;
  }
  return 'all';
};

const getExactStatusLabel = (status?: string) => {
  if (!status) {
    return '';
  }
  return getObjectStatusMeta('order', status).label;
};

const getOrderProgressHint = (order: V2OrderSummary) => {
  switch (String(order.status || '').toLowerCase()) {
    case 'pending_provider_confirmation':
      return '等待机主确认，通常 2 小时内回复';
    case 'pending_payment':
      return '完成支付后才会继续安排执行';
    case 'pending_dispatch':
      return '平台正在安排执行团队';
    case 'assigned':
      return '执行团队已就位，待进入准备阶段';
    case 'preparing':
    case 'loading':
    case 'airspace_applying':
    case 'airspace_approved':
      return '现场准备中，稍后会继续推进飞行';
    case 'in_transit':
      return '运输执行中，请留意飞行与送达更新';
    case 'delivered':
      return '等待签收确认';
    case 'cancelled':
      return '订单已取消，如有支付会继续显示退款进度';
    case 'completed':
      return '本单已完成';
    default:
      return '订单正在推进中';
  }
};

export default function OrderListScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const currentUserId = Number(user?.id || 0);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary, user), [roleSummary, user]);

  const roleTabs = useMemo(() => buildRoleTabs(effectiveRoleSummary), [effectiveRoleSummary]);
  const [activeRole, setActiveRole] = useState<RoleFilter>(getRouteRoleFilter(route?.params?.roleFilter));
  const [activeStatus, setActiveStatus] = useState<StatusFilter>(getRouteStatusFilter(route?.params?.statusFilter));
  const [exactStatusFilter, setExactStatusFilter] = useState<string>(String(route?.params?.serverStatus || ''));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<OrderListItem[]>([]);

  useEffect(() => {
    const nextRole = getRouteRoleFilter(route?.params?.roleFilter);
    const nextStatus = getRouteStatusFilter(route?.params?.statusFilter);
    const nextExactStatus = String(route?.params?.serverStatus || '');
    setActiveRole(nextRole);
    setActiveStatus(nextStatus);
    setExactStatusFilter(nextExactStatus);
  }, [route?.params?.roleFilter, route?.params?.serverStatus, route?.params?.statusFilter]);

  useEffect(() => {
    if (roleTabs.some(tab => tab.key === activeRole)) {
      return;
    }
    setActiveRole(roleTabs[0]?.key || 'all');
  }, [activeRole, roleTabs]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const rolesToLoad: Array<Exclude<RoleFilter, 'all'>> =
        activeRole === 'all'
          ? roleTabs.filter(tab => tab.key !== 'all').map(tab => tab.key as Exclude<RoleFilter, 'all'>)
          : [activeRole as Exclude<RoleFilter, 'all'>];

      const responses = await Promise.all(
        rolesToLoad.map(async role => {
          const res = await orderV2Service.list({
            role,
            status: exactStatusFilter || undefined,
            page: 1,
            page_size: 100,
          });
          return {role, orders: res.data?.items || []};
        }),
      );

      const merged = new Map<number, OrderListItem>();
      responses.forEach(({role, orders}) => {
        orders.forEach(order => {
          const existing = merged.get(order.id);
          if (!existing) {
            merged.set(order.id, {order, roles: [role]});
            return;
          }
          const nextRoles = existing.roles.includes(role) ? existing.roles : [...existing.roles, role];
          const betterOrder = new Date(order.updated_at || order.created_at).getTime() >= new Date(existing.order.updated_at || existing.order.created_at).getTime()
            ? order
            : existing.order;
          merged.set(order.id, {order: betterOrder, roles: nextRoles});
        });
      });

      const list = Array.from(merged.values()).sort(
        (a, b) => new Date(b.order.updated_at || b.order.created_at).getTime() - new Date(a.order.updated_at || a.order.created_at).getTime(),
      );
      setItems(list);
    } catch (error) {
      console.warn('获取订单列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRole, exactStatusFilter, roleTabs]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const filteredItems = useMemo(
    () => items.filter(item => activeStatus === 'all' || getStatusBucket(item.order.status) === activeStatus),
    [activeStatus, items],
  );

  const renderItem = ({item}: {item: OrderListItem}) => {
    const sourceKind = item.order.order_source === 'supply_direct' ? 'supply' : 'demand';
    const isCancelled = String(item.order.status || '').toLowerCase() === 'cancelled';
    const progressHint = getOrderProgressHint(item.order);
    const isPilotOrder = item.roles.includes('pilot');
    const hasDispatchTask = Number(item.order.dispatch_task_id || 0) > 0;
    const canPilotExecute =
      isPilotOrder &&
      hasDispatchTask &&
      currentUserId > 0 &&
      currentUserId === Number(item.order.executor_pilot_user_id || 0) &&
      !['cancelled', 'completed'].includes(String(item.order.status || '').toLowerCase());

    const openPrimaryEntry = () => {
      if (canPilotExecute) {
        navigation.navigate('PilotOrderExecution', {taskId: item.order.dispatch_task_id});
        return;
      }
      if (isPilotOrder && hasDispatchTask) {
        navigation.navigate('DispatchTaskDetail', {
          id: item.order.dispatch_task_id,
          dispatchId: item.order.dispatch_task_id,
        });
        return;
      }
      navigation.navigate('OrderDetail', {orderId: item.order.id, id: item.order.id});
    };

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.orderCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}, isCancelled && styles.cardCancelled]}
        onPress={() => navigation.navigate('OrderDetail', {orderId: item.order.id, id: item.order.id})}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <SourceTag source={sourceKind} />
            <StatusBadge label="" meta={getObjectStatusMeta('order', item.order.status)} />
          </View>
          <Text style={styles.orderNo}>{item.order.order_no}</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>{item.order.title}</Text>

        <View style={styles.cardRoute}>
          <Text style={styles.routeText} numberOfLines={1}>
            📍 {item.order.service_address || '起点'}
            {item.order.dest_address ? ` → ${item.order.dest_address}` : ''}
          </Text>
        </View>

        <View style={styles.progressBanner}>
          <View style={styles.progressInner}>
            <Text style={styles.progressLabel}>当前进展：</Text>
            <Text style={styles.progressText} numberOfLines={1}>{progressHint}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            <Text style={styles.timeLabel}>{formatDateRange(item.order.start_time, item.order.end_time).split(' ')[0]}</Text>
            <Text style={styles.amountText}>{formatAmount(item.order.total_amount)}</Text>
          </View>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={openPrimaryEntry}
          >
            <Text style={styles.actionBtnText}>
              {canPilotExecute ? '去执行' : isPilotOrder && hasDispatchTask ? '执行安排' : '详情'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const emptyAction = activeRole === 'owner'
    ? {text: '去任务列表', onPress: () => navigation.navigate('DemandList', {mode: 'owner'})}
    : activeRole === 'pilot'
      ? {text: '看待接任务', onPress: () => navigation.navigate('PilotTaskList')}
      : {text: '快速下单', onPress: () => navigation.navigate('QuickOrderEntry')};

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={filteredItems}
        keyExtractor={item => String(item.order.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>订单进度</Text>
              <Text style={styles.heroDesc}>
                成交后的订单、执行安排和签收进度都会汇总在这里，按身份视角和状态分组查看。
              </Text>
            </View>

            {(effectiveRoleSummary.has_owner_role || effectiveRoleSummary.has_pilot_role) && (
              <View style={styles.toolEntryRow}>
                {effectiveRoleSummary.has_owner_role && (
                  <TouchableOpacity
                    style={[styles.toolEntryChip, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
                    onPress={() => navigation.navigate('DispatchTaskList')}>
                    <Text style={styles.toolEntryIcon}>📡</Text>
                    <Text style={[styles.toolEntryText, {color: theme.text}]}>执行安排</Text>
                  </TouchableOpacity>
                )}
                {effectiveRoleSummary.has_pilot_role && (
                  <TouchableOpacity
                    style={[styles.toolEntryChip, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
                    onPress={() => navigation.navigate('PilotTaskList')}>
                    <Text style={styles.toolEntryIcon}>🧭</Text>
                    <Text style={[styles.toolEntryText, {color: theme.text}]}>飞手任务</Text>
                  </TouchableOpacity>
                )}
                {effectiveRoleSummary.has_pilot_role && (
                  <TouchableOpacity
                    style={[styles.toolEntryChip, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
                    onPress={() => navigation.navigate('FlightLog')}>
                    <Text style={styles.toolEntryIcon}>🛫</Text>
                    <Text style={[styles.toolEntryText, {color: theme.text}]}>飞行记录</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ObjectCard style={styles.filterCard}>
              <Text style={[styles.filterTitle, {color: theme.text}]}>身份视角</Text>
              <View style={styles.filterRow}>
                {roleTabs.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder}, activeRole === tab.key && {borderColor: theme.primary, backgroundColor: theme.primaryBg}]}
                    onPress={() => setActiveRole(tab.key)}>
                    <Text style={[styles.filterChipText, {color: theme.textSub}, activeRole === tab.key && {color: theme.primaryText}]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterTitle, styles.filterTitleSpaced, {color: theme.text}]}>状态分组</Text>
              <View style={styles.filterRow}>
                {STATUS_TABS.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, {backgroundColor: theme.inputBg, borderColor: theme.inputBorder}, activeStatus === tab.key && {borderColor: theme.primary, backgroundColor: theme.primaryBg}]}
                    onPress={() => {
                      setActiveStatus(tab.key);
                      setExactStatusFilter('');
                    }}>
                    <Text style={[styles.filterChipText, {color: theme.textSub}, activeStatus === tab.key && {color: theme.primaryText}]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {exactStatusFilter ? (
                <View style={styles.exactStatusHint}>
                  <Text style={[styles.exactStatusHintText, {color: theme.textSub}]}>当前精确筛选：{getExactStatusLabel(exactStatusFilter)}</Text>
                  <TouchableOpacity onPress={() => setExactStatusFilter('')}>
                    <Text style={[styles.exactStatusClear, {color: theme.primary}]}>清除</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.refreshColor} />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="📦"
                title="当前没有匹配订单"
                description="这里只显示成交后的订单进度。找服务、发布任务和执行安排入口已经拆开。"
                actionText={emptyAction.text}
                onAction={emptyAction.onPress}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  toolEntryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  toolEntryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  toolEntryIcon: {
    fontSize: 16,
  },
  toolEntryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterCard: {
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterTitleSpaced: {
    marginTop: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  filterChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: theme.primaryText,
  },
  exactStatusHint: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exactStatusHintText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  exactStatusClear: {
    fontSize: 12,
    color: theme.primaryText,
    fontWeight: '700',
  },
  loading: {
    paddingVertical: 48,
  },
  orderCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardCancelled: {
    opacity: 0.7,
    borderColor: theme.divider,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  orderNo: {
    fontSize: 11,
    color: theme.textHint,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 8,
  },
  cardRoute: {
    marginBottom: 12,
  },
  routeText: {
    fontSize: 13,
    color: theme.textSub,
  },
  progressBanner: {
    backgroundColor: theme.bgSecondary,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  progressInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    color: theme.textHint,
    fontWeight: '700',
  },
  progressText: {
    flex: 1,
    fontSize: 12,
    color: theme.primaryText,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    paddingTop: 12,
  },
  footerInfo: {
    gap: 4,
  },
  timeLabel: {
    fontSize: 11,
    color: theme.textHint,
  },
  amountText: {
    fontSize: 18,
    color: theme.danger,
    fontWeight: '800',
  },
  actionBtn: {
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  actionBtnText: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '700',
  },
  card: {
    marginBottom: 12,
  },
});
