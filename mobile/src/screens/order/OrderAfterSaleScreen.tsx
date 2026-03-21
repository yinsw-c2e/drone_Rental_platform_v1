import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import EmptyState from '../../components/business/EmptyState';
import StatusBadge from '../../components/business/StatusBadge';
import {orderFinanceV2Service} from '../../services/orderFinanceV2';
import {orderV2Service} from '../../services/orderV2';
import {RootState} from '../../store/store';
import {
  V2DisputeSummary,
  V2OrderDetail,
  V2RefundSummary,
  V2SettlementSummary,
} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const DISPUTE_TYPES = [
  {key: 'general', label: '一般争议'},
  {key: 'service', label: '履约争议'},
  {key: 'payment', label: '支付争议'},
  {key: 'damage', label: '货损争议'},
] as const;

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

const getRefundTone = (status?: string | null) => {
  switch (String(status || '').toLowerCase()) {
    case 'success':
    case 'completed':
      return 'green' as const;
    case 'processing':
      return 'blue' as const;
    case 'pending':
      return 'orange' as const;
    case 'failed':
      return 'red' as const;
    default:
      return 'gray' as const;
  }
};

const getDisputeTone = (status?: string | null) => {
  switch (String(status || '').toLowerCase()) {
    case 'open':
      return 'orange' as const;
    case 'processing':
      return 'blue' as const;
    case 'resolved':
    case 'closed':
      return 'green' as const;
    case 'rejected':
      return 'red' as const;
    default:
      return 'gray' as const;
  }
};

export default function OrderAfterSaleScreen({route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const currentUserId = Number(useSelector((state: RootState) => state.auth.user?.id || 0));
  const orderId = Number(route.params?.orderId || route.params?.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [refunds, setRefunds] = useState<V2RefundSummary[]>([]);
  const [disputes, setDisputes] = useState<V2DisputeSummary[]>([]);
  const [settlement, setSettlement] = useState<V2SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [disputeType, setDisputeType] = useState<(typeof DISPUTE_TYPES)[number]['key']>('general');
  const [summary, setSummary] = useState('');

  const loadData = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [detailRes, refundRes, disputeRes] = await Promise.all([
        orderV2Service.get(orderId),
        orderFinanceV2Service.listRefunds(orderId),
        orderFinanceV2Service.listDisputes(orderId),
      ]);
      const nextDetail = detailRes.data || null;
      setDetail(nextDetail);
      setRefunds(refundRes.data?.items || []);
      setDisputes(disputeRes.data?.items || []);

      if (nextDetail && ['completed', 'refunded'].includes(String(nextDetail.status || '').toLowerCase())) {
        try {
          const settlementRes = await orderFinanceV2Service.getSettlement(orderId);
          setSettlement(settlementRes.data || null);
        } catch {
          setSettlement(null);
        }
      } else {
        setSettlement(null);
      }
    } catch (error: any) {
      Alert.alert('加载失败', error?.message || '请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const isClient = useMemo(() => {
    if (!detail) {
      return false;
    }
    return currentUserId > 0 && (
      currentUserId === detail.client?.user_id || currentUserId === detail.participants?.client?.user_id
    );
  }, [currentUserId, detail]);

  const canCreateDispute = !!detail && !['pending_provider_confirmation', 'provider_rejected', 'pending_payment'].includes(String(detail.status || '').toLowerCase());
  const canRequestRefund = !!detail && isClient && (
    refunds.length > 0 || ['cancelled', 'refunded'].includes(String(detail.status || '').toLowerCase())
  );

  const handleRefund = async () => {
    if (!detail) {
      return;
    }
    Alert.alert('处理退款', '会按当前订单已有退款记录继续推进退款。开发测试环境下，这一步会直接调用后端退款逻辑。', [
      {text: '取消', style: 'cancel'},
      {
        text: '继续处理',
        onPress: async () => {
          setActionLoading(true);
          try {
            await orderFinanceV2Service.refund(detail.id);
            Alert.alert('退款已处理', '订单退款记录已刷新。');
            await loadData();
          } catch (error: any) {
            Alert.alert('退款失败', error?.message || '请稍后重试');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleCreateDispute = async () => {
    if (!detail) {
      return;
    }
    if (!summary.trim()) {
      Alert.alert('提示', '请填写售后说明或争议摘要');
      return;
    }
    setActionLoading(true);
    try {
      await orderFinanceV2Service.createDispute(detail.id, {
        dispute_type: disputeType,
        summary: summary.trim(),
      });
      setSummary('');
      Alert.alert('已发起售后', '争议/售后记录已经挂在当前订单下。');
      await loadData();
    } catch (error: any) {
      Alert.alert('提交失败', error?.message || '请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.stateText}>正在加载售后信息...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centerState}>
          <Text style={styles.stateText}>订单信息缺失</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroOrderNo}>{detail.order_no}</Text>
          <Text style={styles.heroTitle}>售后处理</Text>
          <Text style={styles.heroHint}>退款、争议和结算信息现在都按订单聚合，后续排查问题只需要回到这一笔订单。</Text>
        </View>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>订单财务摘要</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>订单状态</Text><Text style={styles.rowValue}>{detail.status}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>订单总额</Text><Text style={styles.rowValue}>{formatMoney(detail.financial_summary?.total_amount || detail.total_amount)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>已支付</Text><Text style={styles.rowValue}>{formatMoney(detail.financial_summary?.paid_amount)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>已退款</Text><Text style={styles.rowValue}>{formatMoney(detail.financial_summary?.refunded_amount)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>争议数量</Text><Text style={styles.rowValue}>{String(detail.dispute_count || disputes.length || 0)}</Text></View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>退款处理</Text>
          <Text style={styles.sectionHint}>退款动作仍受后端状态机约束。当前订单如果没有生成退款记录，后端会明确返回原因。</Text>
          {refunds.length === 0 ? (
            <EmptyState
              icon="💸"
              title="当前没有退款记录"
              description="如果订单已进入退款流程，相关记录会出现在这里。"
            />
          ) : (
            refunds.map(item => (
              <View key={item.id} style={styles.recordItem}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordCode}>{item.refund_no}</Text>
                  <StatusBadge label={item.status || '未知'} tone={getRefundTone(item.status)} />
                </View>
                <Text style={styles.recordMeta}>{formatMoney(item.amount)} · {item.reason || '未填写退款原因'}</Text>
                <Text style={styles.recordMeta}>更新时间：{formatDateTime(item.updated_at || item.created_at)}</Text>
              </View>
            ))
          )}
          {canRequestRefund ? (
            <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.primaryBtnDisabled]} disabled={actionLoading} onPress={handleRefund}>
              {actionLoading ? <ActivityIndicator color={theme.btnPrimaryText} /> : <Text style={styles.primaryBtnText}>继续处理退款</Text>}
            </TouchableOpacity>
          ) : (
            <Text style={styles.sectionHint}>当前订单没有可继续处理的退款动作，或当前账号不是客户侧。</Text>
          )}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>争议 / 售后</Text>
          {!canCreateDispute ? (
            <EmptyState
              icon="🧾"
              title="当前状态不允许发起售后"
              description="待机主确认、待支付等早期状态还没有进入可售后阶段。"
            />
          ) : (
            <>
              <Text style={styles.fieldLabel}>售后类型</Text>
              <View style={styles.typeRow}>
                {DISPUTE_TYPES.map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.typeChip, disputeType === item.key && styles.typeChipActive]}
                    onPress={() => setDisputeType(item.key)}>
                    <Text style={[styles.typeChipText, disputeType === item.key && styles.typeChipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>情况说明</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={5}
                value={summary}
                onChangeText={setSummary}
                placeholder="请说明退款诉求、履约问题、货损情况或其他售后背景..."
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{summary.length}/500</Text>
              <TouchableOpacity style={[styles.primaryBtn, actionLoading && styles.primaryBtnDisabled]} disabled={actionLoading} onPress={handleCreateDispute}>
                {actionLoading ? <ActivityIndicator color={theme.btnPrimaryText} /> : <Text style={styles.primaryBtnText}>提交售后记录</Text>}
              </TouchableOpacity>
            </>
          )}

          {disputes.length === 0 ? (
            <Text style={[styles.emptyText, styles.spacingTop]}>当前还没有售后/争议记录。</Text>
          ) : (
            disputes.map(item => (
              <View key={item.id} style={styles.recordItem}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordCode}>{item.dispute_type || 'general'}</Text>
                  <StatusBadge label={item.status || '未知'} tone={getDisputeTone(item.status)} />
                </View>
                <Text style={styles.recordContent}>{item.summary}</Text>
                <Text style={styles.recordMeta}>发起时间：{formatDateTime(item.created_at)}</Text>
              </View>
            ))
          )}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>结算信息</Text>
          {!settlement ? (
            <Text style={styles.emptyText}>订单完成并进入结算后，这里会显示平台费、机主收入、飞手收入等分账结果。</Text>
          ) : (
            <>
              <View style={styles.row}><Text style={styles.rowLabel}>结算单号</Text><Text style={styles.rowValue}>{settlement.settlement_no}</Text></View>
              <View style={styles.row}><Text style={styles.rowLabel}>结算状态</Text><Text style={styles.rowValue}>{settlement.status || '-'}</Text></View>
              <View style={styles.row}><Text style={styles.rowLabel}>最终金额</Text><Text style={styles.rowValue}>{formatMoney(settlement.final_amount)}</Text></View>
              <View style={styles.row}><Text style={styles.rowLabel}>平台费用</Text><Text style={styles.rowValue}>{formatMoney(settlement.platform_fee)}</Text></View>
              <View style={styles.row}><Text style={styles.rowLabel}>机主收入</Text><Text style={styles.rowValue}>{formatMoney(settlement.owner_fee)}</Text></View>
              <View style={styles.row}><Text style={styles.rowLabel}>飞手收入</Text><Text style={styles.rowValue}>{formatMoney(settlement.pilot_fee)}</Text></View>
              <View style={styles.row}><Text style={styles.rowLabel}>结算时间</Text><Text style={styles.rowValue}>{formatDateTime(settlement.settled_at || settlement.calculated_at)}</Text></View>
            </>
          )}
        </ObjectCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    color: theme.textSub,
  },
  content: {
    padding: 14,
    paddingBottom: 24,
  },
  hero: {
    borderRadius: 24,
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    padding: 20,
    marginBottom: 12,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  heroOrderNo: {
    fontSize: 13,
    color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 28,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
  },
  heroHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  sectionCard: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  rowLabel: {
    fontSize: 13,
    color: theme.textSub,
  },
  rowValue: {
    maxWidth: '62%',
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
    textAlign: 'right',
  },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  typeChipText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: theme.primaryText,
  },
  textArea: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.bgSecondary,
    padding: 14,
    minHeight: 120,
    fontSize: 14,
    color: theme.text,
  },
  charCount: {
    marginTop: 8,
    textAlign: 'right',
    fontSize: 12,
    color: theme.textSub,
  },
  primaryBtn: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: theme.primary,
    alignItems: 'center',
    paddingVertical: 13,
  },
  primaryBtnDisabled: {
    backgroundColor: theme.textHint,
  },
  primaryBtnText: {
    fontSize: 14,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  spacingTop: {
    marginTop: 12,
  },
  recordItem: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.divider,
    padding: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordCode: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
  },
  recordContent: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.text,
  },
  recordMeta: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textSub,
    lineHeight: 18,
  },
});
