import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
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

const STATUS_TABS = [
  {key: 'all', label: '全部'},
  {key: 'pending_response', label: '待响应'},
  {key: 'accepted', label: '已接单'},
  {key: 'executing', label: '执行中'},
  {key: 'closed', label: '已结束'},
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]['key'];

const CLOSED_STATUSES = ['rejected', 'expired', 'exception', 'completed', 'finished'];

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

const getStatusMatched = (status: string, filter: StatusFilter) => {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'closed') {
    return CLOSED_STATUSES.includes(String(status || '').toLowerCase());
  }
  return String(status || '').toLowerCase() === filter;
};

const getPilotLabel = (task: V2DispatchTaskSummary) => {
  if (task.target_pilot?.nickname) {
    return task.target_pilot.nickname;
  }
  if (task.target_pilot?.user_id) {
    return `飞手 #${task.target_pilot.user_id}`;
  }
  return '待指定飞手';
};

export default function DispatchTaskListScreen({navigation}: any) {
  const [tasks, setTasks] = useState<V2DispatchTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');

  const loadData = useCallback(async () => {
    try {
      const res = await dispatchV2Service.list({role: 'owner', page: 1, page_size: 100});
      setTasks(res.data?.items || []);
    } catch (error) {
      console.error('获取正式派单列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const filteredTasks = useMemo(
    () => tasks.filter(task => getStatusMatched(task.status, activeStatus)),
    [activeStatus, tasks],
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredTasks}
        keyExtractor={item => String(item.id)}
        renderItem={({item}) => (
          <ObjectCard style={styles.card} onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>
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
              <Text style={styles.metaText}>目标飞手：{getPilotLabel(item)}</Text>
              <Text style={styles.metaText}>派单来源：{item.dispatch_source || '-'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>订单状态：{getObjectStatusMeta('order', item.order?.status).label}</Text>
              <Text style={styles.metaText}>重派次数：{item.retry_count || 0}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>发出时间：{formatDateTime(item.sent_at)}</Text>
              <Text style={styles.metaText}>订单金额：{formatMoney(item.order?.total_amount)}</Text>
            </View>
          </ObjectCard>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} colors={['#0f766e']} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>正式派单</Text>
              <Text style={styles.heroTitle}>这里只看执行指令</Text>
              <Text style={styles.heroDesc}>
                派单任务不再混需求、订单创建或候选匹配过程。这里展示的是已经发出的正式派单，以及它当前的响应和执行状态。
              </Text>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>状态筛选</Text>
              <View style={styles.filterRow}>
                {STATUS_TABS.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, activeStatus === tab.key && styles.filterChipActive]}
                    onPress={() => setActiveStatus(tab.key)}>
                    <Text style={[styles.filterChipText, activeStatus === tab.key && styles.filterChipTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color="#0f766e" />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="📡"
                title="当前没有正式派单"
                description="如果订单还没进入派单阶段，请先去订单页确认待处理订单；只有正式发出的派单，才会出现在这里。"
                actionText="查看订单"
                onAction={() => navigation.navigate('MyOrders', {roleFilter: 'owner'})}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3f8',
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: '#0f766e',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    color: '#ccfbf1',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: '#fff',
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#d1fae5',
  },
  filterCard: {
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '700',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  filterChipText: {
    fontSize: 12,
    color: '#595959',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#0f766e',
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    marginBottom: 12,
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
});
