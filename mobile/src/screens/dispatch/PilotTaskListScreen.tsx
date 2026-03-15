import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {dispatchV2Service} from '../../services/dispatchV2';
import {V2DispatchTaskSummary} from '../../types';

const formatMoney = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

const getPilotEntryMeta = (entryMode: string) => {
  if (entryMode === 'assigned') {
    return {
      title: '待响应正式派单',
      hint: '这里只显示已经派到你名下、等待你确认的正式派单。',
      empty: '当前没有待响应的正式派单',
    };
  }
  return {
    title: '我的正式派单',
    hint: '这里只展示正式派单，不再混公开需求、候选报名和旧任务池。',
    empty: '当前没有分配给你的正式派单',
  };
};

export default function PilotTaskListScreen({navigation, route}: any) {
  const [tasks, setTasks] = useState<V2DispatchTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<V2DispatchTaskSummary | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const entryMode = String(route?.params?.entry || 'all');
  const entryMeta = useMemo(() => getPilotEntryMeta(entryMode), [entryMode]);

  const loadData = useCallback(async () => {
    try {
      const status = entryMode === 'assigned' ? 'pending_response' : undefined;
      const res = await dispatchV2Service.list({role: 'pilot', status, page: 1, page_size: 100});
      setTasks(res.data?.items || []);
    } catch (error) {
      console.error('获取飞手正式派单失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entryMode]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const visibleTasks = useMemo(() => {
    if (entryMode === 'assigned') {
      return tasks.filter(item => String(item.status || '').toLowerCase() === 'pending_response');
    }
    return tasks;
  }, [entryMode, tasks]);

  const handleAccept = (task: V2DispatchTaskSummary) => {
    Alert.alert('确认接单', '确认接受这条正式派单吗？', [
      {text: '取消', style: 'cancel'},
      {
                text: '确认接单',
                onPress: async () => {
                  try {
                    await dispatchV2Service.accept(task.id);
                    await loadData();
                    Alert.alert('接单成功', '正式派单已接受，你可以继续查看派单详情或进入订单详情。', [
                      {
                        text: '查看详情',
                        onPress: () => navigation.navigate('DispatchTaskDetail', {id: task.id}),
              },
              {
                text: '查看订单',
                onPress: () => navigation.navigate('OrderDetail', {id: task.order?.id, orderId: task.order?.id}),
              },
              {text: '稍后', onPress: () => loadData()},
            ]);
          } catch (error: any) {
            Alert.alert('操作失败', error?.response?.data?.message || '请稍后重试');
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    if (!selectedTask) {
      return;
    }
    try {
      await dispatchV2Service.reject(selectedTask.id, rejectReason.trim() || undefined);
      Alert.alert('已拒绝', '这条正式派单已回退，系统可能会自动重派。');
      setSelectedTask(null);
      setRejectReason('');
      loadData();
    } catch (error: any) {
      Alert.alert('操作失败', error?.response?.data?.message || '请稍后重试');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{entryMeta.title}</Text>
        <Text style={styles.bannerHint}>{entryMeta.hint}</Text>
      </View>

      <FlatList
        data={visibleTasks}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} colors={['#b45309']} />}
        contentContainerStyle={styles.content}
        renderItem={({item}) => {
          const canRespond = String(item.status || '').toLowerCase() === 'pending_response';
          return (
            <ObjectCard style={[styles.card, canRespond && styles.cardHighlight]} onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <SourceTag source="dispatch_task" />
                  <StatusBadge label="" meta={getObjectStatusMeta('dispatch_task', item.status)} />
                </View>
                <Text style={styles.code}>{item.dispatch_no}</Text>
              </View>

              <Text style={styles.title}>{item.order?.title || '正式派单任务'}</Text>
              <Text style={styles.route} numberOfLines={2}>
                {item.order?.service_address || '未设置起点'}
                {item.order?.dest_address ? ` -> ${item.order.dest_address}` : ''}
              </Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>机主：{item.provider?.nickname || `机主 #${item.provider?.user_id || '-'}`}</Text>
                <Text style={styles.metaText}>派单来源：{item.dispatch_source || '-'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>订单状态：{getObjectStatusMeta('order', item.order?.status).label}</Text>
                <Text style={styles.metaText}>发出时间：{formatDateTime(item.sent_at)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>重派次数：{item.retry_count || 0}</Text>
                <Text style={styles.metaText}>订单金额：{formatMoney(item.order?.total_amount)}</Text>
              </View>

              {canRespond ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => {
                      setSelectedTask(item);
                      setRejectReason('');
                    }}>
                    <Text style={styles.rejectBtnText}>拒绝</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                    <Text style={styles.acceptBtnText}>接受派单</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ObjectCard>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color="#b45309" />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="🧭"
                title={entryMeta.empty}
                description="正式派单会在这里统一收口。公开需求报名和飞行记录已经拆到其他页面。"
                actionText="查看订单"
                onAction={() => navigation.navigate('MyOrders')}
              />
            </ObjectCard>
          )
        }
      />

      {selectedTask ? (
        <View style={styles.rejectSheet}>
          <Text style={styles.rejectTitle}>拒绝正式派单</Text>
          <TextInput
            style={styles.rejectInput}
            placeholder="选填：说明拒绝原因，便于机主判断是否需要重派"
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
          />
          <View style={styles.rejectActions}>
            <TouchableOpacity style={styles.sheetGhostBtn} onPress={() => setSelectedTask(null)}>
              <Text style={styles.sheetGhostText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetDangerBtn} onPress={handleReject}>
              <Text style={styles.sheetDangerText}>确认拒绝</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7ed',
  },
  banner: {
    backgroundColor: '#b45309',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  bannerTitle: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '800',
  },
  bannerHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#ffedd5',
  },
  content: {
    padding: 14,
    paddingBottom: 140,
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    marginBottom: 12,
  },
  cardHighlight: {
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  code: {
    fontSize: 12,
    color: '#8c8c8c',
    fontWeight: '600',
  },
  title: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 24,
    color: '#1f1f1f',
    fontWeight: '700',
  },
  route: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#595959',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#595959',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  rejectBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffccc7',
    backgroundColor: '#fff1f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  rejectBtnText: {
    fontSize: 12,
    color: '#cf1322',
    fontWeight: '700',
  },
  acceptBtn: {
    borderRadius: 999,
    backgroundColor: '#b45309',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  acceptBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  rejectSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    elevation: 4,
  },
  rejectTitle: {
    fontSize: 16,
    color: '#1f1f1f',
    fontWeight: '800',
  },
  rejectInput: {
    marginTop: 12,
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f3d3b2',
    backgroundColor: '#fffaf5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  rejectActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  sheetGhostBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  sheetGhostText: {
    fontSize: 12,
    color: '#595959',
    fontWeight: '700',
  },
  sheetDangerBtn: {
    borderRadius: 999,
    backgroundColor: '#cf1322',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sheetDangerText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
});
