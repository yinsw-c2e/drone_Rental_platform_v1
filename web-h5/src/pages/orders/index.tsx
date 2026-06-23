import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import { useDispatch } from 'react-redux';
import { readStoredRoleMode, setHaulRoleMode } from '../../store/slices/roleSlice';
import { orderV2Service } from '../../services/orderV2';
import { demandV2Service } from '../../services/demandV2';
import { DemandSummary, QuickOrderDraft, V2OrderSummary } from '../../types';
import { syncCustomTabBar } from '../../utils/tabBar';
import { getDemandSceneLabel, getObjectStatusMeta } from '../../utils';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import { canOpenProgress, progressActionLabelOf, progressUrlOf } from '../../utils/orderProgressNavigation';
import {
  clearQuickOrderOfferDraftForDemand,
  clearQuickOrderOfferDraft,
  quickOrderOfferDraftSummary,
  readQuickOrderOfferDraft,
} from '../../utils/quickOrderOfferDraft';
import {
  CUSTOMER_ORDERS_SEGMENT_KEY,
} from '../../utils/ordersEntry';
import './index.scss';

type StatusFilter = 'all' | 'active' | 'done';
type CustomerOrderSegment = 'demands' | 'orders';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已结束' },
];

const activeStatuses = [
  'pending_payment',
  'delivered',
  'in_transit',
  'in_progress',
  'preparing',
  'assigned',
  'pending_provider_confirmation',
  'pending_dispatch',
  'auto_assigning',
  'dispatch_failed',
  'scheduled',
  'created',
  'paid',
  'airspace_applying',
  'airspace_approved',
];
const providerVisibleStatuses = ['assigned', 'preparing', 'in_transit', 'delivered', 'completed'];
const contactVisibleStatuses = ['assigned', 'preparing', 'in_transit', 'delivered'];
const cancelStatuses = ['pending_dispatch', 'dispatch_failed', 'scheduled', 'assigned', 'preparing'];
const terminalOnlyStatuses = ['cancelled', 'provider_rejected'];
const inactiveDemandStatuses = ['cancelled', 'expired', 'closed', 'converted_to_order'];

const stopTap = (event?: any) => {
  event?.stopPropagation?.();
};

const normalizedStatus = (order?: Pick<V2OrderSummary, 'status'> | null) =>
  String(order?.status || '').toLowerCase();

const normalizedMode = (order?: Pick<V2OrderSummary, 'order_mode'> | null) =>
  String(order?.order_mode || '').toLowerCase();

const normalizedDemandStatus = (demand?: Pick<DemandSummary, 'status'> | null) =>
  String(demand?.status || '').toLowerCase();

const isCustomerActionableDemand = (demand: DemandSummary) =>
  !inactiveDemandStatuses.includes(normalizedDemandStatus(demand));

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
  pending_provider_confirmation: '待服务商确认',
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

const isPaymentReady = (order: V2OrderSummary) => {
  const contract = (order as any).contract;
  if (contract) {
    if (typeof contract.payment_ready === 'boolean') return contract.payment_ready;
    return String(contract.status || '').toLowerCase() === 'fully_signed';
  }
  if (normalizedStatus(order) === 'pending_payment') return false;
  return Boolean(order.payment_ready);
};

const needsContractSign = (order: V2OrderSummary) =>
  normalizedStatus(order) === 'pending_payment' && !isPaymentReady(order);

const statusLabelOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (status === 'pending_payment' && needsContractSign(order)) return '待签署合同';
  return ORDER_STATUS_LABEL_MAP[status] || '服务推进中';
};

const statusToneOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (['completed', 'delivered'].includes(status)) return 'success';
  if (['cancelled', 'provider_rejected'].includes(status)) return 'muted';
  if (['pending_payment', 'pending_provider_confirmation', 'pending_dispatch', 'auto_assigning', 'dispatch_failed', 'scheduled', 'created'].includes(status)) return 'warning';
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

const canContactProvider = (order: V2OrderSummary) =>
  contactVisibleStatuses.includes(normalizedStatus(order));

const canPay = (order: V2OrderSummary) =>
  normalizedStatus(order) === 'pending_payment';

const canReview = (order: V2OrderSummary) =>
  normalizedStatus(order) === 'completed' && !(order as any).reviewed;

const isTerminalOnly = (order: V2OrderSummary) =>
  terminalOnlyStatuses.includes(normalizedStatus(order));

const hasActionButtons = (order: V2OrderSummary) =>
  isTerminalOnly(order) ||
  canCancel(order) ||
  canIncreasePrice(order) ||
  canAddTip(order) ||
  canOpenProgress(order) ||
  canContactProvider(order) ||
  canPay(order) ||
  canReview(order);

const statusBucketOf = (order: V2OrderSummary): StatusFilter =>
  activeStatuses.includes(normalizedStatus(order)) ? 'active' : 'done';

const ORDER_STATUS_SORT_RANK: Record<string, number> = {
  pending_payment: 0,
  delivered: 1,
  in_transit: 2,
  in_progress: 3,
  preparing: 4,
  assigned: 5,
  pending_provider_confirmation: 6,
  pending_dispatch: 7,
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

const customerOrderSortRank = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (ORDER_STATUS_SORT_RANK[status] !== undefined) return ORDER_STATUS_SORT_RANK[status];
  return statusBucketOf(order) === 'active' ? 20 : 70;
};

const compareCustomerOrders = (a: V2OrderSummary, b: V2OrderSummary) => {
  const rankDiff = customerOrderSortRank(a) - customerOrderSortRank(b);
  if (rankDiff !== 0) return rankDiff;
  return orderSortTime(b) - orderSortTime(a);
};

const listItemsOf = (response: unknown): V2OrderSummary[] => {
  const data = response as any;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
};

const demandItemsOf = (response: unknown): DemandSummary[] => {
  const data = response as any;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data?.list)) return data.data.list;
  return [];
};

export default function RoleOrdersPage() {
  const dispatch = useDispatch();

  useDidShow(() => {
    if (readStoredRoleMode() !== 'customer') {
      dispatch(setHaulRoleMode('customer'));
    }
    syncCustomTabBar(1, 'customer');
  });

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

function PendingOfferDraftCard({
  draft,
  onResume,
  onDiscard,
}: {
  draft: QuickOrderDraft;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const summary = quickOrderOfferDraftSummary(draft);

  return (
    <View className="pending-offer-card">
      <View className="pending-offer-main" onClick={onResume}>
        <Text className="pending-offer-eyebrow">待完成下单</Text>
        <Text className="pending-offer-title" numberOfLines={1}>继续挑选服务商</Text>
        <Text className="pending-offer-route" numberOfLines={1}>{summary.route}</Text>
        <Text className="pending-offer-meta" numberOfLines={1}>{summary.meta}</Text>
      </View>
      <View className="pending-offer-actions">
        <View className="pending-offer-discard" onClick={onDiscard}>
          <Text>放弃</Text>
        </View>
        <View className="pending-offer-resume" onClick={onResume}>
          <Text>继续</Text>
        </View>
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
  const [pendingOfferDraft, setPendingOfferDraft] = useState<QuickOrderDraft | null>(null);

  const fetchDemands = useCallback(async () => {
    try {
      const res = await demandV2Service.listMyDemands({ page: 1, page_size: 50 });
      const list = demandItemsOf(res);
      setDemands(list);
      const draftDemandId = Number(readQuickOrderOfferDraft()?.demand_id || 0);
      if (draftDemandId && list.some(demand => Number(demand.id || 0) === draftDemandId && !isCustomerActionableDemand(demand))) {
        clearQuickOrderOfferDraftForDemand(draftDemandId);
        setPendingOfferDraft(null);
      }
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
    syncCustomTabBar(1, 'customer');
    setPendingOfferDraft(readQuickOrderOfferDraft());
    const hint = Taro.getStorageSync(CUSTOMER_ORDERS_SEGMENT_KEY);
    if (hint === 'demands' || hint === 'orders') {
      setActiveSegment(hint);
      Taro.removeStorageSync(CUSTOMER_ORDERS_SEGMENT_KEY);
    }
    setDemandsLoading(true);
    fetchDemands();
  });

  useEffect(() => {
    if (activeSegment !== 'demands') return undefined;
    const timer = setInterval(() => {
      fetchDemands();
    }, 8000);
    return () => clearInterval(timer);
  }, [activeSegment, fetchDemands]);

  const handleSegmentChange = useCallback((next: CustomerOrderSegment) => {
    setActiveSegment(next);
  }, []);

  const activeDemandCount = useMemo(
    () => demands.filter(isCustomerActionableDemand).length,
    [demands],
  );
  const actionableDemands = useMemo(
    () => demands.filter(isCustomerActionableDemand),
    [demands],
  );

  const segmentBar = (
    <CustomerOrderSegmentBar active={activeSegment} onChange={handleSegmentChange} demandCount={activeDemandCount} />
  );
  const resumeOfferDraft = useCallback(() => {
    Taro.navigateTo({ url: '/pages/supply/list/index?quickOrder=1' });
  }, []);
  const discardOfferDraft = useCallback(async () => {
    const res = await Taro.showModal({
      title: '放弃本次挑选？',
      content: '放弃后需要重新填写吊运信息。',
      confirmText: '放弃',
      confirmColor: '#dc2626',
      cancelText: '保留',
    }).catch(() => null);
    if (!res?.confirm) return;
    clearQuickOrderOfferDraft();
    setPendingOfferDraft(null);
  }, []);
  const offerDraftCard = pendingOfferDraft ? (
    <PendingOfferDraftCard
      draft={pendingOfferDraft}
      onResume={resumeOfferDraft}
      onDiscard={discardOfferDraft}
    />
  ) : null;

  if (activeSegment === 'demands') {
    return (
      <CustomerDemandsPage
        segmentBar={segmentBar}
        demands={actionableDemands}
        loading={demandsLoading}
        refreshing={demandsRefreshing}
        error={demandsError}
        offerDraftCard={offerDraftCard}
        hasHistoricalDemands={demands.length > 0}
        onViewOrders={() => setActiveSegment('orders')}
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

  return <CustomerOrdersPage segmentBar={segmentBar} offerDraftCard={offerDraftCard} />;
}

function CustomerDemandsPage({
  segmentBar,
  demands,
  loading,
  refreshing,
  error,
  offerDraftCard,
  hasHistoricalDemands,
  onViewOrders,
  onRefresh,
  onRetry,
}: {
  segmentBar: React.ReactNode;
  demands: DemandSummary[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  offerDraftCard?: React.ReactNode;
  hasHistoricalDemands: boolean;
  onViewOrders: () => void;
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
        {offerDraftCard}

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
            <Text className="empty-state-text">
              {hasHistoricalDemands ? '暂无待处理任务，已生成的订单可在我的订单查看' : '还没有发布过吊运任务'}
            </Text>
            <View className="empty-state-cta" onClick={hasHistoricalDemands ? onViewOrders : goPublish}>
              <Text>{hasHistoricalDemands ? '查看我的订单' : '回首页发布任务'}</Text>
            </View>
          </View>
        ) : (
          demands.map(demand => {
            const meta = getObjectStatusMeta('demand', demand.status);
            const route = String(demand.title || '未命名任务');
            const quoteCount = demand.quote_count || 0;
            const demandStatus = normalizedDemandStatus(demand);
            const isSelectedDemand = demandStatus === 'selected' || Number((demand as any).selected_quote_id || 0) > 0;
            const budgetMin = Math.round(Number(demand.budget_min || 0) / 100);
            const budgetMax = Math.round(Number(demand.budget_max || 0) / 100);
            const budgetText = budgetMin > 0 || budgetMax > 0
              ? `¥${budgetMin}-${budgetMax}`
              : '待估';
            const quoteStateText = isSelectedDemand
              ? '已选定服务商'
              : quoteCount > 0
                ? `已收到 ${quoteCount} 家报价`
                : '等待服务商报价';
            const nextActionText = isSelectedDemand
              ? '等待生成订单'
              : quoteCount > 0
                ? '点开选择服务商'
                : '等待服务商报价';
            return (
              <View key={demand.id} className="order-card order-card-demand" onClick={() => openDetail(demand)}>
                <View className="order-card-head">
                  <View className={`order-status-badge order-status-${meta.tone || 'gray'}`}>
                    <Text>{meta.label}</Text>
                  </View>
                  <Text className="order-card-no">{demand.demand_no}</Text>
                </View>
                <View className="demand-card-main">
                  <Text className="demand-card-title" numberOfLines={1}>{route}</Text>
                  <Text className="demand-card-meta" numberOfLines={1}>{getDemandSceneLabel(demand.cargo_scene)} · {quoteStateText}</Text>
                </View>
                <View className="demand-card-foot">
                  <View className={`demand-next ${quoteCount > 0 ? 'is-ready' : ''}`}>
                    <Text className="demand-next-label">下一步</Text>
                    <Text className="demand-next-text">{nextActionText}</Text>
                  </View>
                  <View className="demand-budget">
                    <Text className="demand-budget-label">预算</Text>
                    <Text className="demand-budget-value">{budgetText}</Text>
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

function CustomerOrdersPage({
  segmentBar,
  offerDraftCard,
}: {
  segmentBar?: React.ReactNode;
  offerDraftCard?: React.ReactNode;
}) {
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
      const list = listItemsOf(response).sort(compareCustomerOrders);
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
    syncCustomTabBar(1, 'customer');
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
    Taro.navigateTo({
      url: needsContractSign(order)
        ? `/pages/orders/contract/index?orderId=${order.id}`
        : `/pages/payment/index?orderId=${order.id}`,
    });
  };

  const goReview = (event: any, order: V2OrderSummary) => {
    stopTap(event);
    Taro.navigateTo({ url: `/pages/review/index?orderId=${order.id}` });
  };

  const goProgress = (event: any, order: V2OrderSummary) => {
    stopTap(event);
    const url = progressUrlOf(order.id, order);
    if (!url) {
      Taro.showToast({ title: '暂无可查看进度', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url });
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
        {canOpenProgress(order) ? (
          <View className="order-card-button order-card-button-ghost" onClick={event => goProgress(event, order)}>
            <Text>{progressActionLabelOf(order)}</Text>
          </View>
        ) : null}
        {canContactProvider(order) ? (
          <View className="order-card-button order-card-button-ghost" onClick={event => callProvider(event, order)}>
            <Text>拨打电话</Text>
          </View>
        ) : null}
        {canPay(order) ? (
          <View className="order-card-button order-card-button-primary" onClick={event => goPayment(event, order)}>
            <Text>{needsContractSign(order) ? '签署合同' : '去支付'}</Text>
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
        {offerDraftCard}
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
            <Text className="empty-state-text">还没有订单，回首页可立即下单或发布吊运任务</Text>
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
