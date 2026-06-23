import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { homeService } from '../../services/home';
import { ownerService } from '../../services/owner';
import { orderV2Service } from '../../services/orderV2';
import { providerService } from '../../services/provider';
import { syncCustomTabBar } from '../../utils/tabBar';
import { switchToOrdersTab } from '../../utils/ordersEntry';
import { formatAmountYuan } from '../../utils';
import { canUseProviderWorkbench, getEffectiveRoleSummary, resolveProviderCapabilities } from '../../utils/roleSummary';
import { useProviderPresence } from '../../hooks/useProviderPresence';
import { RootState, useAppDispatch } from '../../store/store';
import { presenceConfigUpdated } from '../../store/slices/providerPresenceSlice';
import { setHaulRoleMode } from '../../store/slices/roleSlice';
import { PROVIDER_WORKBENCH_SUBSCRIBE_TEMPLATES } from '../../constants/subscribeTemplates';
import { requestSubscribe } from '../../services/push';
import AssignmentModal from '../../components/AssignmentModal';
import ProviderOnboardingOverlay from '../../components/haul/ProviderOnboardingOverlay';
import {
  HomeDashboard,
  OwnerWorkbenchOrderItem,
  OwnerWorkbenchView,
  V2ProviderAssignmentView,
  V2ProviderBroadcastOrderSummary,
  V2ProviderBroadcastView,
  V2OrderSummary,
  V2ProviderStats,
  V2ServiceClass,
} from '../../types';
import { PROVIDER_WORKBENCH_ONBOARDING_STORAGE_KEY } from '../../utils/providerOnboarding';
import { buildProviderReviewFixItems } from '../../utils/providerReview';
import { remainingSeconds } from '../../utils/countdown';
import logoProvider from '../../assets/haul/provider-workbench/logo_provider_anyi_round_drone.png';
import metricPendingIcon from '../../assets/haul/provider-workbench/icon_metric_pending_today_blue.png';
import metricQuoteIcon from '../../assets/haul/provider-workbench/icon_metric_quote_orange.png';
import metricContractIcon from '../../assets/haul/provider-workbench/icon_metric_contract_green.png';
import metricIncomeIcon from '../../assets/haul/provider-workbench/icon_metric_income_purple.png';
import quickNewDemandIcon from '../../assets/haul/provider-workbench/icon_quick_new_demand.png';
import quickMyQuoteIcon from '../../assets/haul/provider-workbench/icon_quick_my_quote.png';
import quickFulfillmentIcon from '../../assets/haul/provider-workbench/icon_quick_fulfillment.png';
import quickDeviceStaffIcon from '../../assets/haul/provider-workbench/icon_quick_device_staff.png';
import quickQualificationIcon from '../../assets/haul/provider-workbench/icon_quick_qualification_insurance.png';
import todoNewDemandIcon from '../../assets/haul/provider-workbench/icon_todo_new_demand.png';
import todoOrderScheduleIcon from '../../assets/haul/provider-workbench/icon_todo_order_schedule.png';
import todoAirspaceIcon from '../../assets/haul/provider-workbench/icon_todo_airspace_confirm.png';
import todoInsuranceIcon from '../../assets/haul/provider-workbench/icon_todo_insurance_expiring.png';
import chevronRightIcon from '../../assets/haul/provider-workbench/icon_chevron_right.png';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import './ProviderWorkbench.scss';

type MetricItem = {
  key: string;
  label: string;
  value: string;
  icon: string;
  valueClass: string;
  onClick: () => void;
};

type QuickEntry = {
  key: string;
  label: string;
  icon: string;
  iconClass: string;
  onClick: () => void;
};

type TodoItem = {
  key: string;
  title: string;
  subtitle: string;
  status: string;
  tone: 'orange' | 'blue' | 'red';
  icon: string;
  onClick: () => void;
};

type SelectedQuoteAlert = {
  order: V2OrderSummary | OwnerWorkbenchOrderItem;
  title: string;
  desc: string;
  cta: string;
};

type TimedProviderBroadcastView = V2ProviderBroadcastView & { received_at_ms?: number };
type TimedProviderAssignmentView = V2ProviderAssignmentView & { received_at_ms?: number };

const formatMoney = (amount: number) =>
  amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 });

const PROVIDER_RADIUS_OPTIONS = [5, 10, 20, 30];
const SELF_EXECUTABLE_REQUIRED_TOAST = '需要先完善设备和履约资质';

const normalizeServiceClasses = (items: unknown): V2ServiceClass[] =>
  Array.isArray(items) ? items.filter((item): item is V2ServiceClass => Boolean(item && (item as V2ServiceClass).code)) : [];

const normalizeProviderItems = <T,>(res: unknown): T[] => {
  const value = res as { items?: T[]; data?: { items?: T[] } } | null;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};

const formatCompletionRate = (rate?: number | null) => {
  if (rate === null || rate === undefined || !Number.isFinite(Number(rate))) return '新入驻';
  const normalized = Number(rate);
  return `${Math.round(Math.max(0, Math.min(1, normalized)) * 100)}%`;
};

const formatProviderRating = (rating?: number | null) => {
  if (rating === null || rating === undefined || !Number.isFinite(Number(rating))) return '暂无评分';
  return Number(rating).toFixed(1);
};

const formatBroadcastDistance = (km?: number | null) => {
  const value = Number(km || 0);
  if (!Number.isFinite(value) || value < 0) return '距你 --';
  if (value < 0.05) return '距你 <0.1km';
  return `距你 ${value.toFixed(value >= 10 ? 0 : 1)}km`;
};

const formatRouteDistance = (meters?: number | null) => {
  const value = Number(meters || 0);
  if (!Number.isFinite(value) || value <= 0) return '距离 --';
  return `距离 ${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}km`;
};

const formatDuration = (minutes?: number | null) => {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) return '时长 --';
  return `约 ${Math.round(value)}分钟`;
};

const formatWeight = (kg?: number | null) => {
  const value = Number(kg || 0);
  if (!Number.isFinite(value) || value <= 0) return '--kg';
  return `${Math.round(value)}kg`;
};

const getBroadcastAmount = (item: V2ProviderBroadcastView | V2ProviderAssignmentView) => {
  const broadcastAmount = 'estimated_total_cents' in item ? item.estimated_total_cents : item.broadcast?.estimated_total_cents;
  return Number(broadcastAmount || item.order?.total_amount || 0);
};

const getOrderFromBroadcast = (item: V2ProviderBroadcastView | V2ProviderAssignmentView): V2ProviderBroadcastOrderSummary | null =>
  item.order || null;

const getOrderIdFromPayload = (payload: unknown, fallback: number) => {
  const value = payload as { order?: { id?: number }; data?: { order?: { id?: number } } } | null;
  return Number(value?.order?.id || value?.data?.order?.id || fallback || 0);
};

const formatOrderTodoSubtitle = (item: OwnerWorkbenchOrderItem) => {
  const route = [item.service_address, item.dest_address].filter(Boolean).join(' → ') || '待补地址';
  return `${route} · ${formatMoney(Math.round(Number(item.total_amount || 0) / 100))}元`;
};

const formatProviderOrderSubtitle = (item: V2OrderSummary) => {
  const route = [item.service_address, item.dest_address].filter(Boolean).join(' → ') || '待补地址';
  return `${route} · ${formatMoney(Math.round(Number(item.total_amount || 0) / 100))}元`;
};

function safeNavigateTo(url: string) {
  Taro.navigateTo({ url }).catch(() => {
    Taro.showToast({ title: '页面暂未开放', icon: 'none' });
  });
}

function isProviderNotSelfExecutableError(error: any) {
  return error?.statusCode === 403 && String(error?.message || '').includes('provider_not_self_executable');
}

function getGrabConflictToast(code?: unknown) {
  switch (code) {
    case 'BROADCAST_LOCKED_BY_ASSIGN':
      return '该单正在指派给其他服务商，请稍候';
    case 'BROADCAST_TAKEN':
      return '已被其他服务商抢走';
    case 'BROADCAST_STATUS_INVALID':
      return '订单状态已变化，刷新后重试';
    case 'BROADCAST_PREVIOUSLY_CANCELLED':
      return '您曾取消过该订单，不能再次抢单';
    default:
      return '已被其他服务商抢走';
  }
}

function PendingAssignments({ onAccepted }: { onAccepted?: (orderId: number) => void }) {
  const [items, setItems] = useState<TimedProviderAssignmentView[]>([]);
  const [tick, setTick] = useState(0);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const pullAssignments = useCallback(async () => {
    try {
      const res = await providerService.listAssignments(5);
      const receivedAtMs = Date.now();
      setItems(normalizeProviderItems<V2ProviderAssignmentView>(res).map(item => ({
        ...item,
        received_at_ms: receivedAtMs,
      })));
    } catch {
      // 自动重试，不打断服务商当前操作。
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await providerService.listAssignments(5);
        if (!cancelled) {
          const receivedAtMs = Date.now();
          setItems(normalizeProviderItems<V2ProviderAssignmentView>(res).map(item => ({
            ...item,
            received_at_ms: receivedAtMs,
          })));
        }
      } catch {
        // 静默重试。
      }
    };
    pull();
    const timer = setInterval(pull, 3_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  const visibleItems = useMemo(() => {
    void tick;
    return items
      .filter(item => item.status === 'pending_accept')
      .filter(item => remainingSeconds(item.accept_deadline_at, item) > 0)
      .slice(0, 2);
  }, [items, tick]);

  const accept = useCallback(async (assignment: TimedProviderAssignmentView) => {
    if (respondingId) return;
    setRespondingId(assignment.id);
    try {
      const res = await providerService.acceptAssignment(assignment.id);
      const orderId = getOrderIdFromPayload(res, assignment.order_id);
      Taro.showToast({ title: '已接受', icon: 'success' });
      setItems(current => current.filter(item => item.id !== assignment.id));
      if (orderId > 0) {
        onAccepted?.(orderId);
      }
    } catch (error: any) {
      if (error?.statusCode === 409 || error?.errno === 409) {
        Taro.showToast({ title: '派单已失效', icon: 'none' });
        setItems(current => current.filter(item => item.id !== assignment.id));
      } else {
        Taro.showToast({ title: friendlyErrorMessage(error, '接受失败'), icon: 'none' });
      }
      pullAssignments();
    } finally {
      setRespondingId(null);
    }
  }, [onAccepted, pullAssignments, respondingId]);

  const decline = useCallback(async (assignment: TimedProviderAssignmentView) => {
    if (respondingId) return;
    const res = await Taro.showModal({
      title: '拒绝派单？',
      content: '拒绝后系统会继续匹配其他服务商。',
      cancelText: '再想想',
      confirmText: '确认拒绝',
    });
    if (!res.confirm) return;
    setRespondingId(assignment.id);
    try {
      await providerService.declineAssignment(assignment.id, '服务商主动拒绝');
      Taro.showToast({ title: '已拒绝', icon: 'none' });
      setItems(current => current.filter(item => item.id !== assignment.id));
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '拒绝失败'), icon: 'none' });
      pullAssignments();
    } finally {
      setRespondingId(null);
    }
  }, [pullAssignments, respondingId]);

  if (visibleItems.length === 0) return null;

  return (
    <View className='pw-card pw-assignment-card'>
      <View className='pw-card-head'>
        <Text className='pw-card-title'>待确认派单</Text>
        <Text className='pw-card-sub'>请在倒计时内确认</Text>
      </View>
      <View className='pw-assignment-list'>
        {visibleItems.map((item) => {
          const order = getOrderFromBroadcast(item);
          const remaining = remainingSeconds(item.accept_deadline_at, item);
          const isResponding = respondingId === item.id;
          return (
            <View className='pw-assignment-item' key={item.id}>
              <View className='pw-broadcast-head'>
                <Text className='pw-assignment-tag'>平台指派 · 第 {item.attempt_seq} 轮</Text>
                <Text className='pw-broadcast-countdown'>剩 {remaining}s</Text>
              </View>
              <View className='pw-broadcast-route'>
                <Text className='pw-broadcast-route-start'>{order?.service_address || '起点待确认'}</Text>
                <Text className='pw-broadcast-route-arrow'>→</Text>
                <Text className='pw-broadcast-route-end'>{order?.dest_address || '终点待确认'}</Text>
              </View>
              <View className='pw-broadcast-meta'>
                <Text>{formatWeight(order?.cargo_weight_kg || item.broadcast?.weight_kg)}</Text>
                <Text>{formatDuration(order?.estimated_duration_min)}</Text>
                <Text>{formatBroadcastDistance(item.distance_km)}</Text>
              </View>
              <View className='pw-broadcast-foot'>
                <Text className='pw-broadcast-price'>{formatAmountYuan(getBroadcastAmount(item))}</Text>
                <View className='pw-assignment-actions'>
                  <View
                    className={`pw-assignment-decline ${isResponding ? 'is-loading' : ''}`}
                    onClick={() => {
                      if (!isResponding) decline(item);
                    }}
                  >
                    <Text>拒绝</Text>
                  </View>
                  <View
                    className={`pw-assignment-accept ${isResponding ? 'is-loading' : ''}`}
                    onClick={() => {
                      if (!isResponding) accept(item);
                    }}
                  >
                    <Text>{isResponding ? '处理中' : '接受'}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function NearbyBroadcasts({ canSelfExecute, onGrabbed }: { canSelfExecute: boolean; onGrabbed?: (orderId: number) => void }) {
  const [items, setItems] = useState<TimedProviderBroadcastView[]>([]);
  const [tick, setTick] = useState(0);
  const [grabbingId, setGrabbingId] = useState<number | null>(null);

  const pullBroadcasts = useCallback(async () => {
    try {
      const res = await providerService.listBroadcasts(20);
      const receivedAtMs = Date.now();
      setItems(normalizeProviderItems<V2ProviderBroadcastView>(res).map(item => ({
        ...item,
        received_at_ms: receivedAtMs,
      })));
    } catch {
      // 网络抖动不打扰服务商，下一轮轮询自动恢复。
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await providerService.listBroadcasts(20);
        if (!cancelled) {
          const receivedAtMs = Date.now();
          setItems(normalizeProviderItems<V2ProviderBroadcastView>(res).map(item => ({
            ...item,
            received_at_ms: receivedAtMs,
          })));
        }
      } catch {
        // 静默重试。
      }
    };
    pull();
    const timer = setInterval(pull, 5_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  const visibleItems = useMemo(() => {
    void tick;
    return items
      .filter(item => remainingSeconds(item.expires_at, item) > 0)
      .slice(0, 3);
  }, [items, tick]);

  const grab = useCallback(async (broadcast: TimedProviderBroadcastView) => {
    if (grabbingId) return;
    if (!canSelfExecute) {
      Taro.showToast({ title: SELF_EXECUTABLE_REQUIRED_TOAST, icon: 'none' });
      return;
    }
    setGrabbingId(broadcast.id);
    try {
      const res = await providerService.grabBroadcast(broadcast.id);
      const orderId = getOrderIdFromPayload(res, broadcast.order_id);
      Taro.showToast({ title: '抢单成功', icon: 'success' });
      if (orderId > 0) {
        onGrabbed?.(orderId);
      }
    } catch (error: any) {
      if (error?.statusCode === 409 || error?.errno === 409) {
        Taro.showToast({ title: getGrabConflictToast(error?.body?.code || error?.code), icon: 'none' });
        pullBroadcasts();
      } else if (isProviderNotSelfExecutableError(error)) {
        Taro.showToast({ title: SELF_EXECUTABLE_REQUIRED_TOAST, icon: 'none' });
      } else {
        Taro.showToast({ title: friendlyErrorMessage(error, '抢单失败'), icon: 'none' });
      }
    } finally {
      setGrabbingId(null);
    }
  }, [canSelfExecute, grabbingId, onGrabbed, pullBroadcasts]);

  return (
    <View className='pw-card pw-broadcast-card'>
      <View className='pw-card-head'>
        <Text className='pw-card-title'>附近订单</Text>
        <Text className='pw-card-sub'>在线后自动刷新</Text>
      </View>
      {visibleItems.length > 0 ? (
        <View className='pw-broadcast-list'>
          {visibleItems.map((item) => {
            const order = getOrderFromBroadcast(item);
            const remaining = remainingSeconds(item.expires_at, item);
            const isGrabbing = grabbingId === item.id;
            return (
              <View className='pw-broadcast-item' key={item.id}>
                <View className='pw-broadcast-head'>
                  <Text className='pw-broadcast-distance'>{formatBroadcastDistance(item.distance_km)}</Text>
                  <Text className='pw-broadcast-countdown'>剩 {remaining}s</Text>
                </View>
                <View className='pw-broadcast-route'>
                  <Text className='pw-broadcast-route-start'>{order?.service_address || '起点待确认'}</Text>
                  <Text className='pw-broadcast-route-arrow'>→</Text>
                  <Text className='pw-broadcast-route-end'>{order?.dest_address || '终点待确认'}</Text>
                </View>
                <View className='pw-broadcast-meta'>
                  <Text>{formatWeight(order?.cargo_weight_kg || item.weight_kg)}</Text>
                  <Text>{formatDuration(order?.estimated_duration_min)}</Text>
                  <Text>{formatRouteDistance(order?.estimated_distance_m)}</Text>
                </View>
                <View className='pw-broadcast-foot'>
                  <Text className='pw-broadcast-price'>{formatAmountYuan(getBroadcastAmount(item))}</Text>
                  <View
                    className={`pw-broadcast-grab ${isGrabbing ? 'is-loading' : ''}`}
                    onClick={() => {
                      if (!isGrabbing) {
                        grab(item);
                      }
                    }}
                  >
                    <Text>{isGrabbing ? '抢单中…' : '一键抢单'}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View className='pw-broadcast-empty'>
          <Image className='pw-broadcast-empty-image' src={todoAirspaceIcon} mode='aspectFit' />
          <Text>附近还没有可抢单订单，保持在线后有新订单会提醒</Text>
        </View>
      )}
    </View>
  );
}

export default function ProviderWorkbench() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const [navShift, setNavShift] = useState(132);
  const [headerActionTop, setHeaderActionTop] = useState(132);
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [workbench, setWorkbench] = useState<OwnerWorkbenchView | null>(null);
  const [pendingPaymentOrders, setPendingPaymentOrders] = useState<V2OrderSummary[]>([]);
  const [openedOnboardingOnce, setOpenedOnboardingOnce] = useState(false);
  const [providerStats, setProviderStats] = useState<V2ProviderStats | null>(null);
  const [serviceClasses, setServiceClasses] = useState<V2ServiceClass[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showProviderOnboarding, setShowProviderOnboarding] = useState(false);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const providerReviewFixItems = useMemo(() => buildProviderReviewFixItems(providerCapabilities), [providerCapabilities]);
  const canUseProvider = canUseProviderWorkbench(effectiveRoleSummary);
  const providerBrandName = useMemo(() => {
    const nickname = String(user?.nickname || '').trim();
    return nickname || '服务商工作台';
  }, [user?.nickname]);
  const { presence, goOnline, goOffline } = useProviderPresence({ managedByGlobalShell: true });
  const providerCertLabel = useMemo(() => {
    if (providerCapabilities.canUseWorkbench) return '接单就绪';
    return '待入驻';
  }, [providerCapabilities.canUseWorkbench]);
  const providerGateCopy = useMemo(() => {
    if (!isAuthenticated) {
      return {
        title: '登录后进入接单工作台',
        desc: '接单工作台展示服务机会、服务订单和结算信息，请先登录服务商账号。',
        primary: '去登录',
      };
    }
    const hasReviewingQualification = providerCapabilities.assetStatus === 'pending_review'
      || providerCapabilities.executorStatus === 'pending_review';
    if (providerCapabilities.nextAction === 'wait_review' && hasReviewingQualification) {
      return {
        title: '接单资质审核中',
        desc: '你的服务商资料、设备资质或履约资质正在审核，通过后才能正式接单和管理履约。',
        primary: '查看入驻进度',
      };
    }
    if (providerCapabilities.nextAction === 'fix_rejected') {
      const fixDesc = providerReviewFixItems.length
        ? `请按下方待修复项补充资料：${providerReviewFixItems.map(item => item.title).join('、')}。`
        : '当前服务商资质未通过或已暂停，请补充资料后重新提交审核。';
      return {
        title: '服务商资质需补充',
        desc: fixDesc,
        primary: '补充服务商资质',
      };
    }
    return {
      title: '接单资质未完成',
      desc: '先完善服务商资料、设备资质和履约资质，审核通过后才能接单和管理履约。',
      primary: '开始服务商入驻',
    };
  }, [
    isAuthenticated,
    providerCapabilities.assetStatus,
    providerCapabilities.executorStatus,
    providerCapabilities.nextAction,
    providerReviewFixItems,
  ]);

  const promptLogin = useCallback(() => {
    Taro.showModal({
      title: '请先登录',
      content: '登录后可查看服务商工作台的业务数据。',
      confirmText: '去登录',
      cancelText: '稍后',
    }).then((res) => {
      if (res.confirm) {
        safeNavigateTo('/pages/auth/login/index?roleMode=provider');
      }
    });
  }, []);

  const navigateWithAuth = useCallback((url: string) => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    safeNavigateTo(url);
  }, [isAuthenticated, promptLogin]);

  // 「需求市场」——客户发布的议价单池，服务商主动去报价
  const openDemandList = useCallback(() => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    switchToOrdersTab('provider').catch(() => {
      Taro.showToast({ title: '接单需求暂不可用', icon: 'none' });
    });
  }, [isAuthenticated, promptLogin]);

  const refreshDashboard = useCallback(() => {
    if (!isAuthenticated || !canUseProvider) {
      setDashboard(null);
      setWorkbench(null);
      setPendingPaymentOrders([]);
      return;
    }
    Promise.all([
      homeService.getDashboard().catch(() => null),
      ownerService.getWorkbench().catch(() => null),
      orderV2Service.list({ role: 'provider', status: 'pending_payment', page: 1, page_size: 5 }).catch(() => null),
    ]).then(([dashboardRes, workbenchRes, pendingPaymentRes]) => {
      setDashboard((dashboardRes as any)?.data || dashboardRes || null);
      setWorkbench((workbenchRes as any)?.data || workbenchRes || null);
      setPendingPaymentOrders(normalizeProviderItems<V2OrderSummary>(pendingPaymentRes));
    }).catch(() => null);
  }, [canUseProvider, isAuthenticated]);

  const refreshProviderStats = useCallback(() => {
    if (!isAuthenticated || !canUseProvider) {
      setProviderStats(null);
      return;
    }
    providerService.getStats()
      .then(setProviderStats)
      .catch(() => null);
  }, [canUseProvider, isAuthenticated]);

  const refreshServiceClasses = useCallback(() => {
    orderV2Service.listServiceClasses()
      .then(items => setServiceClasses(normalizeServiceClasses(items)))
      .catch(() => setServiceClasses([]));
  }, []);

  const setMaxRadius = useCallback((km: number) => {
    dispatch(presenceConfigUpdated({ maxRadiusKM: km }));
  }, [dispatch]);

  const toggleServiceClass = useCallback((code: string) => {
    const current = presence.acceptedServiceClasses || [];
    const next = current.includes(code)
      ? current.filter(item => item !== code)
      : [...current, code];
    dispatch(presenceConfigUpdated({ acceptedServiceClasses: next }));
  }, [dispatch, presence.acceptedServiceClasses]);

  const togglePresence = useCallback(async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (presence.online) {
        await goOffline();
        return;
      }
      if (!presence.acceptedServiceClasses?.length) {
        Taro.showToast({ title: '请先选择至少一个可接机型', icon: 'none' });
        return;
      }
      await requestSubscribe(PROVIDER_WORKBENCH_SUBSCRIBE_TEMPLATES);
      const ok = await goOnline({
        acceptedClasses: presence.acceptedServiceClasses,
        maxRadiusKM: presence.maxRadiusKM,
      });
      if (ok) {
        refreshProviderStats();
      }
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    goOffline,
    goOnline,
    presence.acceptedServiceClasses,
    presence.maxRadiusKM,
    presence.online,
    refreshProviderStats,
  ]);

  const closeProviderOnboarding = useCallback(() => {
    setShowProviderOnboarding(false);
    try {
      Taro.setStorageSync(PROVIDER_WORKBENCH_ONBOARDING_STORAGE_KEY, true);
    } catch (error) {
      Taro.showToast({ title: friendlyErrorMessage(error, '引导状态保存失败'), icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    dispatch(setHaulRoleMode('provider'));
    syncCustomTabBar(0, 'provider');
    if (isAuthenticated && !canUseProvider && !openedOnboardingOnce) {
      setOpenedOnboardingOnce(true);
      safeNavigateTo('/pages/provider/onboarding/index?from=workbench');
      return;
    }
    if (isAuthenticated && canUseProvider) {
      try {
        const seen = Boolean(Taro.getStorageSync(PROVIDER_WORKBENCH_ONBOARDING_STORAGE_KEY));
        setShowProviderOnboarding(!seen);
      } catch (error) {
        setShowProviderOnboarding(false);
        Taro.showToast({ title: friendlyErrorMessage(error, '新手引导加载失败'), icon: 'none' });
      }
    } else {
      setShowProviderOnboarding(false);
    }
    refreshDashboard();
    refreshServiceClasses();
    refreshProviderStats();
  });

  useEffect(() => {
    if (!presence.online) return undefined;
    const timer = setInterval(() => {
      refreshProviderStats();
    }, 30_000);
    return () => clearInterval(timer);
  }, [presence.online, refreshProviderStats]);

  useEffect(() => {
    try {
      const sys = Taro.getSystemInfoSync();
      const ratio = 750 / (sys.windowWidth || 375);
      const statusBarRpx = Math.round(((sys.statusBarHeight || 20) + 12) * ratio);
      setNavShift(statusBarRpx);
      setHeaderActionTop(statusBarRpx);
    } catch {
      setNavShift(132);
      setHeaderActionTop(132);
    }
  }, []);

  const dashboardStats = useMemo(() => {
    const owner = dashboard?.role_views?.owner;
    const summary = dashboard?.summary;
    const workbenchSummary = workbench?.summary;
    const pendingProviderCount = Number(
      workbenchSummary?.pending_provider_confirmation_order_count ??
      owner?.pending_provider_confirmation_order_count ??
      0,
    );
    const pendingDispatchCount = Number(
      workbenchSummary?.pending_dispatch_order_count ??
      owner?.pending_dispatch_order_count ??
      0,
    );
    const pendingPaymentCount = pendingPaymentOrders.length;
    const pendingQuoteCount = Number(workbenchSummary?.pending_quote_count ?? owner?.pending_quote_count ?? 0);
    const recommendedDemandCount = Number(workbenchSummary?.recommended_demand_count ?? owner?.recommended_demand_count ?? 0);
    return {
      todayPending: pendingProviderCount + pendingPaymentCount + pendingDispatchCount,
      pendingQuote: pendingQuoteCount + recommendedDemandCount,
      pendingFulfillment: pendingProviderCount + pendingPaymentCount + pendingDispatchCount,
      monthIncome: Number(summary?.today_income_amount ?? 0),
    };
  }, [dashboard, pendingPaymentOrders.length, workbench]);

  // 单条订单：点击 todo 行时使用，进入该订单详情
  const openFulfillment = useCallback((orderId?: number) => {
    const nextOrderId = Number(orderId || 0);
    if (nextOrderId > 0) {
      navigateWithAuth(`/pages/orders/detail/index?orderId=${nextOrderId}`);
      return;
    }
    // 没传 ID：兜底跳到明确的服务商订单列表。
    navigateWithAuth('/pages/orders/provider/index');
  }, [navigateWithAuth]);

  // 履约类待办默认进入订单列表。
  const openFulfillmentList = useCallback(() => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    Taro.navigateTo({ url: '/pages/orders/provider/index' }).catch(() => {
      Taro.redirectTo({ url: '/pages/orders/provider/index' }).catch(() => {
        Taro.showToast({ title: '订单列表暂不可用', icon: 'none' });
      });
    });
  }, [isAuthenticated, promptLogin]);

  const openTodoList = useCallback(() => {
    const hasOrderTodo = pendingPaymentOrders.length > 0 ||
      (workbench?.pending_provider_confirmation_orders || []).length > 0 ||
      (workbench?.pending_dispatch_orders || []).length > 0;
    if (hasOrderTodo) {
      openFulfillmentList();
      return;
    }
    if ((workbench?.recommended_demands || []).length > 0) {
      openDemandList();
      return;
    }
    openFulfillmentList();
  }, [
    openDemandList,
    openFulfillmentList,
    pendingPaymentOrders.length,
    workbench?.pending_dispatch_orders,
    workbench?.pending_provider_confirmation_orders,
    workbench?.recommended_demands,
  ]);

  const openGrabbedOrder = useCallback((orderId: number) => {
    const nextOrderId = Number(orderId || 0);
    if (nextOrderId <= 0) return;
    safeNavigateTo(`/pages/orders/detail/index?orderId=${nextOrderId}`);
  }, []);

  const openDeviceStaff = useCallback(() => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    Taro.showActionSheet({ itemList: ['设备资质', '接单资质'] })
      .then((res) => {
        if (res.tapIndex === 0) navigateWithAuth('/pages/profile/drones/index');
        if (res.tapIndex === 1) navigateWithAuth('/pages/provider/onboarding/index?from=workbench');
      })
      .catch(() => null);
  }, [isAuthenticated, navigateWithAuth, promptLogin]);

  const openProviderOnboarding = useCallback(() => {
    if (!isAuthenticated) {
      safeNavigateTo('/pages/auth/login/index?roleMode=provider');
      return;
    }
    safeNavigateTo('/pages/provider/onboarding/index?from=workbench');
  }, [isAuthenticated]);

  const metrics: MetricItem[] = [
    {
      key: 'quote',
      label: '待报价服务',
      value: String(dashboardStats.pendingQuote),
      icon: metricQuoteIcon,
      valueClass: 'provider-metric-value-orange',
      onClick: openDemandList,
    },
    {
      key: 'contract',
      label: '待服务订单',
      value: String(dashboardStats.pendingFulfillment),
      icon: metricContractIcon,
      valueClass: 'provider-metric-value-green',
      onClick: openFulfillmentList,
    },
    {
      key: 'income',
      label: '本月收入',
      value: formatAmountYuan(dashboardStats.monthIncome),
      icon: metricIncomeIcon,
      valueClass: 'provider-metric-value-purple provider-metric-value-money',
      onClick: () => navigateWithAuth('/pages/settlement/wallet/index'),
    },
  ];

  const quickEntries: QuickEntry[] = [
    {
      key: 'my-quote',
      label: '我的报价',
      icon: quickMyQuoteIcon,
      iconClass: 'provider-quick-icon-my-quote',
      onClick: () => navigateWithAuth('/pages/profile/my-quotes/index'),
    },
    {
      key: 'device-staff',
      label: '设备资质',
      icon: quickDeviceStaffIcon,
      iconClass: 'provider-quick-icon-device',
      onClick: openDeviceStaff,
    },
    {
      key: 'qualification',
      label: '接单资质',
      icon: quickQualificationIcon,
      iconClass: 'provider-quick-icon-qualification',
      onClick: openProviderOnboarding,
    },
  ];

  const todoItems: TodoItem[] = useMemo(() => {
    const items: TodoItem[] = [];
    pendingPaymentOrders.slice(0, 2).forEach((item) => {
      items.push({
        key: `selected-quote-${item.id}`,
        title: item.title || item.order_no || '报价已被客户选中',
        subtitle: `${formatProviderOrderSubtitle(item)} · 等待客户支付`,
        status: '报价已选中',
        tone: 'red',
        icon: todoOrderScheduleIcon,
        onClick: () => openFulfillment(item.id),
      });
    });
    (workbench?.pending_provider_confirmation_orders || []).slice(0, 2).forEach((item) => {
      items.push({
        key: `confirm-${item.id}`,
        title: item.title || item.order_no || '订单待确认',
        subtitle: formatOrderTodoSubtitle(item),
        status: '立即确认',
        tone: 'red',
        icon: todoOrderScheduleIcon,
        onClick: () => openFulfillment(item.id),
      });
    });
    (workbench?.recommended_demands || []).slice(0, 1).forEach((item) => {
      const isInvitation = item.source === 'invitation';
      const sourceLabel = item.source_label || (isInvitation ? '客户邀请报价' : '');
      items.push({
        key: `demand-${item.id}`,
        title: item.title || '新需求待报价',
        subtitle: `${sourceLabel ? `${sourceLabel} · ` : ''}${item.service_address_text || '待补地址'} · 预算 ${formatMoney(Math.round(Number(item.budget_min || 0) / 100))}-${formatMoney(Math.round(Number(item.budget_max || 0) / 100))}元`,
        status: isInvitation ? '客户邀请' : '待报价',
        tone: 'orange',
        icon: todoNewDemandIcon,
        onClick: () => navigateWithAuth(`/pages/demand/detail/index?id=${item.id}`),
      });
    });
    (workbench?.pending_dispatch_orders || []).slice(0, 2).forEach((item) => {
      items.push({
        key: `dispatch-${item.id}`,
        title: item.title || item.order_no || '订单待开始履约',
        subtitle: formatOrderTodoSubtitle(item),
        status: '待开始',
        tone: 'blue',
        icon: todoAirspaceIcon,
        onClick: () => openFulfillment(item.id),
      });
    });
    if (items.length === 0) {
      return [{
        key: 'empty',
        title: '当前没有待处理事项',
        subtitle: '新订单、资质补充和履约提醒会在这里出现',
        status: '已同步',
        tone: 'blue',
        icon: todoInsuranceIcon,
        onClick: () => openFulfillment(),
      }];
    }
    return items.slice(0, 4);
  }, [navigateWithAuth, openFulfillment, pendingPaymentOrders, workbench]);

  const selectedQuoteAlert = useMemo<SelectedQuoteAlert | null>(() => {
    if (pendingPaymentOrders.length > 0) {
      const order = pendingPaymentOrders[0];
      return {
        order,
        title: '报价已被客户选中',
        desc: `${formatProviderOrderSubtitle(order)}。请关注合同签署和客户支付状态。`,
        cta: '查看订单',
      };
    }
    const confirmOrder = (workbench?.pending_provider_confirmation_orders || [])[0];
    if (confirmOrder) {
      return {
        order: confirmOrder,
        title: '有订单需要你立即确认',
        desc: `${formatOrderTodoSubtitle(confirmOrder)}。确认后客户才能继续支付。`,
        cta: '立即处理',
      };
    }
    return null;
  }, [pendingPaymentOrders, workbench?.pending_provider_confirmation_orders]);

  const navHeaderStyle = { paddingTop: `${navShift}rpx` } as React.CSSProperties;
  const settingsStyle = { top: `${headerActionTop}rpx` } as React.CSSProperties;

  if (!isAuthenticated || !canUseProvider) {
    return (
      <View className='pw-page'>
        <View className='pw-header' style={navHeaderStyle}>
          <View className='pw-brand'>
            <Image className='pw-brand-logo' src={logoProvider} mode='aspectFit' />
            <View className='pw-brand-text'>
              <Text className='pw-brand-name'>服务商工作台</Text>
              <View className='pw-brand-tags'>
                <View className='pw-settings-inline' onClick={() => safeNavigateTo('/pages/settings/index')}>
                  <Text>设置</Text>
                </View>
              </View>
            </View>
          </View>
          <View className='pw-title-wrap'>
            <Text className='pw-greeting'>登录以解锁专属接单与履约功能</Text>
          </View>
        </View>
        <ScrollView scrollY className='pw-scroll'>
          <View className='pw-card pw-gate-card'>
            <Text className='pw-gate-title'>{providerGateCopy.title}</Text>
            <Text className='pw-gate-desc'>{providerGateCopy.desc}</Text>
            {providerReviewFixItems.length ? (
              <View className='pw-review-fix-card'>
                <Text className='pw-review-fix-title'>服务商资质待修复</Text>
                {providerReviewFixItems.map((item) => (
                  <View key={`${item.key}-${item.url}`} className='pw-review-fix-row' onClick={() => safeNavigateTo(item.url)}>
                    <View className='pw-review-fix-main'>
                      <Text className='pw-review-fix-name'>{item.title}</Text>
                      <Text className='pw-review-fix-reason'>{item.reason}</Text>
                    </View>
                    <Text className='pw-review-fix-action'>去修改 →</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View className='pw-gate-primary' onClick={openProviderOnboarding}>
              <Text>{providerGateCopy.primary}</Text>
            </View>
            <View
              className='pw-gate-secondary'
              onClick={() => {
                Taro.switchTab({ url: '/pages/profile/index' })
                  .then(() => syncCustomTabBar(3))
                  .catch(() => null);
              }}
            >
              <Text>查看账号资料</Text>
            </View>
          </View>
          <View className='pw-scroll-spacer' />
        </ScrollView>
      </View>
    );
  }

  const ctaText = actionLoading ? '处理中…' : presence.online ? '下线（停止接单）' : '上线接单';
  const ctaState = actionLoading ? 'loading' : presence.online ? 'offline' : 'online';
  const ctaHint = presence.online
    ? '派单进行中。下线后将停止派单，仍可去「接单」Tab 主动报价。'
    : '上线后平台会按你的接单资质、机型和半径主动派单。';

  return (
    <View className='pw-page'>
      <View className='pw-header' style={navHeaderStyle}>
        <View className='pw-brand'>
          <Image className='pw-brand-logo' src={logoProvider} mode='aspectFit' onClick={() => navigateWithAuth('/pages/profile/owner/index')} />
          <View className='pw-brand-text'>
            <Text className='pw-brand-name' onClick={() => navigateWithAuth('/pages/profile/owner/index')}>{providerBrandName}</Text>
            <View className='pw-brand-tags'>
              <View className='pw-cert-badge' onClick={() => navigateWithAuth('/pages/profile/owner/index')}>
                <Text>{providerCertLabel}</Text>
              </View>
              <View className='pw-settings-inline' onClick={() => navigateWithAuth('/pages/settings/index')}>
                <Text>设置</Text>
              </View>
            </View>
          </View>
        </View>
        <View className='pw-title-wrap'>
          <Text className='pw-greeting'>
            {presence.online ? '正在为您实时监控派单与附近需求' : '当前处于离线状态，随时准备开启接单'}
          </Text>
        </View>
      </View>

      <ScrollView scrollY className='pw-scroll' enhanced showScrollbar={false}>
        {/* Presence panel */}
        <View className='pw-card pw-presence-card'>
          <View className='pw-presence-status'>
            <View className={`pw-presence-dot ${presence.online ? 'is-online' : 'is-offline'}`} />
            <Text className='pw-presence-status-text'>
              {presence.online ? '已上线，等待接单' : '已下线'}
            </Text>
          </View>

          <View className='pw-stats'>
            <View className='pw-stats-main'>
              <View className='pw-stat pw-stat-primary pw-stat-primary-income'>
                <View className='pw-stat-header'>
                  <Image className='pw-stat-icon' src={metricIncomeIcon} mode='aspectFit' />
                  <Text className='pw-stat-label'>今日收入</Text>
                </View>
                <Text className='pw-stat-value pw-color-orange'>{formatAmountYuan(providerStats?.today_income_cents)}</Text>
              </View>
              <View className='pw-stat pw-stat-primary pw-stat-primary-orders'>
                <View className='pw-stat-header'>
                  <Image className='pw-stat-icon' src={metricPendingIcon} mode='aspectFit' />
                  <Text className='pw-stat-label'>今日接单</Text>
                </View>
                <Text className='pw-stat-value pw-color-blue'>{providerStats?.today_order_count ?? '--'}</Text>
              </View>
            </View>
            <View className='pw-stats-sub'>
              <View className='pw-stat'>
                <Text className='pw-stat-value'>{formatAmountYuan(providerStats?.pending_settlement_cents)}</Text>
                <Text className='pw-stat-label'>待结算</Text>
              </View>
              <View className='pw-stat'>
                <Text className='pw-stat-value'>{formatCompletionRate(providerStats?.completion_rate)}</Text>
                <Text className='pw-stat-label'>完单率</Text>
              </View>
              <View className='pw-stat'>
                <Text className='pw-stat-value'>{formatProviderRating(providerStats?.rating)}</Text>
                <Text className='pw-stat-label'>评分</Text>
              </View>
            </View>
          </View>

          <View className='pw-config-row'>
            <Text className='pw-config-label'>服务半径</Text>
            <View className='pw-chip-row'>
              {PROVIDER_RADIUS_OPTIONS.map(km => (
                <View
                  key={km}
                  className={`pw-chip ${presence.maxRadiusKM === km ? 'is-active' : ''}`}
                  onClick={() => setMaxRadius(km)}
                >
                  <Text>{km}km</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='pw-config-row'>
            <Text className='pw-config-label'>可接机型</Text>
            <View className='pw-chip-row'>
              {serviceClasses.length === 0 ? (
                <Text className='pw-chip-empty'>暂无可选机型</Text>
              ) : serviceClasses.map(item => {
                const checked = (presence.acceptedServiceClasses || []).includes(item.code);
                return (
                  <View
                    key={item.code}
                    className={`pw-chip ${checked ? 'is-active' : ''}`}
                    onClick={() => toggleServiceClass(item.code)}
                  >
                    <Text>{item.display_name}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            className={`pw-cta pw-cta-${ctaState}`}
            onClick={() => {
              if (!actionLoading) {
                togglePresence();
              }
            }}
          >
            <Text>{ctaText}</Text>
          </View>

          <Text className='pw-cta-hint'>{ctaHint}</Text>

          {presence.lastError ? (
            <Text className='pw-presence-error'>{presence.lastError}</Text>
          ) : null}
        </View>

        {/* Nearby broadcasts */}
        {presence.online ? (
          <>
            <PendingAssignments onAccepted={openGrabbedOrder} />
            <NearbyBroadcasts canSelfExecute={providerCapabilities.canSelfExecute} onGrabbed={openGrabbedOrder} />
          </>
        ) : null}

        {selectedQuoteAlert ? (
          <View className='pw-selected-alert' onClick={() => openFulfillment(selectedQuoteAlert.order.id)}>
            <View className='pw-selected-alert-main'>
              <Text className='pw-selected-alert-kicker'>重要待办</Text>
              <Text className='pw-selected-alert-title'>{selectedQuoteAlert.title}</Text>
              <Text className='pw-selected-alert-desc'>{selectedQuoteAlert.desc}</Text>
            </View>
            <View className='pw-selected-alert-cta'>
              <Text>{selectedQuoteAlert.cta}</Text>
            </View>
          </View>
        ) : null}

        {/* Metric grid */}
        <View className='pw-card pw-metric-card'>
          <View className='pw-metric-grid'>
            {metrics.map(item => (
              <View key={item.key} className='pw-metric-item' onClick={item.onClick}>
                <Image className='pw-metric-icon' src={item.icon} mode='aspectFit' />
                <View className='pw-metric-body'>
                  <Text className='pw-metric-label'>{item.label}</Text>
                  <Text className={`pw-metric-value ${item.valueClass}`}>{item.value}</Text>
                </View>
                <Image className='pw-metric-chevron' src={chevronRightIcon} mode='aspectFit' />
              </View>
            ))}
          </View>
        </View>

        {/* Quick entries */}
        <View className='pw-card'>
          <View className='pw-card-head'>
            <Text className='pw-card-title'>快捷入口</Text>
          </View>
          <View className='pw-quick-grid'>
            {quickEntries.map(item => (
              <View key={item.key} className='pw-quick-item' onClick={item.onClick}>
                <View className='pw-quick-icon-box'>
                  <Image className='pw-quick-icon' src={item.icon} mode='aspectFit' />
                </View>
                <Text className='pw-quick-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Todo list */}
        <View className='pw-card'>
          <View className='pw-card-head'>
            <Text className='pw-card-title'>待处理事项</Text>
            <View className='pw-card-link' onClick={openTodoList}>
              <Text>全部事项</Text>
              <Image className='pw-card-link-chevron' src={chevronRightIcon} mode='aspectFit' />
            </View>
          </View>
          <View className='pw-todo-list'>
            {todoItems.map((item, index) => (
              <View
                key={item.key}
                className={`pw-todo-row ${index === todoItems.length - 1 ? 'is-last' : ''}`}
                onClick={item.onClick}
              >
                <Image className='pw-todo-icon' src={item.icon} mode='aspectFit' />
                <View className='pw-todo-body'>
                  <Text className='pw-todo-title'>{item.title}</Text>
                  <Text className='pw-todo-sub'>{item.subtitle}</Text>
                </View>
                <View className={`pw-todo-status pw-todo-status-${item.tone}`}>
                  <Text>{item.status}</Text>
                </View>
                <Image className='pw-todo-chevron' src={chevronRightIcon} mode='aspectFit' />
              </View>
            ))}
          </View>
        </View>

        <View className='pw-scroll-spacer' />
      </ScrollView>
      {presence.online ? <AssignmentModal onAccepted={openGrabbedOrder} /> : null}
      <ProviderOnboardingOverlay visible={showProviderOnboarding} onClose={closeProviderOnboarding} />
    </View>
  );
}
