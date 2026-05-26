import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState, useAppDispatch } from '../../store/store';
import { setHaulRoleMode } from '../../store/slices/roleSlice';
import { orderV2Service } from '../../services/orderV2';
import { V2OrderSummary } from '../../types';
import { getEffectiveRoleSummary, getObjectStatusMeta } from '../../utils';
import { syncCustomTabBar } from '../../utils/tabBar';
import DemandListPage from '../demand/list';
import './index.scss';

type RoleFilter = 'all' | 'client' | 'owner' | 'pilot';
type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'in_progress', label: '进行中' },
  { key: 'completed', label: '已完成' },
];

const roleLabelMap: Record<Exclude<RoleFilter, 'all'>, string> = {
  client: '客户订单',
  owner: '服务商订单',
  pilot: '履约订单',
};

const formatAmount = (amount?: number | null) => `¥${((amount || 0) / 100).toFixed(2)}`;

const formatDateRange = (start?: string, end?: string) => {
  if (!start && !end) return '未设置执行时间';
  const values = [start, end].filter(Boolean).map(value => {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
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
  if (['pending_provider_confirmation', 'pending_payment', 'pending_dispatch', 'created', 'accepted', 'paid'].includes(normalized)) {
    return 'pending';
  }
  if (['assigned', 'confirmed', 'preparing', 'airspace_applying', 'airspace_approved', 'loading', 'in_transit', 'delivered'].includes(normalized)) {
    return 'in_progress';
  }
  return 'completed';
};

const buildRoleTabs = (summary: any): { key: RoleFilter; label: string }[] => {
  const tabs: { key: RoleFilter; label: string }[] = [{ key: 'all', label: '全部' }];
  if (summary.has_client_role) tabs.push({ key: 'client', label: roleLabelMap.client });
  if (summary.has_owner_role) tabs.push({ key: 'owner', label: roleLabelMap.owner });
  if (summary.has_pilot_role) tabs.push({ key: 'pilot', label: roleLabelMap.pilot });
  return tabs;
};

const getOrderProgressHint = (order: V2OrderSummary) => {
  switch (String(order.status || '').toLowerCase()) {
    case 'pending_provider_confirmation': return '等待服务商确认，通常 2 小时内回复';
    case 'pending_payment': return '完成支付后才会进入履约流程';
    case 'pending_dispatch': return '服务商待开始履约';
    case 'assigned': return '服务商已接单，待进入准备阶段';
    case 'preparing': case 'loading': case 'airspace_applying': case 'airspace_approved': return '现场准备中，稍后会继续推进飞行';
    case 'in_transit': return '运输执行中，请留意飞行与送达更新';
    case 'delivered': return '等待签收确认';
    case 'cancelled': return '订单已取消，如有支付会继续显示退款进度';
    case 'completed': return '本单已完成';
    default: return '订单正在推进中';
  }
};

const getStatusBadgeColor = (status?: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'pending_provider_confirmation': case 'pending_payment': case 'pending_dispatch': return '#FA8C16';
    case 'assigned': case 'preparing': case 'in_transit': return '#1677FF';
    case 'delivered': case 'completed': return '#52C41A';
    case 'cancelled': return '#9CA3AF';
    default: return '#666';
  }
};

export default function RoleOrdersPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const forcedMode = router.params?.mode === 'provider' ? 'provider' : selectedMode;

  useEffect(() => {
    if (router.params?.mode === 'provider' && selectedMode !== 'provider') {
      dispatch(setHaulRoleMode('provider'));
    }
  }, [dispatch, router.params?.mode, selectedMode]);

  useDidShow(() => {
    if (router.params?.mode === 'provider') {
      dispatch(setHaulRoleMode('provider'));
      syncCustomTabBar(1, 'provider');
      return;
    }
    syncCustomTabBar(1);
  });

  if (forcedMode === 'provider') {
    return <DemandListPage />;
  }

  return <CustomerOrdersPage />;
}

function CustomerOrdersPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary, user), [roleSummary, user]);
  const currentUserId = Number(user?.id || 0);

  const roleTabs = useMemo(() => buildRoleTabs(effectiveRoleSummary), [effectiveRoleSummary]);
  const [activeRole, setActiveRole] = useState<RoleFilter>('all');
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<{ order: V2OrderSummary; roles: RoleFilter[] }[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const rolesToLoad: Array<Exclude<RoleFilter, 'all'>> =
        activeRole === 'all'
          ? roleTabs.filter(tab => tab.key !== 'all').map(tab => tab.key as Exclude<RoleFilter, 'all'>)
          : [activeRole as Exclude<RoleFilter, 'all'>];

      if (rolesToLoad.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const responses = await Promise.all(
        rolesToLoad.map(async role => {
          const res = await orderV2Service.list({ role, page: 1, page_size: 50 });
          return { role, orders: (res as any).items || [] };
        }),
      );

      const merged = new Map<number, { order: V2OrderSummary; roles: RoleFilter[] }>();
      responses.forEach(({ role, orders }) => {
        orders.forEach((order: V2OrderSummary) => {
          const existing = merged.get(order.id);
          if (!existing) {
            merged.set(order.id, { order, roles: [role] });
          } else {
            const nextRoles = existing.roles.includes(role) ? existing.roles : [...existing.roles, role];
            const betterOrder = new Date(order.updated_at || order.created_at).getTime() >=
              new Date(existing.order.updated_at || existing.order.created_at).getTime()
              ? order : existing.order;
            merged.set(order.id, { order: betterOrder, roles: nextRoles });
          }
        });
      });

      const list = Array.from(merged.values()).sort(
        (a, b) => new Date(b.order.updated_at || b.order.created_at).getTime() -
          new Date(a.order.updated_at || a.order.created_at).getTime(),
      );
      setItems(list);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRole, roleTabs]);

  useDidShow(() => {
    syncCustomTabBar(1);
    fetchOrders();
  });

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const filteredItems = useMemo(
    () => items.filter(item => activeStatus === 'all' || getStatusBucket(item.order.status) === activeStatus),
    [activeStatus, items],
  );

  const handleOpenOrder = (item: { order: V2OrderSummary; roles: RoleFilter[] }) => {
    Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${item.order.id}` });
  };

  return (
    <ScrollView
      scrollY
      className="orders-page"
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={onRefresh}
    >
      <View className="orders-page-content">
        <Text className="orders-page-title">我的订单</Text>

        <View className="card orders-filter-card">
          <Text className="orders-filter-title">身份视角</Text>
          <View className="orders-filter-row">
            {roleTabs.map(tab => (
              <View
                key={tab.key}
                className={`orders-filter-chip ${activeRole === tab.key ? 'orders-filter-chip-active' : ''}`}
                onClick={() => setActiveRole(tab.key)}
              >
                <Text>{tab.label}</Text>
              </View>
            ))}
          </View>

          <Text className="orders-filter-title orders-filter-title-spaced">状态分组</Text>
          <View className="orders-filter-row">
            {STATUS_TABS.map(tab => (
              <View
                key={tab.key}
                className={`orders-filter-chip ${activeStatus === tab.key ? 'orders-filter-chip-active' : ''}`}
                onClick={() => setActiveStatus(tab.key)}
              >
                <Text>{tab.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {loading ? (
          <View className="empty-state">
            <Text className="empty-state-text">加载中...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-icon">📦</Text>
            <Text className="empty-state-text">当前没有匹配订单</Text>
          </View>
        ) : (
          filteredItems.map(item => {
            const isCancelled = String(item.order.status || '').toLowerCase() === 'cancelled';
            const progressHint = getOrderProgressHint(item.order);
            const badgeColor = getStatusBadgeColor(item.order.status);
            const statusMeta = getObjectStatusMeta('order', item.order.status);

            return (
              <View
                key={item.order.id}
                className={`card orders-order-card ${isCancelled ? 'orders-order-card-cancelled' : ''}`}
                onClick={() => handleOpenOrder(item)}
              >
                <View className="orders-card-header">
                  <View className="orders-card-header-left">
                    <Text className="orders-source-tag">
                      {item.order.order_source === 'supply_direct' ? '快速下单' : '任务转单'}
                    </Text>
                    <View className="orders-status-badge" style={{ backgroundColor: badgeColor }}>
                      {statusMeta.label}
                    </View>
                  </View>
                  <Text className="orders-order-no">{item.order.order_no}</Text>
                </View>

                <Text className="orders-card-title">{item.order.title}</Text>

                <View className="orders-card-route">
                  <Text className="orders-route-text">
                    📍 {item.order.service_address || '起点'}
                    {item.order.dest_address ? ` → ${item.order.dest_address}` : ''}
                  </Text>
                </View>

                <View className="orders-progress-banner">
                  <View className="orders-progress-inner">
                    <Text className="orders-progress-label">当前进展：</Text>
                    <Text className="orders-progress-text">{progressHint}</Text>
                  </View>
                </View>

                <View className="orders-card-footer">
                  <View className="orders-footer-info">
                    <Text className="orders-time-label">
                      {formatDateRange(item.order.start_time, item.order.end_time).split(' ')[0]}
                    </Text>
                    <Text className="orders-amount-text">{formatAmount(item.order.total_amount)}</Text>
                  </View>
                  <View className="orders-action-btn">
                    <Text className="orders-action-btn-text">
                      {(() => {
                        const isPilotOrder = item.roles.includes('pilot');
                        const hasDispatchTask = Number(item.order.dispatch_task_id || 0) > 0;
                        const canPilotExecute = isPilotOrder && hasDispatchTask && currentUserId > 0 &&
                          currentUserId === Number(item.order.executor_pilot_user_id || 0) &&
                          !['cancelled', 'completed'].includes(String(item.order.status || '').toLowerCase());
                        if (canPilotExecute || (isPilotOrder && hasDispatchTask)) return '履约详情';
                        return '详情';
                      })()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
