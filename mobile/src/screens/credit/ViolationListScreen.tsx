import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  getMyViolations,
  getViolationDetail,
  submitAppeal,
  Violation,
  getViolationTypeText,
  getViolationLevelText,
} from '../../services/credit';

const ViolationListScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAppeal, setShowAppeal] = useState(false);
  const [appealContent, setAppealContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const res = await getMyViolations({ page: 1, page_size: 50 });
      setViolations(res.data.list || []);
    } catch (error) {
      console.error('加载违规记录失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openDetail = async (violation: Violation) => {
    try {
      const res = await getViolationDetail(violation.id);
      setSelectedViolation(res.data);
      setShowDetail(true);
    } catch (error) {
      console.error('加载违规详情失败:', error);
    }
  };

  const handleAppeal = async () => {
    if (!selectedViolation || !appealContent.trim()) {
      Alert.alert('提示', '请输入申诉内容');
      return;
    }

    setSubmitting(true);
    try {
      await submitAppeal(selectedViolation.id, appealContent);
      Alert.alert('成功', '申诉已提交，请等待审核');
      setShowAppeal(false);
      setShowDetail(false);
      setAppealContent('');
      loadData();
    } catch (error) {
      Alert.alert('错误', '提交申诉失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const getLevelColor = (level: string): string => {
    const colorMap: Record<string, string> = {
      minor: '#faad14',
      moderate: '#ff7a45',
      serious: '#f5222d',
      critical: '#a8071a',
    };
    return colorMap[level] || '#999';
  };

  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      appealing: '申诉中',
      revoked: '已撤销',
    };
    return statusMap[status] || status;
  };

  const getAppealStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      none: '未申诉',
      pending: '申诉中',
      approved: '申诉成功',
      rejected: '申诉驳回',
    };
    return statusMap[status] || status;
  };

  const renderViolationItem = ({ item }: { item: Violation }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardHeader}>
        <View style={[styles.levelBadge, { backgroundColor: getLevelColor(item.violation_level) }]}>
          <Text style={styles.levelText}>{getViolationLevelText(item.violation_level)}</Text>
        </View>
        <Text style={styles.violationNo}>#{item.violation_no}</Text>
      </View>
      <Text style={styles.violationType}>{getViolationTypeText(item.violation_type)}</Text>
      <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>状态:</Text>
          <Text style={styles.statusValue}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      {item.score_deduction > 0 && (
        <View style={styles.penaltyInfo}>
          <Text style={styles.penaltyText}>扣除信用分: -{item.score_deduction}</Text>
          {item.freeze_days > 0 && (
            <Text style={styles.penaltyText}>冻结天数: {item.freeze_days}天</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedViolation) return null;

    return (
      <Modal visible={showDetail} animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>违规详情</Text>
            <TouchableOpacity onPress={() => setShowDetail(false)}>
              <Text style={styles.closeBtn}>关闭</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>违规编号</Text>
              <Text style={styles.detailValue}>{selectedViolation.violation_no}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>违规类型</Text>
              <Text style={styles.detailValue}>{getViolationTypeText(selectedViolation.violation_type)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>违规等级</Text>
              <Text style={[styles.detailValue, { color: getLevelColor(selectedViolation.violation_level) }]}>
                {getViolationLevelText(selectedViolation.violation_level)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>状态</Text>
              <Text style={styles.detailValue}>{getStatusText(selectedViolation.status)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>违规描述</Text>
              <Text style={styles.detailValue}>{selectedViolation.description}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>处罚措施</Text>
              <Text style={styles.detailValue}>{selectedViolation.penalty_detail || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>扣除信用分</Text>
              <Text style={[styles.detailValue, { color: '#f5222d' }]}>-{selectedViolation.score_deduction}</Text>
            </View>
            {selectedViolation.freeze_days > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>冻结天数</Text>
                <Text style={styles.detailValue}>{selectedViolation.freeze_days}天</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>申诉状态</Text>
              <Text style={styles.detailValue}>{getAppealStatusText(selectedViolation.appeal_status)}</Text>
            </View>
            {selectedViolation.appeal_result && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>申诉结果</Text>
                <Text style={styles.detailValue}>{selectedViolation.appeal_result}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>创建时间</Text>
              <Text style={styles.detailValue}>{new Date(selectedViolation.created_at).toLocaleString()}</Text>
            </View>
          </View>

          {selectedViolation.status === 'confirmed' && selectedViolation.appeal_status === 'none' && (
            <TouchableOpacity 
              style={styles.appealBtn}
              onPress={() => setShowAppeal(true)}
            >
              <Text style={styles.appealBtnText}>提交申诉</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    );
  };

  const renderAppealModal = () => (
    <Modal visible={showAppeal} animationType="fade" transparent onRequestClose={() => setShowAppeal(false)}>
      <View style={styles.appealOverlay}>
        <View style={styles.appealModal}>
          <Text style={styles.appealTitle}>提交申诉</Text>
          <Text style={styles.appealTip}>请详细描述您的申诉理由，我们将尽快审核</Text>
          <TextInput
            style={styles.appealInput}
            multiline
            placeholder="请输入申诉内容..."
            value={appealContent}
            onChangeText={setAppealContent}
            maxLength={500}
          />
          <Text style={styles.charCount}>{appealContent.length}/500</Text>
          <View style={styles.appealActions}>
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => setShowAppeal(false)}
            >
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.disabledBtn]}
              onPress={handleAppeal}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>提交</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={violations}
        renderItem={renderViolationItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无违规记录</Text>
            <Text style={styles.emptySubText}>保持良好信用，享受更多服务</Text>
          </View>
        }
      />
      {renderDetailModal()}
      {renderAppealModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  levelText: {
    color: '#fff',
    fontSize: 12,
  },
  violationNo: {
    fontSize: 12,
    color: '#999',
  },
  violationType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#999',
    marginRight: 4,
  },
  statusValue: {
    fontSize: 12,
    color: '#1890ff',
  },
  penaltyInfo: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  penaltyText: {
    fontSize: 12,
    color: '#f5222d',
    marginRight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeBtn: {
    fontSize: 16,
    color: '#1890ff',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    width: 90,
    fontSize: 14,
    color: '#999',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  appealBtn: {
    backgroundColor: '#1890ff',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  appealBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  appealOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  appealModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  appealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  appealTip: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  appealInput: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    padding: 12,
    height: 120,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginBottom: 16,
  },
  appealActions: {
    flexDirection: 'row',
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
  },
  submitBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1890ff',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    color: '#fff',
  },
});

export default ViolationListScreen;
