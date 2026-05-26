// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { orderV2Service, confirmReceipt } from '../../../services/orderV2';
import { orderFinanceV2Service } from '../../../services/orderFinanceV2';
import { store } from '../../../store/store';
import './index.scss';

import iconBack from '../../../assets/haul/order-progress/icon_nav_back.png';
import iconService from '../../../assets/haul/order-progress/icon_nav_service_headset.png';
import iconAccepted from '../../../assets/haul/order-progress/icon_status_accepted_green.png';
import logoProvider from '../../../assets/haul/order-progress/logo_provider_anyi.png';
import iconWeight from '../../../assets/haul/order-progress/icon_summary_weight_gray.png';
import iconPickup from '../../../assets/haul/order-progress/icon_pickup_pin_green.png';
import iconDropoff from '../../../assets/haul/order-progress/icon_dropoff_pin_orange.png';
import iconDrone from '../../../assets/haul/order-progress/icon_drone_service_blue.png';
import iconTeam from '../../../assets/haul/order-progress/icon_team_blue.png';
import iconChevron from '../../../assets/haul/order-progress/icon_summary_chevron_right.png';
import iconTimelineCheck from '../../../assets/haul/order-progress/icon_timeline_check.png';
import iconTimelineActive3 from '../../../assets/haul/order-progress/icon_timeline_active_3.png';
import iconTimelinePending4 from '../../../assets/haul/order-progress/icon_timeline_pending_4.png';
import iconTimelinePending5 from '../../../assets/haul/order-progress/icon_timeline_pending_5.png';
import iconTimelinePending6 from '../../../assets/haul/order-progress/icon_timeline_pending_6.png';
import iconPhone from '../../../assets/haul/order-progress/icon_phone_outline.png';
import tabHome from '../../../assets/haul/order-progress/tab_home_inactive.png';
import tabOrder from '../../../assets/haul/order-progress/tab_order_active.png';
import tabMessage from '../../../assets/haul/order-progress/tab_message_inactive.png';
import tabProfile from '../../../assets/haul/order-progress/tab_profile_inactive.png';
import badgeMessage from '../../../assets/haul/order-progress/badge_message_red_3.png';

const formatFullDateTime = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
};

const formatMoney = (amount?: number | null) => {
  const value = Number(amount || 0) / 100;
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
};

const settlementStatusLabelOf = (status?: string) => {
  if (status === 'pending') return '待计算';
  if (status === 'calculated') return '已计算';
  if (status === 'confirmed') return '已确认';
  if (status === 'settled') return '已入账';
  if (status === 'disputed') return '争议中';
  return '待生成';
};

const providerNameOf = (detail: any) =>
  detail?.participants?.provider?.nickname ||
  detail?.provider?.nickname ||
  detail?.provider_nickname ||
  '服务商待确认';

const providerPhoneOf = (detail: any) =>
  detail?.participants?.provider?.phone ||
  detail?.provider?.phone ||
  detail?.provider_phone ||
  '';

const customerPhoneOf = (detail: any) =>
  detail?.participants?.client?.phone ||
  detail?.client?.phone ||
  detail?.client_phone ||
  detail?.renter_phone ||
  '';

const participantUserIdOf = (detail: any, key: string) =>
  Number(detail?.participants?.[key]?.user_id || detail?.participants?.[key]?.id || 0);

const isCallablePhone = (phone?: string) =>
  Boolean(phone && !String(phone).includes('*') && /^[\d+\-\s]{5,}$/.test(String(phone)));

const sourceSupplyIdOf = (detail: any) =>
  Number(detail?.source_info?.source_supply_id || detail?.source_supply_id || detail?.supply_id || 0);

const cargoWeightTextOf = (detail: any) => {
  const value = detail?.cargo_weight_kg || detail?.cargo_weight || detail?.payload_weight_kg || detail?.current_dispatch?.cargo_weight;
  return value ? `${value}kg` : '--';
};

const statusLabelOf = (status?: string) => {
  if (status === 'pending_provider_confirmation') return '待服务商确认';
  if (status === 'pending_payment') return '待支付';
  if (status === 'pending_dispatch') return '待开始履约';
  if (status === 'assigned') return '服务商已接单';
  if (status === 'preparing') return '准备中';
  if (status === 'loading') return '装载中';
  if (status === 'in_transit') return '吊运中';
  if (status === 'delivered') return '待确认收货';
  if (status === 'completed') return '已完成';
  if (status === 'cancelled') return '已取消';
  return status || '状态已更新';
};

const serviceLevelOf = (detail: any) => {
  const weight = Number(String(cargoWeightTextOf(detail)).replace(/[^\d.]/g, '')) || 0;
  if (detail?.estimated_service) return detail.estimated_service;
  if (!weight) return '--';
  if (weight <= 50) return '50kg 级服务';
  if (weight <= 100) return '100kg 级服务';
  if (weight <= 300) return '300kg 级服务';
  return '300kg+ 级服务';
};

const statusTitleOf = (status: string) => {
  if (status === 'completed') return '订单已完成';
  if (status === 'delivered') return '等待客户确认';
  if (status === 'cancelled') return '订单已取消';
  if (status === 'pending_provider_confirmation') return '等待服务商接单';
  if (status === 'pending_payment') return '等待支付';
  if (status === 'pending_dispatch') return '等待服务商开始履约';
  if (['assigned', 'preparing'].includes(status)) return '服务商已接单';
  if (['loading', 'in_transit'].includes(status)) return '吊运进行中';
  if (!status) return '订单状态未知';
  return '服务商已接单';
};

const statusDescOf = (status: string) => {
  if (status === 'completed') return '本次吊运服务已完成';
  if (status === 'delivered') return '货物已送达，请确认完成';
  if (status === 'cancelled') return '订单已结束';
  if (status === 'pending_provider_confirmation') return '服务商正在确认方案，请耐心等待';
  if (status === 'pending_payment') return '请完成支付后继续履约流程';
  if (status === 'pending_dispatch') return '服务商待开始履约';
  if (['loading', 'in_transit'].includes(status)) return '吊运作业正在进行';
  if (!status) return '正在等待订单状态同步';
  return '服务商正在安排准备，请耐心等待';
};

const getStepState = (detail: any) => {
  const status = detail?.status || '';
  if (['completed'].includes(status)) return 6;
  if (['delivered'].includes(status)) return 5;
  if (['in_transit'].includes(status)) return 5;
  if (['preparing', 'assigned', 'pending_dispatch'].includes(status)) return 3;
  if (['pending_payment', 'paid'].includes(status)) return 2;
  return 1;
};

const normalizedStatus = (order?: any) => String(order?.status || '').toLowerCase();
const normalizedMode = (order?: any) => String(order?.order_mode || '').toLowerCase();
const cancelStatuses = ['pending_dispatch', 'scheduled', 'assigned', 'preparing'];
const contactVisibleStatuses = ['assigned', 'preparing', 'in_transit', 'delivered'];
const terminalOnlyStatuses = ['cancelled', 'provider_rejected'];

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

const formatEta = (seconds?: number | null) => {
  if (seconds === 0) return '即将到达';
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '等待实时位置';
  const safe = Math.max(0, Math.round(Number(seconds)));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  if (min <= 0) return `约 ${sec} 秒到达`;
  return `约 ${min} 分 ${sec} 秒到达`;
};

const orderStatusBadgeOf = (order: any) => {
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

const orderStatusToneOf = (order: any) => {
  const status = normalizedStatus(order);
  if (['completed', 'delivered'].includes(status)) return 'success';
  if (['cancelled', 'provider_rejected'].includes(status)) return 'muted';
  if (['pending_payment', 'pending_dispatch', 'auto_assigning', 'scheduled'].includes(status)) return 'warning';
  return 'primary';
};

const detailProviderNameOf = (detail: any) => {
  const direct = detail?.provider_snapshot?.nickname || detail?.provider_snapshot?.name || providerNameOf(detail);
  if (direct && direct !== '服务商待确认') return direct;
  const id = Number(detail?.provider_user_id || detail?.participants?.provider?.user_id || 0);
  if (id > 0) return `服务商 ${String(id).slice(-4)}`;
  return '服务商待确认';
};

const canCancelOrder = (order: any) => cancelStatuses.includes(normalizedStatus(order));
const canIncreaseOrderPrice = (order: any) =>
  normalizedMode(order) === 'instant' &&
  normalizedStatus(order) === 'pending_dispatch' &&
  orderAgeSeconds(order?.created_at) >= 90;
const canAddOrderTip = (order: any) => {
  const mode = normalizedMode(order);
  const status = normalizedStatus(order);
  if (!['instant', 'reservation'].includes(mode)) return false;
  if (status === 'in_transit') return true;
  return status === 'delivered' && within24Hours(order?.updated_at || order?.completed_at || order?.created_at);
};
const canContactOrderProvider = (order: any) => contactVisibleStatuses.includes(normalizedStatus(order));
const canReviewOrder = (order: any) => normalizedStatus(order) === 'completed' && !order?.reviewed;
const isTerminalOnlyOrder = (order: any) => terminalOnlyStatuses.includes(normalizedStatus(order));

export default function OrderProgressPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [remoteDetail, setRemoteDetail] = useState<any | null>(null);
  const [remoteTimeline, setRemoteTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [errorText, setErrorText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [settlement, setSettlement] = useState<any | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setRemoteDetail(null);
      setSettlement(null);
      setErrorText('缺少订单ID，无法展示订单进度');
      setLoading(false);
      return;
    }
    if (!store.getState().auth.accessToken) {
      setRemoteDetail(null);
      setSettlement(null);
      setErrorText('请先登录后查看订单进度');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText('');
    setSettlement(null);
    try {
      const res = await orderV2Service.get(orderId);
      const detail = (res as any)?.data || res;
      if (!detail || !detail.id) {
        setRemoteDetail(null);
        setRemoteTimeline([]);
        setSettlement(null);
        setErrorText('订单不存在或已不可查看');
        return;
      }
      setRemoteDetail(detail);
      if (String(detail.status) === 'completed') {
        setSettlementLoading(true);
        try {
          const settlementRes = await orderFinanceV2Service.getSettlement(orderId);
          setSettlement((settlementRes as any)?.data || settlementRes);
        } catch {
          setSettlement(null);
        } finally {
          setSettlementLoading(false);
        }
      }
      try {
        const timelineRes = await orderV2Service.getTimeline(orderId);
        const timelineData = (timelineRes as any)?.data || timelineRes;
        setRemoteTimeline(Array.isArray(timelineData?.items) ? timelineData.items : []);
      } catch {
        setRemoteTimeline(Array.isArray(detail?.timeline) ? detail.timeline : []);
      }
    } catch (error: any) {
      setRemoteDetail(null);
      setRemoteTimeline([]);
      setSettlement(null);
      setErrorText(error?.message || '订单加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useDidShow(() => {
    load();
  });

  const detail = useMemo(() => remoteDetail, [remoteDetail]);
  const stepState = detail ? getStepState(detail) : 0;
  const canConfirm = detail?.status === 'delivered';
  const canPay = detail?.status === 'pending_payment';
  const canReview = detail?.status === 'completed';
  const canViewLive = ['instant', 'reservation'].includes(String(detail?.order_mode || ''))
    && ['assigned', 'preparing', 'in_transit', 'delivered'].includes(String(detail?.status || ''));
  const needsContractSign = canPay && !detail?.payment_ready;
  const providerPhone = detail ? providerPhoneOf(detail) : '';
  const customerPhone = detail ? customerPhoneOf(detail) : '';
  const currentUserId = Number(store.getState().auth.user?.id || 0);
  const clientUserId = detail ? Number(
    detail.client_user_id ||
    detail.renter_id ||
    participantUserIdOf(detail, 'client') ||
    0,
  ) : 0;
  const providerUserIds = detail ? [
    detail.provider_user_id,
    detail.owner_id,
    detail.drone_owner_user_id,
    detail.executor_pilot_user_id,
    participantUserIdOf(detail, 'provider'),
    participantUserIdOf(detail, 'executor'),
  ].map((id) => Number(id || 0)).filter(Boolean) : [];
  const isProviderViewer = Boolean(currentUserId && providerUserIds.includes(currentUserId) && currentUserId !== clientUserId);
  const contactTargetLabel = isProviderViewer ? '客户' : '服务商';
  const contactPhone = isProviderViewer ? customerPhone : providerPhone;
  const sourceSupplyId = detail ? sourceSupplyIdOf(detail) : 0;
  const demandId = Number(detail?.source_info?.demand_id || detail?.demand_id || 0);
  const orderNo = detail?.order_no || '';
  const createdAt = formatFullDateTime(detail?.created_at);
  const providerConfirmedAt = detail?.provider_confirmed_at
    ? formatFullDateTime(detail.provider_confirmed_at)
    : '等待确认';
  const serviceStartedAt = detail?.updated_at ? formatFullDateTime(detail.updated_at) : '待开始';

  const goBack = () => {
    if (Taro.getCurrentPages().length > 1) Taro.navigateBack();
    else Taro.switchTab({ url: '/pages/orders/index' });
  };

  const openService = () => Taro.switchTab({ url: '/pages/messages/index' });

  const viewPlan = () => {
    if (sourceSupplyId) {
      Taro.navigateTo({ url: `/pages/supply/detail/index?id=${sourceSupplyId}` });
      return;
    }
    if (demandId) {
      Taro.navigateTo({ url: `/pages/demand/detail/index?id=${demandId}` });
      return;
    }
    Taro.showToast({ title: '暂无方案详情', icon: 'none' });
  };

  const viewLive = () => {
    if (!orderId) return;
    Taro.navigateTo({ url: `/pages/orders/live/index?orderId=${orderId}` });
  };

  const copyOrderNo = () => {
    if (!orderNo) return;
    Taro.setClipboardData({ data: orderNo });
  };

  const contactCounterparty = () => {
    if (isCallablePhone(contactPhone)) {
      Taro.makePhoneCall({ phoneNumber: contactPhone });
      return;
    }
    Taro.showModal({
      title: `联系${contactTargetLabel}`,
      content: `当前${contactTargetLabel}暂无可直拨电话，可先通过消息联系客服。`,
      confirmText: '去消息',
      success: (res) => {
        if (res.confirm) openService();
      },
    });
  };

  const cancelOrder = async () => {
    if (!detail || !orderId) return;
    const res = await Taro.showModal({
      title: '确认取消订单？',
      content: '取消后订单将停止继续匹配或服务。',
      confirmText: '确认取消',
    });
    if (!res.confirm) return;
    setActionLoading(true);
    try {
      await orderV2Service.cancel(orderId, '客户主动取消');
      Taro.showToast({ title: '已取消', icon: 'success' });
      load();
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '取消失败'), icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  const increasePrice = async () => {
    if (!detail || !orderId) return;
    const res = await Taro.showModal({
      title: '附近运力紧张',
      content: '加价 ¥20 提升接单优先级？',
      confirmText: '确认加价',
    });
    if (!res.confirm) return;
    setActionLoading(true);
    try {
      await orderV2Service.priceIncrease(orderId, { amount: 2000, reason: '加价提升接单' });
      Taro.showToast({ title: '加价成功，已通知服务商', icon: 'success' });
      load();
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '加价失败'), icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  const addTip = async () => {
    if (!detail || !orderId) return;
    const sheet = await Taro.showActionSheet({ itemList: ['¥5', '¥10', '¥20'] }).catch(() => null);
    if (!sheet || typeof sheet.tapIndex !== 'number') return;
    const amount = [500, 1000, 2000][sheet.tapIndex] || 500;
    const res = await Taro.showModal({
      title: '给服务商小费',
      content: `给服务商小费 ¥${amount / 100}？`,
      confirmText: '确认支付',
    });
    if (!res.confirm) return;
    setActionLoading(true);
    try {
      await orderV2Service.addTip(orderId, amount);
      Taro.showToast({ title: '小费已支付', icon: 'success' });
      load();
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '小费支付失败'), icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  const submitConfirm = () => {
    if (canPay) {
      Taro.navigateTo({
        url: needsContractSign
          ? `/pages/orders/contract/index?orderId=${orderId}`
          : `/pages/payment/index?orderId=${orderId}`,
      });
      return;
    }
    if (canReview) {
      Taro.navigateTo({ url: `/pages/review/index?orderId=${orderId}` });
      return;
    }
    if (!canConfirm) return;
    Taro.showModal({
      title: '确认完成',
      content: '确认货物已完成吊运并签收？',
      success: async (res) => {
        if (!res.confirm || !orderId) return;
        setActionLoading(true);
        try {
          await confirmReceipt(orderId);
          Taro.showToast({ title: '已确认', icon: 'success' });
          load();
        } catch (e: any) {
          Taro.showToast({ title: e?.message || '操作失败', icon: 'none' });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const switchMainTab = (url: string) => {
    Taro.switchTab({ url });
  };

  const summaryRows = detail ? [
    { key: 'provider', icon: logoProvider, label: '服务商', value: providerNameOf(detail), clickable: true },
    { key: 'weight', icon: iconWeight, label: '货物重量', value: cargoWeightTextOf(detail) },
    { key: 'pickup', icon: iconPickup, label: '起吊点', value: detail?.service_address || '-' },
    { key: 'dropoff', icon: iconDropoff, label: '落放点', value: detail?.dest_address || '-' },
    { key: 'service', icon: iconDrone, label: '预计服务', value: serviceLevelOf(detail) },
    { key: 'team', icon: iconTeam, label: '服务商履约', value: stepState >= 3 ? '服务商已接单' : '等待服务商开始履约' },
  ] : [];

  const timeline = detail ? [
    { idx: 1, title: '已提交吊运需求', time: createdAt, desc: '您已提交吊运需求', icon: iconTimelineCheck, done: stepState >= 1 },
    { idx: 2, title: '服务商已确认方案', time: providerConfirmedAt, desc: '服务商已确认并提交方案', icon: iconTimelineCheck, done: stepState >= 2 },
    { idx: 3, title: '服务商开始履约', time: serviceStartedAt, desc: stepState >= 3 ? '服务商已进入履约推进' : '待开始', icon: iconTimelineActive3, active: stepState === 3, done: stepState >= 3 },
    { idx: 4, title: '到场安全评估', time: '服务商到达现场后进行', desc: '待开始', icon: iconTimelinePending4, done: stepState >= 4 },
    { idx: 5, title: '开始吊运', time: '吊运作业进行中', desc: '待开始', icon: iconTimelinePending5, done: stepState >= 5 },
    { idx: 6, title: '已完成，等待确认', time: '作业完成，请您确认', desc: stepState >= 6 ? '已完成' : '待完成', icon: iconTimelinePending6, done: stepState >= 6 },
  ] : [];
  const timelineRows = remoteTimeline.length > 0
    ? remoteTimeline.slice(0, 6).map((event, index) => {
        const status = event?.status || event?.payload?.status || '';
        const desc = event?.description && event.description !== status
          ? event.description
          : statusLabelOf(status);
        return {
          idx: index + 1,
          title: event?.title || statusLabelOf(status),
          time: formatFullDateTime(event?.occurred_at || event?.created_at),
          desc,
          icon: index < 2 ? iconTimelineCheck : index === 2 ? iconTimelineActive3 : [iconTimelinePending4, iconTimelinePending5, iconTimelinePending6][Math.min(index - 3, 2)],
          done: true,
        };
      })
    : timeline;
  const primaryActionText = needsContractSign
    ? '签署合同'
    : canPay
        ? '去支付'
      : canConfirm
        ? (actionLoading ? '确认中...' : '确认完成')
        : canReview
          ? '评价订单'
      : '完成后可确认';
  const showProviderCardRow = detail && ['assigned', 'preparing', 'in_transit', 'delivered', 'completed'].includes(normalizedStatus(detail));
  const showEtaRow = normalizedStatus(detail) === 'in_transit';
  const showTerminalOnlyAction = detail && isTerminalOnlyOrder(detail);
  const settlementRows = settlement?.id ? [
    { label: '结算单号', value: settlement.settlement_no || '--' },
    { label: '客户实付', value: formatMoney(settlement.final_amount || settlement.total_amount) },
    { label: '平台服务费', value: formatMoney(settlement.platform_fee) },
    { label: '履约服务费', value: formatMoney(settlement.pilot_fee) },
    { label: '设备服务费', value: formatMoney(settlement.owner_fee) },
    { label: '结算状态', value: settlementStatusLabelOf(settlement.status) },
  ] : [];

  return (
    <View className="op5-page">
      <View className="op5-top-bg" />
      <View className="op5-nav">
        <View className="op5-back-hit" onClick={goBack}>
          <Image className="op5-back" src={iconBack} mode="aspectFit" />
        </View>
        <Text className="op5-nav-title">订单进度</Text>
        <View className="op5-service-hit" onClick={openService}>
          <Image className="op5-service-icon" src={iconService} mode="aspectFit" />
          <Text className="op5-service-text">客服</Text>
        </View>
      </View>

      <ScrollView scrollY className="op5-scroll" enhanced showScrollbar={false}>
        <View className="op5-content">
          {!detail ? (
            <View className="op5-empty-card">
              <Text className="op5-empty-title">{loading ? '正在同步订单信息' : '无法展示订单进度'}</Text>
              <Text className="op5-empty-desc">{loading ? '请稍候，正在读取真实订单数据。' : errorText || '订单不存在或当前账号无权查看。'}</Text>
            </View>
          ) : (
            <>
          <View className="op5-lala-card">
            <View className="op5-lala-head">
              <View className={`op5-lala-badge op5-lala-badge-${orderStatusToneOf(detail)}`}>
                <Text>{orderStatusBadgeOf(detail)}</Text>
              </View>
              <View className="op5-lala-copy" onClick={copyOrderNo}>
                <Text>复制单号</Text>
              </View>
            </View>

            <View className="op5-lala-route">
              <View className="op5-lala-route-row">
                <View className="op5-lala-route-dot op5-lala-route-start" />
                <Text>{detail?.service_address || '起点待确认'}</Text>
              </View>
              <View className="op5-lala-route-row">
                <View className="op5-lala-route-dot op5-lala-route-end" />
                <Text>{detail?.dest_address || '终点待确认'}</Text>
              </View>
            </View>

            {showProviderCardRow ? (
              <View className="op5-lala-provider">
                <View className="op5-lala-avatar" />
                <View className="op5-lala-provider-main">
                  <Text className="op5-lala-provider-name">{detailProviderNameOf(detail)}</Text>
                  <Text className="op5-lala-provider-rating">评分 5.0</Text>
                </View>
                {canContactOrderProvider(detail) ? (
                  <View className="op5-lala-phone" onClick={contactCounterparty}>
                    <Text>☎</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showEtaRow ? (
              <View className="op5-lala-eta">
                <Text>预计到达</Text>
                <Text>{formatEta(detail?.live?.eta_seconds)}</Text>
              </View>
            ) : null}

            <View className="op5-lala-meta">
              <View>
                <Text className="op5-lala-order-no">{orderNo}</Text>
                <Text className="op5-lala-order-time">下单时间：{createdAt}</Text>
              </View>
              <Text className="op5-lala-amount">{formatMoney(detail?.total_amount)}</Text>
            </View>

            <View className="op5-lala-actions">
              {showTerminalOnlyAction ? (
                <View className="op5-lala-button op5-lala-button-muted" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
                  <Text>重新下单</Text>
                </View>
              ) : (
                <>
                  {canCancelOrder(detail) ? (
                    <View className="op5-lala-button op5-lala-button-ghost" onClick={cancelOrder}>
                      <Text>取消订单</Text>
                    </View>
                  ) : null}
                  {canIncreaseOrderPrice(detail) ? (
                    <View className="op5-lala-button op5-lala-button-warn" onClick={increasePrice}>
                      <Text>附近运力紧张？加价</Text>
                    </View>
                  ) : null}
                  {canAddOrderTip(detail) ? (
                    <View className="op5-lala-button op5-lala-button-ghost" onClick={addTip}>
                      <Text>给个小费</Text>
                    </View>
                  ) : null}
                  {canViewLive ? (
                    <View className="op5-lala-button op5-lala-button-primary" onClick={viewLive}>
                      <Text>查看实时位置</Text>
                    </View>
                  ) : null}
                  {canContactOrderProvider(detail) ? (
                    <View className="op5-lala-button op5-lala-button-ghost" onClick={contactCounterparty}>
                      <Text>拨打电话</Text>
                    </View>
                  ) : null}
                  {canPay ? (
                    <View className="op5-lala-button op5-lala-button-primary" onClick={submitConfirm}>
                      <Text>去支付</Text>
                    </View>
                  ) : null}
                  {canReviewOrder(detail) ? (
                    <View className="op5-lala-button op5-lala-button-primary" onClick={() => Taro.navigateTo({ url: `/pages/review/index?orderId=${orderId}` })}>
                      <Text>评价服务</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </View>

          <View className="op5-summary-card">
            <Text className="op5-card-title">订单摘要</Text>
            <View className="op5-summary-table">
              {summaryRows.map((row, index) => (
                <View
                  key={row.key}
                  className={`op5-summary-row ${index === summaryRows.length - 1 ? 'op5-summary-row-last' : ''}`}
                  onClick={row.clickable ? viewPlan : undefined}
                >
                  <Image className={`op5-summary-icon op5-summary-icon-${row.key}`} src={row.icon} mode="aspectFit" />
                  <Text className="op5-summary-label">{row.label}</Text>
                  <Text className="op5-summary-value" numberOfLines={1}>{row.value}</Text>
                  {row.clickable ? <Image className="op5-summary-chevron" src={iconChevron} mode="aspectFit" /> : null}
                </View>
              ))}
            </View>
          </View>

          <View className="op5-progress-card">
            <Text className="op5-card-title">订单进度</Text>
            {stepState === 3 ? <View className="op5-timeline-highlight" /> : null}
            <View className="op5-timeline-line" />
            {timelineRows.map((item) => (
              <View
                key={item.idx}
                className={`op5-timeline-row op5-timeline-row-${item.idx}`}
              >
                <Image className="op5-timeline-icon" src={item.icon} mode="aspectFit" />
                <Text className="op5-timeline-title">{item.title}</Text>
                <Text className="op5-timeline-time">{item.time}</Text>
                <Text className={`op5-timeline-desc ${item.done ? 'op5-timeline-desc-done' : ''}`}>{item.desc}</Text>
              </View>
            ))}
          </View>

          {detail?.status === 'completed' ? (
            <View className="op5-settlement-card">
              <Text className="op5-card-title">结算明细</Text>
              {settlementRows.length > 0 ? (
                <View className="op5-settlement-table">
                  {settlementRows.map((row, index) => (
                    <View key={row.label} className={`op5-settlement-row ${index === settlementRows.length - 1 ? 'op5-settlement-row-last' : ''}`}>
                      <Text className="op5-settlement-label">{row.label}</Text>
                      <Text className="op5-settlement-value" numberOfLines={1}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="op5-settlement-empty">{settlementLoading ? '正在生成结算明细' : '暂未生成结算明细'}</Text>
              )}
            </View>
          ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <View className="op5-tabbar">
        <View className="op5-tab-item" onClick={() => switchMainTab('/pages/home/index')}>
          <Image className="op5-tab-icon" src={tabHome} mode="aspectFit" />
          <Text>首页</Text>
        </View>
        <View className="op5-tab-item op5-tab-current" onClick={() => switchMainTab('/pages/orders/index')}>
          <Image className="op5-tab-icon" src={tabOrder} mode="aspectFit" />
          <Text>订单</Text>
        </View>
        <View className="op5-tab-item op5-tab-message" onClick={() => switchMainTab('/pages/messages/index')}>
          <Image className="op5-tab-icon" src={tabMessage} mode="aspectFit" />
          <Image className="op5-tab-badge" src={badgeMessage} mode="aspectFit" />
          <Text>消息</Text>
        </View>
        <View className="op5-tab-item" onClick={() => switchMainTab('/pages/profile/index')}>
          <Image className="op5-tab-icon" src={tabProfile} mode="aspectFit" />
          <Text>我的</Text>
        </View>
      </View>
    </View>
  );
}
