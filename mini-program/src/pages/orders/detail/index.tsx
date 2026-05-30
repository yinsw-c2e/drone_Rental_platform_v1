// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const REDISPATCH_PRICE_BUMP_PERCENT = 10;
const REDISPATCH_RADIUS_BUMP_KM = 10;

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

const STATUS_LABEL_MAP: Record<string, string> = {
  // 订单状态
  created: '已创建',
  pending_provider_confirmation: '待服务商确认',
  pending_payment: '待支付',
  pending_dispatch: '待开始履约',
  auto_assigning: '匹配中',
  dispatch_failed: '暂无服务商',
  assigned: '服务商已接单',
  preparing: '准备中',
  loading: '装载中',
  in_transit: '吊运中',
  in_progress: '进行中',
  delivered: '待确认收货',
  completed: '已完成',
  cancelled: '已取消',
  scheduled: '已预约',
  rejected: '已拒绝',
  provider_rejected: '服务未确认',
  // 空域
  airspace_applying: '空域申请中',
  airspace_approved: '空域已批',
  airspace_rejected: '空域被拒',
  // 支付/结算
  paid: '已支付',
  refunded: '已退款',
  settled: '已入账',
  calculated: '已计算',
  confirmed: '已确认',
  disputed: '争议中',
  pending: '待处理',
  settlement_failed: '结算失败',
  // 飞行/调度
  dispatched: '已派单',
  takeoff: '已起飞',
  landed: '已降落',
  aborted: '已中止',
  failed: '失败',
  success: '成功',
};

const statusLabelOf = (status?: string) => {
  if (!status) return '状态已更新';
  const key = String(status).toLowerCase();
  return STATUS_LABEL_MAP[key] || status;
};

// 判断是不是 raw 英文 status（疑似可翻译，区别于中文/业务编号）
const looksLikeRawStatus = (value?: string) => {
  if (!value) return false;
  const text = String(value).trim();
  if (!text) return false;
  if (/[一-龥]/.test(text)) return false;
  return /^[a-z0-9_\-]+$/i.test(text) && text.length <= 40;
};

// 给 timeline 描述/标题用：raw status 翻译，其它原样返回
const translateMaybeStatus = (value?: string) => {
  if (!value) return '';
  if (!looksLikeRawStatus(value)) return value;
  const key = String(value).toLowerCase();
  return STATUS_LABEL_MAP[key] || value;
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
  if (status === 'dispatch_failed') return '暂未匹配到服务商';
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
  if (status === 'dispatch_failed') return '暂未匹配到合适服务商，可加价或扩大半径重发';
  if (status === 'pending_provider_confirmation') return '服务商正在确认方案，请耐心等待';
  if (status === 'pending_payment') return '请完成支付后继续履约流程';
  if (status === 'pending_dispatch') return '服务商待开始履约';
  if (['loading', 'in_transit'].includes(status)) return '吊运作业正在进行';
  if (!status) return '正在等待订单状态同步';
  return '服务商正在安排准备，请耐心等待';
};

// 5 步固定进度条 — 删除了原"到场安全评估"虚步骤（后端无对应 status，
// 把它放进流程里会出现"in_transit 时 step 4 被错标 done"的逻辑漏洞）。
// stepState 语义：5 步以内 === 当前 active 步；6 表示全部完成、无 active。
const getStepState = (detail: any) => {
  const status = String(detail?.status || '').toLowerCase();
  if (status === 'completed') return 6;                                    // 全 done
  if (status === 'delivered') return 5;                                    // step 5 active (等客户确认)
  if (status === 'in_transit') return 4;                                   // step 4 active (吊运中)
  if (['preparing', 'assigned'].includes(status)) return 3;                // step 3 active (开始履约)
  if (['pending_dispatch', 'dispatch_failed', 'paid', 'pending_payment'].includes(status)) return 2; // step 2 active (服务商确认/等履约)
  return 1;                                                                // 默认 step 1 active (已下单)
};

const normalizedStatus = (order?: any) => String(order?.status || '').toLowerCase();
const normalizedMode = (order?: any) => String(order?.order_mode || '').toLowerCase();
const cancelStatuses = ['pending_dispatch', 'dispatch_failed', 'scheduled', 'assigned', 'preparing'];
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
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '等待开始飞行';
  const safe = Math.max(0, Math.round(Number(seconds)));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  if (min <= 0) return `约 ${sec} 秒到达`;
  return `约 ${min} 分 ${sec} 秒到达`;
};

const orderStatusBadgeOf = (order: any) => {
  const status = normalizedStatus(order);
  if (status === 'pending_dispatch' || status === 'auto_assigning') return '等待服务商';
  if (status === 'dispatch_failed') return '暂无服务商';
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
  if (['pending_payment', 'pending_dispatch', 'auto_assigning', 'dispatch_failed', 'scheduled'].includes(status)) return 'warning';
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

const providerAdvanceActionOf = (order: any) => {
  const status = normalizedStatus(order);
  if (status === 'pending_dispatch' || status === 'assigned') {
    return { label: '开始准备', run: () => orderV2Service.startPreparing(Number(order?.id || 0)) };
  }
  if (status === 'preparing') {
    return { label: '开始飞行', run: () => orderV2Service.startFlight(Number(order?.id || 0)) };
  }
  if (status === 'in_transit') {
    return { label: '确认送达', run: () => orderV2Service.confirmDelivery(Number(order?.id || 0)) };
  }
  return null;
};

export default function OrderProgressPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [remoteDetail, setRemoteDetail] = useState<any | null>(null);
  const [remoteTimeline, setRemoteTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [errorText, setErrorText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [providerAdvanceLoading, setProviderAdvanceLoading] = useState(false);
  const [settlement, setSettlement] = useState<any | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [navTopRpx, setNavTopRpx] = useState(132);

  useEffect(() => {
    try {
      const sys = Taro.getSystemInfoSync();
      const ratio = 750 / (sys.windowWidth || 375);
      const statusBarRpx = Math.round(((sys.statusBarHeight || 20) + 12) * ratio);
      setNavTopRpx(statusBarRpx);
    } catch {
      setNavTopRpx(132);
    }
  }, []);

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
  const canConfirm = !isProviderViewer && detail?.status === 'delivered';
  const canPay = !isProviderViewer && detail?.status === 'pending_payment';
  const canReview = !isProviderViewer && detail?.status === 'completed';
  const canViewLive = ['instant', 'reservation'].includes(String(detail?.order_mode || ''))
    && ['pending_dispatch', 'assigned', 'preparing', 'in_transit', 'delivered', 'completed'].includes(String(detail?.status || ''));
  const providerAdvanceAction = isProviderViewer ? providerAdvanceActionOf(detail) : null;
  const showRedispatchActions = Boolean(detail && !isProviderViewer && normalizedStatus(detail) === 'dispatch_failed');
  const needsContractSign = canPay && !detail?.payment_ready;
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
    if (!orderId) {
      Taro.showToast({ title: '缺少订单ID，无法查看进度', icon: 'none' });
      return;
    }
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
    if (!detail || !orderId || actionLoading || providerAdvanceLoading) return;
    const providerCancel = isProviderViewer;
    const res = await Taro.showModal({
      title: providerCancel ? '确认取消接单？' : '确认取消订单？',
      content: providerCancel ? '取消后订单将回到待匹配状态，你将不再负责本单。' : '取消后订单将停止继续匹配或服务。',
      confirmText: '确认取消',
    });
    if (!res.confirm) return;
    setActionLoading(true);
    try {
      await orderV2Service.cancel(orderId, providerCancel ? '服务商取消接单' : '客户主动取消');
      Taro.showToast({ title: providerCancel ? '已取消接单' : '已取消', icon: 'success' });
      if (providerCancel) {
        Taro.setStorageSync('provider_orders_default_segment', 'mine');
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/orders/index' });
        }, 500);
      } else {
        await load();
      }
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

  const redispatchOrder = async (mode: 'price' | 'radius') => {
    if (!detail || !orderId || actionLoading) return;
    const isPriceMode = mode === 'price';
    const res = await Taro.showModal({
      title: isPriceMode ? '确认加价重发？' : '确认扩大半径？',
      content: isPriceMode
        ? `将在当前价格基础上加价 ${REDISPATCH_PRICE_BUMP_PERCENT}% 并重新匹配服务商。`
        : `将把匹配半径扩大 ${REDISPATCH_RADIUS_BUMP_KM}km 后重新匹配服务商。`,
      confirmText: '确认重发',
    });
    if (!res.confirm) return;
    setActionLoading(true);
    try {
      await orderV2Service.redispatch(
        orderId,
        isPriceMode
          ? { price_bump_percent: 0 }
          : { radius_bump_km: 0 },
      );
      Taro.showToast({ title: '已重新发起匹配', icon: 'success' });
      await load();
    } catch (error: any) {
      const code = error?.body?.code || error?.code;
      if (code === 'REDISPATCH_RATE_LIMITED') {
        Taro.showToast({ title: String(error?.body?.message || '操作过于频繁'), icon: 'none' });
        return;
      }
      if (code === 'REDISPATCH_CAPPED') {
        Taro.showModal({
          title: '重发次数已达上限',
          content: '建议取消当前订单后重新下单',
          showCancel: false,
        });
        return;
      }
      Taro.showToast({ title: String(error?.message || '重发失败'), icon: 'none' });
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

  const advanceProviderOrder = async () => {
    if (!providerAdvanceAction || !orderId || actionLoading || providerAdvanceLoading) return;
    setProviderAdvanceLoading(true);
    try {
      await providerAdvanceAction.run();
      Taro.showToast({ title: '已推进', icon: 'success' });
      await load();
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '推进失败'), icon: 'none' });
    } finally {
      setProviderAdvanceLoading(false);
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

  const summaryRows = detail ? [
    { key: 'provider', icon: logoProvider, label: '服务商', value: providerNameOf(detail), clickable: true },
    { key: 'weight', icon: iconWeight, label: '货物重量', value: cargoWeightTextOf(detail) },
    { key: 'pickup', icon: iconPickup, label: '起吊点', value: detail?.service_address || '-' },
    { key: 'dropoff', icon: iconDropoff, label: '落放点', value: detail?.dest_address || '-' },
    { key: 'service', icon: iconDrone, label: '预计服务', value: serviceLevelOf(detail) },
    { key: 'team', icon: iconTeam, label: '服务商履约', value: stepState >= 3 ? '服务商已接单' : '等待服务商开始履约' },
  ] : [];

  // 固定 5 步流程进度条（删除了无后端跟踪的"到场安全评估"虚步骤）
  const stageDefs: Array<{ idx: number; title: string; time: string; doneDesc: string; pendingDesc: string }> = [
    { idx: 1, title: '已提交吊运需求', time: createdAt, doneDesc: '您已提交吊运需求', pendingDesc: '等待提交' },
    { idx: 2, title: '服务商已确认方案', time: providerConfirmedAt, doneDesc: '服务商已确认并提交方案', pendingDesc: '等待服务商确认' },
    { idx: 3, title: '服务商开始履约', time: serviceStartedAt, doneDesc: '服务商进入履约推进', pendingDesc: '等待服务商开始' },
    { idx: 4, title: '开始吊运', time: '吊运作业进行中', doneDesc: '吊运作业已进行', pendingDesc: '等待开始吊运' },
    { idx: 5, title: '已完成，等待确认', time: '作业完成，请您确认', doneDesc: '订单已完成', pendingDesc: '等待客户确认完成' },
  ];

  const pickPendingIcon = (idx: number) => {
    if (idx === 4) return iconTimelinePending5;  // 开始吊运
    if (idx === 5) return iconTimelinePending6;  // 已完成
    return iconTimelinePending4;
  };

  const timelineRows = detail ? stageDefs.map((stage) => {
    // stepState 6 表示"全部完成"——所有步骤 done、没有 active
    const isActive = stepState === stage.idx && stepState <= 5;
    const isDone = stepState > stage.idx;
    const icon = isActive ? iconTimelineActive3 : isDone ? iconTimelineCheck : pickPendingIcon(stage.idx);
    const desc = isDone ? stage.doneDesc : isActive ? '进行中' : stage.pendingDesc;
    return {
      idx: stage.idx,
      title: stage.title,
      time: stage.time,
      desc,
      icon,
      active: isActive,
      done: isDone || isActive,
    };
  }) : [];
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
    <View className="op-page">
      <View className="op-nav" style={{ paddingTop: `${navTopRpx}rpx` }}>
        <View className="op-nav-back" onClick={goBack}>
          <Image className="op-nav-back-icon" src={iconBack} mode="aspectFit" />
        </View>
        <Text className="op-nav-title">订单进度</Text>
        <View className="op-nav-service" onClick={openService}>
          <Image className="op-nav-service-icon" src={iconService} mode="aspectFit" />
          <Text className="op-nav-service-text">客服</Text>
        </View>
      </View>

      <ScrollView scrollY enhanced showScrollbar={false} className="op-scroll">
        {!detail ? (
          <View className="op-empty">
            <Text className="op-empty-title">{loading ? '正在同步订单信息' : '无法展示订单进度'}</Text>
            <Text className="op-empty-desc">{loading ? '请稍候，正在读取真实订单数据。' : errorText || '订单不存在或当前账号无权查看。'}</Text>
          </View>
        ) : (
          <View className="op-content">
            {/* Hero */}
            <View className="op-hero-card">
              <View className="op-hero-head">
                <View className={`op-badge op-badge-${orderStatusToneOf(detail)}`}>
                  <Text>{orderStatusBadgeOf(detail)}</Text>
                </View>
                <View className="op-copy" onClick={copyOrderNo}>
                  <Text>复制单号</Text>
                </View>
              </View>

              <View className="op-route">
                <View className="op-route-row">
                  <View className="op-route-dot op-route-dot-start" />
                  <Text className="op-route-text">{detail?.service_address || '起点待确认'}</Text>
                </View>
                <View className="op-route-row">
                  <View className="op-route-dot op-route-dot-end" />
                  <Text className="op-route-text">{detail?.dest_address || '终点待确认'}</Text>
                </View>
              </View>

              {showProviderCardRow ? (
                <View className="op-provider">
                  <View className="op-provider-avatar" />
                  <View className="op-provider-main">
                    <Text className="op-provider-name">{detailProviderNameOf(detail)}</Text>
                    <Text className="op-provider-rating">评分 5.0</Text>
                  </View>
                  {canContactOrderProvider(detail) ? (
                    <View className="op-provider-phone" onClick={contactCounterparty}>
                      <View className="op-phone-icon" />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {showEtaRow ? (
                <View className="op-eta">
                  <Text className="op-eta-label">预计到达</Text>
                  <Text className="op-eta-value">{formatEta(detail?.live?.eta_seconds)}</Text>
                </View>
              ) : null}

              <View className="op-meta">
                <View className="op-meta-left">
                  <Text className="op-meta-no">{orderNo}</Text>
                  <Text className="op-meta-time">下单时间：{createdAt}</Text>
                </View>
                <Text className="op-meta-amount">{formatMoney(detail?.total_amount)}</Text>
              </View>

              <View className="op-actions">
                {showTerminalOnlyAction ? (
                  <View className="op-button op-button-muted" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
                    <Text>重新下单</Text>
                  </View>
                ) : (
                  <>
                    {showRedispatchActions ? (
                      <>
                        <View className="op-button op-button-warn" onClick={() => redispatchOrder('price')}>
                          <Text>{actionLoading ? '重发中…' : `加价 +${REDISPATCH_PRICE_BUMP_PERCENT}% 重发`}</Text>
                        </View>
                        <View className="op-button op-button-primary" onClick={() => redispatchOrder('radius')}>
                          <Text>{actionLoading ? '重发中…' : `扩大 ${REDISPATCH_RADIUS_BUMP_KM}km 重发`}</Text>
                        </View>
                      </>
                    ) : null}
                    {canCancelOrder(detail) ? (
                      <View className="op-button op-button-ghost" onClick={cancelOrder}>
                        <Text>{actionLoading ? '取消中…' : isProviderViewer ? '取消接单' : '取消订单'}</Text>
                      </View>
                    ) : null}
                    {canIncreaseOrderPrice(detail) ? (
                      <View className="op-button op-button-warn" onClick={increasePrice}>
                        <Text>运力紧张？加价</Text>
                      </View>
                    ) : null}
                    {!isProviderViewer && canAddOrderTip(detail) ? (
                      <View className="op-button op-button-ghost" onClick={addTip}>
                        <Text>给个小费</Text>
                      </View>
                    ) : null}
                    {canViewLive ? (
                      <View className="op-button op-button-ghost" onClick={viewLive}>
                        <Text>查看路线进度</Text>
                      </View>
                    ) : null}
	                    {canContactOrderProvider(detail) ? (
	                      <View className="op-button op-button-ghost" onClick={contactCounterparty}>
	                        <Text>拨打电话</Text>
	                      </View>
	                    ) : null}
		                    {providerAdvanceAction ? (
		                      <View className="op-button op-button-primary" onClick={advanceProviderOrder}>
		                        <Text>{providerAdvanceLoading ? '推进中…' : providerAdvanceAction.label}</Text>
		                      </View>
		                    ) : null}
	                    {canPay ? (
                      <View className="op-button op-button-primary" onClick={submitConfirm}>
                        <Text>{needsContractSign ? '签署合同' : '去支付'}</Text>
                      </View>
                    ) : null}
                    {canConfirm ? (
                      <View className="op-button op-button-primary" onClick={submitConfirm}>
                        <Text>{actionLoading ? '确认中…' : '确认完成'}</Text>
                      </View>
                    ) : null}
                    {canReview ? (
                      <View className="op-button op-button-primary" onClick={() => Taro.navigateTo({ url: `/pages/review/index?orderId=${orderId}` })}>
                        <Text>评价服务</Text>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            </View>

            {/* Summary */}
            <View className="op-card">
              <Text className="op-card-title">订单摘要</Text>
              <View className="op-summary-list">
                {summaryRows.map((row, index) => (
                  <View
                    key={row.key}
                    className={`op-summary-row ${index === summaryRows.length - 1 ? 'is-last' : ''}`}
                    onClick={row.clickable ? viewPlan : undefined}
                  >
                    <Image className="op-summary-icon" src={row.icon} mode="aspectFit" />
                    <Text className="op-summary-label">{row.label}</Text>
                    <Text className="op-summary-value">{row.value}</Text>
                    {row.clickable ? (
                      <Image className="op-summary-chevron" src={iconChevron} mode="aspectFit" />
                    ) : null}
                  </View>
                ))}
              </View>
            </View>

            {/* Progress timeline */}
            <View className="op-card">
              <Text className="op-card-title">订单进度</Text>
              <View className="op-timeline">
                {timelineRows.map((item: any, index: number) => (
                  <View
                    key={item.idx}
                    className={`op-tl-row ${item.active ? 'is-active' : ''} ${item.done ? 'is-done' : ''} ${index === timelineRows.length - 1 ? 'is-last' : ''}`}
                  >
                    <View className="op-tl-rail">
                      <View className="op-tl-icon-wrap">
                        <Image className="op-tl-icon" src={item.icon} mode="aspectFit" />
                      </View>
                      {index === timelineRows.length - 1 ? null : <View className="op-tl-line" />}
                    </View>
                    <View className="op-tl-body">
                      <View className="op-tl-line-1">
                        <Text className="op-tl-title">{item.title}</Text>
                        <Text className={`op-tl-desc ${item.done ? 'is-done' : ''}`}>{item.desc}</Text>
                      </View>
                      <Text className="op-tl-time">{item.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Settlement */}
            {detail?.status === 'completed' ? (
              <View className="op-card">
                <Text className="op-card-title">结算明细</Text>
                {settlementRows.length > 0 ? (
                  <View className="op-settlement-list">
                    {settlementRows.map((row, index) => (
                      <View key={row.label} className={`op-settlement-row ${index === settlementRows.length - 1 ? 'is-last' : ''}`}>
                        <Text className="op-settlement-label">{row.label}</Text>
                        <Text className="op-settlement-value">{row.value}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="op-settlement-empty">{settlementLoading ? '正在生成结算明细' : '暂未生成结算明细'}</Text>
                )}
              </View>
            ) : null}

            <View className="op-scroll-spacer" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
