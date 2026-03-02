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
  accepted: {label: '已接受', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
  expired: {label: '已过期', color: '#8c8c8c'},
};

export default function PilotTaskListScreen({navigation}: any) {
  const [tasks, setTasks] = useState<DispatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DispatchCandidate | null>(null);
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

  const handleAccept = (task: DispatchCandidate) => {
    Alert.alert('确认接单', '确定要接受此任务吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认接受',
        onPress: async () => {
          try {
            await acceptTask(task.id);
            Alert.alert('成功', '已接受任务');
            loadData();
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

  const renderItem = ({item}: {item: DispatchCandidate}) => {
    const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
    const isPending = item.status === 'pending';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.matchScoreBox}>
            <Text style={styles.matchScoreValue}>{item.match_score?.toFixed(0) || '-'}</Text>
            <Text style={styles.matchScoreLabel}>匹配分</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <View style={[styles.statusBadge, {backgroundColor: status.color + '20'}]}>
              <Text style={[styles.statusText, {color: status.color}]}>{status.label}</Text>
            </View>
            {isPending && item.response_deadline && (
              <Text style={styles.countdownText}>
                {formatCountdown(item.response_deadline)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>距离</Text>
            <Text style={styles.infoValue}>
              {item.distance_km ? `${item.distance_km.toFixed(1)}km` : '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>预估报酬</Text>
            <Text style={[styles.infoValue, {color: '#f5222d', fontWeight: 'bold'}]}>
              {item.estimated_price ? `¥${(item.estimated_price / 100).toFixed(0)}` : '待定'}
            </Text>
          </View>
          {item.drone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>使用无人机</Text>
              <Text style={styles.infoValue}>
                {item.drone.brand} {item.drone.model}
              </Text>
            </View>
          )}
        </View>

        {isPending && (
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
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  matchScoreBox: { alignItems: 'center' },
  matchScoreValue: { fontSize: 24, fontWeight: 'bold', color: '#1890ff' },
  matchScoreLabel: { fontSize: 11, color: '#999' },
  cardHeaderRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '500' },
  countdownText: { fontSize: 11, color: '#faad14', marginTop: 4 },
  cardBody: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  actionRow: {
    flexDirection: 'row', marginTop: 14, gap: 12,
  },
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
