import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo, useRef } from 'react';
import { Image, View, Text, ScrollView } from '@tarojs/components';
import { messageService } from '../../services/message';
import { notificationV2Service } from '../../services/notificationV2';
import { ConversationSummary, V2NotificationSummary } from '../../types';
import { refreshCustomTabBarBadges, syncCustomTabBar } from '../../utils/tabBar';
import avatarUserIcon from '../../assets/message/icons/avatar_user.png';
import packageBoxIcon from '../../assets/message/icons/package_box.png';
import './index.scss';

const DELETE_WIDTH = 76;

const BUCKET_MAP: Record<string, { key: string; title: string; icon: string }> = {
  demand: { key: 'demand', title: '需求动态', icon: '🧾' },
  quote: { key: 'quote', title: '报价动态', icon: '💬' },
  order: { key: 'order', title: '订单动态', icon: '📦' },
  dispatch: { key: 'dispatch', title: '派单动态', icon: '🛫' },
  refund: { key: 'refund', title: '退款售后', icon: '💸' },
  qualification: { key: 'qualification', title: '资质审核', icon: '📋' },
  binding: { key: 'binding', title: '绑定协作', icon: '🤝' },
  system: { key: 'system', title: '系统消息', icon: '🔔' },
};

function getBucket(n: V2NotificationSummary) {
  const bt = String(n.extra_data?.business_type || '').trim();
  const et = String(n.extra_data?.event_type || '').trim();
  if (bt && BUCKET_MAP[bt]) return BUCKET_MAP[bt];
  if (et.includes('refund') || et.includes('dispute')) return BUCKET_MAP.refund;
  if (et.includes('qualification') || et.includes('verification')) return BUCKET_MAP.qualification;
  if (et.includes('binding')) return BUCKET_MAP.binding;
  if (et.includes('dispatch')) return BUCKET_MAP.dispatch;
  if (et.includes('order')) return BUCKET_MAP.order;
  if (et.includes('quote')) return BUCKET_MAP.quote;
  if (et.includes('demand')) return BUCKET_MAP.demand;
  return BUCKET_MAP.system;
}

function fmtTime(s?: string) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'conversations'>('notifications');
  const [notifications, setNotifications] = useState<V2NotificationSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [openConversationId, setOpenConversationId] = useState('');
  const [dragView, setDragView] = useState({ id: '', x: 0 });
  const dragRef = useRef({ id: '', startX: 0, baseX: 0 });
  const swipeMovedRef = useRef(false);

  useDidShow(() => {
    syncCustomTabBar(1);
    Promise.all([
      notificationV2Service.list({ page: 1, page_size: 50 }),
      messageService.getConversations()
    ]).then(([nr, cr]) => {
      const ns = (nr as any).items || [];
      setNotifications(ns);
      setNotifUnread((nr as any).meta?.unread_count || ns.filter((i: any) => !i.is_read).length);
      setConversations(((cr as any).items || []).filter((i: any) => i.peer_id > 0 && !String(i.conversation_id || '').startsWith('system-')));
      refreshCustomTabBarBadges();
    }).catch(() => {});
  });

  const sections = useMemo(() => {
    const grouped = new Map<string, { key: string; title: string; icon: string; data: V2NotificationSummary[] }>();
    notifications.forEach(n => {
      const b = getBucket(n);
      if (!grouped.has(b.key)) grouped.set(b.key, { ...b, data: [] });
      grouped.get(b.key)!.data.push(n);
    });
    return Array.from(grouped.values());
  }, [notifications]);

  const convUnread = useMemo(() => conversations.reduce((s, i) => s + Number(i.unread_count || 0), 0), [conversations]);

  const handleNotificationTap = async (n: V2NotificationSummary) => {
    if (!n.is_read) {
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
      setNotifUnread(prev => Math.max(prev - 1, 0));
      try { await notificationV2Service.markRead(n.id); } catch {}
      refreshCustomTabBarBadges();
    }
    const extra = n.extra_data || {};
    if (extra.order_id) Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${extra.order_id}` });
    else if (extra.dispatch_task_id) Taro.navigateTo({ url: `/pages/dispatch/detail/index?id=${extra.dispatch_task_id}` });
    else if (extra.demand_id) Taro.navigateTo({ url: `/pages/demand/detail/index?id=${extra.demand_id}` });
  };

  const openConversation = async (c: ConversationSummary) => {
    setOpenConversationId('');
    if (Number(c.unread_count || 0) > 0) {
      setConversations(prev => prev.map(item => item.conversation_id === c.conversation_id ? { ...item, unread_count: 0 } : item));
      try { await messageService.markRead(c.conversation_id); } catch {}
      refreshCustomTabBarBadges();
    }
    const peerName = (c.peer_name || `用户 ${c.peer_id}`).trim();
    Taro.navigateTo({
      url: `/pages/chat/index?convId=${encodeURIComponent(c.conversation_id)}&peerId=${c.peer_id}&peerName=${encodeURIComponent(peerName)}&peerAvatar=${encodeURIComponent(c.peer_avatar_url || '')}`,
    });
  };

  const getTouchX = (event: any) => Number(event?.touches?.[0]?.clientX ?? event?.changedTouches?.[0]?.clientX ?? 0);

  const handleSwipeStart = (c: ConversationSummary, event: any) => {
    const id = c.conversation_id;
    const baseX = openConversationId === id ? -DELETE_WIDTH : 0;
    dragRef.current = { id, startX: getTouchX(event), baseX };
    swipeMovedRef.current = false;
    setDragView({ id, x: baseX });
  };

  const handleSwipeMove = (c: ConversationSummary, event: any) => {
    const id = c.conversation_id;
    const drag = dragRef.current;
    if (drag.id !== id) return;

    const deltaX = getTouchX(event) - drag.startX;
    if (Math.abs(deltaX) > 6) swipeMovedRef.current = true;
    const nextX = Math.max(-DELETE_WIDTH, Math.min(0, drag.baseX + deltaX));
    setDragView({ id, x: nextX });
  };

  const handleSwipeEnd = (c: ConversationSummary) => {
    const id = c.conversation_id;
    const drag = dragRef.current;
    if (drag.id !== id) return;

    const currentX = dragView.id === id ? dragView.x : drag.baseX;
    setOpenConversationId(currentX < -DELETE_WIDTH / 2 ? id : '');
    setDragView({ id: '', x: 0 });
    dragRef.current = { id: '', startX: 0, baseX: 0 };
  };

  const getSwipeX = (id: string) => {
    if (dragView.id === id) return dragView.x;
    return openConversationId === id ? -DELETE_WIDTH : 0;
  };

  const handleConversationCardTap = (c: ConversationSummary) => {
    if (swipeMovedRef.current) {
      swipeMovedRef.current = false;
      return;
    }
    if (openConversationId) {
      setOpenConversationId('');
      return;
    }
    openConversation(c);
  };

  const deleteConversation = async (c: ConversationSummary) => {
    const previous = conversations;
    setOpenConversationId('');
    setConversations(prev => prev.filter(item => item.conversation_id !== c.conversation_id));
    try {
      await messageService.deleteConversation(c.conversation_id);
      refreshCustomTabBarBadges();
      Taro.showToast({ title: '已删除会话', icon: 'success' });
    } catch (error: any) {
      setConversations(previous);
      Taro.showToast({ title: error?.message || '删除失败', icon: 'none' });
    }
  };

  return (
    <View className="msg-page">
      <View className="msg-ornament" />
      <View className="msg-header">
        <Text className="msg-title">消息</Text>
        <Text className="msg-subtitle">系统通知承载业务事件，会话消息用于即时沟通</Text>
      </View>

      <View className="msg-tabs">
        <View className={`msg-tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
          <Text className={`msg-tab-text ${activeTab === 'notifications' ? 'active-text' : ''}`}>系统通知</Text>
          {notifUnread > 0 && <View className="msg-badge"><Text className="msg-badge-text">{notifUnread > 99 ? '99+' : notifUnread}</Text></View>}
        </View>
        <View className={`msg-tab ${activeTab === 'conversations' ? 'active' : ''}`} onClick={() => setActiveTab('conversations')}>
          <Text className={`msg-tab-text ${activeTab === 'conversations' ? 'active-text' : ''}`}>会话消息</Text>
          {convUnread > 0 && <View className="msg-badge"><Text className="msg-badge-text">{convUnread > 99 ? '99+' : convUnread}</Text></View>}
        </View>
      </View>

      <ScrollView scrollY className="msg-scroll">
        {activeTab === 'notifications' ? (
          sections.length === 0 ? <View className="empty-box"><Text className="empty-text">暂无系统通知</Text></View> :
            sections.map(sec => (
              <View key={sec.key} className="sec-wrap">
                <View className="sec-header">
                  <View className="sec-title-wrap">
                    <Image className="sec-icon-img" src={packageBoxIcon} mode="aspectFit" />
                    <Text className="sec-title">{sec.title}</Text>
                  </View>
                  <Text className="sec-meta">{sec.data.filter(i => !i.is_read).length} 未读</Text>
                </View>
                {sec.data.map(n => (
                  <View key={n.id} className="n-card" onClick={() => handleNotificationTap(n)}>
                    <View className="n-icon-wrap">
                      <Image className="n-icon-img" src={packageBoxIcon} mode="aspectFit" />
                    </View>
                    <View className="n-content">
                      <View className="n-row">
                        <Text className="n-title">{n.extra_data?.title || sec.title}</Text>
                        <Text className="n-time">{fmtTime(n.created_at)}</Text>
                      </View>
                      <Text className="n-desc" numberOfLines={2}>{n.content}</Text>
                    </View>
                    {!n.is_read && <View className="n-dot" />}
                  </View>
                ))}
              </View>
            ))
        ) : (
          conversations.length === 0 ? <View className="empty-box"><Text className="empty-text">暂无会话消息</Text></View> :
            conversations.map(c => {
              const swipeX = getSwipeX(c.conversation_id);
              return (
                <View key={c.conversation_id} className="c-swipe-area">
                  <View className="c-delete" onClick={() => deleteConversation(c)}>
                    <Text className="c-delete-text">删除</Text>
                  </View>
                  <View
                    className={`c-swipe-view ${dragView.id === c.conversation_id ? 'dragging' : ''}`}
                    style={{ transform: `translateX(${swipeX}px)` }}
                    onTouchStart={(event) => handleSwipeStart(c, event)}
                    onTouchMove={(event) => handleSwipeMove(c, event)}
                    onTouchEnd={() => handleSwipeEnd(c)}
                    onTouchCancel={() => handleSwipeEnd(c)}
                  >
                    <View className={`c-card ${swipeX < 0 ? 'c-card-open' : ''}`} onClick={() => handleConversationCardTap(c)}>
                      <View className="c-avatar">
                        <Image className="c-avatar-img" src={c.peer_avatar_url || avatarUserIcon} mode="aspectFill" />
                      </View>
                      <View className="c-content">
                        <View className="c-row">
                          <Text className="c-title">{c.peer_name || `用户 ${c.peer_id}`}</Text>
                          <Text className="c-time">{fmtTime(c.last_time)}</Text>
                        </View>
                        <View className="c-row-bottom">
                          <Text className="c-desc" numberOfLines={1}>{c.last_type === 'image' ? '[图片]' : c.last_message || '暂无消息'}</Text>
                          {c.unread_count > 0 && <View className="msg-badge"><Text className="msg-badge-text">{c.unread_count > 99 ? '99+' : c.unread_count}</Text></View>}
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
        )}
        <View className="msg-bottom-spacer" />
      </ScrollView>
    </View>
  );
}
