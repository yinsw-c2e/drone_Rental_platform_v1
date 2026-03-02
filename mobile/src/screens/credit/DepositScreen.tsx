import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { getMyDeposit, Deposit } from '../../services/credit';

const DepositScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await getMyDeposit();
      setDeposit(res.data);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setDeposit(null);
        setError(null);
      } else {
        setError('加载失败，请重试');
      }
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

  const formatAmount = (amount: number): string => {
    return (amount / 100).toFixed(2);
  };

  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      pending: '待缴纳',
      paid: '已缴纳',
      partial: '部分缴纳',
      frozen: '已冻结',
      refunding: '退还中',
      refunded: '已退还',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      pending: '#faad14',
      paid: '#52c41a',
      partial: '#1890ff',
      frozen: '#f5222d',
      refunding: '#722ed1',
      refunded: '#999',
    };
    return colorMap[status] || '#999';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!deposit) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>💰</Text>
          </View>
          <Text style={styles.emptyTitle}>暂无保证金记录</Text>
          <Text style={styles.emptyDesc}>您当前不需要缴纳保证金</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>温馨提示</Text>
            <Text style={styles.tipText}>
              • 保持良好的信用记录可以免除保证金要求{'\n'}
              • 出现违规行为可能需要缴纳保证金{'\n'}
              • 保证金将在账号注销或满足退还条件时返还
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 保证金状态卡片 */}
      <View style={styles.mainCard}>
        <View style={styles.statusBadgeContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(deposit.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(deposit.status)}</Text>
          </View>
        </View>
        <Text style={styles.depositNo}>编号: {deposit.deposit_no}</Text>
        
        <View style={styles.amountSection}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>应缴金额</Text>
            <Text style={styles.amountValue}>¥{formatAmount(deposit.required_amount)}</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>已缴金额</Text>
            <Text style={[styles.amountValue, { color: '#52c41a' }]}>
              ¥{formatAmount(deposit.paid_amount)}
            </Text>
          </View>
        </View>

        <View style={styles.amountSection}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>冻结金额</Text>
            <Text style={[styles.amountValue, { color: '#f5222d' }]}>
              ¥{formatAmount(deposit.frozen_amount)}
            </Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>已退还</Text>
            <Text style={styles.amountValue}>¥{formatAmount(deposit.refunded_amount)}</Text>
          </View>
        </View>

        {/* 进度条 */}
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>缴纳进度</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${Math.min(100, (deposit.paid_amount / deposit.required_amount) * 100)}%`,
                  backgroundColor: deposit.paid_amount >= deposit.required_amount ? '#52c41a' : '#1890ff'
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {((deposit.paid_amount / deposit.required_amount) * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* 详细信息 */}
      <View style={styles.detailCard}>
        <Text style={styles.cardTitle}>详细信息</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>要求原因</Text>
          <Text style={styles.detailValue}>{deposit.require_reason || '-'}</Text>
        </View>
        
        {deposit.paid_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>缴纳时间</Text>
            <Text style={styles.detailValue}>
              {new Date(deposit.paid_at).toLocaleString()}
            </Text>
          </View>
        )}
        
        {deposit.refund_reason && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>退还原因</Text>
            <Text style={styles.detailValue}>{deposit.refund_reason}</Text>
          </View>
        )}
        
        {deposit.refunded_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>退还时间</Text>
            <Text style={styles.detailValue}>
              {new Date(deposit.refunded_at).toLocaleString()}
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>创建时间</Text>
          <Text style={styles.detailValue}>
            {new Date(deposit.created_at).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 说明信息 */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>保证金说明</Text>
        <Text style={styles.infoText}>
          1. 保证金用于保障平台和用户的合法权益{'\n'}
          2. 发生违规行为时，可能从保证金中扣除赔偿金额{'\n'}
          3. 满足条件后可申请退还未冻结的保证金{'\n'}
          4. 如有疑问请联系客服处理
        </Text>
      </View>
    </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f5222d',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f5ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  tipCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '100%',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  mainCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
  },
  statusBadgeContainer: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  depositNo: {
    fontSize: 12,
    color: '#999',
    marginBottom: 20,
  },
  amountSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  amountItem: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  progressSection: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#1890ff',
    textAlign: 'right',
    marginTop: 4,
  },
  detailCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  infoCard: {
    backgroundColor: '#fffbe6',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d48806',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#d48806',
    lineHeight: 22,
  },
});

export default DepositScreen;
