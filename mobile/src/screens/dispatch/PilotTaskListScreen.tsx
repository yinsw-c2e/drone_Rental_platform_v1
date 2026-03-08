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
  Modal,
  TextInput,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  listPilotTasks,
  acceptTask,
  rejectTask,
  DispatchCandidate,
} from '../../services/dispatch';

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待响应', color: '#faad14'},
  notified: {label: '请确认接单', color: '#ff7a00'},
  accepted: {label: '已接单', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
  expired: {label: '已过期', color: '#8c8c8c'},
};

export default function PilotTaskListScreen({navigation}: any) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = async () => {
    try {
      const res = await listPilotTasks({page: 1, page_size: 50});
      setTasks(res.data || []);
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

  const handleAccept = (task: any) => {
    if (task.status !== 'notified') {
      Alert.alert('提示', '只有被指定通知的任务才可以接单');
      return;
    }
    Alert.alert('确认接单', '确定要接受此任务吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认接受',
        onPress: async () => {
          try {
            const result = await acceptTask(task.id);
            Alert.alert('接单成功', '已成功接单，请前往任务执行界面继续操作', [
              {
                text: '前往执行',
                onPress: () => navigation.navigate('PilotOrderExecution', {
                  taskId: task.task_id,
                  taskNo: task.task_no,
                  orderId: result?.order_id,
                }),
              },
              {text: '稍后', onPress: () => loadData()},
            ]);
          } catch (e: any) {
            Alert.alert('操作失败', e.message);
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    if (!selectedTask) return;
    try {
      await rejectTask(selectedTask.id, rejectReason.trim() || undefined);
      Alert.alert('提示', '已拒绝任务');
      setShowRejectModal(false);
      setRejectReason('');
      loadData();
    } catch (e: any) {
      Alert.alert('操作失败', e.message);
    }
  };

  const formatCountdown = (deadline: string): string => {
    if (!deadline) return '';
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return '已过期';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分钟内响应`;
    const hours = Math.floor(mins / 60);
    return `${hours}小时${mins % 60}分钟内响应`;
  };

  const renderItem = ({item}: {item: any}) => {
    const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
    const canAct = item.status === 'notified';
    const price = typeof item.quoted_price === 'number' ? item.quoted_price : Number(item.quoted_price);
    const score = typeof item.total_score === 'number' ? item.total_score : Number(item.total_score);
    const weight = typeof item.cargo_weight === 'number' ? item.cargo_weight : Number(item.cargo_weight);

    return (
      <View style={[styles.card, canAct && styles.cardHighlight]}>
        {/* 头部：任务编号 + 状态 */}
        <View style={styles.cardHeader}>
          <View style={{flex:1}}>
            <Text style={styles.taskNo}>{item.task_no || '-'}</Text>
            <Text style={styles.taskType}>{item.task_type === 'cargo_transport' ? '货运任务' : (item.task_type || '-')}</Text>
          </View>
          <View style={styles.matchScoreBox}>
            <Text style={styles.matchScoreValue}>{score ? score.toFixed(0) : '-'}</Text>
            <Text style={styles.matchScoreLabel}>匹配分</Text>
          </View>
        </View>

        {/* 状态标签 */}
        <View style={[styles.statusBadge, {backgroundColor: status.color + '20', alignSelf: 'flex-start', marginBottom: 10}]}>
          <Text style={[styles.statusText, {color: status.color}]}>{status.label}</Text>
        </View>

        {/* 任务详情 */}
        <View style={styles.cardBody}>
          {item.pickup_address ? (
            <View style={styles.routeRow}>
              <View style={styles.routeDot} />
              <Text style={styles.routeText} numberOfLines={1}>{item.pickup_address}</Text>
            </View>
          ) : null}
          {item.delivery_address ? (
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, {backgroundColor: '#f5222d'}]} />
              <Text style={styles.routeText} numberOfLines={1}>{item.delivery_address}</Text>
            </View>
          ) : null}
          <View style={styles.metricsRow}>
            {weight > 0 && (
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{weight.toFixed(1)}kg</Text>
                <Text style={styles.metricLabel}>货物重量</Text>
              </View>
            )}
            {item.distance ? (
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{Number(item.distance).toFixed(1)}km</Text>
                <Text style={styles.metricLabel}>餐送距离</Text>
              </View>
            ) : null}
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, {color: '#f5222d'}]}>
                {price > 0 ? `¥${(price / 100).toFixed(0)}` : '待定'}
              </Text>
              <Text style={styles.metricLabel}>预估报酬</Text>
            </View>
          </View>
        </View>

        {canAct && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => {
                setSelectedTask(item);
                setShowRejectModal(true);
              }}>
              <Text style={styles.rejectBtnText}>拒绝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAccept(item)}>
              <Text style={styles.acceptBtnText}>接受任务</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'accepted' && (
          <TouchableOpacity
            style={styles.executeBtn}
            onPress={() => navigation.navigate('PilotOrderExecution', {
              taskId: item.task_id,
              taskNo: item.task_no,
            })}>
            <Text style={styles.executeBtnText}>查看执行进度 →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无分配的任务</Text>
      <Text style={styles.emptySubText}>请确保已开启接单状态</Text>
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
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* 拒绝原因弹窗 */}
      <Modal
        visible={showRejectModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>拒绝任务</Text>
            <Text style={styles.modalSubtitle}>请填写拒绝原因（选填）</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="如: 距离太远、时间冲突等"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRejectModal(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleReject}>
                <Text style={styles.modalConfirmText}>确认拒绝</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  listContent: { padding: 16, paddingBottom: 24 },
  emptyContainer: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#999' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHighlight: {
    borderWidth: 2, borderColor: '#ff7a00',
    shadowColor: '#ff7a00', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskNo: { fontSize: 13, color: '#999', marginBottom: 2 },
  taskType: { fontSize: 14, color: '#333', fontWeight: '600' },
  matchScoreBox: { alignItems: 'center', minWidth: 50 },
  matchScoreValue: { fontSize: 22, fontWeight: 'bold', color: '#1890ff' },
  matchScoreLabel: { fontSize: 11, color: '#999' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardBody: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#52c41a', marginRight: 8 },
  routeText: { flex: 1, fontSize: 13, color: '#555' },
  metricsRow: { flexDirection: 'row', marginTop: 10, gap: 12 },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  metricLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  actionRow: { flexDirection: 'row', marginTop: 14, gap: 12 },
  rejectBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#ff4d4f', alignItems: 'center',
  },
  rejectBtnText: { fontSize: 16, color: '#ff4d4f', fontWeight: '600' },
  acceptBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#1890ff', alignItems: 'center',
  },
  acceptBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  executeBtn: {
    marginTop: 12, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#f6ffed', borderWidth: 1, borderColor: '#b7eb8f', alignItems: 'center',
  },
  executeBtnText: { fontSize: 15, color: '#52c41a', fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  modalInput: {
    height: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingTop: 10, fontSize: 14, backgroundColor: '#fafafa',
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
  },
  modalCancelText: { fontSize: 16, color: '#666' },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#ff4d4f', alignItems: 'center',
  },
  modalConfirmText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
