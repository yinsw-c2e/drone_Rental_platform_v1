import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
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
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

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

const DELETE_WIDTH = 76;

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

function SwipeableConversationItem({
  item,
  styles,
  onPress,
  onDelete,
}: {
  item: ConversationSummary;
  styles: ReturnType<typeof getStyles>;
  onPress: (item: ConversationSummary) => void;
  onDelete: (item: ConversationSummary) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);

  const animateTo = useCallback(
    (value: number) => {
      Animated.spring(translateX, {
        toValue: value,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }).start();
      setOpen(value < 0);
    },
    [translateX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          const base = open ? -DELETE_WIDTH : 0;
          const next = Math.max(-DELETE_WIDTH, Math.min(0, base + gesture.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldOpen = (open ? -DELETE_WIDTH : 0) + gesture.dx < -DELETE_WIDTH / 2;
          animateTo(shouldOpen ? -DELETE_WIDTH : 0);
        },
        onPanResponderTerminate: () => animateTo(open ? -DELETE_WIDTH : 0),
      }),
    [animateTo, open, translateX],
  );

  return (
    <View style={styles.swipeWrap}>
      <TouchableOpacity style={styles.deleteAction} onPress={() => onDelete(item)} activeOpacity={0.85}>
        <Text style={styles.deleteText}>删除</Text>
      </TouchableOpacity>
      <Animated.View
        style={[styles.swipeItem, open && styles.swipeItemOpen, {transform: [{translateX}]}]}
        {...panResponder.panHandlers}>
        <TouchableOpacity
          style={[styles.item, open && styles.itemOpen]}
          activeOpacity={0.85}
          onPress={() => {
            if (open) {
              animateTo(0);
              return;
            }
            onPress(item);
          }}>
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
      </Animated.View>
    </View>
  );
}

export default function ConversationListScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
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
      const nextConversations = (conversationRes.data?.items || []).filter(
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
      if (extra.order_id) {
        const preferOrderView = !roleSummary?.has_owner_role && !roleSummary?.has_pilot_role;
        if (preferOrderView || !extra.dispatch_task_id) {
          navigation.navigate('OrderDetail', {orderId: Number(extra.order_id)});
          return;
        }
      }
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

  const openConversation = useCallback(
    async (item: ConversationSummary) => {
      if (Number(item.unread_count || 0) > 0) {
        setConversations(prev =>
          prev.map(conversation =>
            conversation.conversation_id === item.conversation_id
              ? {...conversation, unread_count: 0}
              : conversation,
          ),
        );
        try {
          await messageService.markRead(item.conversation_id);
        } catch (error) {
          console.warn('标记会话已读失败:', error);
        }
      }
      navigation.navigate('Chat', {
        conversationId: item.conversation_id,
        peerId: item.peer_id,
        peerName: item.peer_name || `用户 ${item.peer_id}`,
        peerAvatar: item.peer_avatar_url || '',
        onMessageSent: fetchData,
      });
    },
    [fetchData, navigation],
  );

  const deleteConversation = useCallback(async (item: ConversationSummary) => {
    let previous: ConversationSummary[] = [];
    setConversations(prev => {
      previous = prev;
      return prev.filter(conversation => conversation.conversation_id !== item.conversation_id);
    });
    try {
      await messageService.deleteConversation(item.conversation_id);
    } catch (error: any) {
      setConversations(previous);
      Alert.alert('删除失败', error?.message || '请稍后重试');
    }
  }, []);

  const renderConversation = ({item}: {item: ConversationSummary}) => (
    <SwipeableConversationItem
      item={item}
      styles={styles}
      onPress={openConversation}
      onDelete={deleteConversation}
    />
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
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.refreshColor]} />}
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

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  header: {
    backgroundColor: theme.card,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  headerTitle: {fontSize: 22, fontWeight: '800', color: theme.text},
  headerSubtitle: {marginTop: 6, fontSize: 12, lineHeight: 18, color: theme.textSub},
  tabWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 4,
    backgroundColor: theme.tabBg,
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
    backgroundColor: theme.card,
    shadowColor: theme.primary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 1,
  },
  tabText: {fontSize: 14, fontWeight: '700', color: theme.textSub},
  tabTextActive: {color: theme.primaryText},
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 6,
  },
  tabBadgeText: {color: theme.btnPrimaryText, fontSize: 10, fontWeight: '700'},
  listContent: {paddingHorizontal: 16, paddingBottom: 24},
  emptyListContent: {flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24},
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {fontSize: 15, fontWeight: '800', color: theme.text},
  sectionMeta: {fontSize: 12, color: theme.textSub},
  swipeWrap: {
    height: 76,
    marginBottom: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  swipeItem: {
    height: 76,
    backgroundColor: theme.card,
    borderRadius: 18,
  },
  swipeItemOpen: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: DELETE_WIDTH,
    height: 76,
    backgroundColor: theme.danger,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  deleteText: {color: theme.btnPrimaryText, fontSize: 14, fontWeight: '800'},
  item: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    height: 76,
  },
  itemOpen: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {fontSize: 22},
  content: {flex: 1},
  topRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  name: {fontSize: 15, fontWeight: '700', color: theme.text, flex: 1, marginRight: 8},
  time: {fontSize: 12, color: theme.textSub},
  bottomRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6},
  lastMsg: {fontSize: 13, color: theme.textSub, flex: 1, marginRight: 8},
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {color: theme.btnPrimaryText, fontSize: 10, fontWeight: '700'},
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  notificationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationIcon: {fontSize: 20},
  notificationContent: {flex: 1},
  notificationSubtitle: {marginTop: 2, fontSize: 12, color: theme.primaryText, fontWeight: '600'},
  notificationBody: {marginTop: 4, fontSize: 13, lineHeight: 19, color: theme.textSub},
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.danger,
    marginLeft: 10,
  },
  chatHint: {
    backgroundColor: theme.warning + '22',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  chatHintTitle: {fontSize: 13, fontWeight: '800', color: theme.warning},
  chatHintText: {marginTop: 4, fontSize: 12, lineHeight: 18, color: theme.warning},
});
