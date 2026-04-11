import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
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
import StatusBadge from '../../components/business/StatusBadge';
import {
  getObjectStatusMeta,
  getTonePalette,
  VisualTone,
} from '../../components/business/visuals';
import { homeService } from '../../services/home';
import { RootState } from '../../store/store';
import { HomeDashboard } from '../../types';
import {getResponsiveTwoColumnLayout} from '../../utils/responsiveGrid';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

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

type TodoItem = {
  key: string;
  title: string;
  desc: string;
  actionText: string;
  onPress: () => void;
  badge?: number;
  tone?: VisualTone;
};

const CONTENT_SIDE_MARGIN = 16;
const HERO_SIDE_PADDING = 18;
const METRIC_GAP = 12;

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
      style={[
        styles.quickActionCard,
        {
          width,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.cardBorder,
        },
      ]}
      onPress={action.onPress}
      activeOpacity={0.88}
    >
      <View
        style={[
          styles.quickActionIconWrap,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
      >
        <Text style={styles.quickActionIcon}>{action.icon}</Text>
        {typeof action.badge === 'number' && action.badge > 0 ? (
          <View
            style={[styles.quickActionBadge, { backgroundColor: palette.text }]}
          >
            <Text style={styles.quickActionBadgeText}>{action.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.quickActionTitle, {color: theme.text}]}>{action.title}</Text>
      <Text style={[styles.quickActionDesc, {color: theme.textSub}]}>{action.desc}</Text>
    </TouchableOpacity>
  );
}

function getHeroTheme(role: RoleView): HeroTheme {
  switch (role) {
    case 'client':
      return {
        gradient: ['#0f8f61', '#17a36b'],
        accent: '#0f8f61',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(239,255,247,0.88)',
        eyebrow: '客户概览',
      };
    case 'owner':
      return {
        gradient: ['#0f5cab', '#1d4ed8'],
        accent: '#0f5cab',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(230,244,255,0.88)',
        eyebrow: '机主概览',
      };
    case 'pilot':
      return {
        gradient: ['#b45309', '#d97706'],
        accent: '#b45309',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(255,247,237,0.9)',
        eyebrow: '飞手概览',
      };
    default:
      return {
        gradient: ['#0f4c81', '#0f766e'],
        accent: '#0f5cab',
        surface: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.22)',
        softText: 'rgba(236,253,245,0.9)',
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
  const tabBarHeight = useBottomTabBarHeight();

  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const fetchDashboard = useCallback(async () => {
    if (!authStateRef.current) {
      return;
    }
    try {
      const res = await homeService.getDashboard();
      if (authStateRef.current) {
        setDashboard(res.data || emptyDashboard);
      }
    } catch (error) {
      if (authStateRef.current) {
        console.warn('加载首页数据失败:', error);
      }
    } finally {
      if (authStateRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return undefined;
      }
      fetchDashboard();
      return undefined;
    }, [fetchDashboard, isAuthenticated]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  const heroTheme = useMemo(() => getHeroTheme(activeRole), [activeRole]);
  const quickActionLayout = useMemo(
    () =>
      getResponsiveTwoColumnLayout({
        viewportWidth,
        totalHorizontalPadding: CONTENT_SIDE_MARGIN * 2,
        gap: 10,
        minItemWidth: 132,
      }),
    [viewportWidth],
  );

  const heroConfig = useMemo(() => {
    switch (activeRole) {
      case 'client':
        return {
          title: '先发任务，再选方案',
          subtitle:
            '你最需要的是尽快发起任务、浏览服务、跟进报价与待支付订单。',
          primaryAction: {
            title: '立即发布任务',
            onPress: () => navigation.navigate('PublishCargo'),
          },
          secondaryActions: [
            {
              title: '浏览服务',
              onPress: () => navigation.navigate('OfferList'),
            },
            {
              title: '我的订单',
              onPress: () => navigation.navigate('MyOrders'),
            },
          ],
          metrics: [
            {
              key: 'client-quoted',
              label: '待选方案',
              value: currentDashboard.role_views.client.quoted_demand_count,
              hint: '已有报价进入筛选',
            },
            {
              key: 'client-confirm',
              label: '待确认',
              value:
                currentDashboard.role_views.client
                  .pending_provider_confirmation_order_count,
              hint: '等待机主确认',
            },
            {
              key: 'client-payment',
              label: '待支付',
              value:
                currentDashboard.role_views.client.pending_payment_order_count,
              hint: '已选定方案待付款',
            },
            {
              key: 'client-progress',
              label: '进行中任务',
              value: currentDashboard.role_views.client.in_progress_order_count,
              hint: '已进入执行阶段',
            },
          ] as MetricCard[],
        };
      case 'owner':
        return {
          title: '先看新需求，再做承接',
          subtitle:
            '机主首页只聚焦获客、报价和进度管理，不再把客户信息和飞手信息混在一起。',
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
              hint: '平台推荐可报价需求',
            },
            {
              key: 'owner-confirm',
              label: '待确认',
              value:
                currentDashboard.role_views.owner
                  .pending_provider_confirmation_order_count,
              hint: '直达订单待处理',
            },
            {
              key: 'owner-quote',
              label: '待报价',
              value: currentDashboard.role_views.owner.pending_quote_count,
              hint: '已提交后继续跟进',
            },
            {
              key: 'owner-dispatch',
              label: '待指派',
              value:
                currentDashboard.role_views.owner.pending_dispatch_order_count,
              hint: '成交后待安排执行',
            },
          ] as MetricCard[],
        };
      case 'pilot':
        return {
          title: '先接派单，再看执行',
          subtitle:
            '飞手视图只保留执行相关信息，避免把任务、服务和订单列表堆在一起。',
          primaryAction: {
            title: '待接派单',
            onPress: () =>
              navigation.navigate('PilotTaskList', { entry: 'assigned' }),
          },
          secondaryActions: [
            {
              title: '飞行记录',
              onPress: () => navigation.navigate('FlightLog'),
            },
            {
              title: '可报名需求',
              onPress: () => navigation.navigate('DemandList'),
            },
          ],
          metrics: [
            {
              key: 'pilot-pending',
              label: '待响应派单',
              value:
                currentDashboard.role_views.pilot
                  .pending_response_dispatch_count,
              hint: '系统正式派单待确认',
            },
            {
              key: 'pilot-active',
              label: '今日任务',
              value: currentDashboard.role_views.pilot.active_dispatch_count,
              hint: '已接受或执行中的派单',
            },
            {
              key: 'pilot-flight',
              label: '最近飞行',
              value: currentDashboard.role_views.pilot.recent_flight_count,
              hint: '真实履约飞行记录',
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
            onPress: () => navigation.navigate('OfferList'),
          });
        }

        const allMetrics: MetricCard[] = [];
        if (hasClient) {
          allMetrics.push({
            key: 'all-progress',
            label: '进行中订单',
            value: currentDashboard.summary.in_progress_order_count,
            hint: '当前正在执行的履约任务',
          });
        }
        if (hasPilot) {
          allMetrics.push({
            key: 'all-pending',
            label: '待接派单',
            value:
              currentDashboard.role_views.pilot.pending_response_dispatch_count,
            hint: '需要飞手尽快响应',
          });
        }
        if (hasOwner) {
          allMetrics.push({
            key: 'all-demand',
            label: '待报价需求',
            value: currentDashboard.role_views.owner.recommended_demand_count,
            hint: '适合当前机队承接',
          });
        }
        while (allMetrics.length < 3) {
          allMetrics.push({
            key: `all-filler-${allMetrics.length}`,
            label: allMetrics.length === 1 ? '今日单量' : '市场需求',
            value:
              allMetrics.length === 1
                ? currentDashboard.summary.today_order_count
                : currentDashboard.market_totals.demand_count,
            hint:
              allMetrics.length === 1 ? '今天新进入的订单' : '平台公开可见需求',
          });
        }

        return {
          title: '先处理优先动作，再看全局',
          subtitle:
            '综合视图只保留今天最重要的三件事：发布任务、看新需求、接派单。',
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
    switch (activeRole) {
      case 'client':
        return [
          {
            key: 'client-publish',
            title: '发布任务',
            desc: '发起重载末端吊运任务',
            icon: '📝',
            tone: 'green',
            onPress: () => navigation.navigate('PublishCargo'),
          },
          {
            key: 'client-supply',
            title: '浏览服务',
            desc: '查看可直达下单的合规服务',
            icon: '📦',
            tone: 'blue',
            onPress: () => navigation.navigate('OfferList'),
            badge: currentDashboard.market_totals.supply_count,
          },
          {
            key: 'client-demands',
            title: '我的任务',
            desc: '跟进报价与项目进度',
            icon: '🗂️',
            tone: 'teal',
            onPress: () => navigation.navigate('MyDemands'),
            badge: currentDashboard.role_views.client.open_demand_count,
          },
          {
            key: 'client-orders',
            title: '我的订单',
            desc: '查看付款、执行与完成状态',
            icon: '📋',
            tone: 'green',
            onPress: () => navigation.navigate('MyOrders'),
          },
        ];
      case 'owner':
        return [
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
          {
            key: 'pilot-assigned',
            title: '待接派单',
            desc: '优先处理系统正式派单',
            icon: '🎯',
            tone: 'orange',
            onPress: () =>
              navigation.navigate('PilotTaskList', { entry: 'assigned' }),
            badge:
              currentDashboard.role_views.pilot.pending_response_dispatch_count,
          },
          {
            key: 'pilot-nearby',
            title: '可报名任务',
            desc: '查看系统筛选后的公开任务',
            icon: '🛰️',
            tone: 'blue',
            onPress: () => navigation.navigate('DemandList'),
            badge: currentDashboard.role_views.pilot.candidate_demand_count,
          },
          {
            key: 'pilot-records',
            title: '飞行记录',
            desc: '查看真实执行飞行数据',
            icon: '🛫',
            tone: 'purple',
            onPress: () => navigation.navigate('FlightLog'),
            badge: currentDashboard.role_views.pilot.recent_flight_count,
          },
        ];
      default:
        const actions: DashboardAction[] = [];
        if (hasClient) {
          actions.push({
            key: 'all-publish',
            title: '发布任务',
            desc: '快速发起新的重载吊运任务',
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
        actions.push({
          key: 'all-orders',
          title: '我的订单',
          desc: '统一查看成交后的订单进度',
          icon: '📦',
          tone: 'teal',
          onPress: () => navigation.navigate('MyOrders'),
        });
        return actions.slice(0, 4);
    }
  }, [activeRole, currentDashboard, hasClient, hasOwner, hasPilot, navigation]);

  const todoItems = useMemo<TodoItem[]>(() => {
    switch (activeRole) {
      case 'client':
        return [
          {
            key: 'client-quote',
            title: '待确认报价与方案',
            desc: '先看哪些任务已经进入报价阶段，再决定是否继续推进。',
            badge: currentDashboard.role_views.client.quoted_demand_count,
            actionText: '查看任务',
            onPress: () => navigation.navigate('MyDemands', {statusFilter: 'quoting'}),
            tone: 'green',
          },
          {
            key: 'client-confirm',
            title: '待机主确认订单',
            desc: '直达下单后，先由机主确认，再进入支付阶段。',
            badge:
              currentDashboard.role_views.client
                .pending_provider_confirmation_order_count,
            actionText: '查看订单',
            onPress: () =>
              navigation.navigate('MyOrders', {
                roleFilter: 'client',
                statusFilter: 'pending',
                serverStatus: 'pending_provider_confirmation',
              }),
            tone: 'orange',
          },
          {
            key: 'client-payment',
            title: '待付款订单',
            desc: '已选定方案但尚未付款的订单会在这里汇总。',
            badge:
              currentDashboard.role_views.client.pending_payment_order_count,
            actionText: '去付款',
            onPress: () =>
              navigation.navigate('MyOrders', {
                roleFilter: 'client',
                statusFilter: 'pending',
                serverStatus: 'pending_payment',
              }),
            tone: 'blue',
          },
          {
            key: 'client-progress',
            title: '进行中任务',
            desc: '执行中的订单会持续出现在首页，避免你再去翻列表。',
            badge: currentDashboard.role_views.client.in_progress_order_count,
            actionText: '查看订单',
            onPress: () => navigation.navigate('MyOrders', {roleFilter: 'client', statusFilter: 'in_progress'}),
            tone: 'teal',
          },
        ];
      case 'owner':
        return [
          {
            key: 'owner-recommend',
            title: '待报价新需求',
            desc: '优先处理当前机队可承接的新需求，缩短获客反应时间。',
            badge: currentDashboard.role_views.owner.recommended_demand_count,
            actionText: '去报价',
            onPress: () => navigation.navigate('DemandList', {mode: 'owner'}),
            tone: 'blue',
          },
          {
            key: 'owner-confirm',
            title: '待确认直达单',
            desc: '客户刚提交的直达订单会先停在这里，机主确认后才进入支付。',
            badge:
              currentDashboard.role_views.owner
                .pending_provider_confirmation_order_count,
            actionText: '去处理',
            onPress: () =>
              navigation.navigate('MyOrders', {
                roleFilter: 'owner',
                statusFilter: 'pending',
                serverStatus: 'pending_provider_confirmation',
              }),
            tone: 'red',
          },
          {
            key: 'owner-dispatch',
            title: '待发起派单',
            desc: '机主已经承接并完成支付的订单，会先停在待派阶段等待你安排执行。',
            badge:
              currentDashboard.role_views.owner.pending_dispatch_order_count,
            actionText: '查看订单',
            onPress: () =>
              navigation.navigate('MyOrders', {
                roleFilter: 'owner',
                statusFilter: 'pending',
                serverStatus: 'pending_dispatch',
              }),
            tone: 'orange',
          },
          {
            key: 'owner-asset',
            title: '服务与机队状态',
            desc: '如果服务不上架或设备不合规，会直接影响后续承接和派单。',
            badge: currentDashboard.role_views.owner.active_supply_count,
            actionText: '查看机队',
            onPress: () => navigation.navigate('MyDrones'),
            tone: 'teal',
          },
        ];
      case 'pilot':
        return [
          {
            key: 'pilot-pending',
            title: '待响应派单',
            desc: '系统正式派单优先于报名任务，超时会自动回退。',
            badge:
              currentDashboard.role_views.pilot.pending_response_dispatch_count,
            actionText: '去接单',
            onPress: () =>
              navigation.navigate('PilotTaskList', { entry: 'assigned' }),
            tone: 'orange',
          },
          {
            key: 'pilot-active',
            title: '今日执行任务',
            desc: '已接派单和执行中的任务保持在首页，减少来回切换。',
            badge: currentDashboard.role_views.pilot.active_dispatch_count,
            actionText: '查看任务',
            onPress: () => navigation.navigate('PilotTaskList', {entry: 'accepted'}),
            tone: 'blue',
          },
          {
            key: 'pilot-candidate',
            title: '可报名任务',
            desc: '公开任务报名不等于抢单成功，但能提前进入后续候选池。',
            badge: currentDashboard.role_views.pilot.candidate_demand_count,
            actionText: '去查看',
            onPress: () => navigation.navigate('DemandList', {mode: 'pilot'}),
            tone: 'purple',
          },
        ];
      default:
        const items: TodoItem[] = [];
        if (hasOwner) {
          items.push({
            key: 'all-capture',
            title: '获客优先',
            desc: '先看今天新需求和待报价机会，决定是否立刻承接。',
            badge: currentDashboard.role_views.owner.recommended_demand_count,
            actionText: '查看新需求',
            onPress: () => navigation.navigate('DemandList'),
            tone: 'blue',
          });
        }
        if (hasPilot || hasClient) {
          items.push({
            key: 'all-exec',
            title: '执行优先',
            desc: '待接派单和进行中任务是今天最应该先处理的执行项。',
            badge:
              (hasPilot
                ? currentDashboard.role_views.pilot
                    .pending_response_dispatch_count
                : 0) + currentDashboard.summary.in_progress_order_count,
            actionText: '查看进度',
            onPress: () => navigation.navigate('MyOrders', {statusFilter: 'in_progress'}),
            tone: 'orange',
          });
        }
        items.push({
          key: 'all-alert',
          title: '异常提醒',
          desc: '超时过久的订单会在这里提醒，避免阶段性积压。',
          badge: currentDashboard.summary.alert_count,
          actionText: '查看订单',
          onPress: () => navigation.navigate('MyOrders'),
          tone: 'red',
        });
        return items;
    }
  }, [activeRole, currentDashboard, hasClient, hasOwner, hasPilot, navigation]);

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
            <View style={styles.heroTopRow}>
              <View style={styles.heroCopyWrap}>
                <Text
                  style={[styles.heroEyebrow, { color: heroTheme.softText }]}
                >
                  {heroTheme.eyebrow}
                </Text>
                <Text style={styles.heroTitle}>{heroConfig.title}</Text>
              </View>

              {currentDashboard.summary.alert_count > 0 ? (
                <View style={styles.alertPill}>
                  <Text style={styles.alertPillValue}>
                    {currentDashboard.summary.alert_count}
                  </Text>
                  <Text style={styles.alertPillLabel}>异常提醒</Text>
                </View>
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
            {todoItems.map(item => {
              const palette = getTonePalette(item.tone || 'blue', theme.isDark);
              return (
                <ObjectCard
                  key={item.key}
                  style={styles.todoCard}
                  highlightColor={palette.border}
                >
                  <View style={styles.todoHeader}>
                    <Text style={[styles.todoTitle, {color: theme.text}]}>{item.title}</Text>
                    {typeof item.badge === 'number' && item.badge > 0 ? (
                      <View
                        style={[
                          styles.todoBadge,
                          {
                            backgroundColor: palette.bg,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.todoBadgeText,
                            { color: palette.text },
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.todoDesc, {color: theme.textSub}]}>{item.desc}</Text>
                  <TouchableOpacity
                    style={[
                      styles.todoActionBtn,
                      { backgroundColor: palette.text },
                    ]}
                    onPress={item.onPress}
                  >
                    <Text style={styles.todoActionText}>{item.actionText}</Text>
                  </TouchableOpacity>
                </ObjectCard>
              );
            })}
          </View>
        </View>

        <View style={styles.contentRail}>
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, {color: theme.text}]}>常用动作</Text>
              <Text style={[styles.sectionHint, {color: theme.textHint}]}>快速进入常用功能</Text>
            </View>
            <View style={styles.quickGrid}>
              {quickActions.map(action => (
                <QuickActionCard key={action.key} action={action} width={quickActionLayout.itemWidth} />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.contentRail}>
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, {color: theme.text}]}>
                {activeRole === 'pilot' ? '当前执行订单' : '进行中任务'}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyOrders')}>
                <Text style={[styles.linkText, {color: theme.primary}]}>查看全部</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator style={styles.loading} color={theme.refreshColor} />
            ) : currentDashboard.in_progress_orders.length > 0 ? (
              currentDashboard.in_progress_orders.map(order => (
                <ObjectCard
                  key={order.id}
                  onPress={() =>
                    navigation.navigate('OrderDetail', { id: order.id })
                  }
                >
                  <View style={styles.orderHeader}>
                    <Text style={[styles.orderNo, {color: theme.textHint}]}>{order.order_no}</Text>
                    <StatusBadge
                      label=""
                      meta={getObjectStatusMeta('order', order.status)}
                    />
                  </View>
                  <Text style={[styles.orderTitle, {color: theme.text}]} numberOfLines={2}>
                    {order.title}
                  </Text>
                  <View style={styles.orderFooter}>
                    <Text style={[styles.orderMeta, {color: theme.textSub}]}>
                      {order.created_at?.slice(0, 10)}
                    </Text>
                    <Text style={styles.orderAmount}>
                      ¥{(order.total_amount / 100).toFixed(2)}
                    </Text>
                  </View>
                </ObjectCard>
              ))
            ) : (
              <ObjectCard>
                <EmptyState
                  icon="📭"
                  title={
                    activeRole === 'pilot'
                      ? '当前没有执行中的订单'
                      : '当前没有进行中的任务'
                  }
                  description="这里会汇总正在执行中的订单，避免你在首页和列表页之间来回跳。"
                  actionText="查看订单"
                  onAction={() => navigation.navigate('MyOrders')}
                />
              </ObjectCard>
            )}
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
    marginTop: 10,
    borderRadius: 18,
    padding: 5,
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
    paddingVertical: 10,
    borderRadius: 14,
  },
  roleTabActive: {},
  roleTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  roleTabTextActive: {},
  hero: {
    marginTop: 12,
    borderRadius: 26,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 22,
    shadowColor: theme.isDark ? 'rgba(0,212,255,0.3)' : '#000',
    shadowOffset: {width: 0, height: theme.isDark ? 0 : 4},
    shadowOpacity: theme.isDark ? 0.5 : 0.08,
    shadowRadius: theme.isDark ? 20 : 12,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: HERO_SIDE_PADDING,
  },
  heroCopyWrap: {
    flex: 1,
    paddingRight: 14,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  alertPill: {
    minWidth: 74,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  alertPillValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  alertPillLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heroActionRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: HERO_SIDE_PADDING,
  },
  heroActionBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  heroActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  heroActionTextGhost: {
    color: '#FFFFFF',
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
  todoCard: {
    marginBottom: 10,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todoTitle: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
    paddingRight: 10,
  },
  todoBadge: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  todoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  todoDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  todoActionBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  todoActionText: {
    fontSize: 12,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionCard: {
    borderRadius: 20,
    padding: 14,
    shadowColor: theme.isDark ? 'rgba(0,212,255,0.15)' : '#000',
    shadowOffset: {width: 0, height: theme.isDark ? 0 : 3},
    shadowOpacity: theme.isDark ? 0.4 : 0.06,
    shadowRadius: theme.isDark ? 12 : 10,
    elevation: theme.isDark ? 0 : 3,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  quickActionIcon: {
    fontSize: 20,
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
    marginTop: 12,
    fontSize: 15,
    fontWeight: '800',
  },
  quickActionDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
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
