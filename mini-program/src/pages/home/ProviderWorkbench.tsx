import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { homeService } from '../../services/home';
import { ownerService } from '../../services/owner';
import { syncCustomTabBar } from '../../utils/tabBar';
import { formatAmountYuan } from '../../utils';
import { canUseProviderWorkbench, getEffectiveRoleSummary, resolveProviderCapabilities } from '../../utils/roleSummary';
import { RootState, useAppDispatch } from '../../store/store';
import { setHaulRoleMode } from '../../store/slices/roleSlice';
import { HomeDashboard, OwnerWorkbenchOrderItem, OwnerWorkbenchView } from '../../types';
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
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const canUseProvider = canUseProviderWorkbench(effectiveRoleSummary);
  const providerBrandName = useMemo(() => {
    const nickname = String(user?.nickname || '').trim();
    return nickname || '服务商工作台';
  }, [user?.nickname]);
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
        desc: '接单工作台只展示真实需求、履约订单和结算数据，请先登录服务商账号。',
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

  useDidShow(() => {
    dispatch(setHaulRoleMode('provider'));
    syncCustomTabBar(0, 'provider');
    if (isAuthenticated && !canUseProvider && !openedOnboardingOnce) {
      setOpenedOnboardingOnce(true);
      safeNavigateTo('/pages/provider/onboarding/index?from=workbench');
      return;
    }
    refreshDashboard();
  });

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

  const stats = useMemo(() => {
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
    navigateWithAuth(nextOrderId ? `/pages/fulfillment/hub/index?orderId=${nextOrderId}` : '/pages/fulfillment/hub/index');
  }, [firstFulfillmentOrder?.id, navigateWithAuth]);

  const openFulfillmentOrExecution = useCallback(() => {
    openFulfillment(firstFulfillmentOrder?.id);
  }, [firstFulfillmentOrder?.id, openFulfillment]);

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
      value: String(stats.todayPending),
      icon: metricPendingIcon,
      valueClass: 'provider-metric-value-blue',
      onClick: openFulfillmentOrExecution,
    },
    {
      key: 'quote',
      label: '待报价需求',
      value: String(stats.pendingQuote),
      icon: metricQuoteIcon,
      valueClass: 'provider-metric-value-orange',
      onClick: openDemandTab,
    },
    {
      key: 'contract',
      label: '待履约订单',
      value: String(stats.pendingFulfillment),
      icon: metricContractIcon,
      valueClass: 'provider-metric-value-green',
      onClick: openFulfillmentOrExecution,
    },
    {
      key: 'income',
      label: '本月收入',
      value: formatAmountYuan(stats.monthIncome),
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
        <View className="provider-workbench-canvas" style={canvasStyle}>
          <View className="provider-header-bg" />
          <View className="provider-header-curve" />

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

          <View className="provider-metric-card">
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

          <View className="provider-quick-card">
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

          <View className="provider-todo-card">
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
    </View>
  );
}
