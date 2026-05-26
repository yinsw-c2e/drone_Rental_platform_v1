import Taro from '@tarojs/taro';
import { messageService } from '../services/message';
import { notificationV2Service } from '../services/notificationV2';
import { store } from '../store/store';
import type { HaulRoleMode } from '../store/slices/roleSlice';

const MESSAGE_TAB_INDEX = 2;
const TAB_LABELS = {
  customer: ['首页', '订单', '消息', '我的'],
  provider: ['工作台', '接单', '消息', '我的'],
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
    iconPath: '/custom-tab-bar/assets/provider_tab_message_inactive.png',
    selectedIconPath: '/custom-tab-bar/assets/provider_tab_message_active.png',
    iconWidth: 58,
    iconHeight: 60,
    selectedIconWidth: 58,
    selectedIconHeight: 60,
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

function patchMessageBadge(tabBar: any, unreadCount: number) {
  const list = Array.isArray(tabBar?.data?.list) ? tabBar.data.list : [];
  const isProviderMode = store.getState().role.selectedMode === 'provider';
  const badge = isProviderMode ? '' : formatBadge(unreadCount);

  if (!list.length) return;

  tabBar.setData({
    list: list.map((item: any, index: number) => (
      index === MESSAGE_TAB_INDEX ? { ...item, badge, badgeDot: false } : item
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
      ...(selectedMode === 'provider' && index === MESSAGE_TAB_INDEX ? { badge: '' } : {}),
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

export async function refreshCustomTabBarBadges() {
  if (!store.getState().auth.isAuthenticated) {
    const tabBar = getCurrentTabBar();
    if (tabBar?.setData) {
      patchMessageBadge(tabBar, 0);
    }
    return;
  }

  try {
    const unreadCount = await fetchMessageTabUnread();
    const tabBar = getCurrentTabBar();
    if (tabBar?.setData) {
      patchMessageBadge(tabBar, unreadCount);
    }
  } catch {
    // 角标刷新失败不影响页面主流程。
  }
}

export function syncCustomTabBar(selected: number, modeOverride?: HaulRoleMode) {
  const tabBar = getCurrentTabBar();

  if (tabBar?.setData) {
    patchRoleTabLabels(tabBar, selected, modeOverride);
    refreshCustomTabBarBadges();
  }
}
