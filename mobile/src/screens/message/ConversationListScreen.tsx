import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';

import EmptyState from '../../components/business/EmptyState';
import {messageService} from '../../services/message';
import {notificationV2Service} from '../../services/notificationV2';
import {RootState} from '../../store/store';
import {ConversationSummary, V2NotificationSummary} from '../../types';

type MessageCenterTab = 'notifications' | 'conversations';

type NotificationSection = {
  key: string;
  title: string;
  icon: string;
  data: V2NotificationSummary[];
};

type NotificationBucket = {
  key: string;
  title: string;
  icon: string;
};

const notificationBucketMap: Record<string, NotificationBucket> = {
  demand: {key: 'demand', title: '需求动态', icon: '🧾'},
  demand_quote: {key: 'quote', title: '报价动态', icon: '💬'},
  quote: {key: 'quote', title: '报价动态', icon: '💬'},
  order: {key: 'order', title: '订单动态', icon: '📦'},
  dispatch: {key: 'dispatch', title: '派单动态', icon: '🛫'},
  refund: {key: 'refund', title: '退款售后', icon: '💸'},
  dispute: {key: 'refund', title: '退款售后', icon: '💸'},
  qualification: {key: 'qualification', title: '资质审核', icon: '📋'},
  pilot_binding: {key: 'binding', title: '绑定协作', icon: '🤝'},
  binding: {key: 'binding', title: '绑定协作', icon: '🤝'},
  system: {key: 'system', title: '系统消息', icon: '🔔'},
};

function formatTime(timeStr?: string | null) {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) {
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function resolveNotificationBucket(notification: V2NotificationSummary): NotificationBucket {
  const businessType = String(notification.extra_data?.business_type || '').trim();
  const eventType = String(notification.extra_data?.event_type || '').trim();

  if (businessType && notificationBucketMap[businessType]) {
    return notificationBucketMap[businessType];
  }
  if (eventType.includes('refund') || eventType.includes('dispute')) {
    return notificationBucketMap.refund;
  }
  if (eventType.includes('qualification') || eventType.includes('verification')) {
    return notificationBucketMap.qualification;
  }
  if (eventType.includes('binding')) {
    return notificationBucketMap.binding;
  }
  if (eventType.includes('dispatch')) {
    return notificationBucketMap.dispatch;
  }
  if (eventType.includes('order')) {
    return notificationBucketMap.order;
  }
  if (eventType.includes('quote')) {
    return notificationBucketMap.quote;
  }
  if (eventType.includes('demand')) {
    return notificationBucketMap.demand;
  }
  return notificationBucketMap.system;
}

function buildNotificationSections(notifications: V2NotificationSummary[]): NotificationSection[] {
  const grouped = new Map<string, NotificationSection>();
  notifications.forEach(notification => {
    const bucket = resolveNotificationBucket(notification);
    if (!grouped.has(bucket.key)) {
      grouped.set(bucket.key, {
        key: bucket.key,
        title: bucket.title,
        icon: bucket.icon,
        data: [],
      });
    }
    grouped.get(bucket.key)?.data.push(notification);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const aUnread = a.data.filter(item => !item.is_read).length;
    const bUnread = b.data.filter(item => !item.is_read).length;
    if (aUnread !== bUnread) {
      return bUnread - aUnread;
    }
    const aTime = a.data[0]?.created_at || '';
    const bTime = b.data[0]?.created_at || '';
    return bTime.localeCompare(aTime);
  });
}

function resolveNotificationTitle(notification: V2NotificationSummary) {
  return notification.extra_data?.title || resolveNotificationBucket(notification).title;
}

function resolveNotificationSubtitle(notification: V2NotificationSummary) {
  const extra = notification.extra_data || {};
  return extra.order_no || extra.dispatch_no || extra.quote_no || extra.demand_no || '';
}

export default function ConversationListScreen({navigation}: any) {
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const [activeTab, setActiveTab] = useState<MessageCenterTab>('notifications');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [notifications, setNotifications] = useState<V2NotificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [notificationRes, conversationRes] = await Promise.all([
        notificationV2Service.list({page: 1, page_size: 100}),
        messageService.getConversations(),
      ]);

      const nextNotifications = notificationRes.data?.items || [];
      const nextConversations = (conversationRes.data || []).filter(
        item => item.peer_id > 0 && !String(item.conversation_id || '').startsWith('system-'),
      );

      setNotifications(nextNotifications);
      setNotificationUnread(
        Number(notificationRes.meta?.unread_count || nextNotifications.filter(item => !item.is_read).length),
      );
      setConversations(nextConversations);
    } catch (e) {
      console.warn('获取消息中心数据失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const notificationSections = useMemo(
    () => buildNotificationSections(notifications),
    [notifications],
  );

  const conversationUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [conversations],
  );

  const markNotificationReadLocally = useCallback((notificationId: number) => {
    setNotifications(prev =>
      prev.map(item =>
        item.id === notificationId
          ? {
              ...item,
              is_read: true,
              read_at: item.read_at || new Date().toISOString(),
            }
          : item,
      ),
    );
    setNotificationUnread(prev => Math.max(0, prev - 1));
  }, []);

  const navigateByNotification = useCallback(
    async (notification: V2NotificationSummary) => {
      if (!notification.is_read) {
        markNotificationReadLocally(notification.id);
        try {
          await notificationV2Service.markRead(notification.id);
        } catch (error) {
          console.warn('标记通知已读失败:', error);
        }
      }

      const extra = notification.extra_data || {};
      if (extra.dispatch_task_id) {
        navigation.navigate('DispatchTaskDetail', {dispatchId: Number(extra.dispatch_task_id)});
        return;
      }
      if (extra.order_id) {
        navigation.navigate('OrderDetail', {orderId: Number(extra.order_id)});
        return;
      }
      if (extra.demand_id) {
        navigation.navigate('DemandDetail', {demandId: Number(extra.demand_id)});
        return;
      }
      if (extra.binding_id) {
        if (roleSummary?.has_owner_role) {
          navigation.navigate('OwnerPilotBindings');
          return;
        }
        if (roleSummary?.has_pilot_role) {
          navigation.navigate('PilotOwnerBindings');
          return;
        }
      }
      if (resolveNotificationBucket(notification).key === 'qualification') {
        if (roleSummary?.has_pilot_role) {
          navigation.navigate('PilotProfile');
          return;
        }
        if (roleSummary?.has_owner_role) {
          navigation.navigate('OwnerProfile');
          return;
        }
      }
    },
    [markNotificationReadLocally, navigation, roleSummary],
  );

  const renderConversation = ({item}: {item: ConversationSummary}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() =>
        navigation.navigate('Chat', {
          conversationId: item.conversation_id,
          peerId: item.peer_id,
          onMessageSent: fetchData,
        })
      }>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>👤</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            用户 {item.peer_id}
          </Text>
          <Text style={styles.time}>{formatTime(item.last_time)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.lastMsg} numberOfLines={1}>
            {item.last_type === 'image' ? '[图片]' : item.last_message || '暂无消息'}
          </Text>
          {item.unread_count > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderNotificationItem = ({item}: {item: V2NotificationSummary}) => {
    const bucket = resolveNotificationBucket(item);
    const subtitle = resolveNotificationSubtitle(item);
    return (
      <TouchableOpacity style={styles.notificationItem} onPress={() => navigateByNotification(item)}>
        <View style={styles.notificationIconWrap}>
          <Text style={styles.notificationIcon}>{bucket.icon}</Text>
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={1}>
              {resolveNotificationTitle(item)}
            </Text>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          </View>
          {subtitle ? (
            <Text style={styles.notificationSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.content}
          </Text>
        </View>
        {!item.is_read ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>消息</Text>
        <Text style={styles.headerSubtitle}>系统通知承载业务事件，会话消息只用于沟通</Text>
      </View>

      <View style={styles.tabWrap}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'notifications' && styles.tabBtnActive]}
          onPress={() => setActiveTab('notifications')}>
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>系统通知</Text>
          {notificationUnread > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{notificationUnread > 99 ? '99+' : notificationUnread}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'conversations' && styles.tabBtnActive]}
          onPress={() => setActiveTab('conversations')}>
          <Text style={[styles.tabText, activeTab === 'conversations' && styles.tabTextActive]}>会话消息</Text>
          {conversationUnread > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{conversationUnread > 99 ? '99+' : conversationUnread}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {activeTab === 'notifications' ? (
        <SectionList
          sections={notificationSections}
          keyExtractor={item => String(item.id)}
          renderItem={renderNotificationItem}
          renderSectionHeader={({section}) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {section.icon} {section.title}
              </Text>
              <Text style={styles.sectionMeta}>{section.data.filter(item => !item.is_read).length} 未读</Text>
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1677ff']} />}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title={loading ? '正在加载通知' : '暂无系统通知'}
              description="需求、报价、订单、派单、资质等业务事件会统一出现在这里。"
            />
          }
          contentContainerStyle={notificationSections.length ? styles.listContent : styles.emptyListContent}
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.conversation_id}
          renderItem={renderConversation}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1677ff']} />}
          ListHeaderComponent={
            <View style={styles.chatHint}>
              <Text style={styles.chatHintTitle}>聊天只用于沟通</Text>
              <Text style={styles.chatHintText}>订单确认、派单接受、退款处理等正式状态，请以系统通知和业务页面为准。</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="💬"
              title={loading ? '正在加载会话' : '暂无会话消息'}
              description="这里仅保留人与人之间的沟通消息，不再混入正式业务状态通知。"
            />
          }
          contentContainerStyle={conversations.length ? styles.listContent : styles.emptyListContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f7fb'},
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f5',
  },
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#1f1f1f'},
  headerSubtitle: {marginTop: 6, fontSize: 12, lineHeight: 18, color: '#8c8c8c'},
  tabWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 4,
    backgroundColor: '#eef3fb',
    borderRadius: 999,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 10,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 1,
  },
  tabText: {fontSize: 14, fontWeight: '700', color: '#6b7280'},
  tabTextActive: {color: '#1677ff'},
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff4d4f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 6,
  },
  tabBadgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},
  listContent: {paddingHorizontal: 16, paddingBottom: 24},
  emptyListContent: {flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24},
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {fontSize: 15, fontWeight: '800', color: '#262626'},
  sectionMeta: {fontSize: 12, color: '#8c8c8c'},
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {fontSize: 22},
  content: {flex: 1},
  topRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  name: {fontSize: 15, fontWeight: '700', color: '#262626', flex: 1, marginRight: 8},
  time: {fontSize: 12, color: '#8c8c8c'},
  bottomRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6},
  lastMsg: {fontSize: 13, color: '#8c8c8c', flex: 1, marginRight: 8},
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff4d4f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  notificationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationIcon: {fontSize: 20},
  notificationContent: {flex: 1},
  notificationSubtitle: {marginTop: 2, fontSize: 12, color: '#1677ff', fontWeight: '600'},
  notificationBody: {marginTop: 4, fontSize: 13, lineHeight: 19, color: '#595959'},
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4d4f',
    marginLeft: 10,
  },
  chatHint: {
    backgroundColor: '#fffbe6',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  chatHintTitle: {fontSize: 13, fontWeight: '800', color: '#ad6800'},
  chatHintText: {marginTop: 4, fontSize: 12, lineHeight: 18, color: '#8c6d1f'},
});
