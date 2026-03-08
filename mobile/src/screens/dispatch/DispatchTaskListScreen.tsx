import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  listClientTasks,
  DispatchTask,
} from '../../services/dispatch';

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待派单', color: '#faad14'},
  matching: {label: '匹配中', color: '#1890ff'},
  assigned: {label: '已分配', color: '#52c41a'},
  accepted: {label: '已接受', color: '#52c41a'},
  in_progress: {label: '执行中', color: '#1890ff'},
  completed: {label: '已完成', color: '#8c8c8c'},
  cancelled: {label: '已取消', color: '#ff4d4f'},
  failed: {label: '匹配失败', color: '#ff4d4f'},
};

const TASK_TYPE_MAP: Record<string, string> = {
  cargo_delivery: '货物运输',
  agriculture: '农业植保',
  mapping: '航拍测绘',
  inspection: '巡检监测',
  emergency: '应急救援',
  other: '其他',
};

const PRIORITY_MAP: Record<string, {label: string; color: string}> = {
  normal: {label: '普通', color: '#8c8c8c'},
  urgent: {label: '加急', color: '#fa8c16'},
  critical: {label: '紧急', color: '#ff4d4f'},
};

export default function DispatchTaskListScreen({navigation}: any) {
  const [tasks, setTasks] = useState<DispatchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await listClientTasks({page: 1, page_size: 50});
      setTasks(res.list || []);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderItem = ({item}: {item: DispatchTask}) => {
    const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
    const priority = PRIORITY_MAP[item.priority] || PRIORITY_MAP.normal;
    const taskType = TASK_TYPE_MAP[item.task_type] || item.task_type;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.taskNo}>{item.task_no}</Text>
            <View style={[styles.priorityBadge, {backgroundColor: priority.color + '20'}]}>
              <Text style={[styles.priorityText, {color: priority.color}]}>{priority.label}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: status.color + '20'}]}>
            <Text style={[styles.statusText, {color: status.color}]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.taskType}>{taskType}</Text>
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <Text style={styles.routeText} numberOfLines={1}>{item.pickup_address || '待确认'}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, {backgroundColor: '#ff4d4f'}]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.delivery_address || '待确认'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            {item.cargo_weight ? `${item.cargo_weight}kg` : '-'}
          </Text>
          <Text style={styles.footerText}>
            {item.max_budget ? `预算 ¥${(item.max_budget / 100).toFixed(0)}` : '系统定价'}
          </Text>
          <Text style={styles.footerDate}>
            {item.created_at?.substring(0, 10)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无派单任务</Text>
      <Text style={styles.emptySubText}>点击下方按钮创建新任务</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('CreateDispatchTask')}>
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>创建派单任务</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  listContent: { paddingBottom: 24 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1890ff', marginHorizontal: 16, marginTop: 16,
    paddingVertical: 14, borderRadius: 8,
  },
  addBtnIcon: { fontSize: 20, color: '#fff', marginRight: 8 },
  addBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  emptyContainer: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#999' },
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 16,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  taskNo: { fontSize: 14, fontWeight: '600', color: '#333', marginRight: 8 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  priorityText: { fontSize: 11, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '500' },
  cardBody: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  taskType: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  routeDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#52c41a', marginRight: 10,
  },
  routeText: { fontSize: 14, color: '#333', flex: 1 },
  routeLine: {
    width: 1, height: 16, backgroundColor: '#ddd', marginLeft: 4.5, marginVertical: 2,
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  footerText: { fontSize: 12, color: '#666' },
  footerDate: { fontSize: 12, color: '#999' },
});
