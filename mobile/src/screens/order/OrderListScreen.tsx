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

const summarizeParty = (party: V2OrderSummary['provider'] | V2OrderSummary['client'] | V2OrderSummary['executor'], fallbackLabel: string) => {
  if (!party) {
    return fallbackLabel;
  }
  if (party.nickname) {
    return party.nickname;
  }
  if (party.user_id) {
    return `${fallbackLabel} #${party.user_id}`;
  }
  return fallbackLabel;
};

const getStatusBucket = (status?: string): StatusFilter => {
  const normalized = String(status || '').toLowerCase();
  if (
    [
      'pending_provider_confirmation',
      'pending_payment',
      'pending_dispatch',
      'assigned',
      'confirmed',
      'created',
      'accepted',
      'paid',
    ].includes(normalized)
  ) {
    return 'pending';
  }
  if (
    [
      'airspace_applying',
      'airspace_approved',
      'loading',
      'in_transit',
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

export default function OrderListScreen({navigation, route}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
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
    const roleHints = item.roles.filter(role => role !== 'all').map(role => roleLabelMap[role as Exclude<RoleFilter, 'all'>]);

    return (
      <ObjectCard style={styles.card} onPress={() => navigation.navigate('OrderDetail', {orderId: item.order.id, id: item.order.id})}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <SourceTag source={sourceKind} />
            <StatusBadge label="" meta={getObjectStatusMeta('order', item.order.status)} />
          </View>
          <Text style={styles.code}>{item.order.order_no}</Text>
        </View>

        <Text style={styles.title}>{item.order.title}</Text>
        <Text style={styles.address} numberOfLines={2}>
          {item.order.service_address || '未设置起点'}
          {item.order.dest_address ? ` -> ${item.order.dest_address}` : ''}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>承接方：{summarizeParty(item.order.provider, '未分配机主')}</Text>
          <Text style={styles.metaText}>执行方：{summarizeParty(item.order.executor, item.order.execution_mode === 'self_execute' ? '机主自执行' : '待派单')}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>客户：{summarizeParty(item.order.client, '客户')}</Text>
          <Text style={styles.metaText}>{formatDateRange(item.order.start_time, item.order.end_time)}</Text>
        </View>

        {roleHints.length > 0 ? (
          <View style={styles.roleHintRow}>
            {roleHints.map(label => (
              <View key={label} style={styles.roleHintChip}>
                <Text style={styles.roleHintText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.amount}>{formatAmount(item.order.total_amount)}</Text>
          <TouchableOpacity style={styles.detailBtn} onPress={() => navigation.navigate('OrderDetail', {orderId: item.order.id, id: item.order.id})}>
            <Text style={styles.detailBtnText}>查看订单</Text>
          </TouchableOpacity>
        </View>
      </ObjectCard>
    );
  };

  const emptyAction = activeRole === 'owner'
    ? {text: '去需求市场', onPress: () => navigation.navigate('DemandList', {mode: 'owner'})}
    : activeRole === 'pilot'
      ? {text: '看派单任务', onPress: () => navigation.navigate('PilotTaskList')}
      : {text: '去供给市场', onPress: () => navigation.navigate('OfferList')};

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={item => String(item.order.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0f5cab']} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>我的订单</Text>
              <Text style={styles.heroTitle}>这里只看订单对象</Text>
              <Text style={styles.heroDesc}>
                订单列表已经和派单任务、飞手候选彻底拆开。来源、承接方、执行方和当前状态都在同一张卡里表达。
              </Text>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>身份视角</Text>
              <View style={styles.filterRow}>
                {roleTabs.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, activeRole === tab.key && styles.filterChipActive]}
                    onPress={() => setActiveRole(tab.key)}>
                    <Text style={[styles.filterChipText, activeRole === tab.key && styles.filterChipTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterTitle, {marginTop: 16}]}>状态分组</Text>
              <View style={styles.filterRow}>
                {STATUS_TABS.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, activeStatus === tab.key && styles.filterChipActive]}
                    onPress={() => {
                      setActiveStatus(tab.key);
                      setExactStatusFilter('');
                    }}>
                    <Text style={[styles.filterChipText, activeStatus === tab.key && styles.filterChipTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {exactStatusFilter ? (
                <View style={styles.exactStatusHint}>
                  <Text style={styles.exactStatusHintText}>当前精确筛选：{getExactStatusLabel(exactStatusFilter)}</Text>
                  <TouchableOpacity onPress={() => setExactStatusFilter('')}>
                    <Text style={styles.exactStatusClear}>清除</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color="#0f5cab" />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="📦"
                title="当前没有匹配订单"
                description="订单页已经只保留成交后的订单对象。需求、供给、派单任务请去对应页面查看。"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3f8',
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: '#114178',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    color: '#d6e4ff',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: '#fff',
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#d6e4ff',
  },
  filterCard: {
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '700',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#114178',
    backgroundColor: '#e6f4ff',
  },
  filterChipText: {
    fontSize: 12,
    color: '#595959',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#114178',
  },
  exactStatusHint: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exactStatusHintText: {
    fontSize: 12,
    color: '#595959',
    fontWeight: '600',
  },
  exactStatusClear: {
    fontSize: 12,
    color: '#114178',
    fontWeight: '700',
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  code: {
    fontSize: 12,
    color: '#8c8c8c',
    fontWeight: '600',
  },
  title: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 24,
    color: '#1f1f1f',
    fontWeight: '700',
  },
  address: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#595959',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#595959',
  },
  roleHintRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleHintChip: {
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleHintText: {
    fontSize: 11,
    color: '#595959',
    fontWeight: '700',
  },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  amount: {
    fontSize: 22,
    color: '#cf1322',
    fontWeight: '800',
  },
  detailBtn: {
    borderRadius: 999,
    backgroundColor: '#114178',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
});
