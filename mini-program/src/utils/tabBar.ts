import Taro from '@tarojs/taro';
import { demandV2Service } from '../services/demandV2';
import { messageService } from '../services/message';
import { notificationV2Service } from '../services/notificationV2';
import { orderV2Service } from '../services/orderV2';
import { store } from '../store/store';
import type { HaulRoleMode } from '../store/slices/roleSlice';

const ORDERS_TAB_INDEX = 1;
const MESSAGE_TAB_INDEX = 2;
const CLIENT_ACTIVE_DEMAND_STATUSES = new Set(['draft', 'open', 'published', 'quoting', 'selected']);
const CLIENT_ACTION_ORDER_STATUSES = new Set(['pending_payment', 'dispatch_failed', 'delivered']);
const TAB_LABELS = {
  customer: ['首页', '订单', '消息', '我的'],
  provider: ['工作台', '接单需求', '消息', '我的'],
};

const PROVIDER_TAB_ICONS = [
  {
    iconPath: '/custom-tab-bar/assets/provider_tab_workbench_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_workbench_active.png',
    iconWidth: 54,
    iconHeight: 59,
    selectedIconWidth: 57,
    selectedIconHeight: 53,
  },
  {
    iconPath: '/custom-tab-bar/assets/provider_tab_accept_order_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_accept_order_active.png',
    iconWidth: 56,
    iconHeight: 51,
    selectedIconWidth: 70,
    selectedIconHeight: 60,
  },
  {
    iconPath: '/custom-tab-bar/assets/icon_tab_message_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_message_active.png',
    iconWidth: 58,
    iconHeight: 56,
    selectedIconWidth: 58,
    selectedIconHeight: 56,
  },
  {
    iconPath: '/custom-tab-bar/assets/provider_tab_profile_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_profile_active.png',
    iconWidth: 54,
    iconHeight: 61,
    selectedIconWidth: 54,
    selectedIconHeight: 61,
  },
];

const CUSTOMER_TAB_ICONS = [
  {
    iconPath: '/custom-tab-bar/assets/icon_tab_home_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_home_active.png',
    iconWidth: 58,
    iconHeight: 60,
    selectedIconWidth: 58,
    selectedIconHeight: 60,
  },
  {
    iconPath: '/custom-tab-bar/assets/icon_tab_order_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_order_active.png',
    iconWidth: 56,
    iconHeight: 60,
    selectedIconWidth: 56,
    selectedIconHeight: 60,
  },
  {
    iconPath: '/custom-tab-bar/assets/icon_tab_message_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_message_active.png',
    iconWidth: 58,
    iconHeight: 56,
    selectedIconWidth: 58,
    selectedIconHeight: 56,
  },
  {
    iconPath: '/custom-tab-bar/assets/icon_tab_profile_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/icon_tab_profile_active.png',
    iconWidth: 58,
    iconHeight: 60,
    selectedIconWidth: 58,
    selectedIconHeight: 60,
  },
];

function getCurrentTabBar() {
  const pages = Taro.getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  return currentPage?.getTabBar?.();
}

function formatBadge(count: number) {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

function isRealConversation(item: any) {
  return Number(item?.peer_id || 0) > 0 && !String(item?.conversation_id || '').startsWith('system-');
}

function patchTabBadge(tabBar: any, index: number, count: number) {
  const list = Array.isArray(tabBar?.data?.list) ? tabBar.data.list : [];
  const badge = formatBadge(count);
  const targetIndex = index;

  if (!list.length) return;

  tabBar.setData({
    list: list.map((item: any, itemIndex: number) => (
      itemIndex === targetIndex ? { ...item, badge, badgeDot: false } : item
    )),
  });
}

function patchTabBadges(tabBar: any, badges: Record<number, number>) {
  const list = Array.isArray(tabBar?.data?.list) ? tabBar.data.list : [];
  if (!list.length) return;
  tabBar.setData({
    list: list.map((item: any, index: number) => (
      Object.prototype.hasOwnProperty.call(badges, index)
        ? { ...item, badge: formatBadge(badges[index]), badgeDot: false }
        : item
    )),
  });
}

function getRoleTabLabels(modeOverride?: HaulRoleMode) {
  const selectedMode = modeOverride || store.getState().role.selectedMode;
  return selectedMode === 'provider' ? TAB_LABELS.provider : TAB_LABELS.customer;
}

function patchRoleTabLabels(tabBar: any, selected?: number, modeOverride?: HaulRoleMode) {
  const list = Array.isArray(tabBar?.data?.list) ? tabBar.data.list : [];
  if (!list.length) return;

  const selectedMode = modeOverride || store.getState().role.selectedMode;
  const labels = getRoleTabLabels(selectedMode);
  const icons = selectedMode === 'provider' ? PROVIDER_TAB_ICONS : CUSTOMER_TAB_ICONS;
  tabBar.setData({
    ...(typeof selected === 'number' ? { selected } : {}),
    list: list.map((item: any, index: number) => ({
      ...item,
      text: labels[index] || item.text,
      ...(icons[index] || {}),
      badgeDot: false,
    })),
  });
}

async function fetchMessageTabUnread() {
  const [notificationResult, conversationResult] = await Promise.allSettled([
    notificationV2Service.list({ page: 1, page_size: 1 }),
    messageService.getConversations(),
  ]);

  let notificationUnread = 0;
  if (notificationResult.status === 'fulfilled') {
    const res = notificationResult.value as any;
    const items = res?.items || [];
    notificationUnread = Number(res?.meta?.unread_count ?? items.filter((item: any) => !item.is_read).length) || 0;
  }

  let conversationUnread = 0;
  if (conversationResult.status === 'fulfilled') {
    const conversations = ((conversationResult.value as any)?.items || []).filter(isRealConversation);
    conversationUnread = conversations.reduce((sum: number, item: any) => sum + Number(item.unread_count || 0), 0);
  }

  return notificationUnread + conversationUnread;
}

function countItems(response: any) {
  const items = response?.items || response?.data?.items || [];
  const metaTotal = response?.meta?.total ?? response?.data?.meta?.total;
  return Number(metaTotal ?? items.length) || 0;
}

async function fetchCustomerOrderTabBadge() {
  const [demandResult, orderResult] = await Promise.allSettled([
    demandV2Service.listMyDemands({ page: 1, page_size: 50 }),
    orderV2Service.list({ role: 'client', page: 1, page_size: 50 }),
  ]);

  let activeDemandCount = 0;
  if (demandResult.status === 'fulfilled') {
    const items = (demandResult.value as any)?.items || [];
    activeDemandCount = items.filter((item: any) => CLIENT_ACTIVE_DEMAND_STATUSES.has(String(item?.status || '').toLowerCase())).length;
  }

  let actionOrderCount = 0;
  if (orderResult.status === 'fulfilled') {
    const items = (orderResult.value as any)?.items || [];
    actionOrderCount = items.filter((item: any) => CLIENT_ACTION_ORDER_STATUSES.has(String(item?.status || '').toLowerCase())).length;
  }

  return activeDemandCount + actionOrderCount;
}

async function fetchProviderDemandTabBadge() {
  const result = await demandV2Service.listMarketplaceDemands({ page: 1, page_size: 1 });
  return countItems(result);
}

export async function refreshCustomTabBarBadges() {
  const tabBar = getCurrentTabBar();
  if (!store.getState().auth.isAuthenticated) {
    if (tabBar?.setData) {
      patchTabBadges(tabBar, {
        [ORDERS_TAB_INDEX]: 0,
        [MESSAGE_TAB_INDEX]: 0,
      });
    }
    return;
  }

  try {
    const mode = store.getState().role.selectedMode;
    const [messageResult, workResult] = await Promise.allSettled([
      fetchMessageTabUnread(),
      mode === 'provider' ? fetchProviderDemandTabBadge() : fetchCustomerOrderTabBadge(),
    ]);
    const unreadCount = messageResult.status === 'fulfilled' ? messageResult.value : 0;
    const workCount = workResult.status === 'fulfilled' ? workResult.value : 0;
    if (tabBar?.setData) {
      patchTabBadges(tabBar, {
        [ORDERS_TAB_INDEX]: workCount,
        [MESSAGE_TAB_INDEX]: unreadCount,
      });
    }
  } catch {
    // 角标刷新失败不影响页面主流程。
  }
}

export function setTabBadge(index: number, count: number) {
  const tabBar = getCurrentTabBar();
  if (tabBar?.setData) {
    patchTabBadge(tabBar, index, count);
  }
}

export function syncCustomTabBar(selected: number, modeOverride?: HaulRoleMode) {
  const tabBar = getCurrentTabBar();

  if (tabBar?.setData) {
    patchRoleTabLabels(tabBar, selected, modeOverride);
    refreshCustomTabBarBadges();
  }
}
