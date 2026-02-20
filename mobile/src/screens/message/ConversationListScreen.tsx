import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl,
} from 'react-native';
import {messageService} from '../../services/message';
import {ConversationSummary} from '../../types';

export default function ConversationListScreen({navigation}: any) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await messageService.getConversations();
      setConversations(res.data || []);
    } catch (e) {
      console.warn('获取会话列表失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
    });
    return unsubscribe;
  }, [navigation, fetchConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 24 * 60 * 60 * 1000) return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const renderConversation = ({item}: {item: ConversationSummary}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('Chat', {
        conversationId: item.conversation_id,
        peerId: item.peer_id,
      })}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>👤</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>用户 {item.peer_id}</Text>
          <Text style={styles.time}>{formatTime(item.last_time)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.lastMsg} numberOfLines={1}>
            {item.last_type === 'image' ? '[图片]' : item.last_message || '暂无消息'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>消息</Text>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={item => item.conversation_id}
        renderItem={renderConversation}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>{loading ? '加载中...' : '暂无消息'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {
    backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: {fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center'},
  item: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5', alignItems: 'center',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: {fontSize: 22},
  content: {flex: 1},
  topRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  name: {fontSize: 15, fontWeight: '600', color: '#333', flex: 1, marginRight: 8},
  time: {fontSize: 12, color: '#999'},
  bottomRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4},
  lastMsg: {fontSize: 13, color: '#999', flex: 1, marginRight: 8},
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ff4d4f',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: {color: '#fff', fontSize: 10, fontWeight: 'bold'},
  emptyContainer: {alignItems: 'center', paddingTop: 80},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999'},
});
