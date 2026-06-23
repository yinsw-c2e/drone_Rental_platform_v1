import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import { orderV2Service } from '../../../services/orderV2';
import { V2OrderSummary } from '../../../types';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import { getProviderAdvanceConfirmCopy } from '../../../utils/providerAdvance';
import { syncCustomTabBar } from '../../../utils/tabBar';
import './index.scss';

type StatusFilter = 'all' | 'active' | 'done';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已结束' },
];

const activeStatuses = [
  'pending_provider_confirmation',
  'pending_payment',
  'pending_dispatch',
  'auto_assigning',
  'dispatch_failed',
  'scheduled',
  'assigned',
  'preparing',
  'in_transit',
  'in_progress',
  'delivered',
  'created',
  'paid',
  'airspace_applying',
  'airspace_approved',
];

const normalizedStatus = (order?: Pick<V2OrderSummary, 'status'> | null) =>
  String(order?.status || '').toLowerCase();

const normalizedMode = (order?: Pick<V2OrderSummary, 'order_mode'> | null) =>
  String(order?.order_mode || '').toLowerCase();

const formatAmount = (amount?: number | null) =>
  `¥${(Number(amount || 0) / 100).toFixed(2)}`;

const ORDER_STATUS_LABEL_MAP: Record<string, string> = {
  pending_dispatch: '等待服务商',
  auto_assigning: '匹配中',
  dispatch_failed: '暂无服务商',
  assigned: '服务商已接单',
  preparing: '准备起飞',
  in_transit: '飞行中',
  in_progress: '进行中',
  delivered: '等待签收',
  completed: '已完成',
  cancelled: '已取消',
  provider_rejected: '服务未确认',
  pending_provider_confirmation: '待确认接单',
  pending_payment: '报价已选中',
  paid: '已支付',
  refunded: '已退款',
  scheduled: '已预约',
  rejected: '已拒绝',
  created: '已创建',
  airspace_applying: '空域申请中',
  airspace_approved: '空域已批',
  airspace_rejected: '空域被拒',
  settled: '已入账',
  settlement_failed: '结算失败',
};

const statusLabelOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  return ORDER_STATUS_LABEL_MAP[status] || '服务推进中';
};

const statusToneOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (['completed', 'delivered'].includes(status)) return 'success';
  if (['cancelled', 'provider_rejected'].includes(status)) return 'muted';
  if (['pending_provider_confirmation', 'pending_payment', 'pending_dispatch', 'auto_assigning', 'dispatch_failed', 'scheduled', 'created'].includes(status)) return 'warning';
  return 'primary';
};

const statusBucketOf = (order: V2OrderSummary): StatusFilter =>
  activeStatuses.includes(normalizedStatus(order)) ? 'active' : 'done';

const listItemsOf = (response: unknown): V2OrderSummary[] => {
  const data = response as any;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
};

const providerAdvanceLabelOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (status === 'pending_provider_confirmation') return '确认接单';
  if (status === 'pending_dispatch' || status === 'assigned') return '开始准备';
  if (status === 'preparing') return '开始飞行';
  if (status === 'in_transit') return '确认送达';
  return '';
};

const PROVIDER_ORDER_STATUS_SORT_RANK: Record<string, number> = {
  pending_provider_confirmation: 0,
  pending_payment: 1,
  pending_dispatch: 2,
  assigned: 3,
  preparing: 4,
  in_transit: 5,
  in_progress: 6,
  delivered: 7,
  auto_assigning: 8,
  dispatch_failed: 9,
  scheduled: 10,
  created: 11,
  paid: 12,
  airspace_applying: 13,
  airspace_approved: 14,
  completed: 40,
  settled: 41,
  refunded: 50,
  cancelled: 60,
  provider_rejected: 60,
  rejected: 60,
  settlement_failed: 60,
};

const orderSortTime = (order: V2OrderSummary) => {
  const value = order.updated_at || order.completed_at || order.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const providerOrderSortRank = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (PROVIDER_ORDER_STATUS_SORT_RANK[status] !== undefined) return PROVIDER_ORDER_STATUS_SORT_RANK[status];
  return statusBucketOf(order) === 'active' ? 20 : 70;
};

const compareProviderOrders = (a: V2OrderSummary, b: V2OrderSummary) => {
  const rankDiff = providerOrderSortRank(a) - providerOrderSortRank(b);
  if (rankDiff !== 0) return rankDiff;
  return orderSortTime(b) - orderSortTime(a);
};

const stopTap = (event?: any) => {
  event?.stopPropagation?.();
};

export default function ProviderOrdersPage() {
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<V2OrderSummary[]>([]);
  const [topInsetRpx, setTopInsetRpx] = useState(132);
  const [advancingId, setAdvancingId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const sys = Taro.getSystemInfoSync();
      const ratio = 750 / (sys.windowWidth || 375);
      const statusBarRpx = Math.round(((sys.statusBarHeight || 20) + 12) * ratio);
      setTopInsetRpx(statusBarRpx);
    } catch {
      setTopInsetRpx(132);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await orderV2Service.list({ role: 'provider', page: 1, page_size: 50 });
      const list = listItemsOf(response).sort(compareProviderOrders);
      setItems(list);
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '订单加载失败'), icon: 'none' });
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDidShow(() => {
    syncCustomTabBar(1, 'provider');
    fetchOrders();
  });

  const filteredItems = useMemo(
    () => items.filter(item => activeStatus === 'all' || statusBucketOf(item) === activeStatus),
    [activeStatus, items],
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const openDetail = (order: V2OrderSummary) => {
    Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${order.id}` });
  };

  const advanceOrder = async (event: any, order: V2OrderSummary) => {
    stopTap(event);
    if (advancingId) return;
    const label = providerAdvanceLabelOf(order);
    if (!label) return;
    try {
      const copy = getProviderAdvanceConfirmCopy(label);
      if (copy) {
        const res = await Taro.showModal({
          title: copy.title,
          content: copy.content,
          cancelText: '再想想',
          confirmText: copy.confirmText,
        });
        if (!res.confirm) return;
      }
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '操作确认失败'), icon: 'none' });
      return;
    }
    setAdvancingId(order.id);
    try {
      if (label === '确认接单') await orderV2Service.providerConfirm(order.id);
      if (label === '开始准备') await orderV2Service.startPreparing(order.id);
      if (label === '开始飞行') await orderV2Service.startFlight(order.id);
      if (label === '确认送达') await orderV2Service.confirmDelivery(order.id);
      Taro.showToast({ title: '已推进', icon: 'success' });
      fetchOrders();
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '推进失败'), icon: 'none' });
    } finally {
      setAdvancingId(null);
    }
  };

  return (
    <ScrollView
      scrollY
      className="orders-page"
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={onRefresh}
    >
      <View className="orders-page-content" style={{ paddingTop: `${topInsetRpx}rpx` }}>
        <Text className="orders-page-title">服务商订单</Text>
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

        {loading ? (
          <View className="empty-state">
            <Text className="empty-state-text">加载中...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-text">当前没有待服务订单，可回工作台或接单需求查看可接任务</Text>
          </View>
        ) : (
          filteredItems.map(order => {
            const status = normalizedStatus(order);
            const label = providerAdvanceLabelOf(order);
            return (
              <View key={order.id} className="order-card" onClick={() => openDetail(order)}>
                <View className="order-card-head">
                  <View className={`order-status-badge order-status-${statusToneOf(order)}`}>
                    <Text>{statusLabelOf(order)}</Text>
                  </View>
                  <Text className="order-card-no">{order.order_no}</Text>
                </View>
                <View className="order-route">
                  <View className="order-route-line">
                    <View className="order-route-dot order-route-dot-start" />
                    <Text className="order-route-text">{order.service_address || '起点待确认'}</Text>
                  </View>
                  <View className="order-route-line">
                    <View className="order-route-dot order-route-dot-end" />
                    <Text className="order-route-text">{order.dest_address || '终点待确认'}</Text>
                  </View>
                </View>
                <View className="order-card-foot">
                  <Text className="order-mode-text">{normalizedMode(order) === 'negotiated' ? '议价单' : normalizedMode(order) === 'reservation' ? '预约单' : '即时单'}</Text>
                  <Text className="order-amount">{formatAmount(order.total_amount)}</Text>
                </View>
                {label ? (
                  <View className="order-card-actions">
                    <View className="order-card-button order-card-button-primary" onClick={event => advanceOrder(event, order)}>
                      <Text>{advancingId === order.id ? '推进中...' : label}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
