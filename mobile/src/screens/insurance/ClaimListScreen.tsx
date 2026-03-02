import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  getMyClaims,
  getClaimDetail,
  getClaimTimelines,
  InsuranceClaim,
  ClaimTimeline,
  getIncidentTypeText,
  getClaimStatusText,
  getClaimStatusColor,
  formatAmount,
} from '../../services/insurance';

const ClaimListScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaim | null>(null);
  const [timelines, setTimelines] = useState<ClaimTimeline[]>([]);
  const [showDetail, setShowDetail] = useState(false);

  const loadData = async () => {
    try {
      const res = await getMyClaims({ page: 1, page_size: 50 });
      setClaims(res.data.list || []);
    } catch (error) {
      console.error('加载理赔记录失败:', error);
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

  const openDetail = async (claim: InsuranceClaim) => {
    try {
      const [claimRes, timelinesRes] = await Promise.all([
        getClaimDetail(claim.id),
        getClaimTimelines(claim.id),
      ]);
      setSelectedClaim(claimRes.data);
      setTimelines(timelinesRes.data || []);
      setShowDetail(true);
    } catch (error) {
      console.error('加载理赔详情失败:', error);
    }
  };

  const getStepIndex = (step: string): number => {
    const steps = ['report', 'evidence', 'liability', 'approve', 'pay', 'close'];
    return steps.indexOf(step);
  };

  const renderClaimItem = ({ item }: { item: InsuranceClaim }) => {
    const statusColor = getClaimStatusColor(item.status);

    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.claimNo}>#{item.claim_no}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{getClaimStatusText(item.status)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.incidentInfo}>
            <Text style={styles.incidentType}>{getIncidentTypeText(item.incident_type)}</Text>
            <Text style={styles.incidentTime}>
              {new Date(item.incident_time).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.incident_description}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.amountInfo}>
            <Text style={styles.amountLabel}>索赔金额</Text>
            <Text style={styles.amountValue}>{formatAmount(item.claim_amount)}</Text>
          </View>
          {item.approved_amount > 0 && (
            <View style={styles.amountInfo}>
              <Text style={styles.amountLabel}>核定金额</Text>
              <Text style={[styles.amountValue, { color: '#52c41a' }]}>
                {formatAmount(item.approved_amount)}
              </Text>
            </View>
          )}
          {item.paid_amount > 0 && (
            <View style={styles.amountInfo}>
              <Text style={styles.amountLabel}>已赔付</Text>
              <Text style={[styles.amountValue, { color: '#1890ff' }]}>
                {formatAmount(item.paid_amount)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedClaim) return null;
    const currentStepIndex = getStepIndex(selectedClaim.current_step);
    const steps = [
      { key: 'report', label: '报案' },
      { key: 'evidence', label: '取证' },
      { key: 'liability', label: '责任认定' },
      { key: 'approve', label: '核赔' },
      { key: 'pay', label: '赔付' },
      { key: 'close', label: '结案' },
    ];

    return (
      <Modal visible={showDetail} animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>理赔详情</Text>
            <TouchableOpacity onPress={() => setShowDetail(false)}>
              <Text style={styles.closeBtn}>关闭</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={[{ type: 'content' }]}
            keyExtractor={() => 'content'}
            renderItem={() => (
              <>
                {/* 进度条 */}
                <View style={styles.progressContainer}>
                  {steps.map((step, index) => (
                    <View key={step.key} style={styles.stepItem}>
                      <View
                        style={[
                          styles.stepCircle,
                          index <= currentStepIndex && styles.stepCircleActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepNumber,
                            index <= currentStepIndex && styles.stepNumberActive,
                          ]}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.stepLabel,
                          index <= currentStepIndex && styles.stepLabelActive,
                        ]}
                      >
                        {step.label}
                      </Text>
                      {index < steps.length - 1 && (
                        <View
                          style={[
                            styles.stepLine,
                            index < currentStepIndex && styles.stepLineActive,
                          ]}
                        />
                      )}
                    </View>
                  ))}
                </View>

                {/* 基本信息 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>基本信息</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>理赔单号</Text>
                    <Text style={styles.detailValue}>{selectedClaim.claim_no}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>保单号</Text>
                    <Text style={styles.detailValue}>{selectedClaim.policy_no}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>事故类型</Text>
                    <Text style={styles.detailValue}>
                      {getIncidentTypeText(selectedClaim.incident_type)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>事故时间</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedClaim.incident_time).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>事故地点</Text>
                    <Text style={styles.detailValue}>{selectedClaim.incident_location}</Text>
                  </View>
                </View>

                {/* 金额信息 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>金额信息</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>预估损失</Text>
                    <Text style={styles.detailValue}>{formatAmount(selectedClaim.estimated_loss)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>索赔金额</Text>
                    <Text style={styles.detailValue}>{formatAmount(selectedClaim.claim_amount)}</Text>
                  </View>
                  {selectedClaim.actual_loss > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>实际损失</Text>
                      <Text style={styles.detailValue}>{formatAmount(selectedClaim.actual_loss)}</Text>
                    </View>
                  )}
                  {selectedClaim.approved_amount > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>核定金额</Text>
                      <Text style={[styles.detailValue, { color: '#52c41a' }]}>
                        {formatAmount(selectedClaim.approved_amount)}
                      </Text>
                    </View>
                  )}
                  {selectedClaim.deducted_amount > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>免赔额扣除</Text>
                      <Text style={styles.detailValue}>-{formatAmount(selectedClaim.deducted_amount)}</Text>
                    </View>
                  )}
                  {selectedClaim.paid_amount > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>已赔付</Text>
                      <Text style={[styles.detailValue, { color: '#1890ff', fontWeight: '600' }]}>
                        {formatAmount(selectedClaim.paid_amount)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 责任认定 */}
                {selectedClaim.liability_party && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>责任认定</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>责任方</Text>
                      <Text style={styles.detailValue}>{selectedClaim.liability_party}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>责任比例</Text>
                      <Text style={styles.detailValue}>{selectedClaim.liability_ratio}%</Text>
                    </View>
                    {selectedClaim.liability_reason && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>认定理由</Text>
                        <Text style={styles.detailValue}>{selectedClaim.liability_reason}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 拒赔原因 */}
                {selectedClaim.reject_reason && (
                  <View style={styles.rejectSection}>
                    <Text style={styles.rejectTitle}>拒赔原因</Text>
                    <Text style={styles.rejectText}>{selectedClaim.reject_reason}</Text>
                  </View>
                )}

                {/* 时间线 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>处理进度</Text>
                  {timelines.map((timeline, index) => (
                    <View key={timeline.id} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      {index < timelines.length - 1 && <View style={styles.timelineLine} />}
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineAction}>{timeline.description}</Text>
                        <Text style={styles.timelineTime}>
                          {new Date(timeline.created_at).toLocaleString()}
                        </Text>
                        {timeline.operator_name && (
                          <Text style={styles.timelineOperator}>操作人: {timeline.operator_name}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          />
        </View>
      </Modal>
    );
  };

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
        data={claims}
        renderItem={renderClaimItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>暂无理赔记录</Text>
            <Text style={styles.emptySubText}>发生事故时，可在保单页面提交报案</Text>
          </View>
        }
      />
      {renderDetailModal()}
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  claimNo: {
    fontSize: 14,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
  },
  cardBody: {
    marginBottom: 12,
  },
  incidentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  incidentTime: {
    fontSize: 12,
    color: '#999',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  amountInfo: {
    marginRight: 24,
  },
  amountLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
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
  progressContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: '#1890ff',
  },
  stepNumber: {
    fontSize: 12,
    color: '#999',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 10,
    color: '#999',
  },
  stepLabelActive: {
    color: '#1890ff',
  },
  stepLine: {
    position: 'absolute',
    top: 12,
    left: '60%',
    right: '-40%',
    height: 2,
    backgroundColor: '#f0f0f0',
  },
  stepLineActive: {
    backgroundColor: '#1890ff',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLabel: {
    width: 80,
    fontSize: 14,
    color: '#999',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  rejectSection: {
    backgroundColor: '#fff1f0',
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f5222d',
  },
  rejectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cf1322',
    marginBottom: 8,
  },
  rejectText: {
    fontSize: 14,
    color: '#cf1322',
  },
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: 12,
    position: 'relative',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1890ff',
    marginTop: 6,
  },
  timelineLine: {
    position: 'absolute',
    left: 15,
    top: 18,
    bottom: 0,
    width: 2,
    backgroundColor: '#e8e8e8',
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 20,
  },
  timelineAction: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 12,
    color: '#999',
  },
  timelineOperator: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default ClaimListScreen;
