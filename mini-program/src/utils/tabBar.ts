import Taro from '@tarojs/taro';
import { messageService } from '../services/message';
import { notificationV2Service } from '../services/notificationV2';

const MESSAGE_TAB_INDEX = 1;

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
  const badge = formatBadge(unreadCount);

  if (!list.length) return;

  tabBar.setData({
    list: list.map((item: any, index: number) => (
      index === MESSAGE_TAB_INDEX ? { ...item, badge } : item
    )),
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

export function syncCustomTabBar(selected: number) {
  const tabBar = getCurrentTabBar();

  if (tabBar?.setData) {
    tabBar.setData({ selected });
    refreshCustomTabBarBadges();
  }
}
