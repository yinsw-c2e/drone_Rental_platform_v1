import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  getMyCreditScore,
  getMyCreditLogs,
  CreditScore,
  CreditScoreLog,
  getScoreLevelText,
  getScoreLevelColor,
} from '../../services/credit';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const CreditScoreScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [logs, setLogs] = useState<CreditScoreLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  const loadData = async () => {
    try {
      const [scoreRes, logsRes] = await Promise.all([
        getMyCreditScore(),
        getMyCreditLogs({ page: 1, page_size: 20 }),
      ]);
      setCreditScore(scoreRes.data);
      setLogs(logsRes.data.list || []);
    } catch (error) {
      console.error('加载信用分失败:', error);
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

  const renderScoreCircle = () => {
    if (!creditScore) return null;
    const color = getScoreLevelColor(creditScore.score_level);
    
    return (
      <View style={styles.scoreCircle}>
        <View style={[styles.scoreRing, { borderColor: color }]}>
          <Text style={[styles.scoreNumber, { color }]}>{creditScore.total_score}</Text>
          <Text style={styles.scoreLabel}>信用分</Text>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: color }]}>
          <Text style={styles.levelText}>{getScoreLevelText(creditScore.score_level)}</Text>
        </View>
      </View>
    );
  };

  const renderDimensionScores = () => {
    if (!creditScore) return null;
    
    let dimensions: Array<{ label: string; score: number; max: number }> = [];
    
    switch (creditScore.user_type) {
      case 'pilot':
        dimensions = [
          { label: '基础资质', score: creditScore.pilot_qualification, max: 200 },
          { label: '服务质量', score: creditScore.pilot_service, max: 300 },
          { label: '安全记录', score: creditScore.pilot_safety, max: 300 },
          { label: '活跃度', score: creditScore.pilot_activity, max: 200 },
        ];
        break;
      case 'owner':
        dimensions = [
          { label: '设备合规', score: creditScore.owner_compliance, max: 250 },
          { label: '服务质量', score: creditScore.owner_service, max: 300 },
          { label: '履约能力', score: creditScore.owner_fulfillment, max: 250 },
          { label: '合作态度', score: creditScore.owner_attitude, max: 200 },
        ];
        break;
      case 'client':
        dimensions = [
          { label: '身份认证', score: creditScore.client_identity, max: 200 },
          { label: '支付能力', score: creditScore.client_payment, max: 300 },
          { label: '合作态度', score: creditScore.client_attitude, max: 300 },
          { label: '订单质量', score: creditScore.client_order_quality, max: 200 },
        ];
        break;
    }

    return (
      <View style={styles.dimensionsCard}>
        <Text style={styles.cardTitle}>分项得分</Text>
        {dimensions.map((dim, index) => (
          <View key={index} style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>{dim.label}</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBg}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(dim.score / dim.max) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.dimensionScore}>{dim.score}/{dim.max}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderStatistics = () => {
    if (!creditScore) return null;

    return (
      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>服务统计</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{creditScore.total_orders}</Text>
            <Text style={styles.statLabel}>总订单</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{creditScore.completed_orders}</Text>
            <Text style={styles.statLabel}>已完成</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{creditScore.average_rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>平均评分</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{creditScore.violation_count}</Text>
            <Text style={styles.statLabel}>违规次数</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderLogs = () => {
    if (logs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无信用分变动记录</Text>
        </View>
      );
    }

    return (
      <View style={styles.logsContainer}>
        {logs.map((log) => (
          <View key={log.id} style={styles.logItem}>
            <View style={styles.logHeader}>
              <Text style={styles.logReason}>{log.change_reason}</Text>
              <Text style={[
                styles.logChange,
                { color: log.score_change >= 0 ? '#52c41a' : '#f5222d' }
              ]}>
                {log.score_change >= 0 ? '+' : ''}{log.score_change}
              </Text>
            </View>
            <View style={styles.logFooter}>
              <Text style={styles.logTime}>
                {new Date(log.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.logScore}>
                {log.score_before} → {log.score_after}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 信用分展示 */}
      {renderScoreCircle()}

      {/* 状态提示 */}
      {creditScore?.is_frozen && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>账号已冻结: {creditScore.frozen_reason}</Text>
        </View>
      )}
      {creditScore?.is_blacklisted && (
        <View style={styles.dangerBanner}>
          <Text style={styles.dangerText}>账号已被列入黑名单</Text>
        </View>
      )}

      {/* Tab切换 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            信用概览
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'logs' && styles.activeTab]}
          onPress={() => setActiveTab('logs')}
        >
          <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>
            变动记录
          </Text>
        </TouchableOpacity>
      </View>

      {/* 内容区域 */}
      {activeTab === 'overview' ? (
        <>
          {renderDimensionScores()}
          {renderStatistics()}
        </>
      ) : (
        renderLogs()
      )}
    </ScrollView>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircle: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: theme.card,
  },
  scoreRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 14,
    color: theme.textSub,
    marginTop: 4,
  },
  levelBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  levelText: {
    color: theme.btnPrimaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  warningBanner: {
    backgroundColor: theme.warning + '22',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.warning,
  },
  warningText: {
    color: theme.warning,
    fontSize: 14,
  },
  dangerBanner: {
    backgroundColor: theme.danger + '22',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.danger,
  },
  dangerText: {
    color: theme.danger,
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontSize: 14,
    color: theme.textSub,
  },
  activeTabText: {
    color: theme.btnPrimaryText,
    fontWeight: '500',
  },
  dimensionsCard: {
    backgroundColor: theme.card,
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  dimensionRow: {
    marginBottom: 12,
  },
  dimensionLabel: {
    fontSize: 14,
    color: theme.textSub,
    marginBottom: 6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: theme.divider,
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 4,
  },
  dimensionScore: {
    fontSize: 12,
    color: theme.textSub,
    width: 60,
    textAlign: 'right',
  },
  statsCard: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSub,
    marginTop: 4,
  },
  logsContainer: {
    padding: 16,
  },
  logItem: {
    backgroundColor: theme.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logReason: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
  logChange: {
    fontSize: 16,
    fontWeight: '600',
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  logTime: {
    fontSize: 12,
    color: theme.textSub,
  },
  logScore: {
    fontSize: 12,
    color: theme.textSub,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSub,
  },
});

export default CreditScoreScreen;
