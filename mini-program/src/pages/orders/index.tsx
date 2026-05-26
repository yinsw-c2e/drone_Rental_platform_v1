import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState, useAppDispatch } from '../../store/store';
import { setHaulRoleMode } from '../../store/slices/roleSlice';
import { orderV2Service } from '../../services/orderV2';
import { V2OrderSummary } from '../../types';
import { syncCustomTabBar } from '../../utils/tabBar';
import DemandListPage from '../demand/list';
import './index.scss';

type StatusFilter = 'all' | 'active' | 'done';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已结束' },
];

const activeStatuses = ['pending_dispatch', 'auto_assigning', 'scheduled', 'assigned', 'preparing', 'in_transit', 'delivered', 'pending_payment'];
const providerVisibleStatuses = ['assigned', 'preparing', 'in_transit', 'delivered', 'completed'];
const contactVisibleStatuses = ['assigned', 'preparing', 'in_transit', 'delivered'];
const liveStatuses = ['assigned', 'preparing', 'in_transit', 'delivered'];
const cancelStatuses = ['pending_dispatch', 'scheduled', 'assigned', 'preparing'];
const terminalOnlyStatuses = ['cancelled', 'provider_rejected'];

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
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '实时位置中查看 ETA';
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

const statusLabelOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (status === 'pending_dispatch' || status === 'auto_assigning') return '等待服务商';
  if (status === 'assigned') return '服务商已接单';
  if (status === 'preparing') return '准备起飞';
  if (status === 'in_transit') return '飞行中';
  if (status === 'delivered') return '等待签收';
  if (status === 'completed') return '已完成';
  if (status === 'cancelled') return '已取消';
  if (status === 'provider_rejected') return '服务未确认';
  if (status === 'pending_payment') return '待支付';
  if (status === 'scheduled') return '已预约';
  return '服务推进中';
};

const statusToneOf = (order: V2OrderSummary) => {
  const status = normalizedStatus(order);
  if (['completed', 'delivered'].includes(status)) return 'success';
  if (['cancelled', 'provider_rejected'].includes(status)) return 'muted';
  if (['pending_payment', 'pending_dispatch', 'auto_assigning', 'scheduled'].includes(status)) return 'warning';
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
  const router = useRouter();
  const dispatch = useAppDispatch();
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const forcedMode = router.params?.mode === 'provider' ? 'provider' : selectedMode;

  React.useEffect(() => {
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
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<V2OrderSummary[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await orderV2Service.list({ role: 'client', page: 1, page_size: 50 });
      const list = listItemsOf(response).sort(
        (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
      );
      setItems(list);
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '订单加载失败'), icon: 'none' });
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
      Taro.showToast({ title: String(error?.message || '取消失败'), icon: 'none' });
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
      Taro.showToast({ title: String(error?.message || '加价失败'), icon: 'none' });
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
      Taro.showToast({ title: String(error?.message || '小费支付失败'), icon: 'none' });
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
    Taro.navigateTo({ url: `/pages/orders/live/index?orderId=${order.id}` });
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
          <View className="order-card-button order-card-button-primary" onClick={event => goLive(event, order)}>
            <Text>查看实时位置</Text>
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
      <View className="orders-page-content">
        <Text className="orders-page-title">我的订单</Text>
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
                        <Text>☎</Text>
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
