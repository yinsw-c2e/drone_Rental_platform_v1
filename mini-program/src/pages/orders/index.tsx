import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { orderV2Service } from '../../services/orderV2';
import { demandV2Service } from '../../services/demandV2';
import { DemandSummary, V2OrderSummary } from '../../types';
import { syncCustomTabBar } from '../../utils/tabBar';
import { getDemandSceneLabel, getObjectStatusMeta } from '../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../utils/roleSummary';
import DemandListPage from '../demand/list';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import './index.scss';

type StatusFilter = 'all' | 'active' | 'done';
type ProviderOrderSegment = 'demand' | 'mine';
type CustomerOrderSegment = 'demands' | 'orders';

const PROVIDER_ORDERS_SEGMENT_KEY = 'provider_orders_default_segment';
export const CUSTOMER_ORDERS_SEGMENT_KEY = 'customer_orders_default_segment';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已结束' },
];

const activeStatuses = ['pending_dispatch', 'auto_assigning', 'dispatch_failed', 'scheduled', 'assigned', 'preparing', 'in_transit', 'delivered', 'pending_payment'];
const providerVisibleStatuses = ['assigned', 'preparing', 'in_transit', 'delivered', 'completed'];
const contactVisibleStatuses = ['assigned', 'preparing', 'in_transit', 'delivered'];
const liveStatuses = ['assigned', 'preparing', 'in_transit', 'delivered'];
const cancelStatuses = ['pending_dispatch', 'dispatch_failed', 'scheduled', 'assigned', 'preparing'];
const terminalOnlyStatuses = ['cancelled', 'provider_rejected'];
const SELF_EXECUTABLE_REQUIRED_TOAST = '需要先完善设备和履约资质';

const stopTap = (event?: any) => {
  event?.stopPropagation?.();
};

const normalizedStatus = (order?: Pick<V2OrderSummary, 'status'> | null) =>
  String(order?.status || '').toLowerCase();

const normalizedMode = (order?: Pick<V2OrderSummary, 'order_mode'> | null) =>
  String(order?.order_mode || '').toLowerCase();

const formatAmount = (amount?: number | null) =>
  `¥${(Number(amount || 0) / 100).toFixed(2)}`;

const formatEta = (seconds?: number | null) => {
  if (seconds === 0) return '即将到达';
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '等待开始飞行';
  const safe = Math.max(0, Math.round(Number(seconds)));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  if (min <= 0) return `约 ${sec} 秒到达`;
  return `约 ${min} 分 ${sec} 秒到达`;
};

const orderAgeSeconds = (value?: string) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
};

const within24Hours = (value?: string | null) => {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
};

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
  pending_payment: '待支付',
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
  if (['pending_payment', 'pending_dispatch', 'auto_assigning', 'dispatch_failed', 'scheduled'].includes(status)) return 'warning';
  return 'primary';
};

const providerNameOf = (order: any) => {
  const direct = order?.provider_snapshot?.nickname || order?.provider_snapshot?.name || order?.provider?.nickname || order?.provider?.name;
  if (direct) return String(direct);
  const id = Number(order?.provider_user_id || order?.provider?.user_id || 0);
  if (id > 0) return `服务商 ${String(id).slice(-4)}`;
  return '服务商待确认';
};

const providerPhoneOf = (order: any) =>
  String(order?.provider_snapshot?.phone || order?.provider?.phone || order?.provider_phone || '');

const isCallablePhone = (phone?: string) =>
  Boolean(phone && !String(phone).includes('*') && /^[\d+\-\s]{5,}$/.test(String(phone)));

const canCancel = (order: V2OrderSummary) =>
  cancelStatuses.includes(normalizedStatus(order));

const canIncreasePrice = (order: V2OrderSummary) =>
  normalizedMode(order) === 'instant' &&
  normalizedStatus(order) === 'pending_dispatch' &&
  orderAgeSeconds(order.created_at) >= 90;

const canAddTip = (order: V2OrderSummary) => {
  const mode = normalizedMode(order);
  const status = normalizedStatus(order);
  if (!['instant', 'reservation'].includes(mode)) return false;
  if (status === 'in_transit') return true;
  return status === 'delivered' && within24Hours(order.updated_at || order.completed_at || order.created_at);
};

const canViewLive = (order: V2OrderSummary) =>
  ['instant', 'reservation'].includes(normalizedMode(order)) &&
  liveStatuses.includes(normalizedStatus(order));

const canContactProvider = (order: V2OrderSummary) =>
  contactVisibleStatuses.includes(normalizedStatus(order));

const canPay = (order: V2OrderSummary) =>
  normalizedStatus(order) === 'pending_payment';

const canReview = (order: V2OrderSummary) =>
  normalizedStatus(order) === 'completed' && !(order as any).reviewed;

const isTerminalOnly = (order: V2OrderSummary) =>
  terminalOnlyStatuses.includes(normalizedStatus(order));

const providerAdvanceLabelOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (status === 'pending_dispatch' || status === 'assigned') return '开始准备';
  if (status === 'preparing') return '开始飞行';
  if (status === 'in_transit') return '确认送达';
  return '';
};

const hasActionButtons = (order: V2OrderSummary) =>
  isTerminalOnly(order) ||
  canCancel(order) ||
  canIncreasePrice(order) ||
  canAddTip(order) ||
  canViewLive(order) ||
  canContactProvider(order) ||
  canPay(order) ||
  canReview(order);

const statusBucketOf = (order: V2OrderSummary): StatusFilter =>
  activeStatuses.includes(normalizedStatus(order)) ? 'active' : 'done';

const listItemsOf = (response: unknown): V2OrderSummary[] => {
  const data = response as any;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
};

export default function RoleOrdersPage() {
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);

  useDidShow(() => {
    // 仅同步 TabBar 选中态，不强制改写全局角色身份。
    syncCustomTabBar(1);
  });

  if (selectedMode === 'provider') {
    return <ProviderOrdersShell />;
  }

  return <CustomerOrdersShell />;
}

function CustomerOrderSegmentBar({
  active,
  onChange,
  demandCount,
}: {
  active: CustomerOrderSegment;
  onChange: (next: CustomerOrderSegment) => void;
  demandCount: number;
}) {
  return (
    <View className="customer-order-segment">
      <View
        className={`customer-order-segment-item ${active === 'demands' ? 'is-active' : ''}`}
        onClick={() => onChange('demands')}
      >
        <Text>我的任务</Text>
        {demandCount > 0 ? <Text className="customer-order-segment-count">{demandCount > 99 ? '99+' : demandCount}</Text> : null}
      </View>
      <View
        className={`customer-order-segment-item ${active === 'orders' ? 'is-active' : ''}`}
        onClick={() => onChange('orders')}
      >
        <Text>我的订单</Text>
      </View>
    </View>
  );
}

function CustomerOrdersShell() {
  const [activeSegment, setActiveSegment] = useState<CustomerOrderSegment>('orders');
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [demandsLoading, setDemandsLoading] = useState(false);
  const [demandsRefreshing, setDemandsRefreshing] = useState(false);
  const [demandsError, setDemandsError] = useState('');

  const fetchDemands = useCallback(async () => {
    try {
      const res = await demandV2Service.listMyDemands({ page: 1, page_size: 50 });
      const list = (res as any)?.list || (res as any)?.data?.list || [];
      setDemands(Array.isArray(list) ? list : []);
      setDemandsError('');
    } catch (error: any) {
      setDemands([]);
      setDemandsError(friendlyErrorMessage(error, '任务列表加载失败，请下拉刷新或检查网络'));
    } finally {
      setDemandsLoading(false);
      setDemandsRefreshing(false);
    }
  }, []);

  useDidShow(() => {
    syncCustomTabBar(1);
    const hint = Taro.getStorageSync(CUSTOMER_ORDERS_SEGMENT_KEY);
    if (hint === 'demands' || hint === 'orders') {
      setActiveSegment(hint);
      Taro.removeStorageSync(CUSTOMER_ORDERS_SEGMENT_KEY);
    }
    setDemandsLoading(true);
    fetchDemands();
  });

  const handleSegmentChange = useCallback((next: CustomerOrderSegment) => {
    setActiveSegment(next);
  }, []);

  const activeDemandCount = useMemo(
    () => demands.filter(d => !['cancelled', 'expired', 'closed', 'converted_to_order'].includes(String(d.status || '').toLowerCase())).length,
    [demands],
  );

  const segmentBar = (
    <CustomerOrderSegmentBar active={activeSegment} onChange={handleSegmentChange} demandCount={activeDemandCount} />
  );

  if (activeSegment === 'demands') {
    return (
      <CustomerDemandsPage
        segmentBar={segmentBar}
        demands={demands}
        loading={demandsLoading}
        refreshing={demandsRefreshing}
        error={demandsError}
        onRefresh={() => {
          setDemandsRefreshing(true);
          fetchDemands();
        }}
        onRetry={() => {
          setDemandsLoading(true);
          setDemandsError('');
          fetchDemands();
        }}
      />
    );
  }

  return <CustomerOrdersPage segmentBar={segmentBar} />;
}

function CustomerDemandsPage({
  segmentBar,
  demands,
  loading,
  refreshing,
  error,
  onRefresh,
  onRetry,
}: {
  segmentBar: React.ReactNode;
  demands: DemandSummary[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  onRefresh: () => void;
  onRetry: () => void;
}) {
  const [topInsetRpx, setTopInsetRpx] = useState(0);

  useEffect(() => {
    try {
      const sys = Taro.getSystemInfoSync();
      const ratio = 750 / (sys.windowWidth || 375);
      const statusBarRpx = Math.round(((sys.statusBarHeight || 20) + 12) * ratio);
      setTopInsetRpx(statusBarRpx);
    } catch {
      // 忽略
    }
  }, []);

  const openDetail = (demand: DemandSummary) => {
    Taro.navigateTo({ url: `/pages/demand/detail/index?id=${demand.id}` });
  };

  const goPublish = () => {
    Taro.switchTab({ url: '/pages/home/index' });
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
        <Text className="orders-page-title">我的任务</Text>
        {segmentBar}

        {loading ? (
          <View className="empty-state">
            <Text className="empty-state-text">加载中...</Text>
          </View>
        ) : error ? (
          <View className="empty-state">
            <Text className="empty-state-text">{error}</Text>
            <View className="empty-state-cta" onClick={onRetry}>
              <Text>重新加载</Text>
            </View>
          </View>
        ) : demands.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-text">还没有发布过吊运任务</Text>
            <View className="empty-state-cta" onClick={goPublish}>
              <Text>回首页发布任务</Text>
            </View>
          </View>
        ) : (
          demands.map(demand => {
            const meta = getObjectStatusMeta('demand', demand.status);
            const route = String(demand.title || '未命名任务');
            const quoteCount = demand.quote_count || 0;
            const budgetMin = Math.round(Number(demand.budget_min || 0) / 100);
            const budgetMax = Math.round(Number(demand.budget_max || 0) / 100);
            const budgetText = budgetMin > 0 || budgetMax > 0
              ? `预算 ¥${budgetMin}-${budgetMax}`
              : '预算待估';
            return (
              <View key={demand.id} className="order-card" onClick={() => openDetail(demand)}>
                <View className="order-card-head">
                  <View className={`order-status-badge order-status-${meta.tone || 'gray'}`}>
                    <Text>{meta.label}</Text>
                  </View>
                  <Text className="order-card-no">{demand.demand_no}</Text>
                </View>
                <View className="order-route">
                  <Text className="order-route-text">{route}</Text>
                </View>
                <View className="order-card-foot">
                  <Text className="order-mode-text">{getDemandSceneLabel(demand.cargo_scene)} · {quoteCount > 0 ? `${quoteCount} 家报价` : '等待报价'}</Text>
                  <Text className="order-amount">{budgetText}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function ProviderOrderSegmentBar({
  active,
  onChange,
}: {
  active: ProviderOrderSegment;
  onChange: (next: ProviderOrderSegment) => void;
}) {
  return (
    <View className="provider-order-segment">
      <View
        className={`provider-order-segment-item ${active === 'demand' ? 'is-active' : ''}`}
        onClick={() => onChange('demand')}
      >
        <Text>接单需求</Text>
      </View>
      <View
        className={`provider-order-segment-item ${active === 'mine' ? 'is-active' : ''}`}
        onClick={() => onChange('mine')}
      >
        <Text>我的订单</Text>
      </View>
    </View>
  );
}

function ProviderOrdersShell() {
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const [activeSegment, setActiveSegment] = useState<ProviderOrderSegment>('demand');
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);

  useDidShow(() => {
    syncCustomTabBar(1);
    const hint = Taro.getStorageSync(PROVIDER_ORDERS_SEGMENT_KEY);
    if (hint === 'mine' || hint === 'demand') {
      setActiveSegment(hint);
      Taro.removeStorageSync(PROVIDER_ORDERS_SEGMENT_KEY);
    }
  });

  const handleSegmentChange = useCallback((next: ProviderOrderSegment) => {
    if (!providerCapabilities.canSelfExecute) {
      Taro.showToast({ title: SELF_EXECUTABLE_REQUIRED_TOAST, icon: 'none' });
    }
    setActiveSegment(next);
  }, [providerCapabilities.canSelfExecute]);

  const segmentBar = (
    <ProviderOrderSegmentBar active={activeSegment} onChange={handleSegmentChange} />
  );

  if (activeSegment === 'mine') {
    return <ProviderOrdersPage segmentBar={segmentBar} />;
  }

  return <DemandListPage headerExtra={segmentBar} />;
}

function ProviderOrdersPage({ segmentBar }: { segmentBar: React.ReactNode }) {
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
      const list = listItemsOf(response).sort(
        (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
      );
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
    syncCustomTabBar(1);
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
    setAdvancingId(order.id);
    try {
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
        {segmentBar}
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
            <Text className="empty-state-text">当前没有待服务订单</Text>
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

function CustomerOrdersPage({ segmentBar }: { segmentBar?: React.ReactNode }) {
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<V2OrderSummary[]>([]);
  const [topInsetRpx, setTopInsetRpx] = useState(132);

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
      const response = await orderV2Service.list({ role: 'client', page: 1, page_size: 50 });
      const list = listItemsOf(response).sort(
        (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
      );
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
    syncCustomTabBar(1);
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

  const cancelOrder = async (event: any, order: V2OrderSummary) => {
    stopTap(event);
    const res = await Taro.showModal({
      title: '确认取消订单？',
      content: '取消后订单将停止继续匹配或服务。',
      confirmText: '确认取消',
    });
    if (!res.confirm) return;
    try {
      await orderV2Service.cancel(order.id, '客户主动取消');
      Taro.showToast({ title: '已取消', icon: 'success' });
      fetchOrders();
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '取消失败'), icon: 'none' });
    }
  };

  const increasePrice = async (event: any, order: V2OrderSummary) => {
    stopTap(event);
    const res = await Taro.showModal({
      title: '附近运力紧张',
      content: '加价 ¥20 提升接单优先级？',
      confirmText: '确认加价',
    });
    if (!res.confirm) return;
    try {
      await orderV2Service.priceIncrease(order.id, { amount: 2000, reason: '加价提升接单' });
      Taro.showToast({ title: '加价成功，已通知服务商', icon: 'success' });
      fetchOrders();
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '加价失败'), icon: 'none' });
    }
  };

  const addTip = async (event: any, order: V2OrderSummary) => {
    stopTap(event);
    const sheet = await Taro.showActionSheet({ itemList: ['¥5', '¥10', '¥20'] }).catch(() => null);
    if (!sheet || typeof sheet.tapIndex !== 'number') return;
    const amount = [500, 1000, 2000][sheet.tapIndex] || 500;
    const res = await Taro.showModal({
      title: '给服务商小费',
      content: `给服务商小费 ¥${amount / 100}？`,
      confirmText: '确认支付',
    });
    if (!res.confirm) return;
    try {
      await orderV2Service.addTip(order.id, amount);
      Taro.showToast({ title: '小费已支付', icon: 'success' });
      fetchOrders();
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '小费支付失败'), icon: 'none' });
    }
  };

  const callProvider = (event: any, order: V2OrderSummary) => {
    stopTap(event);
    const phone = providerPhoneOf(order);
    if (isCallablePhone(phone)) {
      Taro.makePhoneCall({ phoneNumber: phone });
      return;
    }
    Taro.showToast({ title: '暂无可直拨电话', icon: 'none' });
  };

  const goPayment = (event: any, order: V2OrderSummary) => {
    stopTap(event);
    Taro.navigateTo({ url: `/pages/payment/index?orderId=${order.id}` });
  };

  const goReview = (event: any, order: V2OrderSummary) => {
    stopTap(event);
    Taro.navigateTo({ url: `/pages/review/index?orderId=${order.id}` });
  };

  const goLive = (event: any, order: V2OrderSummary) => {
    stopTap(event);
    Taro.showToast({ title: '实时位置功能即将开放', icon: 'none' });
  };

  const reorder = (event: any) => {
    stopTap(event);
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const renderButtons = (order: V2OrderSummary) => {
    if (isTerminalOnly(order)) {
      return (
        <View className="order-card-actions">
          <View className="order-card-button order-card-button-muted" onClick={reorder}>
            <Text>重新下单</Text>
          </View>
        </View>
      );
    }
    if (!hasActionButtons(order)) return null;
    return (
      <View className="order-card-actions">
        {canCancel(order) ? (
          <View className="order-card-button order-card-button-ghost" onClick={event => cancelOrder(event, order)}>
            <Text>取消订单</Text>
          </View>
        ) : null}
        {canIncreasePrice(order) ? (
          <View className="order-card-button order-card-button-warn" onClick={event => increasePrice(event, order)}>
            <Text>附近运力紧张？加价</Text>
          </View>
        ) : null}
        {canAddTip(order) ? (
          <View className="order-card-button order-card-button-ghost" onClick={event => addTip(event, order)}>
            <Text>给个小费</Text>
          </View>
        ) : null}
        {canViewLive(order) ? (
          <View className="order-card-button order-card-button-ghost" onClick={event => goLive(event, order)}>
            <Text>实时位置（暂未启用）</Text>
          </View>
        ) : null}
        {canContactProvider(order) ? (
          <View className="order-card-button order-card-button-ghost" onClick={event => callProvider(event, order)}>
            <Text>拨打电话</Text>
          </View>
        ) : null}
        {canPay(order) ? (
          <View className="order-card-button order-card-button-primary" onClick={event => goPayment(event, order)}>
            <Text>去支付</Text>
          </View>
        ) : null}
        {canReview(order) ? (
          <View className="order-card-button order-card-button-primary" onClick={event => goReview(event, order)}>
            <Text>评价服务</Text>
          </View>
        ) : null}
      </View>
    );
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
        <Text className="orders-page-title">我的订单</Text>
        {segmentBar}
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
            <Text className="empty-state-text">当前没有订单</Text>
          </View>
        ) : (
          filteredItems.map(order => {
            const status = normalizedStatus(order);
            const mode = normalizedMode(order);
            const live = (order as any).live;
            const showProvider = providerVisibleStatuses.includes(status);
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

                {showProvider ? (
                  <View className="order-provider-row">
                    <View className="order-provider-avatar" />
                    <View className="order-provider-main">
                      <Text className="order-provider-name">{providerNameOf(order)}</Text>
                      <Text className="order-provider-rating">评分 5.0</Text>
                    </View>
                    {canContactProvider(order) ? (
                      <View className="order-provider-phone" onClick={event => callProvider(event, order)}>
                        <View className="order-provider-phone-icon" />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {status === 'in_transit' ? (
                  <View className="order-eta-row">
                    <Text>预计到达</Text>
                    <Text>{formatEta(live?.eta_seconds)}</Text>
                  </View>
                ) : null}

                <View className="order-card-foot">
                  <Text className="order-mode-text">{mode === 'negotiated' ? '议价单' : mode === 'reservation' ? '预约单' : '即时单'}</Text>
                  <Text className="order-amount">{formatAmount(order.total_amount)}</Text>
                </View>

                {renderButtons(order)}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
