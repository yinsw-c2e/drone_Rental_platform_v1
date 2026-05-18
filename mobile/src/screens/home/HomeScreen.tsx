import React, {
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import {
  getObjectStatusMeta,
  getTonePalette,
  VisualTone,
} from '../../components/business/visuals';
import {demandV2Service} from '../../services/demandV2';
import {dispatchV2Service} from '../../services/dispatchV2';
import { homeService } from '../../services/home';
import {orderAnomalyV2Service} from '../../services/orderAnomalyV2';
import {orderV2Service} from '../../services/orderV2';
import { RootState } from '../../store/store';
import {
  DemandSummary,
  HomeDashboard,
  V2DispatchTaskSummary,
  V2OrderAnomaly,
  V2OrderAnomalySummary,
  V2OrderSummary,
} from '../../types';
import {formatDemandBudget, resolveDemandPrimaryAddress} from '../../utils/demandMeta';
import {formatAmountYuan} from '../../utils/supplyMeta';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {workbenchAssets} from '../../assets/miniProgramAssets';

type RoleView = 'all' | 'client' | 'owner' | 'pilot';

type HeroTheme = {
  gradient: [string, string];
  accent: string;
  surface: string;
  border: string;
  softText: string;
  eyebrow: string;
};

type MetricCard = {
  key: string;
  label: string;
  value: number;
  hint: string;
};

type DashboardAction = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  tone: VisualTone;
  onPress: () => void;
  badge?: number;
};

type PriorityQueueFilter =
  | 'all'
  | 'quote'
  | 'confirm'
  | 'payment'
  | 'dispatch'
  | 'progress'
  | 'anomaly';

type PriorityQueueCategory = Exclude<PriorityQueueFilter, 'all'>;

type PriorityQueueTarget = {
  screen: 'DemandDetail' | 'OrderDetail' | 'DispatchTaskDetail' | 'PilotOrderExecution';
  params: Record<string, any>;
};

type PriorityQueueItem = {
  key: string;
  role: RoleView | 'all';
  category: PriorityQueueCategory;
  title: string;
  subtitle: string;
  meta: string;
  tagLabel: string;
  tagTone: VisualTone;
  urgency: number;
  sortAt: number;
  referenceNo?: string;
  target: PriorityQueueTarget;
};

const CONTENT_SIDE_MARGIN = 16;
const HERO_SIDE_PADDING = 18;
const PRIORITY_PAGE_SIZE = 4;
const QUICK_GRID_PANEL_HORIZONTAL_PADDING = 12;

const emptyDashboard: HomeDashboard = {
  role_summary: {
    has_client_role: false,
    has_owner_role: false,
    has_pilot_role: false,
    can_publish_supply: false,
    can_accept_dispatch: false,
    can_self_execute: false,
  },
  summary: {
    in_progress_order_count: 0,
    today_order_count: 0,
    today_income_amount: 0,
    alert_count: 0,
  },
  market_totals: {
    supply_count: 0,
    demand_count: 0,
  },
  role_views: {
    client: {
      open_demand_count: 0,
      quoted_demand_count: 0,
      pending_provider_confirmation_order_count: 0,
      pending_payment_order_count: 0,
      in_progress_order_count: 0,
    },
    owner: {
      recommended_demand_count: 0,
      active_supply_count: 0,
      pending_quote_count: 0,
      pending_provider_confirmation_order_count: 0,
      pending_dispatch_order_count: 0,
    },
    pilot: {
      pending_response_dispatch_count: 0,
      candidate_demand_count: 0,
      active_dispatch_count: 0,
      recent_flight_count: 0,
    },
  },
  in_progress_orders: [],
  market_feed: [],
};

const emptyAnomalySummary: V2OrderAnomalySummary = {
  total: 0,
  critical_count: 0,
  warning_count: 0,
  by_anomaly_type: [],
  by_order_status: [],
};

const getOrderStatusBucket = (status?: string): PriorityQueueCategory | null => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending_provider_confirmation') {
    return 'confirm';
  }
  if (normalized === 'pending_payment') {
    return 'payment';
  }
  if (normalized === 'pending_dispatch') {
    return 'dispatch';
  }
  if (
    [
      'assigned',
      'confirmed',
      'preparing',
      'airspace_applying',
      'airspace_approved',
      'loading',
      'in_transit',
      'delivered',
    ].includes(normalized)
  ) {
    return 'progress';
  }
  return null;
};

const getPriorityItemTimestamp = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getPriorityRoleLabel = (role: RoleView | 'all') => {
  switch (role) {
    case 'client':
      return '客户';
    case 'owner':
      return '机主';
    case 'pilot':
      return '飞手';
    default:
      return '综合';
  }
};

const getPriorityFilterLabel = (role: RoleView, filter: PriorityQueueFilter) => {
  switch (filter) {
    case 'quote':
      if (role === 'owner') {
        return '待报价';
      }
      if (role === 'client') {
        return '待确认方案';
      }
      return '方案/报价';
    case 'confirm':
      return '待确认';
    case 'payment':
      return '待付款';
    case 'dispatch':
      return role === 'pilot' ? '待接单' : '待派单';
    case 'progress':
      return '进行中';
    case 'anomaly':
      return '异常';
    default:
      return '全部';
  }
};

const getPriorityUrgencyLabel = (urgency: number) => {
  if (urgency >= 100) {
    return '需立即处理';
  }
  if (urgency >= 85) {
    return '建议优先';
  }
  return '顺手处理';
};

const getActionAsset = (key: string) => {
  if (key.includes('service-hub')) {
    return workbenchAssets.entryBrowseService;
  }
  if (key.includes('quick-order')) {
    return workbenchAssets.entryQuickOrder;
  }
  if (key.includes('publish')) {
    return workbenchAssets.entryPublishTask;
  }
  if (key.includes('demands')) {
    return workbenchAssets.entryInquiryTask;
  }
  if (key.includes('progress')) {
    return workbenchAssets.entryMyDemand;
  }
  if (key.includes('demand')) {
    return workbenchAssets.entryBrowseService;
  }
  if (key.includes('offer') || key.includes('supplies') || key.includes('fulfillment') || key.includes('assigned') || key.includes('nearby')) {
    return workbenchAssets.entryQuickOrder;
  }
  if (key.includes('profile') || key.includes('drones')) {
    return workbenchAssets.entryMyDemand;
  }
  switch (key) {
    case 'service-hub':
      return workbenchAssets.entryBrowseService;
    case 'progress':
      return workbenchAssets.entryMyDemand;
    case 'quick-order':
      return workbenchAssets.entryQuickOrder;
    case 'publish':
      return workbenchAssets.entryPublishTask;
    case 'my-demands':
      return workbenchAssets.entryInquiryTask;
    case 'profile':
    case 'drones':
      return workbenchAssets.entryMyDemand;
    case 'offer':
    case 'supplies':
    case 'fulfill':
    case 'assigned':
    case 'nearby':
      return workbenchAssets.entryQuickOrder;
    default:
      return workbenchAssets.entryBrowseService;
  }
};

const getHeroActionAsset = (title: string) =>
  title.includes('发布') || title.includes('上架')
    ? workbenchAssets.plusCircle
    : workbenchAssets.quickOrder;

function ActionPill({
  title,
  onPress,
  primary,
  theme,
}: {
  title: string;
  onPress: () => void;
  primary?: boolean;
  theme: HeroTheme;
}) {
  const {theme: appTheme} = useTheme();
  const styles = getStyles(appTheme);
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.heroActionBtn,
        primary
          ? { backgroundColor: 'rgba(255,255,255,0.92)' }
          : {
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderColor: 'rgba(255,255,255,0.22)',
            },
      ]}
    >
      <Image
        source={getHeroActionAsset(title)}
        style={styles.heroActionIcon}
        resizeMode="contain"
      />
      <Text
        style={[
          styles.heroActionText,
          primary ? { color: theme.accent } : styles.heroActionTextGhost,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function QuickActionCard({
  action,
  width,
}: {
  action: DashboardAction;
  width: number;
}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const palette = getTonePalette(action.tone, theme.isDark);
  return (
    <TouchableOpacity
      style={[styles.quickActionCard, {width}]}
      onPress={action.onPress}
      activeOpacity={0.88}
    >
      <View
        style={[
          styles.quickActionIconWrap,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
      >
        <Image
          source={getActionAsset(action.key)}
          style={styles.quickActionIconImage}
          resizeMode="contain"
        />
        {typeof action.badge === 'number' && action.badge > 0 ? (
          <View
            style={[styles.quickActionBadge, { backgroundColor: palette.text }]}
          >
            <Text style={styles.quickActionBadgeText}>{action.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.quickActionTitle, {color: theme.text}]} numberOfLines={2}>
        {action.title}
      </Text>
    </TouchableOpacity>
  );
}

function getHeroTheme(role: RoleView): HeroTheme {
  switch (role) {
    case 'client':
      return {
        gradient: ['#0756D8', '#2F82FF'],
        accent: '#135ED9',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(255,255,255,0.9)',
        eyebrow: '客户概览',
      };
    case 'owner':
      return {
        gradient: ['#0756D8', '#2F82FF'],
        accent: '#135ED9',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(255,255,255,0.9)',
        eyebrow: '机主概览',
      };
    case 'pilot':
      return {
        gradient: ['#0756D8', '#2F82FF'],
        accent: '#135ED9',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(255,255,255,0.9)',
        eyebrow: '飞手概览',
      };
    default:
      return {
        gradient: ['#0756D8', '#2F82FF'],
        accent: '#135ED9',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(255,255,255,0.9)',
        eyebrow: '今日概览',
      };
  }
}

export default function HomeScreen({ navigation }: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const authRoleSummary = useSelector(
    (state: RootState) => state.auth.roleSummary,
  );
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const { width: viewportWidth } = useWindowDimensions();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 66;

  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [anomalySummary, setAnomalySummary] = useState<V2OrderAnomalySummary>(emptyAnomalySummary);
  const [priorityItems, setPriorityItems] = useState<PriorityQueueItem[]>([]);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityQueueFilter>('all');
  const [priorityFilterExpanded, setPriorityFilterExpanded] = useState(false);
  const [priorityPage, setPriorityPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const authStateRef = useRef(isAuthenticated);

  const currentDashboard = dashboard || emptyDashboard;
  const effectiveRoleSummary = useMemo(
    () =>
      dashboard?.role_summary || authRoleSummary || emptyDashboard.role_summary,
    [authRoleSummary, dashboard?.role_summary],
  );

  const hasClient = effectiveRoleSummary.has_client_role;
  const hasOwner = effectiveRoleSummary.has_owner_role;
  const hasPilot = effectiveRoleSummary.has_pilot_role;
  const roleCount = Number(hasClient) + Number(hasOwner) + Number(hasPilot);

  const defaultRole = useMemo<RoleView>(() => {
    if (roleCount > 1) {
      return 'all';
    }
    if (hasClient) {
      return 'client';
    }
    if (hasOwner) {
      return 'owner';
    }
    if (hasPilot) {
      return 'pilot';
    }
    return 'all';
  }, [hasClient, hasOwner, hasPilot, roleCount]);

  const [activeRole, setActiveRole] = useState<RoleView>(defaultRole);

  const roleTabs = useMemo(() => {
    const tabs: { key: RoleView; label: string }[] = [];
    if (roleCount > 1) {
      tabs.push({ key: 'all', label: '综合' });
    }
    if (hasClient) {
      tabs.push({ key: 'client', label: '客户' });
    }
    if (hasOwner) {
      tabs.push({ key: 'owner', label: '机主' });
    }
    if (hasPilot) {
      tabs.push({ key: 'pilot', label: '飞手' });
    }
    if (tabs.length === 0) {
      tabs.push({ key: 'all', label: '综合' });
    }
    return tabs;
  }, [hasClient, hasOwner, hasPilot, roleCount]);

  useEffect(() => {
    const keys = roleTabs.map(item => item.key);
    if (!keys.includes(activeRole)) {
      setActiveRole(defaultRole);
    }
  }, [activeRole, defaultRole, roleTabs]);

  useEffect(() => {
    authStateRef.current = isAuthenticated;
    if (!isAuthenticated) {
      setDashboard(null);
      setAnomalySummary(emptyAnomalySummary);
      setPriorityItems([]);
      setPriorityFilter('all');
      setPriorityPage(0);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const fetchDashboard = useCallback(async () => {
    if (!authStateRef.current) {
      return;
    }
    try {
      const [res, anomalyRes] = await Promise.all([
        homeService.getDashboard(),
        orderAnomalyV2Service.summary({
          role: activeRole === 'all' ? undefined : activeRole,
        }),
      ]);
      if (authStateRef.current) {
        setDashboard(res.data || emptyDashboard);
        setAnomalySummary(anomalyRes.data || emptyAnomalySummary);
      }
    } catch (error) {
      if (authStateRef.current) {
        console.warn('加载首页数据失败:', error);
      }
    } finally {
      if (authStateRef.current) {
        setRefreshing(false);
      }
    }
  }, [activeRole]);

  const anomalyAlertCount = anomalySummary?.total ?? currentDashboard.summary.alert_count;
  const openAnomalyCenter = useCallback(() => {
    navigation.navigate('OrderAnomalyList', {
      roleFilter: activeRole === 'all' ? undefined : activeRole,
    });
  }, [activeRole, navigation]);

  const fetchPriorityQueue = useCallback(async () => {
    if (!authStateRef.current) {
      return;
    }

    setPriorityLoading(true);
    try {
      const rolesToLoad: RoleView[] =
        activeRole === 'all'
          ? [
              ...(hasClient ? (['client'] as RoleView[]) : []),
              ...(hasOwner ? (['owner'] as RoleView[]) : []),
              ...(hasPilot ? (['pilot'] as RoleView[]) : []),
            ]
          : [activeRole];

      const nextItems: PriorityQueueItem[] = [];

      const tasks: Promise<void>[] = [];

      if (rolesToLoad.includes('client')) {
        tasks.push(
          (async () => {
            const [demandRes, orderRes] = await Promise.all([
              demandV2Service.listMyDemands({page: 1, page_size: 40}),
              orderV2Service.list({role: 'client', page: 1, page_size: 50}),
            ]);

            (demandRes.data?.items || [])
              .filter(item => ['published', 'quoting'].includes(String(item.status || '').toLowerCase()) && Number(item.quote_count || 0) > 0)
              .forEach((item: DemandSummary) => {
                nextItems.push({
                  key: `client-demand-${item.id}`,
                  role: 'client',
                  category: 'quote',
                  title: item.title || '待确认方案',
                  subtitle: `${resolveDemandPrimaryAddress(item)} · ${formatDemandBudget(item.budget_min, item.budget_max)}`,
                  meta: `已收到 ${item.quote_count || 0} 份报价，点击直接查看并决定是否继续推进`,
                  tagLabel: '待确认方案',
                  tagTone: 'green',
                  urgency: 82 + Math.min(Number(item.quote_count || 0), 9),
                  sortAt: Number(item.id || 0),
                  referenceNo: item.demand_no,
                  target: {screen: 'DemandDetail', params: {id: item.id}},
                });
              });

            (orderRes.data?.items || []).forEach((order: V2OrderSummary) => {
              const bucket = getOrderStatusBucket(order.status);
              if (!bucket || (bucket !== 'confirm' && bucket !== 'payment' && bucket !== 'progress')) {
                return;
              }

              const urgency =
                bucket === 'confirm'
                  ? 92
                  : bucket === 'payment'
                    ? 88
                    : String(order.status || '').toLowerCase() === 'delivered'
                      ? 86
                      : 70;

              nextItems.push({
                key: `client-order-${order.id}`,
                role: 'client',
                category: bucket,
                title: order.title || order.order_no,
                subtitle: `${order.service_address || '起点待确认'}${order.dest_address ? ` → ${order.dest_address}` : ''}`,
                meta:
                  bucket === 'confirm'
                    ? '等待机主确认后才会进入支付阶段'
                    : bucket === 'payment'
                      ? `待支付金额 ${formatAmountYuan(order.total_amount)}`
                      : `当前状态：${getObjectStatusMeta('order', order.status).label}`,
                tagLabel:
                  bucket === 'confirm'
                    ? '待确认'
                    : bucket === 'payment'
                      ? '待付款'
                      : '进行中',
                tagTone:
                  bucket === 'confirm'
                    ? 'orange'
                    : bucket === 'payment'
                      ? 'blue'
                      : 'teal',
                urgency,
                sortAt: getPriorityItemTimestamp(order.updated_at || order.created_at),
                referenceNo: order.order_no,
                target: {screen: 'OrderDetail', params: {orderId: order.id, id: order.id}},
              });
            });
          })(),
        );
      }

      if (rolesToLoad.includes('owner')) {
        tasks.push(
          (async () => {
            const [demandRes, orderRes] = await Promise.all([
              demandV2Service.listMarketplaceDemands({page: 1, page_size: 40}),
              orderV2Service.list({role: 'owner', page: 1, page_size: 50}),
            ]);

            (demandRes.data?.items || []).forEach((item: DemandSummary) => {
              nextItems.push({
                key: `owner-demand-${item.id}`,
                role: 'owner',
                category: 'quote',
                title: item.title || '待报价任务',
                subtitle: `${resolveDemandPrimaryAddress(item)} · ${formatDemandBudget(item.budget_min, item.budget_max)}`,
                meta: `报价窗口已打开，先响应更容易拿下这单`,
                tagLabel: '待报价',
                tagTone: 'blue',
                urgency: 78 + Math.min(Number(item.quote_count || 0), 5),
                sortAt: Number(item.id || 0),
                referenceNo: item.demand_no,
                target: {screen: 'DemandDetail', params: {id: item.id}},
              });
            });

            (orderRes.data?.items || []).forEach((order: V2OrderSummary) => {
              const bucket = getOrderStatusBucket(order.status);
              if (!bucket || (bucket !== 'confirm' && bucket !== 'dispatch' && bucket !== 'progress')) {
                return;
              }

              nextItems.push({
                key: `owner-order-${order.id}`,
                role: 'owner',
                category: bucket,
                title: order.title || order.order_no,
                subtitle: `${order.service_address || '起点待确认'}${order.dest_address ? ` → ${order.dest_address}` : ''}`,
                meta:
                  bucket === 'confirm'
                    ? '客户已下单，机主确认后才能继续推进'
                    : bucket === 'dispatch'
                      ? '已承接订单，下一步要安排执行'
                      : `当前状态：${getObjectStatusMeta('order', order.status).label}`,
                tagLabel:
                  bucket === 'confirm'
                    ? '待确认'
                    : bucket === 'dispatch'
                      ? '待派单'
                      : '进行中',
                tagTone:
                  bucket === 'confirm'
                    ? 'red'
                    : bucket === 'dispatch'
                      ? 'orange'
                      : 'teal',
                urgency: bucket === 'confirm' ? 95 : bucket === 'dispatch' ? 90 : 68,
                sortAt: getPriorityItemTimestamp(order.updated_at || order.created_at),
                referenceNo: order.order_no,
                target: {screen: 'OrderDetail', params: {orderId: order.id, id: order.id}},
              });
            });
          })(),
        );
      }

      if (rolesToLoad.includes('pilot')) {
        tasks.push(
          (async () => {
            const dispatchRes = await dispatchV2Service.list({role: 'pilot', page: 1, page_size: 50});

            (dispatchRes.data?.items || []).forEach((task: V2DispatchTaskSummary) => {
              const taskStatus = String(task.status || '').toLowerCase();
              const orderStatus = String(task.order?.status || '').toLowerCase();
              if (taskStatus === 'pending_response') {
                nextItems.push({
                  key: `pilot-dispatch-${task.id}`,
                  role: 'pilot',
                  category: 'dispatch',
                  title: task.order?.title || '待响应派单',
                  subtitle: `${task.order?.service_address || '起点待确认'}${task.order?.dest_address ? ` → ${task.order.dest_address}` : ''}`,
                  meta: '正式派单已发到你名下，超时可能会自动回退',
                  tagLabel: '待接单',
                  tagTone: 'orange',
                  urgency: 98,
                  sortAt: getPriorityItemTimestamp(task.sent_at || task.updated_at || task.created_at),
                  referenceNo: task.dispatch_no,
                  target: {screen: 'DispatchTaskDetail', params: {id: task.id, dispatchId: task.id}},
                });
                return;
              }

              if (taskStatus === 'accepted' && !['completed', 'cancelled'].includes(orderStatus)) {
                nextItems.push({
                  key: `pilot-active-${task.id}`,
                  role: 'pilot',
                  category: 'progress',
                  title: task.order?.title || '执行中的任务',
                  subtitle: `${task.order?.service_address || '起点待确认'}${task.order?.dest_address ? ` → ${task.order.dest_address}` : ''}`,
                  meta: `当前状态：${getObjectStatusMeta('order', task.order?.status).label}`,
                  tagLabel: '进行中',
                  tagTone: 'teal',
                  urgency: orderStatus === 'delivered' ? 84 : 72,
                  sortAt: getPriorityItemTimestamp(task.updated_at || task.sent_at || task.created_at),
                  referenceNo: task.dispatch_no,
                  target: {screen: 'PilotOrderExecution', params: {taskId: task.id}},
                });
              }
            });
          })(),
        );
      }

      tasks.push(
        (async () => {
          const anomalyRes = await orderAnomalyV2Service.list({
            role: activeRole === 'all' ? undefined : activeRole,
            page: 1,
            page_size: 40,
          });

          (anomalyRes.data?.items || []).forEach((item: V2OrderAnomaly) => {
            const isCritical = String(item.severity || '').toLowerCase() === 'critical';
            nextItems.push({
              key: `anomaly-${item.order_id}-${item.anomaly_type}`,
              role: activeRole === 'all' ? 'all' : activeRole,
              category: 'anomaly',
              title: item.title || item.order_no,
              subtitle: item.message,
              meta: item.recommended_action || '点击进入详情查看异常上下文',
              tagLabel: isCritical ? '严重异常' : '异常提醒',
              tagTone: isCritical ? 'red' : 'orange',
              urgency: isCritical ? 110 : 96,
              sortAt: getPriorityItemTimestamp(item.updated_at),
              referenceNo: item.order_no,
              target:
                activeRole === 'pilot' && item.dispatch_task_id
                  ? {screen: 'DispatchTaskDetail', params: {id: item.dispatch_task_id, dispatchId: item.dispatch_task_id}}
                  : {screen: 'OrderDetail', params: {orderId: item.order_id, id: item.order_id}},
            });
          });
        })(),
      );

      await Promise.all(tasks);

      if (!authStateRef.current) {
        return;
      }

      nextItems.sort((a, b) => {
        if (b.urgency !== a.urgency) {
          return b.urgency - a.urgency;
        }
        if (b.sortAt !== a.sortAt) {
          return b.sortAt - a.sortAt;
        }
        return a.key.localeCompare(b.key);
      });

      setPriorityItems(nextItems);
    } catch (error) {
      if (authStateRef.current) {
        console.warn('加载首页待处理列表失败:', error);
        setPriorityItems([]);
      }
    } finally {
      if (authStateRef.current) {
        setPriorityLoading(false);
      }
    }
  }, [activeRole, hasClient, hasOwner, hasPilot]);

  useEffect(() => {
    setPriorityFilter('all');
    setPriorityPage(0);
    setPriorityFilterExpanded(false);
  }, [activeRole]);

  useEffect(() => {
    setPriorityPage(0);
    setPriorityFilterExpanded(false);
  }, [priorityFilter]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return undefined;
      }
      fetchDashboard();
      fetchPriorityQueue();
      return undefined;
    }, [fetchDashboard, fetchPriorityQueue, isAuthenticated]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
    fetchPriorityQueue();
  }, [fetchDashboard, fetchPriorityQueue]);

  const heroTheme = useMemo(() => getHeroTheme(activeRole), [activeRole]);
  const quickActionLayout = useMemo(() => {
    const gap = 10;
    const availableWidth = Math.max(
      viewportWidth - CONTENT_SIDE_MARGIN * 2 - QUICK_GRID_PANEL_HORIZONTAL_PADDING * 2,
      0,
    );
    const columns = availableWidth >= 300 ? 3 : 2;
    const itemWidth = Math.floor((availableWidth - gap * (columns - 1)) / columns);
    return {
      columns,
      availableWidth,
      itemWidth,
    };
  }, [viewportWidth]);

  const heroConfig = useMemo(() => {
    switch (activeRole) {
      case 'client':
        return {
          title: '今天先处理这些订单',
          subtitle:
            '要下单就走快速下单；需要比价或说明更多细节，就发布任务。',
          primaryAction: {
            title: '快速下单',
            onPress: () => navigation.navigate('QuickOrderEntry'),
          },
          secondaryActions: [
            {
              title: '发布任务',
              onPress: () => navigation.navigate('PublishCargo'),
            },
          ],
          metrics: [
            {
              key: 'client-quoted',
              label: '待确认方案',
              value: currentDashboard.role_views.client.quoted_demand_count,
              hint: '有服务方给出方案',
            },
            {
              key: 'client-confirm',
              label: '待确认订单',
              value:
                currentDashboard.role_views.client
                  .pending_provider_confirmation_order_count,
              hint: '等服务方确认',
            },
            {
              key: 'client-payment',
              label: '待付款',
              value:
                currentDashboard.role_views.client.pending_payment_order_count,
              hint: '确认后再付款',
            },
            {
              key: 'client-progress',
              label: '运输中',
              value: currentDashboard.role_views.client.in_progress_order_count,
              hint: '正在推进的订单',
            },
          ] as MetricCard[],
        };
      case 'owner':
        return {
          title: '今天先看这些机会',
          subtitle:
            '新任务、待确认订单和待安排执行都放在这里，先处理最着急的。',
          primaryAction: {
            title: '查看新需求',
            onPress: () => navigation.navigate('DemandList'),
          },
          secondaryActions: [
            {
              title: '上架服务',
              onPress: () => navigation.navigate('PublishOffer'),
            },
            {
              title: '机队资质',
              onPress: () => navigation.navigate('MyDrones'),
            },
          ],
          metrics: [
            {
              key: 'owner-demand',
              label: '新需求',
              value: currentDashboard.role_views.owner.recommended_demand_count,
              hint: '可以报价的任务',
            },
            {
              key: 'owner-confirm',
              label: '待确认订单',
              value:
                currentDashboard.role_views.owner
                  .pending_provider_confirmation_order_count,
              hint: '客户已提交订单',
            },
            {
              key: 'owner-quote',
              label: '待报价',
              value: currentDashboard.role_views.owner.pending_quote_count,
              hint: '需要尽快响应',
            },
            {
              key: 'owner-dispatch',
              label: '待安排执行',
              value:
                currentDashboard.role_views.owner.pending_dispatch_order_count,
              hint: '成交后安排飞手',
            },
          ] as MetricCard[],
        };
      case 'pilot':
        return {
          title: '今天有哪些任务要处理',
          subtitle:
            '待接单、执行中和飞行记录都在这里，先处理快超时的任务。',
          primaryAction: {
            title: '查看待接派单',
            onPress: () =>
              navigation.navigate('PilotTaskList', { entry: 'assigned' }),
          },
          secondaryActions: [
            {
              title: '飞行执行',
              onPress: () => navigation.navigate('Fulfillment'),
            },
            {
              title: '资质管理',
              onPress: () => navigation.navigate('PilotProfile'),
            },
          ],
          metrics: [
            {
              key: 'pilot-pending',
              label: '待接单',
              value:
                currentDashboard.role_views.pilot
                  .pending_response_dispatch_count,
              hint: '等你确认的任务',
            },
            {
              key: 'pilot-active',
              label: '执行中',
              value: currentDashboard.role_views.pilot.active_dispatch_count,
              hint: '正在处理的任务',
            },
            {
              key: 'pilot-flight',
              label: '飞行记录',
              value: currentDashboard.role_views.pilot.recent_flight_count,
              hint: '已完成记录',
            },
          ] as MetricCard[],
        };
      default:
        const allSecondaryActions = [];
        if (hasOwner) {
          allSecondaryActions.push({
            title: '查看新需求',
            onPress: () => navigation.navigate('DemandList'),
          });
        }
        if (hasPilot) {
          allSecondaryActions.push({
            title: '待接派单',
            onPress: () =>
              navigation.navigate('PilotTaskList', { entry: 'assigned' }),
          });
        }
        if (hasClient && !hasOwner && !hasPilot) {
          allSecondaryActions.push({
            title: '浏览服务',
            onPress: () => navigation.navigate('QuickOrderEntry'),
          });
        }

        const allMetrics: MetricCard[] = [];
        if (hasClient) {
          allMetrics.push({
            key: 'all-progress',
            label: '进行中订单',
            value: currentDashboard.summary.in_progress_order_count,
            hint: '正在推进的订单',
          });
        }
        if (hasPilot) {
          allMetrics.push({
            key: 'all-pending',
            label: '待接派单',
            value:
              currentDashboard.role_views.pilot.pending_response_dispatch_count,
            hint: '等你确认的任务',
          });
        }
        if (hasOwner) {
          allMetrics.push({
            key: 'all-demand',
            label: '待报价任务',
            value: currentDashboard.role_views.owner.recommended_demand_count,
            hint: '可以报价的任务',
          });
        }
        while (allMetrics.length < 3) {
          allMetrics.push({
            key: `all-filler-${allMetrics.length}`,
            label: allMetrics.length === 1 ? '今日新单' : '市场任务',
            value:
              allMetrics.length === 1
                ? currentDashboard.summary.today_order_count
                : currentDashboard.market_totals.demand_count,
            hint:
              allMetrics.length === 1 ? '今天新来的订单' : '可承接的任务',
          });
        }

        return {
          title: '今天先处理这些事',
          subtitle:
            '下单、报价、接单和异常提醒都集中在工作台。',
          primaryAction: {
            title: hasClient
              ? '发布任务'
              : hasOwner
              ? '查看新需求'
              : '待接派单',
            onPress: hasClient
              ? () => navigation.navigate('PublishCargo')
              : hasOwner
              ? () => navigation.navigate('DemandList')
              : () =>
                  navigation.navigate('PilotTaskList', { entry: 'assigned' }),
          },
          secondaryActions: allSecondaryActions.slice(0, 2),
          metrics: allMetrics.slice(0, 3),
        };
    }
  }, [activeRole, currentDashboard, hasClient, hasOwner, hasPilot, navigation]);
  const quickActions = useMemo<DashboardAction[]>(() => {
    const platformEntries: DashboardAction[] = [
      {
        key: 'service-hub',
        title: '浏览服务',
        desc: '查看供给与需求',
        icon: '🧭',
        tone: 'blue',
        onPress: () => navigation.navigate('ServiceHub'),
      },
      {
        key: 'progress',
        title: '我的需求',
        desc: '查看我的需求',
        icon: '📋',
        tone: 'teal',
        onPress: () => navigation.navigate('MyDemands'),
      },
    ];

    switch (activeRole) {
      case 'client':
        return [
          ...platformEntries,
          {
            key: 'quick-order',
            title: '快速下单',
            desc: '直达下单',
            icon: '📦',
            tone: 'blue',
            onPress: () => navigation.navigate('QuickOrderEntry'),
          },
          {
            key: 'publish',
            title: '发布任务',
            desc: '发起需求',
            icon: '📝',
            tone: 'orange',
            onPress: () => navigation.navigate('PublishCargo'),
          },
          {
            key: 'my-demands',
            title: '询价中的任务',
            desc: '开放报价中的需求',
            icon: '🗂️',
            tone: 'purple',
            onPress: () => navigation.navigate('MyDemands', {statusFilter: 'quoting'}),
            badge: currentDashboard.role_views.client.open_demand_count,
          },
        ];
      case 'owner':
        return [
          ...platformEntries,
          {
            key: 'owner-demand',
            title: '查看新需求',
            desc: '进入市场寻找可承接任务',
            icon: '📈',
            tone: 'blue',
            onPress: () => navigation.navigate('DemandList'),
            badge: currentDashboard.role_views.owner.recommended_demand_count,
          },
          {
            key: 'owner-offer',
            title: '上架服务',
            desc: '上架机型、能力与服务区域',
            icon: '🚁',
            tone: 'teal',
            onPress: () => navigation.navigate('PublishOffer'),
          },
          {
            key: 'owner-supplies',
            title: '我的服务',
            desc: '查看服务状态与曝光结果',
            icon: '📦',
            tone: 'green',
            onPress: () => navigation.navigate('MyOffers'),
            badge: currentDashboard.role_views.owner.active_supply_count,
          },
          {
            key: 'owner-drones',
            title: '机队资质',
            desc: '维护设备、认证与可用状态',
            icon: '🛩️',
            tone: 'purple',
            onPress: () => navigation.navigate('MyDrones'),
          },
        ];
      case 'pilot':
        return [
          ...platformEntries,
          {
            key: 'pilot-assigned',
            title: '待接派单',
            desc: '处理系统正式指派任务',
            icon: '🎯',
            tone: 'orange',
            onPress: () =>
              navigation.navigate('PilotTaskList', { entry: 'assigned' }),
            badge:
              currentDashboard.role_views.pilot.pending_response_dispatch_count,
          },
          {
            key: 'pilot-fulfillment',
            title: '飞行执行',
            desc: '进入飞行监控与交付看板',
            icon: '🚁',
            tone: 'teal',
            onPress: () => navigation.navigate('Fulfillment'),
          },
          {
            key: 'pilot-nearby',
            title: '报名需求',
            desc: '报名公开任务进入候选池',
            icon: '🛰️',
            tone: 'blue',
            onPress: () => navigation.navigate('DemandList', {mode: 'pilot'}),
            badge: currentDashboard.role_views.pilot.candidate_demand_count,
          },
          {
            key: 'pilot-profile',
            title: '资质设置',
            desc: '管理执照、技能与接单开关',
            icon: '🪪',
            tone: 'purple',
            onPress: () => navigation.navigate('PilotProfile'),
          },
        ];
      default:
        const actions: DashboardAction[] = [...platformEntries];
        if (hasClient) {
          actions.push({
            key: 'all-quick-order',
            title: '快速下单',
            desc:
              currentDashboard.market_totals.supply_count > 0
                ? `当前有 ${currentDashboard.market_totals.supply_count} 个服务支持直达下单，标准场景优先走这条`
                : '标准场景先补最小信息，系统会筛选支持直达下单的服务',
            icon: '📦',
            tone: 'blue',
            onPress: () => navigation.navigate('QuickOrderEntry'),
          });
          actions.push({
            key: 'all-publish',
            title: '发布任务',
            desc: '复杂或非标需求先发起任务，再慢慢补细节',
            icon: '📝',
            tone: 'green',
            onPress: () => navigation.navigate('PublishCargo'),
          });
        }
        if (hasOwner) {
          actions.push({
            key: 'all-demand',
            title: '查看新需求',
            desc: '进入市场挑选可承接任务',
            icon: '📈',
            tone: 'blue',
            onPress: () => navigation.navigate('DemandList'),
            badge: currentDashboard.role_views.owner.recommended_demand_count,
          });
        }
        if (hasPilot) {
          actions.push({
            key: 'all-pilot',
            title: '待接派单',
            desc: '飞手优先处理正式派单',
            icon: '🎯',
            tone: 'orange',
            onPress: () =>
              navigation.navigate('PilotTaskList', { entry: 'assigned' }),
            badge:
              currentDashboard.role_views.pilot.pending_response_dispatch_count,
          });
        }
        return actions.slice(0, 6);
    }
  }, [activeRole, currentDashboard, hasClient, hasOwner, hasPilot, navigation]);

  const priorityFilterOptions = useMemo(() => {
    const counts = priorityItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    const filters: Array<{key: PriorityQueueFilter; label: string; count: number}> = [
      {key: 'all', label: '全部', count: priorityItems.length},
    ];

    (['anomaly', 'confirm', 'quote', 'payment', 'dispatch', 'progress'] as PriorityQueueCategory[]).forEach(key => {
      const count = counts[key] || 0;
      if (count > 0) {
        filters.push({
          key,
          label: getPriorityFilterLabel(activeRole, key),
          count,
        });
      }
    });

    return filters;
  }, [activeRole, priorityItems]);

  const currentPriorityFilterOption = useMemo(
    () =>
      priorityFilterOptions.find(item => item.key === priorityFilter) ||
      priorityFilterOptions[0],
    [priorityFilter, priorityFilterOptions],
  );

  useEffect(() => {
    if (priorityFilterOptions.some(item => item.key === priorityFilter)) {
      return;
    }
    setPriorityFilter('all');
  }, [priorityFilter, priorityFilterOptions]);

  const filteredPriorityItems = useMemo(
    () =>
      priorityItems.filter(item => priorityFilter === 'all' || item.category === priorityFilter),
    [priorityFilter, priorityItems],
  );

  const priorityPageCount = Math.max(1, Math.ceil(filteredPriorityItems.length / PRIORITY_PAGE_SIZE));

  useEffect(() => {
    if (priorityPage <= priorityPageCount - 1) {
      return;
    }
    setPriorityPage(0);
  }, [priorityPage, priorityPageCount]);

  const priorityPageItems = useMemo(() => {
    const start = priorityPage * PRIORITY_PAGE_SIZE;
    return filteredPriorityItems.slice(start, start + PRIORITY_PAGE_SIZE);
  }, [filteredPriorityItems, priorityPage]);

  return (
    <View style={styles.rootWrap}>
      <LinearGradient
        colors={theme.isDark ? ['#060B18', '#0A1025', '#111D35'] : [theme.bg, theme.bg, theme.bg]}
        style={StyleSheet.absoluteFill}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
      />
      {theme.isDark && (
        <>
          <View style={[styles.glowOrb, {top: -60, right: -80, backgroundColor: 'rgba(0,212,255,0.06)'}]} />
          <View style={[styles.glowOrb, {top: 360, left: -100, backgroundColor: 'rgba(0,100,255,0.04)'}]} />
        </>
      )}
      <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + 20 },
        ]}
        scrollIndicatorInsets={{ bottom: tabBarHeight }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.refreshColor]}
            tintColor={theme.refreshColor}
          />
        }
      >
        <View style={styles.contentRail}>
          <View style={[styles.tabsWrap, {backgroundColor: theme.tabBg}]}>
            {roleTabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.roleTab,
                  activeRole === tab.key && {backgroundColor: theme.tabActiveBg},
                ]}
                onPress={() => setActiveRole(tab.key)}
              >
                <Text
                  style={[
                    styles.roleTabText,
                    {color: theme.tabText},
                    activeRole === tab.key && {color: theme.tabActiveText},
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.contentRail}>
          <View style={styles.hero}>
            <LinearGradient
              colors={heroTheme.gradient}
              style={StyleSheet.absoluteFill}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
            />
            <Image
              source={workbenchAssets.hero}
              style={styles.heroBgImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(4,76,213,0.18)', 'rgba(4,76,213,0.08)', 'rgba(4,76,213,0.02)']}
              style={styles.heroImageOverlay}
              start={{x: 0, y: 0.5}}
              end={{x: 1, y: 0.5}}
            />
            <View style={styles.heroTopRow}>
              <View style={styles.heroCopyWrap}>
                <Text
                  style={[styles.heroEyebrow, { color: heroTheme.softText }]}
                >
                  {heroTheme.eyebrow}
                </Text>
                <Text style={styles.heroTitle}>{heroConfig.title}</Text>
                <Text style={styles.heroSubtitle}>{heroConfig.subtitle}</Text>
                <TouchableOpacity
                  activeOpacity={0.86}
                  style={styles.heroAlertRow}
                  onPress={anomalyAlertCount > 0 ? openAnomalyCenter : undefined}
                >
                  <Image source={workbenchAssets.warning} style={styles.heroWarningIcon} resizeMode="contain" />
                  <Text style={styles.heroAlertText} numberOfLines={1}>
                    {anomalyAlertCount > 0
                      ? `${anomalyAlertCount} 个任务出现异常，请及时处理`
                      : '暂无异常提醒，当前任务运行稳定'}
                  </Text>
                </TouchableOpacity>
              </View>

              {anomalyAlertCount > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`异常提醒，当前 ${anomalyAlertCount} 条，点击查看`}
                  onPress={openAnomalyCenter}
                  style={styles.alertPill}
                >
                  <Text style={styles.alertPillValue}>{anomalyAlertCount}</Text>
                  <Text style={styles.alertPillLabel}>异常提醒</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.heroActionRow}>
              <ActionPill
                title={heroConfig.primaryAction.title}
                onPress={heroConfig.primaryAction.onPress}
                primary
                theme={heroTheme}
              />
              {heroConfig.secondaryActions.slice(0, 1).map(action => (
                <ActionPill
                  key={action.title}
                  title={action.title}
                  onPress={action.onPress}
                  theme={heroTheme}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.contentRail}>
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, {color: theme.text}]}>今天优先处理</Text>
              <Text style={[styles.sectionHint, {color: theme.textHint}]}>先处理这些再看其他</Text>
            </View>
            <ObjectCard style={styles.priorityBoard}>
              <View style={styles.priorityHeaderRow}>
                <Text style={[styles.priorityTitle, {color: theme.text}]}>待处理列表</Text>
                <Text style={[styles.prioritySummary, {color: theme.textHint}]}>
                  {filteredPriorityItems.length} 条
                </Text>
              </View>

              <View style={styles.priorityFilterRow}>
                <Text style={[styles.priorityFilterLabel, {color: theme.textHint}]}>筛选范围</Text>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[
                    styles.priorityFilterTrigger,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: priorityFilterExpanded ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setPriorityFilterExpanded(prev => !prev)}
                >
                  <View style={styles.priorityFilterTriggerMain}>
                    <Text style={[styles.priorityFilterTriggerText, {color: theme.text}]}>
                      {currentPriorityFilterOption?.label || '全部'}
                    </Text>
                    <View
                      style={[
                        styles.priorityFilterCount,
                        {backgroundColor: `${theme.primary}18`},
                      ]}
                    >
                      <Text style={[styles.priorityFilterCountText, {color: theme.primary}]}>
                        {currentPriorityFilterOption?.count || 0}
                      </Text>
                    </View>
                  </View>
                  <Image
                    source={workbenchAssets.dropdownDown}
                    style={[
                      styles.priorityFilterChevronImage,
                      priorityFilterExpanded && styles.priorityFilterChevronImageOpen,
                    ]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              {priorityFilterExpanded ? (
                <View
                  style={[
                    styles.priorityDropdown,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {priorityFilterOptions.map(item => {
                    const isActive = priorityFilter === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        activeOpacity={0.88}
                        style={[
                          styles.priorityDropdownItem,
                          isActive ? styles.priorityDropdownItemActive : null,
                        ]}
                        onPress={() => {
                          setPriorityFilter(item.key);
                          setPriorityFilterExpanded(false);
                        }}
                      >
                        <View style={styles.priorityDropdownCopy}>
                          <Text
                            style={[
                              styles.priorityDropdownTitle,
                              {color: isActive ? theme.primaryText : theme.text},
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text
                            style={[
                              styles.priorityDropdownHint,
                              {color: isActive ? theme.primaryText : theme.textHint},
                            ]}
                          >
                            {item.key === 'all' ? '查看全部待处理事项' : `仅看${item.label}`}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.priorityFilterCount,
                            {backgroundColor: isActive ? `${theme.primary}20` : theme.inputBg},
                          ]}
                        >
                          <Text
                            style={[
                              styles.priorityFilterCountText,
                              {color: isActive ? theme.primary : theme.textHint},
                            ]}
                          >
                            {item.count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {priorityLoading ? (
                <ActivityIndicator style={styles.loading} color={theme.refreshColor} />
              ) : priorityPageItems.length > 0 ? (
                <View style={styles.priorityList}>
                  {priorityPageItems.map(item => {
                    const palette = getTonePalette(item.tagTone, theme.isDark);
                    return (
                      <TouchableOpacity
                        key={item.key}
                        activeOpacity={0.88}
                        style={[
                          styles.priorityItem,
                          {
                            backgroundColor: theme.card,
                            borderColor: theme.cardBorder,
                            borderLeftColor: palette.text,
                          },
                        ]}
                        onPress={() => navigation.navigate(item.target.screen as never, item.target.params as never)}
                      >
                        <View style={styles.priorityItemTop}>
                          <View style={styles.priorityIdentityRow}>
                            {activeRole === 'all' && item.role !== 'all' ? (
                              <View
                                style={[
                                  styles.priorityRolePill,
                                  {backgroundColor: theme.inputBg, borderColor: theme.inputBorder},
                                ]}
                              >
                                <Text style={[styles.priorityRolePillText, {color: theme.textSub}]}>
                                  {getPriorityRoleLabel(item.role)}
                                </Text>
                              </View>
                            ) : null}
                            {item.referenceNo ? (
                              <Text
                                style={[styles.priorityRefNo, {color: theme.textHint}]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {item.referenceNo}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.priorityTopTags}>
                            <View
                              style={[
                                styles.priorityTag,
                                {backgroundColor: palette.bg, borderColor: palette.border},
                              ]}
                            >
                              <Text style={[styles.priorityTagText, {color: palette.text}]}>
                                {item.tagLabel}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.priorityUrgencyText,
                                {
                                  color: palette.text,
                                  backgroundColor: palette.bg,
                                  borderColor: palette.border,
                                },
                              ]}
                            >
                              {getPriorityUrgencyLabel(item.urgency)}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.priorityItemTitle, {color: theme.text}]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View style={styles.priorityItemBottom}>
                          <Text style={[styles.priorityItemSubtitle, {color: theme.textSub}]} numberOfLines={1}>
                            {item.subtitle}
                          </Text>
                          <View style={styles.priorityItemMetaWrap}>
                            <Text style={[styles.priorityItemMeta, {color: theme.textHint}]} numberOfLines={1}>
                              {item.meta}
                            </Text>
                            <Image
                              source={workbenchAssets.chevronRight}
                              style={styles.priorityItemChevronImage}
                              resizeMode="contain"
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <EmptyState
                  icon="📋"
                  title="当前没有待处理事项"
                  description="筛选后没有命中的结果，先去创建任务或查看全部订单。"
                  actionText={activeRole === 'client' ? '快速下单' : '查看订单'}
                  onAction={() =>
                    activeRole === 'client'
                      ? navigation.navigate('QuickOrderEntry')
                      : navigation.navigate('MyOrders')
                  }
                />
              )}

              {priorityPageCount > 1 ? (
                <View style={styles.priorityPagerRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={priorityPage === 0}
                    style={[
                      styles.priorityPagerBtn,
                      {
                        backgroundColor: priorityPage === 0 ? theme.inputBg : theme.card,
                        borderColor: theme.inputBorder,
                      },
                    ]}
                    onPress={() => setPriorityPage(prev => Math.max(0, prev - 1))}
                  >
                    <Text
                      style={[
                        styles.priorityPagerBtnText,
                        {color: priorityPage === 0 ? theme.textHint : theme.text},
                      ]}
                    >
                      上一页
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.priorityPagerText, {color: theme.textHint}]}>
                    第 {priorityPage + 1} / {priorityPageCount} 页
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={priorityPage >= priorityPageCount - 1}
                    style={[
                      styles.priorityPagerBtn,
                      {
                        backgroundColor: priorityPage >= priorityPageCount - 1 ? theme.inputBg : theme.card,
                        borderColor: theme.inputBorder,
                      },
                    ]}
                    onPress={() => setPriorityPage(prev => Math.min(priorityPageCount - 1, prev + 1))}
                  >
                    <Text
                      style={[
                        styles.priorityPagerBtnText,
                        {color: priorityPage >= priorityPageCount - 1 ? theme.textHint : theme.text},
                      ]}
                    >
                      下一页
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ObjectCard>
          </View>
        </View>

        <View style={styles.contentRail}>
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, {color: theme.text}]}>
                工作台入口
              </Text>
            </View>
            <View
              style={[
                styles.quickGridPanel,
                {
                  backgroundColor: theme.isDark ? theme.card : theme.bgSecondary,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.quickGrid}>
                {quickActions.map(action => (
                  <QuickActionCard key={action.key} action={action} width={quickActionLayout.itemWidth} />
                ))}
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  rootWrap: {
    flex: 1,
  },
  glowOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  contentRail: {
    marginHorizontal: CONTENT_SIDE_MARGIN,
  },
  tabsWrap: {
    marginTop: 8,
    borderRadius: 18,
    padding: 3,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: theme.isDark ? 0 : 0.04,
    shadowRadius: theme.isDark ? 0 : 8,
    elevation: theme.isDark ? 0 : 2,
  },
  roleTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    paddingVertical: 5,
    borderRadius: 15,
  },
  roleTabActive: {},
  roleTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  roleTabTextActive: {},
  hero: {
    marginTop: 12,
    height: 170,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#0753D8',
    shadowColor: theme.isDark ? 'rgba(0,212,255,0.3)' : '#000',
    shadowOffset: {width: 0, height: theme.isDark ? 0 : 9},
    shadowOpacity: theme.isDark ? 0.5 : 0.2,
    shadowRadius: theme.isDark ? 20 : 24,
    elevation: 6,
  },
  heroBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroTopRow: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: HERO_SIDE_PADDING,
    paddingTop: 14,
  },
  heroCopyWrap: {
    flex: 1,
    paddingRight: 14,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  heroTitle: {
    maxWidth: 245,
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  heroSubtitle: {
    maxWidth: 260,
    marginTop: 7,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  heroAlertRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 260,
  },
  heroWarningIcon: {
    width: 17,
    height: 17,
    marginRight: 7,
    flexShrink: 0,
  },
  heroAlertText: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  alertPill: {
    minWidth: 112,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 13,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#0B3282',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  alertPillValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F04438',
  },
  alertPillLabel: {
    marginLeft: 4,
    fontSize: 11,
    color: '#F04438',
    fontWeight: '800',
  },
  heroActionRow: {
    position: 'absolute',
    left: HERO_SIDE_PADDING,
    bottom: 15,
    zIndex: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  heroActionBtn: {
    minWidth: 86,
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 0,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  heroActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  heroActionTextGhost: {
    color: '#FFFFFF',
  },
  heroDualBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  heroDualBtnTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroDualBtnDesc: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionWrap: {
    marginTop: 14,
  },
  sectionHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: theme.text,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionHint: {
    fontSize: 12,
    color: theme.textHint,
  },
  linkText: {
    fontSize: 12,
    color: theme.primaryText,
    fontWeight: '700',
  },
  priorityBoard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  priorityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  prioritySummary: {
    fontSize: 12,
    fontWeight: '700',
  },
  priorityFilterRow: {
    marginTop: 12,
    gap: 8,
  },
  priorityFilterLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  priorityFilterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  priorityFilterTriggerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityFilterTriggerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  priorityFilterChevronImage: {
    width: 12,
    height: 12,
  },
  priorityFilterChevronImageOpen: {
    transform: [{rotate: '180deg'}],
  },
  priorityDropdown: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  priorityDropdownItem: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  priorityDropdownItemActive: {
    backgroundColor: theme.primaryBg,
  },
  priorityDropdownCopy: {
    flex: 1,
  },
  priorityDropdownTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  priorityDropdownHint: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
  },
  priorityFilterChip: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 6,
  },
  priorityFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  priorityFilterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  priorityFilterCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  priorityList: {
    marginTop: 14,
    gap: 10,
  },
  priorityItem: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  priorityItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  priorityIdentityRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityRolePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityRolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priorityRefNo: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '700',
  },
  priorityTopTags: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  priorityItemTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '800',
  },
  priorityItemBottom: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  priorityItemSubtitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  priorityItemMetaWrap: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 128,
  },
  priorityItemMeta: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  priorityItemChevronImage: {
    width: 12,
    height: 12,
    flexShrink: 0,
  },
  priorityUrgencyText: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  priorityPagerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityPagerBtn: {
    minWidth: 78,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  priorityPagerBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  priorityPagerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickGridPanel: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: QUICK_GRID_PANEL_HORIZONTAL_PADDING,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: theme.isDark ? 0 : 0.04,
    shadowRadius: theme.isDark ? 0 : 10,
    elevation: theme.isDark ? 0 : 2,
  },
  quickActionCard: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 88,
  },
  quickActionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  quickActionIconImage: {
    width: 34,
    height: 34,
  },
  quickActionBadge: {
    position: 'absolute',
    right: -10,
    top: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadgeText: {
    fontSize: 10,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  quickActionTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  loading: {
    paddingVertical: 28,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNo: {
    fontSize: 12,
    color: theme.textHint,
    fontWeight: '700',
  },
  orderTitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    color: theme.text,
    fontWeight: '700',
  },
  orderFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderMeta: {
    fontSize: 12,
    color: theme.textSub,
  },
  orderAmount: {
    fontSize: 16,
    color: theme.danger,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
