import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { homeService } from '../../services/home';
import { ownerService } from '../../services/owner';
import { orderV2Service } from '../../services/orderV2';
import { providerService } from '../../services/provider';
import { syncCustomTabBar } from '../../utils/tabBar';
import { formatAmountYuan } from '../../utils';
import { canUseProviderWorkbench, getEffectiveRoleSummary, resolveProviderCapabilities } from '../../utils/roleSummary';
import { useProviderPresence } from '../../hooks/useProviderPresence';
import { RootState, useAppDispatch } from '../../store/store';
import { setHaulRoleMode } from '../../store/slices/roleSlice';
import { presenceConfigUpdated } from '../../store/slices/providerPresenceSlice';
import {
  HomeDashboard,
  OwnerWorkbenchOrderItem,
  OwnerWorkbenchView,
  V2ProviderAssignmentView,
  V2ProviderBroadcastOrderSummary,
  V2ProviderBroadcastView,
  V2ProviderStats,
  V2ServiceClass,
} from '../../types';
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

const formatMoney = (amount: number) =>
  amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 });

const PROVIDER_RADIUS_OPTIONS = [5, 10, 20, 30];

const normalizeServiceClasses = (items: unknown): V2ServiceClass[] =>
  Array.isArray(items) ? items.filter((item): item is V2ServiceClass => Boolean(item && (item as V2ServiceClass).code)) : [];

const normalizeProviderItems = <T,>(res: unknown): T[] => {
  const value = res as { items?: T[]; data?: { items?: T[] } } | null;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};

const formatCompletionRate = (rate?: number) => {
  const normalized = Number.isFinite(Number(rate)) ? Number(rate) : 1;
  return `${Math.round(Math.max(0, Math.min(1, normalized)) * 100)}%`;
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

const getRemainingSeconds = (deadline?: string | null, fallback?: number | null) => {
  const deadlineMs = deadline ? Date.parse(deadline) : NaN;
  if (Number.isFinite(deadlineMs)) {
    return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  }
  return Math.max(0, Math.ceil(Number(fallback || 0)));
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

const firstFulfillmentOrderOf = (workbench?: OwnerWorkbenchView | null): OwnerWorkbenchOrderItem | null =>
  workbench?.pending_provider_confirmation_orders?.[0] ||
  workbench?.pending_dispatch_orders?.[0] ||
  null;

const formatOrderTodoSubtitle = (item: OwnerWorkbenchOrderItem) => {
  const route = [item.service_address, item.dest_address].filter(Boolean).join(' → ') || '待补地址';
  return `${route} · ${formatMoney(Math.round(Number(item.total_amount || 0) / 100))}元`;
};

function safeNavigateTo(url: string) {
  Taro.navigateTo({ url }).catch(() => {
    Taro.showToast({ title: '页面暂未开放', icon: 'none' });
  });
}

function NearbyBroadcasts({ onGrabbed }: { onGrabbed?: (orderId: number) => void }) {
  const [items, setItems] = useState<V2ProviderBroadcastView[]>([]);
  const [tick, setTick] = useState(0);
  const [grabbingId, setGrabbingId] = useState<number | null>(null);

  const pullBroadcasts = useCallback(async () => {
    try {
      const res = await providerService.listBroadcasts(20);
      setItems(normalizeProviderItems<V2ProviderBroadcastView>(res));
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
          setItems(normalizeProviderItems<V2ProviderBroadcastView>(res));
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
      .filter(item => getRemainingSeconds(item.expires_at, item.remaining_seconds) > 0)
      .slice(0, 3);
  }, [items, tick]);

  const grab = useCallback(async (broadcast: V2ProviderBroadcastView) => {
    if (grabbingId) return;
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
        Taro.showToast({ title: '已被其他服务商抢走', icon: 'none' });
        pullBroadcasts();
      } else {
        Taro.showToast({ title: String(error?.message || '抢单失败'), icon: 'none' });
      }
    } finally {
      setGrabbingId(null);
    }
  }, [grabbingId, onGrabbed, pullBroadcasts]);

  return (
    <View className="nearby-broadcast-section">
      <View className="nearby-broadcast-header">
        <Text className="nearby-broadcast-title">附近订单</Text>
        <Text className="nearby-broadcast-subtitle">在线后自动刷新</Text>
      </View>
      {visibleItems.length > 0 ? (
        <View className="nearby-broadcast-list">
          {visibleItems.map((item) => {
            const order = getOrderFromBroadcast(item);
            const remaining = getRemainingSeconds(item.expires_at, item.remaining_seconds);
            const isGrabbing = grabbingId === item.id;
            return (
              <View className="nearby-broadcast-item" key={item.id}>
                <View className="nearby-broadcast-item-head">
                  <Text className="nearby-broadcast-distance">{formatBroadcastDistance(item.distance_km)}</Text>
                  <Text className="nearby-broadcast-countdown">剩 {remaining}s</Text>
                </View>
                <View className="nearby-broadcast-route">
                  <Text className="nearby-route-start">{order?.service_address || '起点待确认'}</Text>
                  <Text className="nearby-route-arrow">→</Text>
                  <Text className="nearby-route-end">{order?.dest_address || '终点待确认'}</Text>
                </View>
                <View className="nearby-broadcast-meta">
                  <Text>{formatWeight(order?.cargo_weight_kg || item.weight_kg)}</Text>
                  <Text>{formatDuration(order?.estimated_duration_min)}</Text>
                  <Text>{formatRouteDistance(order?.estimated_distance_m)}</Text>
                </View>
                <View className="nearby-broadcast-footer">
                  <Text className="nearby-broadcast-price">{formatAmountYuan(getBroadcastAmount(item))}</Text>
                  <View
                    className={`nearby-broadcast-grab ${isGrabbing ? 'is-loading' : ''}`}
                    onClick={() => {
                      if (!isGrabbing) {
                        grab(item);
                      }
                    }}
                  >
                    <Text>{isGrabbing ? '抢单中...' : '一键抢单'}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View className="nearby-broadcast-empty">
          <Text>暂无附近订单，保持在线等待</Text>
        </View>
      )}
    </View>
  );
}

function AssignmentModal({ onAccepted }: { onAccepted?: (orderId: number) => void }) {
  const [assignment, setAssignment] = useState<V2ProviderAssignmentView | null>(null);
  const [responding, setResponding] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await providerService.listAssignments(5);
        const items = normalizeProviderItems<V2ProviderAssignmentView>(res)
          .filter(item => item.status === 'pending_accept')
          .sort((a, b) => b.attempt_seq - a.attempt_seq);
        if (!cancelled) {
          setAssignment(items[0] || null);
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

  const remaining = assignment
    ? getRemainingSeconds(assignment.accept_deadline_at, assignment.remaining_seconds)
    : 0;

  useEffect(() => {
    void tick;
    if (assignment && remaining <= 0) {
      setAssignment(null);
    }
  }, [assignment, remaining, tick]);

  const accept = useCallback(async () => {
    if (responding || !assignment) return;
    setResponding(true);
    try {
      const res = await providerService.acceptAssignment(assignment.id);
      const orderId = getOrderIdFromPayload(res, assignment.order_id);
      Taro.showToast({ title: '已接受', icon: 'success' });
      setAssignment(null);
      if (orderId > 0) {
        onAccepted?.(orderId);
      }
    } catch (error: any) {
      if (error?.statusCode === 409 || error?.errno === 409) {
        Taro.showToast({ title: '指派已失效或超时', icon: 'none' });
        setAssignment(null);
      } else {
        Taro.showToast({ title: String(error?.message || '接受失败'), icon: 'none' });
      }
    } finally {
      setResponding(false);
    }
  }, [assignment, onAccepted, responding]);

  const decline = useCallback(async () => {
    if (responding || !assignment) return;
    const res = await Taro.showModal({
      title: '确认拒绝指派',
      content: '拒绝后系统会指派给其他服务商',
      confirmText: '确认拒绝',
      confirmColor: '#dc2626',
    });
    if (!res.confirm) return;
    setResponding(true);
    try {
      await providerService.declineAssignment(assignment.id, '服务商主动拒绝');
      Taro.showToast({ title: '已拒绝', icon: 'none' });
      setAssignment(null);
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '拒绝失败'), icon: 'none' });
    } finally {
      setResponding(false);
    }
  }, [assignment, responding]);

  if (!assignment || remaining <= 0) return null;

  const order = assignment.order;
  return (
    <View className="assignment-modal-mask">
      <View className="assignment-modal-card">
        <View className="assignment-modal-titlebar">
          <Text>平台为你指派了订单 第 {assignment.attempt_seq} 轮</Text>
        </View>
        <Text className="assignment-modal-countdown">{remaining}s 内响应</Text>
        <View className="assignment-modal-route">
          <Text className="assignment-route-start">{order?.service_address || '起点待确认'}</Text>
          <Text className="assignment-route-arrow">→</Text>
          <Text className="assignment-route-end">{order?.dest_address || '终点待确认'}</Text>
        </View>
        <View className="assignment-modal-meta">
          <Text>{formatBroadcastDistance(assignment.distance_km)}</Text>
          <Text>{formatWeight(order?.cargo_weight_kg || assignment.broadcast?.weight_kg)}</Text>
          <Text>{formatDuration(order?.estimated_duration_min)}</Text>
          <Text>{formatRouteDistance(order?.estimated_distance_m)}</Text>
        </View>
        <Text className="assignment-modal-price">{formatAmountYuan(getBroadcastAmount(assignment))}</Text>
        <View className="assignment-modal-actions">
          <View className={`assignment-decline ${responding ? 'is-loading' : ''}`} onClick={decline}>
            <Text>拒绝</Text>
          </View>
          <View className={`assignment-accept ${responding ? 'is-loading' : ''}`} onClick={accept}>
            <Text>{responding ? '处理中...' : '接受'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function ProviderWorkbench() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const [navShift, setNavShift] = useState(0);
  const [headerActionTop, setHeaderActionTop] = useState(82);
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [workbench, setWorkbench] = useState<OwnerWorkbenchView | null>(null);
  const [openedOnboardingOnce, setOpenedOnboardingOnce] = useState(false);
  const [providerStats, setProviderStats] = useState<V2ProviderStats | null>(null);
  const [serviceClasses, setServiceClasses] = useState<V2ServiceClass[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const canUseProvider = canUseProviderWorkbench(effectiveRoleSummary);
  const providerBrandName = useMemo(() => {
    const nickname = String(user?.nickname || '').trim();
    return nickname || '服务商工作台';
  }, [user?.nickname]);
  const { presence, goOnline, goOffline } = useProviderPresence();
  const providerCertLabel = useMemo(() => {
    if (providerCapabilities.canSelfExecute) return '综合就绪';
    if (providerCapabilities.canPublishSupply) return '设备就绪';
    if (providerCapabilities.canAcceptDispatch) return '履约就绪';
    return '待入驻';
  }, [providerCapabilities.canAcceptDispatch, providerCapabilities.canPublishSupply, providerCapabilities.canSelfExecute]);
  const providerGateCopy = useMemo(() => {
    if (!isAuthenticated) {
      return {
        title: '登录后进入接单工作台',
        desc: '接单工作台只展示真实服务机会、服务订单和结算数据，请先登录服务商账号。',
        primary: '去登录',
      };
    }
    if (providerCapabilities.nextAction === 'wait_review') {
      return {
        title: '服务商资质审核中',
        desc: '你的服务商资料和设备资质正在审核，通过后才能正式接单和管理履约。',
        primary: '查看入驻进度',
      };
    }
    if (providerCapabilities.nextAction === 'fix_rejected') {
      return {
        title: '服务商资质需补充',
        desc: '当前服务商资质未通过或已暂停，请补充资料后重新提交审核。',
        primary: '补充服务商资质',
      };
    }
    return {
      title: '服务商能力未开通',
      desc: '先完善服务商资料和设备资质，审核通过后才能接单和管理履约。',
      primary: '开始服务商入驻',
    };
  }, [isAuthenticated, providerCapabilities.nextAction]);

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

  const openDemandTab = useCallback(() => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    Taro.switchTab({ url: '/pages/orders/index' }).catch(() => {
      Taro.reLaunch({ url: '/pages/orders/index?mode=provider' }).catch(() => {
        Taro.showToast({ title: '接单页暂不可用', icon: 'none' });
      });
    });
  }, [isAuthenticated, promptLogin]);

  const refreshDashboard = useCallback(() => {
    if (!isAuthenticated || !canUseProvider) {
      setDashboard(null);
      setWorkbench(null);
      return;
    }
    Promise.all([
      homeService.getDashboard().catch(() => null),
      ownerService.getWorkbench().catch(() => null),
    ]).then(([dashboardRes, workbenchRes]) => {
      setDashboard((dashboardRes as any)?.data || dashboardRes || null);
      setWorkbench((workbenchRes as any)?.data || workbenchRes || null);
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

  useDidShow(() => {
    dispatch(setHaulRoleMode('provider'));
    syncCustomTabBar(0, 'provider');
    if (isAuthenticated && !canUseProvider && !openedOnboardingOnce) {
      setOpenedOnboardingOnce(true);
      safeNavigateTo('/pages/provider/onboarding/index?from=workbench');
      return;
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
      const menu = Taro.getMenuButtonBoundingClientRect();
      const system = Taro.getSystemInfoSync();
      const rpxRatio = 750 / system.windowWidth;
      const menuTopRpx = menu.top * rpxRatio;
      setNavShift(Number(Math.max(0, menuTopRpx - 95.1).toFixed(1)));
      setHeaderActionTop(82);
    } catch {
      setNavShift(0);
      setHeaderActionTop(82);
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
    return {
      todayPending: pendingProviderCount + pendingDispatchCount,
      pendingQuote:
        Number(owner?.pending_quote_count ?? 0) +
        Number(owner?.recommended_demand_count ?? workbenchSummary?.recommended_demand_count ?? 0),
      pendingFulfillment: pendingDispatchCount,
      monthIncome: Number(summary?.today_income_amount ?? 0),
    };
  }, [dashboard, workbench]);

  const firstFulfillmentOrder = useMemo(() => firstFulfillmentOrderOf(workbench), [workbench]);

  const openFulfillment = useCallback((orderId?: number) => {
    const nextOrderId = Number(orderId || firstFulfillmentOrder?.id || 0);
    navigateWithAuth(nextOrderId ? `/pages/orders/detail/index?orderId=${nextOrderId}` : '/pages/orders/index');
  }, [firstFulfillmentOrder?.id, navigateWithAuth]);

  const openFulfillmentOrExecution = useCallback(() => {
    openFulfillment(firstFulfillmentOrder?.id);
  }, [firstFulfillmentOrder?.id, openFulfillment]);

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
    Taro.showActionSheet({ itemList: ['设备管理', '服务资质'] })
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
      key: 'pending',
      label: '今日待处理',
      value: String(dashboardStats.todayPending),
      icon: metricPendingIcon,
      valueClass: 'provider-metric-value-blue',
      onClick: openFulfillmentOrExecution,
    },
    {
      key: 'quote',
      label: '待报价服务',
      value: String(dashboardStats.pendingQuote),
      icon: metricQuoteIcon,
      valueClass: 'provider-metric-value-orange',
      onClick: openDemandTab,
    },
    {
      key: 'contract',
      label: '待服务订单',
      value: String(dashboardStats.pendingFulfillment),
      icon: metricContractIcon,
      valueClass: 'provider-metric-value-green',
      onClick: openFulfillmentOrExecution,
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
      key: 'new-demand',
      label: '查看新需求',
      icon: quickNewDemandIcon,
      iconClass: 'provider-quick-icon-new-demand',
      onClick: openDemandTab,
    },
    {
      key: 'my-quote',
      label: '我的报价',
      icon: quickMyQuoteIcon,
      iconClass: 'provider-quick-icon-my-quote',
      onClick: () => navigateWithAuth('/pages/profile/my-quotes/index'),
    },
    {
      key: 'fulfillment',
      label: '履约执行',
      icon: quickFulfillmentIcon,
      iconClass: 'provider-quick-icon-fulfillment',
      onClick: openFulfillmentOrExecution,
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
      label: '服务资质',
      icon: quickQualificationIcon,
      iconClass: 'provider-quick-icon-qualification',
      onClick: openProviderOnboarding,
    },
  ];

  const todoItems: TodoItem[] = useMemo(() => {
    const items: TodoItem[] = [];
    (workbench?.recommended_demands || []).slice(0, 1).forEach((item) => {
      items.push({
        key: `demand-${item.id}`,
        title: item.title || '新需求待报价',
        subtitle: `${item.service_address_text || '待补地址'} · 预算 ${formatMoney(Math.round(Number(item.budget_min || 0) / 100))}-${formatMoney(Math.round(Number(item.budget_max || 0) / 100))}元`,
        status: '待报价',
        tone: 'orange',
        icon: todoNewDemandIcon,
        onClick: () => navigateWithAuth(`/pages/demand/detail/index?id=${item.id}`),
      });
    });
    (workbench?.pending_provider_confirmation_orders || []).slice(0, 2).forEach((item) => {
      items.push({
        key: `confirm-${item.id}`,
        title: item.title || item.order_no || '直达订单待确认',
        subtitle: formatOrderTodoSubtitle(item),
        status: '待确认',
        tone: 'orange',
        icon: todoOrderScheduleIcon,
        onClick: () => openFulfillment(item.id),
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
        title: '暂无待处理事项',
        subtitle: '当前没有后端返回的待办订单或需求',
        status: '已同步',
        tone: 'blue',
        icon: todoInsuranceIcon,
        onClick: () => openFulfillment(),
      }];
    }
    return items.slice(0, 4);
  }, [navigateWithAuth, openFulfillment, workbench]);

  const canvasStyle = {
    marginTop: `${navShift}rpx`,
  } as React.CSSProperties;

  const headerSettingsStyle = {
    top: `${headerActionTop}rpx`,
  } as React.CSSProperties;

  if (!isAuthenticated || !canUseProvider) {
    return (
      <View className="provider-workbench-page">
        <ScrollView scrollY className="provider-workbench-scroll">
          <View className="provider-workbench-canvas" style={canvasStyle}>
            <View className="provider-header-bg" />
            <View className="provider-header-curve" />
            <Text className="provider-page-title">工作台</Text>
            <View className="provider-gate-card">
              <Text className="provider-gate-title">
                {providerGateCopy.title}
              </Text>
              <Text className="provider-gate-desc">
                {providerGateCopy.desc}
              </Text>
              <View
                className="provider-gate-primary"
                onClick={openProviderOnboarding}
              >
                <Text className="provider-gate-primary-text">{providerGateCopy.primary}</Text>
              </View>
              <View
                className="provider-gate-secondary"
                onClick={() => {
                  Taro.switchTab({ url: '/pages/profile/index' })
                    .then(() => syncCustomTabBar(3, 'provider'))
                    .catch(() => null);
                }}
              >
                <Text className="provider-gate-secondary-text">查看账号资料</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="provider-workbench-page">
      <ScrollView scrollY className="provider-workbench-scroll">
        <View className={`provider-workbench-canvas ${presence.online ? 'provider-workbench-canvas-online' : ''}`} style={canvasStyle}>
          <View className="provider-header-bg" />
          <View className="provider-header-curve" />

          <View className="presence-panel">
            <View className="presence-header">
              <View className={`presence-status-dot ${presence.online ? 'online' : 'offline'}`} />
              <Text className="presence-status-text">
                {presence.online ? '已上线，等待接单' : '已下线'}
              </Text>
            </View>

            <View className="presence-metrics">
              <View className="presence-metric">
                <Text className="presence-metric-value">{providerStats?.today_order_count ?? '--'}</Text>
                <Text className="presence-metric-label">今日接单</Text>
              </View>
              <View className="presence-metric">
                <Text className="presence-metric-value">{formatAmountYuan(providerStats?.today_income_cents)}</Text>
                <Text className="presence-metric-label">今日收入</Text>
              </View>
              <View className="presence-metric">
                <Text className="presence-metric-value">{formatAmountYuan(providerStats?.pending_settlement_cents)}</Text>
                <Text className="presence-metric-label">待结算</Text>
              </View>
              <View className="presence-metric">
                <Text className="presence-metric-value">{formatCompletionRate(providerStats?.completion_rate)}</Text>
                <Text className="presence-metric-label">完单率</Text>
              </View>
              <View className="presence-metric">
                <Text className="presence-metric-value">{(providerStats?.rating ?? 4.5).toFixed(1)}</Text>
                <Text className="presence-metric-label">评分</Text>
              </View>
            </View>

            <View className="presence-config">
              <View className="presence-config-row">
                <Text className="presence-config-label">服务半径</Text>
                <View className="presence-radius-chips">
                  {PROVIDER_RADIUS_OPTIONS.map(km => (
                    <View
                      key={km}
                      className={`presence-radius-chip ${presence.maxRadiusKM === km ? 'is-active' : ''}`}
                      onClick={() => setMaxRadius(km)}
                    >
                      <Text>{km}km</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="presence-config-row presence-config-row-classes">
                <Text className="presence-config-label">可接机型</Text>
                <View className="presence-class-chips">
                  {serviceClasses.map(item => {
                    const checked = (presence.acceptedServiceClasses || []).includes(item.code);
                    return (
                      <View
                        key={item.code}
                        className={`presence-class-chip ${checked ? 'is-active' : ''}`}
                        onClick={() => toggleServiceClass(item.code)}
                      >
                        <Text>{item.display_name}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <View
              className={`presence-cta ${presence.online ? 'is-offline' : 'is-online'} ${actionLoading ? 'is-loading' : ''}`}
              onClick={() => {
                if (!actionLoading) {
                  togglePresence();
                }
              }}
            >
              <Text>
                {actionLoading ? '处理中...' : presence.online ? '下线接单' : '上线接单'}
              </Text>
            </View>

            {presence.lastError ? (
              <Text className="presence-error">{presence.lastError}</Text>
            ) : null}
          </View>

          {presence.online ? (
            <NearbyBroadcasts onGrabbed={openGrabbedOrder} />
          ) : null}

          <View className="provider-brand" onClick={() => navigateWithAuth('/pages/profile/owner/index')}>
            <Image className="provider-brand-logo" src={logoProvider} mode="aspectFit" />
            <Text className="provider-brand-name">{providerBrandName}</Text>
            <View className="provider-cert-badge">
              <Text className="provider-cert-text">{providerCertLabel}</Text>
            </View>
          </View>

          <View
            className="provider-header-action provider-header-settings"
            style={headerSettingsStyle}
            onClick={() => navigateWithAuth('/pages/settings/index')}
          >
            <View className="provider-header-settings-clean-icon">
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-top" />
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-bottom" />
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-left" />
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-right" />
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-lt" />
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-rt" />
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-lb" />
              <View className="provider-settings-gear-tooth provider-settings-gear-tooth-rb" />
              <View className="provider-settings-gear-core" />
            </View>
            <Text className="provider-header-action-text">设置</Text>
          </View>

          <Text className="provider-page-title">工作台</Text>

          <View className={`provider-metric-card ${presence.online ? 'provider-metric-card-online' : ''}`}>
            <View className="provider-metric-line-h" />
            <View className="provider-metric-line-v" />
            {metrics.map((item, index) => (
              <View
                key={item.key}
                className={`provider-metric-item provider-metric-item-${index}`}
                onClick={item.onClick}
              >
                <Image className="provider-metric-icon" src={item.icon} mode="aspectFit" />
                <Text className="provider-metric-label">{item.label}</Text>
                <Text className={`provider-metric-value ${item.valueClass}`}>{item.value}</Text>
                <Image className="provider-metric-chevron" src={chevronRightIcon} mode="aspectFit" />
              </View>
            ))}
          </View>

          <View className={`provider-quick-card ${presence.online ? 'provider-quick-card-online' : ''}`}>
            <Text className="provider-section-title provider-quick-title">快捷入口</Text>
            {quickEntries.map((item, index) => (
              <View
                key={item.key}
                className={`provider-quick-entry provider-quick-entry-${index}`}
                onClick={item.onClick}
              >
                <View className="provider-quick-icon-box">
                  <Image className={`provider-quick-icon ${item.iconClass}`} src={item.icon} mode="aspectFit" />
                </View>
                <Text className="provider-quick-label">{item.label}</Text>
              </View>
            ))}
          </View>

          <View className={`provider-todo-card ${presence.online ? 'provider-todo-card-online' : ''}`}>
            <View className="provider-todo-header">
              <Text className="provider-section-title">待处理事项</Text>
              <View className="provider-todo-all" onClick={openFulfillmentOrExecution}>
                <Text className="provider-todo-all-text">全部事项</Text>
                <Image className="provider-todo-all-chevron" src={chevronRightIcon} mode="aspectFit" />
              </View>
            </View>
            <View className="provider-todo-box">
              {todoItems.map((item, index) => (
                <View
                  key={item.key}
                  className={`provider-todo-row provider-todo-row-${index}`}
                  onClick={item.onClick}
                >
                  <Image className="provider-todo-icon" src={item.icon} mode="aspectFit" />
                  <Text className="provider-todo-title">{item.title}</Text>
                  <Text className="provider-todo-subtitle">{item.subtitle}</Text>
                  <View className={`provider-todo-status provider-todo-status-${item.tone} provider-todo-status-${index}`}>
                    <Text className={`provider-todo-status-text provider-todo-status-text-${item.tone}`}>{item.status}</Text>
                  </View>
                  <Image className="provider-todo-chevron" src={chevronRightIcon} mode="aspectFit" />
                </View>
              ))}
            </View>
          </View>
        </View>
        <View className="provider-tabbar-spacer" />
      </ScrollView>
      {presence.online ? (
        <AssignmentModal onAccepted={openGrabbedOrder} />
      ) : null}
    </View>
  );
}
