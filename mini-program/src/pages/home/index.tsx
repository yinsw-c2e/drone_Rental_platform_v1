import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { homeService } from '../../services/home';
import { demandV2Service } from '../../services/demandV2';
import { dispatchV2Service } from '../../services/dispatchV2';
import { orderAnomalyV2Service } from '../../services/orderAnomalyV2';
import { orderV2Service } from '../../services/orderV2';
import { sessionService } from '../../services/session';
import { setMeSummary } from '../../store/slices/authSlice';
import { useAppDispatch } from '../../store/store';
import { HomeDashboard, DemandSummary, V2DispatchTaskSummary, V2OrderAnomaly, V2OrderAnomalySummary, V2OrderSummary } from '../../types';
import { formatDemandBudget, resolveDemandPrimaryAddress, formatAmountYuan, getObjectStatusMeta } from '../../utils';
import { syncCustomTabBar } from '../../utils/tabBar';
import { getTonePalette, VisualTone } from '../../components/business/visuals';
import heroBgImage from '../../assets/workbench/images/workbench_hero_drone_bg_750x310.jpg';
import quickOrderIcon from '../../assets/workbench/icons/paper_plane_blue.png';
import plusCircleIcon from '../../assets/workbench/icons/plus_circle_white.png';
import warningIcon from '../../assets/workbench/icons/warning_shield.png';
import chevronRightIcon from '../../assets/workbench/icons/chevron_right.png';
import dropdownDownIcon from '../../assets/workbench/icons/dropdown_down.png';
import entryBrowseService from '../../assets/workbench/icons/entrance_browse_service.png';
import entryMyDemand from '../../assets/workbench/icons/entrance_my_demand.png';
import entryQuickOrder from '../../assets/workbench/icons/entrance_quick_order.png';
import entryPublishTask from '../../assets/workbench/icons/entrance_publish_task.png';
import entryInquiryTask from '../../assets/workbench/icons/entrance_inquiry_task.png';
import './index.scss';

// ── Types ──
type RoleView = 'all' | 'client' | 'owner' | 'pilot';
type PriorityQueueFilter = 'all' | 'quote' | 'confirm' | 'payment' | 'dispatch' | 'progress' | 'anomaly';
type PriorityQueueCategory = Exclude<PriorityQueueFilter, 'all'>;

interface HeroTheme { gradient: string; accent: string; softText: string; eyebrow: string; }
interface MetricCard { key: string; label: string; value: number; hint: string; }
interface DashboardAction { key: string; title: string; desc: string; icon: string; tone: VisualTone; onPress: () => void; badge?: number | string | null; }
interface PriorityQueueItem {
  key: string; role: RoleView | 'all'; category: PriorityQueueCategory;
  title: string; subtitle: string; meta: string; tagLabel: string; tagTone: VisualTone;
  urgency: number; sortAt: number; referenceNo?: string;
  target: { screen: string; params: Record<string, any> };
}

const PRIORITY_PAGE_SIZE = 4;
const ORDER_ANOMALY_LIST_PATH = '/pages/orders/anomaly-list/index';

const buildOrderAnomalyListUrl = (role: RoleView) =>
  role === 'all' ? ORDER_ANOMALY_LIST_PATH : `${ORDER_ANOMALY_LIST_PATH}?role=${role}`;

const emptyDashboard: HomeDashboard = {
  role_summary: { has_client_role: false, has_owner_role: false, has_pilot_role: false, can_publish_supply: false, can_accept_dispatch: false, can_self_execute: false },
  summary: { in_progress_order_count: 0, today_order_count: 0, today_income_amount: 0, alert_count: 0 },
  market_totals: { supply_count: 0, demand_count: 0 },
  role_views: {
    client: { open_demand_count: 0, quoted_demand_count: 0, pending_provider_confirmation_order_count: 0, pending_payment_order_count: 0, in_progress_order_count: 0 },
    owner: { recommended_demand_count: 0, active_supply_count: 0, pending_quote_count: 0, pending_provider_confirmation_order_count: 0, pending_dispatch_order_count: 0 },
    pilot: { pending_response_dispatch_count: 0, candidate_demand_count: 0, active_dispatch_count: 0, recent_flight_count: 0 },
  },
  in_progress_orders: [],
  market_feed: [],
};

// ── Helper Functions ──
const getOrderStatusBucket = (status?: string): PriorityQueueCategory | null => {
  const s = String(status || '').toLowerCase();
  if (s === 'pending_provider_confirmation') return 'confirm';
  if (s === 'pending_payment') return 'payment';
  if (s === 'pending_dispatch') return 'dispatch';
  if (['assigned', 'confirmed', 'preparing', 'airspace_applying', 'airspace_approved', 'loading', 'in_transit', 'delivered'].includes(s)) return 'progress';
  return null;
};

const getPriorityItemTimestamp = (v?: string | null): number => { if (!v) return 0; const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime(); };
const getPriorityRoleLabel = (role: RoleView | 'all') =>
  ({ client: '客户', owner: '机主', pilot: '飞手', all: '综合' } as Record<RoleView | 'all', string>)[role];

const getPriorityFilterLabel = (role: RoleView, filter: PriorityQueueFilter) => {
  switch (filter) {
    case 'quote': return role === 'owner' ? '待报价' : role === 'client' ? '待确认方案' : '方案/报价';
    case 'confirm': return '待确认';
    case 'payment': return '待付款';
    case 'dispatch': return role === 'pilot' ? '待接单' : '待派单';
    case 'progress': return '进行中';
    case 'anomaly': return '异常';
    default: return '全部';
  }
};

const getPriorityUrgencyLabel = (urgency: number) => urgency >= 100 ? '需立即处理' : urgency >= 85 ? '建议优先' : '顺手处理';

const getVisibleBadgeValue = (badge?: number | string | null): number | null => {
  const value = Number(badge || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const getActionAsset = (action: DashboardAction): string => {
  switch (action.key) {
    case 'service-hub':
      return entryBrowseService;
    case 'progress':
      return entryMyDemand;
    case 'quick-order':
      return entryQuickOrder;
    case 'publish':
      return entryPublishTask;
    case 'my-demands':
      return entryInquiryTask;
    case 'profile':
    case 'drones':
      return entryMyDemand;
    case 'offer':
    case 'supplies':
    case 'fulfill':
      return entryQuickOrder;
    case 'assigned':
    case 'nearby':
      return entryQuickOrder;
    case 'demand':
    default:
      return entryBrowseService;
  }
};

const getHeroActionAsset = (title: string): string => {
  if (title.includes('发布') || title.includes('上架')) return plusCircleIcon;
  return quickOrderIcon;
};

const getPriorityTimeLabel = (item: PriorityQueueItem): string => {
  if (item.sortAt > 946684800000) {
    const minutes = Math.max(1, Math.floor((Date.now() - item.sortAt) / 60000));
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
  }
  return item.meta || '刚刚';
};

const getHeroTheme = (role: RoleView): HeroTheme => {
  switch (role) {
    case 'client': return { gradient: 'linear-gradient(135deg, #0756D8, #2F82FF)', accent: '#135ED9', softText: 'rgba(255,255,255,0.9)', eyebrow: '客户概览' };
    case 'owner': return { gradient: 'linear-gradient(135deg, #0756D8, #2F82FF)', accent: '#135ED9', softText: 'rgba(255,255,255,0.9)', eyebrow: '机主概览' };
    case 'pilot': return { gradient: 'linear-gradient(135deg, #0756D8, #2F82FF)', accent: '#135ED9', softText: 'rgba(255,255,255,0.9)', eyebrow: '飞手概览' };
    default: return { gradient: 'linear-gradient(135deg, #0756D8, #2F82FF)', accent: '#135ED9', softText: 'rgba(255,255,255,0.9)', eyebrow: '今日概览' };
  }
};

// ── Sub-components ──
function EmptyStateView({ icon, title, description, actionText, onAction }: { icon: string; title: string; description: string; actionText: string; onAction: () => void }) {
  return (
    <View className="empty-state-wrap">
      <Text className="empty-state-icon">{icon}</Text>
      <Text className="empty-state-title">{title}</Text>
      <Text className="empty-state-desc">{description}</Text>
      {actionText && <View className="empty-state-action" onClick={onAction}><Text style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>{actionText}</Text></View>}
    </View>
  );
}

// ── Main Component ──
export default function HomeScreen() {
  const dispatch = useAppDispatch();
  const authRoleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [anomalySummary, setAnomalySummary] = useState<V2OrderAnomalySummary>({ total: 0, critical_count: 0, warning_count: 0, by_anomaly_type: [], by_order_status: [] });
  const [priorityItems, setPriorityItems] = useState<PriorityQueueItem[]>([]);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityQueueFilter>('all');
  const [priorityFilterExpanded, setPriorityFilterExpanded] = useState(false);
  const [priorityPage, setPriorityPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const authStateRef = useRef(isAuthenticated);
  const dashboardRequestSeqRef = useRef(0);
  const priorityRequestSeqRef = useRef(0);

  const currentDashboard = dashboard || emptyDashboard;
  const effectiveRoleSummary = useMemo(() => dashboard?.role_summary || authRoleSummary || emptyDashboard.role_summary, [authRoleSummary, dashboard?.role_summary]);

  const hasClient = effectiveRoleSummary.has_client_role;
  const hasOwner = effectiveRoleSummary.has_owner_role;
  const hasPilot = effectiveRoleSummary.has_pilot_role;
  const roleCount = Number(hasClient) + Number(hasOwner) + Number(hasPilot);

  const defaultRole = useMemo<RoleView>(() => {
    if (roleCount > 1) return 'all';
    if (hasClient) return 'client';
    if (hasOwner) return 'owner';
    if (hasPilot) return 'pilot';
    return 'all';
  }, [hasClient, hasOwner, hasPilot, roleCount]);

  const [activeRole, setActiveRole] = useState<RoleView>(defaultRole);

  const roleTabs = useMemo(() => {
    const tabs: { key: RoleView; label: string }[] = [];
    if (roleCount > 1) tabs.push({ key: 'all', label: '综合' });
    if (hasClient) tabs.push({ key: 'client', label: '客户' });
    if (hasOwner) tabs.push({ key: 'owner', label: '机主' });
    if (hasPilot) tabs.push({ key: 'pilot', label: '飞手' });
    if (tabs.length === 0) tabs.push({ key: 'all', label: '综合' });
    return tabs;
  }, [hasClient, hasOwner, hasPilot, roleCount]);

  useEffect(() => {
    if (!roleTabs.find(t => t.key === activeRole)) setActiveRole(defaultRole);
  }, [activeRole, defaultRole, roleTabs]);

  useEffect(() => { authStateRef.current = isAuthenticated; }, [isAuthenticated]);

  const fetchDashboard = useCallback(async (roleOverride?: RoleView) => {
    if (!authStateRef.current) return;
    const requestSeq = ++dashboardRequestSeqRef.current;
    const role = roleOverride || activeRole;
    try {
      const [res, anomalyRes] = await Promise.all([
        homeService.getDashboard(),
        orderAnomalyV2Service.summary({ role: role === 'all' ? undefined : role } as any),
      ]);
      if (authStateRef.current && requestSeq === dashboardRequestSeqRef.current) {
        setDashboard((res as any) || emptyDashboard);
        setAnomalySummary((anomalyRes as any) || { total: 0, critical_count: 0, warning_count: 0, by_anomaly_type: [], by_order_status: [] });
      }
    } catch (e) { console.warn('加载首页数据失败:', e); }
    finally { if (authStateRef.current && requestSeq === dashboardRequestSeqRef.current) setRefreshing(false); }
  }, [activeRole]);

  const anomalyAlertCount = anomalySummary?.total ?? currentDashboard.summary.alert_count;

  const fetchPriorityQueue = useCallback(async (roleOverride?: RoleView) => {
    if (!authStateRef.current) return;
    const requestSeq = ++priorityRequestSeqRef.current;
    const role = roleOverride || activeRole;
    setPriorityLoading(true);
    try {
      const rolesToLoad: RoleView[] = role === 'all'
        ? [...(hasClient ? ['client' as RoleView] : []), ...(hasOwner ? ['owner' as RoleView] : []), ...(hasPilot ? ['pilot' as RoleView] : [])]
        : [role];
      const nextItems: PriorityQueueItem[] = [];

      await Promise.all(rolesToLoad.map(async (role) => {
        if (role === 'client') {
          const [demandRes, orderRes] = await Promise.all([demandV2Service.listMyDemands({ page: 1, page_size: 40 }), orderV2Service.list({ role: 'client', page: 1, page_size: 50 })]);
          ((demandRes as any).items || []).filter((item: DemandSummary) => ['published', 'quoting'].includes(item.status || '') && Number(item.quote_count || 0) > 0)
            .forEach((item: DemandSummary) => nextItems.push({
              key: `client-demand-${item.id}`, role: 'client', category: 'quote', title: item.title || '待确认方案',
              subtitle: `${resolveDemandPrimaryAddress(item)} · ${formatDemandBudget(item.budget_min, item.budget_max)}`,
              meta: `已收到 ${item.quote_count || 0} 份报价`, tagLabel: '待确认方案', tagTone: 'green',
              urgency: 82 + Math.min(Number(item.quote_count || 0), 9), sortAt: Number(item.id || 0),
              referenceNo: item.demand_no, target: { screen: 'DemandDetail', params: { id: item.id } },
            }));
          ((orderRes as any).items || []).forEach((order: V2OrderSummary) => {
            const bucket = getOrderStatusBucket(order.status);
            if (!bucket || !['confirm', 'payment', 'progress'].includes(bucket)) return;
            const urgency = bucket === 'confirm' ? 92 : bucket === 'payment' ? 88 : order.status === 'delivered' ? 86 : 70;
            nextItems.push({
              key: `client-order-${order.id}`, role: 'client', category: bucket, title: order.title || order.order_no,
              subtitle: `${order.service_address || '起点待确认'}${(order as any).dest_address ? ` → ${(order as any).dest_address}` : ''}`,
              meta: bucket === 'confirm' ? '等待机主确认' : bucket === 'payment' ? `待支付 ${formatAmountYuan(order.total_amount)}` : `当前状态：${getObjectStatusMeta('order', order.status).label}`,
              tagLabel: bucket === 'confirm' ? '待确认' : bucket === 'payment' ? '待付款' : '进行中',
              tagTone: bucket === 'confirm' ? 'orange' : bucket === 'payment' ? 'blue' : 'teal',
              urgency, sortAt: getPriorityItemTimestamp(order.updated_at || order.created_at),
              referenceNo: order.order_no, target: { screen: 'OrderDetail', params: { orderId: order.id, id: order.id } },
            });
          });
        }
        if (role === 'owner') {
          const [demandRes, orderRes] = await Promise.all([demandV2Service.listMarketplaceDemands({ page: 1, page_size: 40 }), orderV2Service.list({ role: 'owner', page: 1, page_size: 50 })]);
          ((demandRes as any).items || []).forEach((item: DemandSummary) => nextItems.push({
            key: `owner-demand-${item.id}`, role: 'owner', category: 'quote', title: item.title || '待报价任务',
            subtitle: `${resolveDemandPrimaryAddress(item)} · ${formatDemandBudget(item.budget_min, item.budget_max)}`,
            meta: '报价窗口已打开', tagLabel: '待报价', tagTone: 'blue',
            urgency: 78 + Math.min(Number(item.quote_count || 0), 5), sortAt: Number(item.id || 0),
            referenceNo: item.demand_no, target: { screen: 'DemandDetail', params: { id: item.id } },
          }));
          ((orderRes as any).items || []).forEach((order: V2OrderSummary) => {
            const bucket = getOrderStatusBucket(order.status);
            if (!bucket || !['confirm', 'dispatch', 'progress'].includes(bucket)) return;
            nextItems.push({
              key: `owner-order-${order.id}`, role: 'owner', category: bucket, title: order.title || order.order_no,
              subtitle: `${order.service_address || '起点待确认'}${(order as any).dest_address ? ` → ${(order as any).dest_address}` : ''}`,
              meta: bucket === 'confirm' ? '客户已下单' : bucket === 'dispatch' ? '已承接，待安排执行' : `当前状态：${getObjectStatusMeta('order', order.status).label}`,
              tagLabel: bucket === 'confirm' ? '待确认' : bucket === 'dispatch' ? '待派单' : '进行中',
              tagTone: bucket === 'confirm' ? 'red' : bucket === 'dispatch' ? 'orange' : 'teal',
              urgency: bucket === 'confirm' ? 95 : bucket === 'dispatch' ? 90 : 68,
              sortAt: getPriorityItemTimestamp(order.updated_at || order.created_at),
              referenceNo: order.order_no, target: { screen: 'OrderDetail', params: { orderId: order.id, id: order.id } },
            });
          });
        }
        if (role === 'pilot') {
          const dispatchRes = await dispatchV2Service.list({ role: 'pilot', page: 1, page_size: 50 });
          ((dispatchRes as any).items || []).forEach((task: V2DispatchTaskSummary) => {
            const ts = String(task.status || '').toLowerCase();
            const os = String(task.order?.status || '').toLowerCase();
            if (ts === 'pending_response') nextItems.push({
              key: `pilot-dispatch-${task.id}`, role: 'pilot', category: 'dispatch', title: task.order?.title || '待响应派单',
              subtitle: `${task.order?.service_address || ''}${task.order?.dest_address ? ` → ${task.order.dest_address}` : ''}`,
              meta: '正式派单已发', tagLabel: '待接单', tagTone: 'orange', urgency: 98,
              sortAt: getPriorityItemTimestamp(task.sent_at || task.updated_at || task.created_at),
              referenceNo: task.dispatch_no, target: { screen: 'DispatchTaskDetail', params: { id: task.id, dispatchId: task.id } },
            });
            else if (ts === 'accepted' && !['completed', 'cancelled'].includes(os)) nextItems.push({
              key: `pilot-active-${task.id}`, role: 'pilot', category: 'progress', title: task.order?.title || '执行中',
              subtitle: `${task.order?.service_address || ''}${task.order?.dest_address ? ` → ${task.order.dest_address}` : ''}`,
              meta: `当前状态：${getObjectStatusMeta('order', task.order?.status).label}`, tagLabel: '进行中', tagTone: 'teal',
              urgency: os === 'delivered' ? 84 : 72,
              sortAt: getPriorityItemTimestamp(task.updated_at || task.sent_at || task.created_at),
              referenceNo: task.dispatch_no, target: { screen: 'PilotOrderExecution', params: { taskId: task.id } },
            });
          });
        }
      }));

      // Anomalies
      try {
        const anomalyRes = await orderAnomalyV2Service.list({ role: role === 'all' ? undefined : role, page: 1, page_size: 40 } as any);
        ((anomalyRes as any).items || []).forEach((item: V2OrderAnomaly) => {
          const isCritical = String(item.severity || '').toLowerCase() === 'critical';
          nextItems.push({
            key: `anomaly-${item.order_id}-${item.anomaly_type}`, role: role === 'all' ? 'all' : role,
            category: 'anomaly', title: item.title || item.order_no, subtitle: item.message,
            meta: item.recommended_action || '点击查看异常', tagLabel: isCritical ? '严重异常' : '异常提醒',
            tagTone: isCritical ? 'red' : 'orange', urgency: isCritical ? 110 : 96,
            sortAt: getPriorityItemTimestamp(item.updated_at), referenceNo: item.order_no,
            target: { screen: 'OrderDetail', params: { orderId: item.order_id, id: item.order_id } },
          });
        });
      } catch {}

      nextItems.sort((a, b) => b.urgency !== a.urgency ? b.urgency - a.urgency : b.sortAt !== a.sortAt ? b.sortAt - a.sortAt : a.key.localeCompare(b.key));
      if (authStateRef.current && requestSeq === priorityRequestSeqRef.current) setPriorityItems(nextItems);
    } catch (e) { console.warn('加载待处理列表失败:', e); }
    finally { if (authStateRef.current && requestSeq === priorityRequestSeqRef.current) setPriorityLoading(false); }
  }, [activeRole, hasClient, hasOwner, hasPilot]);

  const switchRole = useCallback((nextRole: RoleView) => {
    if (nextRole === activeRole) return;
    setActiveRole(nextRole);
    setPriorityFilter('all');
    setPriorityPage(0);
    setPriorityFilterExpanded(false);
    setPriorityItems([]);
    setAnomalySummary({ total: 0, critical_count: 0, warning_count: 0, by_anomaly_type: [], by_order_status: [] });
    if (authStateRef.current) {
      fetchDashboard(nextRole);
      fetchPriorityQueue(nextRole);
    }
  }, [activeRole, fetchDashboard, fetchPriorityQueue]);

  useEffect(() => { setPriorityFilter('all'); setPriorityPage(0); setPriorityFilterExpanded(false); }, [activeRole]);
  useEffect(() => { setPriorityPage(0); setPriorityFilterExpanded(false); }, [priorityFilter]);

  useDidShow(() => {
    syncCustomTabBar(0);
    if (!isAuthenticated) return;
    fetchDashboard();
    fetchPriorityQueue();
  });

  usePullDownRefresh(() => {
    setRefreshing(true);
    fetchDashboard().then(() => fetchPriorityQueue()).finally(() => Taro.stopPullDownRefresh());
  });

  // ── Hero config ──
  const heroTheme = useMemo(() => getHeroTheme(activeRole), [activeRole]);
  const heroConfig = useMemo(() => {
    switch (activeRole) {
      case 'client': return { title: '今天先处理这些订单', subtitle: '要下单就走快速下单；需要比价或说明更多细节，就发布任务。', primaryAction: { title: '快速下单', onPress: () => Taro.navigateTo({ url: '/pages/publish/quick-order/index' }) }, secondaryActions: [{ title: '发布任务', onPress: () => Taro.navigateTo({ url: '/pages/publish/demand/index' }) }] };
      case 'owner': return { title: '今天先看这些机会', subtitle: '新任务、待确认订单和待安排执行都放在这里。', primaryAction: { title: '查看新需求', onPress: () => Taro.navigateTo({ url: '/pages/profile/my-demands/index' }) }, secondaryActions: [{ title: '上架服务', onPress: () => Taro.navigateTo({ url: '/pages/publish/supply/index' }) }, { title: '机队资质', onPress: () => Taro.navigateTo({ url: '/pages/profile/drones/index' }) }] };
      case 'pilot': return { title: '今天有哪些任务要处理', subtitle: '待接单、执行中和飞行记录都在这里。', primaryAction: { title: '查看待接派单', onPress: () => Taro.navigateTo({ url: '/pages/dispatch/list/index' }) }, secondaryActions: [{ title: '飞行执行', onPress: () => Taro.navigateTo({ url: '/pages/pilot/workbench/index' }) }, { title: '资质管理', onPress: () => Taro.navigateTo({ url: '/pages/profile/pilot/index' }) }] };
      default: return {
        title: '今天先处理这些事',
        subtitle: '下单、报价、接单和异常提醒都集中在工作台。',
        primaryAction: {
          title: hasClient ? '快速下单' : hasOwner ? '查看新需求' : '待接派单',
          onPress: () => Taro.navigateTo({ url: hasClient ? '/pages/publish/quick-order/index' : hasOwner ? '/pages/market/index' : '/pages/dispatch/list/index' }),
        },
        secondaryActions: hasClient ? [{ title: '发布任务', onPress: () => Taro.navigateTo({ url: '/pages/publish/demand/index' }) }] : [],
      };
    }
  }, [activeRole, hasClient, hasOwner, hasPilot]);

  // ── Quick actions ──
  const quickActions = useMemo<DashboardAction[]>(() => {
    const base: DashboardAction[] = [
      { key: 'service-hub', title: '浏览服务', desc: '查看供给与需求', icon: '🧭', tone: 'blue', onPress: () => Taro.navigateTo({ url: '/pages/market/index' }) },
      { key: 'progress', title: '我的需求', desc: '查看我的需求', icon: '📋', tone: 'teal', onPress: () => Taro.navigateTo({ url: '/pages/profile/my-demands/index' }) },
    ];
    switch (activeRole) {
      case 'client': return [...base,
        { key: 'quick-order', title: '快速下单', desc: '直达下单', icon: '📦', tone: 'blue', onPress: () => Taro.navigateTo({ url: '/pages/publish/quick-order/index' }) },
        { key: 'publish', title: '发布任务', desc: '发起需求', icon: '📝', tone: 'orange', onPress: () => Taro.navigateTo({ url: '/pages/publish/demand/index' }) },
        { key: 'my-demands', title: '询价中的任务', desc: '开放报价中的需求', icon: '📁', tone: 'purple', onPress: () => Taro.navigateTo({ url: '/pages/profile/my-demands/index' }), badge: currentDashboard.role_views.client.open_demand_count },
      ];
      case 'owner': return [...base,
        { key: 'demand', title: '查看新需求', desc: '可承接任务', icon: '📈', tone: 'blue', onPress: () => Taro.navigateTo({ url: '/pages/profile/my-demands/index' }), badge: currentDashboard.role_views.owner.recommended_demand_count },
        { key: 'offer', title: '上架服务', desc: '上架机型', icon: '🚁', tone: 'teal', onPress: () => Taro.navigateTo({ url: '/pages/publish/supply/index' }) },
        { key: 'supplies', title: '我的服务', desc: '服务状态', icon: '📦', tone: 'green', onPress: () => Taro.navigateTo({ url: '/pages/profile/my-offers/index' }), badge: currentDashboard.role_views.owner.active_supply_count },
        { key: 'drones', title: '机队资质', desc: '设备认证', icon: '📄', tone: 'purple', onPress: () => Taro.navigateTo({ url: '/pages/profile/drones/index' }) },
      ];
      case 'pilot': return [...base,
        { key: 'assigned', title: '待接派单', desc: '正式指派任务', icon: '🎯', tone: 'orange', onPress: () => Taro.navigateTo({ url: '/pages/dispatch/list/index' }), badge: currentDashboard.role_views.pilot.pending_response_dispatch_count },
        { key: 'fulfill', title: '飞行执行', desc: '监控看板', icon: '🚁', tone: 'teal', onPress: () => Taro.navigateTo({ url: '/pages/pilot/workbench/index' }) },
        { key: 'nearby', title: '报名需求', desc: '候选池', icon: '📡', tone: 'blue', onPress: () => Taro.navigateTo({ url: '/pages/profile/my-demands/index' }), badge: currentDashboard.role_views.pilot.candidate_demand_count },
        { key: 'profile', title: '资质设置', desc: '执照技能', icon: '📑', tone: 'purple', onPress: () => Taro.navigateTo({ url: '/pages/profile/pilot/index' }) },
      ];
      default: {
        const a: DashboardAction[] = [...base];
        if (hasClient) { a.push({ key: 'quick-order', title: '快速下单', desc: '直达下单', icon: '📦', tone: 'blue', onPress: () => Taro.navigateTo({ url: '/pages/publish/quick-order/index' }) }); }
        if (hasOwner) { a.push({ key: 'demand', title: '查看新需求', desc: '可承接', icon: '📈', tone: 'blue', onPress: () => Taro.navigateTo({ url: '/pages/profile/my-demands/index' }), badge: currentDashboard.role_views.owner.recommended_demand_count }); }
        if (hasPilot) { a.push({ key: 'assigned', title: '待接派单', desc: '正式指派', icon: '🎯', tone: 'orange', onPress: () => Taro.navigateTo({ url: '/pages/dispatch/list/index' }), badge: currentDashboard.role_views.pilot.pending_response_dispatch_count }); }
        return a.slice(0, 6);
      }
    }
  }, [activeRole, currentDashboard, hasClient, hasOwner, hasPilot]);

  // ── Priority filter options ──
  const priorityFilterOptions = useMemo(() => {
    const counts = priorityItems.reduce<Record<string, number>>((acc, item) => { acc[item.category] = (acc[item.category] || 0) + 1; return acc; }, {});
    const filters: Array<{ key: PriorityQueueFilter; label: string; count: number }> = [{ key: 'all', label: '全部', count: priorityItems.length }];
    (['anomaly', 'confirm', 'quote', 'payment', 'dispatch', 'progress'] as PriorityQueueCategory[]).forEach(key => {
      const count = counts[key] || 0;
      if (count > 0) filters.push({ key, label: getPriorityFilterLabel(activeRole, key), count });
    });
    return filters;
  }, [activeRole, priorityItems]);

  const currentFilterOption = priorityFilterOptions.find(i => i.key === priorityFilter) || priorityFilterOptions[0];
  const filteredPriorityItems = useMemo(() => priorityItems.filter(i => priorityFilter === 'all' || i.category === priorityFilter), [priorityFilter, priorityItems]);
  const priorityPageCount = Math.max(1, Math.ceil(filteredPriorityItems.length / PRIORITY_PAGE_SIZE));
  const priorityPageItems = useMemo(() => filteredPriorityItems.slice(priorityPage * PRIORITY_PAGE_SIZE, (priorityPage + 1) * PRIORITY_PAGE_SIZE), [filteredPriorityItems, priorityPage]);
  const pendingOrderCount = Math.max(
    priorityItems.length,
    Number(currentDashboard.role_views.client.pending_provider_confirmation_order_count || 0)
      + Number(currentDashboard.role_views.client.pending_payment_order_count || 0)
      + Number(currentDashboard.role_views.owner.pending_provider_confirmation_order_count || 0)
      + Number(currentDashboard.role_views.owner.pending_dispatch_order_count || 0)
      + Number(currentDashboard.role_views.pilot.pending_response_dispatch_count || 0),
  );
  const inProgressTaskCount = Number(currentDashboard.summary.in_progress_order_count || 0)
    || Number(currentDashboard.role_views.client.in_progress_order_count || 0)
    || Number(currentDashboard.role_views.pilot.active_dispatch_count || 0);

  return (
    <View className="root-wrap">
      <ScrollView scrollY className="container" refresherEnabled refresherTriggered={refreshing} onRefresherRefresh={() => { setRefreshing(true); fetchDashboard().then(() => fetchPriorityQueue()).finally(() => setRefreshing(false)); }}
        >

        {/* ── Role Tabs ── */}
        <View className="content-rail role-tabs-rail">
          <View className="tabs-wrap">
            {roleTabs.map(tab => (
              <View key={tab.key} className={`role-tab ${activeRole === tab.key ? 'role-tab-active' : ''}`} onClick={() => switchRole(tab.key)}>
                <Text className={`role-tab-text ${activeRole === tab.key ? 'role-tab-text-active' : ''}`}>{tab.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Hero Section ── */}
        <View className="content-rail">
          <View className="hero" style={{ background: heroTheme.gradient }}>
            <Image className="hero-bg-image" src={heroBgImage} mode="aspectFill" />
            {anomalyAlertCount > 0 && (
              <View className="alert-pill" onClick={() => Taro.navigateTo({ url: buildOrderAnomalyListUrl(activeRole) })}>
                <Text className="alert-pill-text">{anomalyAlertCount} 个异常提醒</Text>
              </View>
            )}
            <View className="hero-copy-wrap">
              <Text className="hero-eyebrow">{heroTheme.eyebrow}</Text>
              <Text className="hero-title">{heroConfig.title}</Text>
              <Text className="hero-subtitle">
                {activeRole === 'all' || activeRole === 'client'
                  ? `您有 ${pendingOrderCount} 个订单待处理，${inProgressTaskCount} 个任务进行中`
                  : heroConfig.subtitle}
              </Text>
              <View className="hero-alert-row" onClick={() => anomalyAlertCount > 0 && Taro.navigateTo({ url: buildOrderAnomalyListUrl(activeRole) })}>
                <Image className="hero-warning-icon" src={warningIcon} mode="aspectFit" />
                <Text className="hero-alert-text">
                  {anomalyAlertCount > 0 ? `${anomalyAlertCount} 个任务出现异常，请及时处理` : '暂无异常提醒，当前任务运行稳定'}
                </Text>
              </View>
            </View>
            <View className="hero-action-row">
              <View className="hero-action-btn hero-action-btn-primary" onClick={heroConfig.primaryAction.onPress}>
                <Image className="hero-action-icon" src={getHeroActionAsset(heroConfig.primaryAction.title)} mode="aspectFit" />
                <Text className="hero-action-text" style={{ color: heroTheme.accent }}>{heroConfig.primaryAction.title}</Text>
              </View>
              {heroConfig.secondaryActions.slice(0, 1).map(a => (
                <View key={a.title} className="hero-action-btn hero-action-btn-ghost" onClick={a.onPress}>
                  <Image className="hero-action-icon hero-action-icon-ghost" src={getHeroActionAsset(a.title)} mode="aspectFit" />
                  <Text className="hero-action-text hero-action-text-ghost">{a.title}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Priority Queue ── */}
        <View className="content-rail">
          <View className="section-wrap">
            <View className="priority-board">
              <View className="priority-header-row">
                <Text className="priority-title">待处理列表</Text>
                <Text className="priority-summary">{filteredPriorityItems.length} 条</Text>
              </View>

              <View className="priority-filter-row">
                <Text className="priority-filter-label">筛选范围</Text>
                <View className="priority-filter-trigger" onClick={() => setPriorityFilterExpanded(!priorityFilterExpanded)}>
                  <View className="priority-filter-trigger-main">
                    <Text className="priority-filter-trigger-text">{currentFilterOption?.label || '全部'}</Text>
                    <View className="priority-filter-count"><Text className="priority-filter-count-text">{currentFilterOption?.count || 0}</Text></View>
                  </View>
                  <Image className={`priority-filter-chevron-img ${priorityFilterExpanded ? 'priority-filter-chevron-img-open' : ''}`} src={dropdownDownIcon} mode="aspectFit" />
                </View>
              </View>

              {priorityFilterExpanded && (
                <View className="priority-dropdown">
                  {priorityFilterOptions.map(item => {
                    const isActive = priorityFilter === item.key;
                    return (
                      <View key={item.key} className={`priority-dropdown-item ${isActive ? 'priority-dropdown-item-active' : ''}`}
                        onClick={() => { setPriorityFilter(item.key); setPriorityFilterExpanded(false); }}>
                        <View className="priority-dropdown-copy">
                          <Text className="priority-dropdown-title" style={{ color: isActive ? '#1677FF' : '#1A1D26' }}>{item.label}</Text>
                          <Text className="priority-dropdown-hint" style={{ color: isActive ? '#1677FF' : '#9CA3AF' }}>{item.key === 'all' ? '查看全部待处理事项' : `仅看${item.label}`}</Text>
                        </View>
                        <View className="priority-filter-count" style={{ background: isActive ? 'rgba(22,119,255,0.12)' : '#F9FAFB' }}>
                          <Text className="priority-filter-count-text" style={{ color: isActive ? '#1677FF' : '#9CA3AF' }}>{item.count}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {priorityLoading ? (
                <View className="loading-wrap"><Text style={{ color: '#9CA3AF' }}>加载中...</Text></View>
              ) : priorityPageItems.length > 0 ? (
                <View className="priority-list">
                  {priorityPageItems.map(item => {
                    const palette = getTonePalette(item.tagTone, false);
                    return (
                      <View key={item.key} className="priority-item" style={{ borderLeftColor: palette.text }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const s = item.target.screen;
                          const p = item.target.params || {};
                          console.warn('[Priority] Clicked:', s, p);
                          try {
                            if (s === 'DemandDetail') Taro.navigateTo({ url: `/pages/demand/detail/index?id=${p.id || p.demandId}` });
                            else if (s === 'OrderDetail') Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${p.orderId || p.id}` });
                            else if (s === 'DispatchTaskDetail') Taro.navigateTo({ url: `/pages/dispatch/detail/index?id=${p.id || p.dispatchId}` });
                            else if (s === 'PilotOrderExecution') Taro.navigateTo({ url: `/pages/pilot/workbench/index?taskId=${p.taskId || p.id}` });
                          } catch (err) {
                            console.error('[Priority] Nav failed:', err);
                          }
                        }}>
                        <View className="priority-item-top">
                          <View className="priority-identity-row">
                            {activeRole === 'all' && item.role !== 'all' && (
                              <View className="priority-role-pill"><Text className="priority-role-pill-text">{getPriorityRoleLabel(item.role)}</Text></View>
                            )}
                            {item.referenceNo && <Text className="priority-ref-no">{item.referenceNo}</Text>}
                          </View>
                          <View className="priority-top-tags">
                            <View className="priority-tag" style={{ background: palette.bg, borderColor: palette.border }}>
                              <Text className="priority-tag-text" style={{ color: palette.text }}>{item.tagLabel}</Text>
                            </View>
                            <View className="priority-urgency-chip" style={{ background: palette.bg, borderColor: palette.border }}>
                              <Text className="priority-urgency-text" style={{ color: palette.text }}>{getPriorityUrgencyLabel(item.urgency)}</Text>
                            </View>
                          </View>
                        </View>
                        <Text className="priority-item-title">{item.title}</Text>
                        <View className="priority-item-bottom">
                          <Text className="priority-item-subtitle">{item.subtitle}</Text>
                          <View className="priority-item-meta-wrap">
                            <Text className="priority-item-meta">{getPriorityTimeLabel(item)}</Text>
                            <Image className="priority-item-chevron-img" src={chevronRightIcon} mode="aspectFit" />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <EmptyStateView icon="📋" title="当前没有待处理事项" description="筛选后没有命中的结果" actionText={activeRole === 'client' ? '快速下单' : '查看订单'} onAction={() => Taro.navigateTo({ url: activeRole === 'client' ? '/pages/publish/quick-order/index' : '/pages/orders/index' })} />
              )}

              {priorityPageCount > 1 && (
                <View className="priority-pager-row">
                  <View className={`priority-pager-btn ${priorityPage === 0 ? 'priority-pager-btn-disabled' : ''}`} onClick={() => priorityPage > 0 && setPriorityPage(priorityPage - 1)}>
                    <Text className={`priority-pager-btn-text ${priorityPage === 0 ? 'priority-pager-btn-text-disabled' : ''}`}>上一页</Text>
                  </View>
                  <Text className="priority-pager-text">第 {priorityPage + 1} / {priorityPageCount} 页</Text>
                  <View className={`priority-pager-btn ${priorityPage >= priorityPageCount - 1 ? 'priority-pager-btn-disabled' : ''}`} onClick={() => priorityPage < priorityPageCount - 1 && setPriorityPage(priorityPage + 1)}>
                    <Text className={`priority-pager-btn-text ${priorityPage >= priorityPageCount - 1 ? 'priority-pager-btn-text-disabled' : ''}`}>下一页</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Quick Actions Grid ── */}
        <View className="content-rail">
          <View className="section-wrap">
            <View className="quick-grid-panel">
              <View className="quick-grid-title-row">
                <Text className="quick-grid-title">工作台入口</Text>
              </View>
            <View className="quick-grid">
              {quickActions.map(action => {
                const palette = getTonePalette(action.tone, false);
                const badgeValue = getVisibleBadgeValue(action.badge);
                return (
                  <View key={action.key} className="quick-action-card" onClick={action.onPress}>
                    <View className="quick-action-card-inner">
                      <View className="quick-action-icon-wrap">
                        <Image className="quick-action-icon-img" src={getActionAsset(action)} mode="aspectFit" />
                        {badgeValue !== null && (
                          <View className="quick-action-badge" style={{ background: palette.text }}>
                            <Text className="quick-action-badge-text">{badgeValue}</Text>
                          </View>
                        )}
                      </View>
                      <Text className="quick-action-title">{action.title}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            </View>
          </View>
        </View>

        <View className="tabbar-scroll-spacer" />
      </ScrollView>
    </View>
  );
}
