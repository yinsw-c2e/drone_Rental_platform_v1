import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import SourceTag from '../../components/business/SourceTag';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {orderFinanceV2Service} from '../../services/orderFinanceV2';
import {orderV2Service} from '../../services/orderV2';
import {
  V2OrderDetail,
  V2PaymentSummary,
  V2RefundSummary,
} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const METHODS = [
  {key: 'mock', label: '模拟支付', icon: '🧪', desc: '当前正式联调路径，提交后立即回写支付成功'},
  {key: 'wechat', label: '微信支付', icon: '📱', desc: '预留真实通道，当前只创建待回调支付单'},
  {key: 'alipay', label: '支付宝', icon: '💳', desc: '预留真实通道，当前只创建待回调支付单'},
] as const;

type PaymentMethod = (typeof METHODS)[number]['key'];
type ResultState = {
  mode: 'success' | 'pending' | 'fail';
  title: string;
  desc: string;
};

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

const getPaymentStatusTone = (status?: string | null) => {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return 'green' as const;
    case 'pending':
      return 'orange' as const;
    case 'refunded':
      return 'gray' as const;
    case 'failed':
      return 'red' as const;
    default:
      return 'gray' as const;
  }
};

const getRefundStatusTone = (status?: string | null) => {
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

export default function PaymentScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const orderId = Number(route.params?.orderId || route.params?.id || route.params?.order?.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [payments, setPayments] = useState<V2PaymentSummary[]>([]);
  const [refunds, setRefunds] = useState<V2RefundSummary[]>([]);
  const [selected, setSelected] = useState<PaymentMethod>('mock');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  const loadData = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [orderRes, paymentRes, refundRes] = await Promise.all([
        orderV2Service.get(orderId),
        orderFinanceV2Service.listPayments(orderId),
        orderFinanceV2Service.listRefunds(orderId),
      ]);
      setDetail(orderRes.data || null);
      setPayments(paymentRes.data?.items || []);
      setRefunds(refundRes.data?.items || []);
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

  const totalPay = useMemo(() => {
    if (!detail) {
      return 0;
    }
    return Number(detail.total_amount || 0) + Number(detail.financial_summary?.deposit_amount || 0);
  }, [detail]);

  const paymentReady = detail?.payment_ready !== false && (!detail?.contract || detail.contract.payment_ready !== false);
  const canPay = !!detail && paymentReady && (detail.status === 'pending_payment' || detail.status === 'accepted') && !detail.paid_at;
  const selectedMethod = METHODS.find(method => method.key === selected) || METHODS[0];
  const primaryActionLabel = selected === 'mock'
    ? `确认模拟支付 ${formatMoney(totalPay)}`
    : `创建待回调支付单 ${formatMoney(totalPay)}`;

  const handlePay = async () => {
    if (!detail) {
      return;
    }
    setPaying(true);
    try {
      const res = await orderFinanceV2Service.createPayment(detail.id, selected);
      const latestPayment = res.data?.payment;
      const paymentFlow = res.data?.payment_flow;
      const flowNotice = paymentFlow?.notice || '当前开发环境未接真实支付 SDK，请继续使用模拟支付联调。';

      if ((paymentFlow?.auto_completed || selected === 'mock') && String(latestPayment?.status || '').toLowerCase() === 'paid') {
        setResult({
          mode: 'success',
          title: '支付成功',
          desc: `${flowNotice} 订单 ${detail.order_no} 已完成支付，后续履约会按订单状态继续推进。`,
        });
      } else {
        setResult({
          mode: 'pending',
          title: '支付单已创建',
          desc: `支付单号 ${latestPayment?.payment_no || '-'} 已生成。${flowNotice}`,
        });
      }
      await loadData();
    } catch (error: any) {
      Alert.alert('支付失败', error?.message || '请稍后重试');
      setResult({
        mode: 'fail',
        title: '支付失败',
        desc: error?.message || '订单支付未完成，请稍后重试。',
      });
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.stateText}>正在加载订单支付信息...</Text>
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
          <View style={styles.heroTagRow}>
            <SourceTag source="order" />
            <StatusBadge label="" meta={getObjectStatusMeta('order', detail.status)} />
          </View>
          <Text style={styles.heroOrderNo}>{detail.order_no}</Text>
          <Text style={styles.heroAmount}>{formatMoney(totalPay)}</Text>
          <Text style={styles.heroHint}>当前订单支付和退款动作都挂在订单对象下，和订单状态一起推进。</Text>
        </View>

        {result ? (
          <ObjectCard style={styles.resultCard}>
            <Text style={styles.resultTitle}>{result.title}</Text>
            <Text style={styles.resultDesc}>{result.desc}</Text>
            <View style={styles.resultActionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setResult(null)}>
                <Text style={styles.secondaryBtnText}>关闭结果</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resultPrimaryBtn}
                onPress={() => navigation.navigate('OrderDetail', {id: detail.id, orderId: detail.id})}>
                <Text style={styles.primaryBtnText}>返回订单</Text>
              </TouchableOpacity>
            </View>
          </ObjectCard>
        ) : null}

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>订单支付摘要</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>订单标题</Text><Text style={styles.rowValue}>{detail.title}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>订单金额</Text><Text style={styles.rowValue}>{formatMoney(detail.total_amount)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>押金</Text><Text style={styles.rowValue}>{formatMoney(detail.financial_summary?.deposit_amount)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>已支付</Text><Text style={styles.rowValue}>{formatMoney(detail.financial_summary?.paid_amount)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>已退款</Text><Text style={styles.rowValue}>{formatMoney(detail.financial_summary?.refunded_amount)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>订单状态</Text><Text style={styles.rowValue}>{getObjectStatusMeta('order', detail.status).label}</Text></View>
          {detail.contract ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>合同状态</Text>
              <Text style={styles.rowValue}>
                {detail.contract.status === 'fully_signed'
                  ? '双方已签署'
                  : detail.contract.status === 'client_signed'
                    ? '客户已签署'
                    : detail.contract.status === 'provider_signed'
                      ? '服务方已签署'
                      : '待签署'}
              </Text>
            </View>
          ) : null}
        </ObjectCard>

        {!paymentReady ? (
          <ObjectCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>当前还不能支付</Text>
            <Text style={styles.sectionHint}>这笔订单的合同还没有完成双方签署，请先回到合同页完成确认。签署完成后，这里会自动恢复可支付状态。</Text>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Contract', {orderId: detail.id})}>
              <Text style={styles.secondaryBtnText}>查看合同</Text>
            </TouchableOpacity>
          </ObjectCard>
        ) : null}

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>支付方式</Text>
          <Text style={styles.sectionHint}>当前正式联调路径只有模拟支付。微信/支付宝在本阶段只保留占位支付单与接口字段，不会发起真实扣款。</Text>
          {METHODS.map(method => (
            <TouchableOpacity
              key={method.key}
              style={[styles.methodItem, selected === method.key && styles.methodItemActive]}
              onPress={() => setSelected(method.key)}>
              <Text style={styles.methodIcon}>{method.icon}</Text>
              <View style={styles.methodContent}>
                <Text style={styles.methodLabel}>{method.label}</Text>
                <Text style={styles.methodDesc}>{method.desc}</Text>
              </View>
              <View style={[styles.radio, selected === method.key && styles.radioActive]}>
                {selected === method.key ? <View style={styles.radioInner} /> : null}
              </View>
            </TouchableOpacity>
          ))}
          {selected !== 'mock' ? (
            <Text style={styles.sectionHint}>当前选择的是 {selectedMethod.label}，点击主按钮后只会生成待回调支付单；如需继续推进订单，请改用模拟支付。</Text>
          ) : null}
          <TouchableOpacity
            style={[styles.primaryBtn, (!canPay || paying) && styles.primaryBtnDisabled]}
            disabled={!canPay || paying}
            onPress={handlePay}>
            {paying ? <ActivityIndicator color={theme.btnPrimaryText} /> : <Text style={styles.primaryBtnText}>{primaryActionLabel}</Text>}
          </TouchableOpacity>
          {!canPay ? (
            <Text style={styles.sectionHint}>
              {paymentReady ? '当前订单状态不是待支付，不能重复发起支付。' : '当前合同尚未完成双方签署，暂时不能发起支付。'}
            </Text>
          ) : null}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>支付记录</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>当前还没有支付记录。</Text>
          ) : (
            payments.map(item => (
              <View key={item.id} style={styles.recordItem}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordCode}>{item.payment_no}</Text>
                  <StatusBadge label={({'paid':'已支付','pending':'待处理','refunded':'已退款','failed':'失败'} as Record<string,string>)[item.status || ''] || item.status || '未知'} tone={getPaymentStatusTone(item.status)} />
                </View>
                <Text style={styles.recordMeta}>{item.payment_method || '-'} · {formatMoney(item.amount)}</Text>
                <Text style={styles.recordMeta}>支付时间：{formatDateTime(item.paid_at || item.created_at)}</Text>
              </View>
            ))
          )}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>退款记录</Text>
          {refunds.length === 0 ? (
            <Text style={styles.emptyText}>当前还没有退款记录。退款处理请前往“售后处理”页面。</Text>
          ) : (
            refunds.map(item => (
              <View key={item.id} style={styles.recordItem}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordCode}>{item.refund_no}</Text>
                  <StatusBadge label={item.status || '未知'} tone={getRefundStatusTone(item.status)} />
                </View>
                <Text style={styles.recordMeta}>{formatMoney(item.amount)} · {item.reason || '未填写退款原因'}</Text>
                <Text style={styles.recordMeta}>更新时间：{formatDateTime(item.updated_at || item.created_at)}</Text>
              </View>
            ))
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
  heroTagRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  heroOrderNo: {
    marginTop: 12,
    fontSize: 13,
    color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  heroAmount: {
    marginTop: 14,
    fontSize: 32,
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
  resultCard: {
    marginBottom: 12,
    backgroundColor: theme.success + '22',
  },
  resultTitle: {
    fontSize: 17,
    color: theme.text,
    fontWeight: '800',
  },
  resultDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  resultActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
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
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  methodItemActive: {
    backgroundColor: theme.primaryBg,
  },
  methodIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  methodContent: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  methodDesc: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: theme.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.primary,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: theme.primary,
    paddingVertical: 13,
    alignItems: 'center',
  },
  resultPrimaryBtn: {
    flex: 1,
    marginTop: 0,
    borderRadius: 999,
    backgroundColor: theme.primary,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: theme.textHint,
  },
  primaryBtnText: {
    fontSize: 14,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: theme.card,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    color: theme.primaryText,
    fontWeight: '700',
  },
  recordItem: {
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.divider,
    padding: 12,
    marginTop: 10,
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
  recordMeta: {
    marginTop: 6,
    fontSize: 12,
    color: theme.textSub,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
});
