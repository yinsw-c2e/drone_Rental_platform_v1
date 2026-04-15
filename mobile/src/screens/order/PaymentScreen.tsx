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
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import StatusBadge from '../../components/business/StatusBadge';
import {orderFinanceV2Service} from '../../services/orderFinanceV2';
import {orderV2Service} from '../../services/orderV2';
import {
  V2OrderDetail,
  V2PaymentSummary,
} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const METHODS = [
  {key: 'mock', label: '快速确认', icon: '✅', desc: '当前体验环境使用平台确认流程，提交后会立即返回支付结果'},
  {key: 'wechat', label: '微信支付', icon: '📱', desc: '微信支付通道接入中，暂不可直接完成付款'},
  {key: 'alipay', label: '支付宝', icon: '💳', desc: '支付宝通道接入中，暂不可直接完成付款'},
] as const;

type PaymentMethod = (typeof METHODS)[number]['key'];
type ResultState = {
  mode: 'success' | 'pending' | 'fail';
  title: string;
  desc: string;
};

const formatMoney = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;

const getPaymentStatusTone = (status?: string | null) => {
  switch (String(status || '').toLowerCase()) {
    case 'paid': return 'green';
    case 'pending': return 'orange';
    case 'refunded': return 'gray';
    case 'failed': return 'red';
    default: return 'gray';
  }
};

export default function PaymentScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const orderId = Number(route.params?.orderId || route.params?.id || 0);

  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [payments, setPayments] = useState<V2PaymentSummary[]>([]);
  const [selected, setSelected] = useState<PaymentMethod>('mock');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  const loadData = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    try {
      const [orderRes, paymentRes] = await Promise.all([
        orderV2Service.get(orderId),
        orderFinanceV2Service.listPayments(orderId),
      ]);
      setDetail(orderRes.data || null);
      setPayments(paymentRes.data?.items || []);
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
    if (!detail) return 0;
    return Number(detail.total_amount || 0) + Number(detail.financial_summary?.deposit_amount || 0);
  }, [detail]);

  const canPay = !!detail && (detail.status === 'pending_payment' || detail.status === 'accepted') && !detail.paid_at;
  const primaryActionLabel = selected === 'mock'
    ? `确认支付 ${formatMoney(totalPay)}`
    : `确认支付 ${formatMoney(totalPay)}`;

  const handlePay = async () => {
    if (!detail) return;
    setPaying(true);
    try {
      const res = await orderFinanceV2Service.createPayment(detail.id, selected);
      const latestPayment = res.data?.payment;
      const paymentFlow = res.data?.payment_flow;

      if ((paymentFlow?.auto_completed || selected === 'mock') && String(latestPayment?.status || '').toLowerCase() === 'paid') {
        setResult({
          mode: 'success',
          title: '支付完成',
          desc: `订单 ${detail.order_no} 已支付 ${formatMoney(totalPay)}。系统已实时通知承接方。`,
        });
      } else {
        setResult({
          mode: 'pending',
          title: '支付单已创建',
          desc: `支付单号 ${latestPayment?.payment_no || '-'}。支付渠道确认后，页面会自动刷新最新状态。`,
        });
      }
      await loadData();
    } catch (error: any) {
      setResult({
        mode: 'fail',
        title: '支付失败',
        desc: error?.message || '支付通道建立失败，请重试。',
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
          <Text style={styles.stateText}>安全支付网关加载中...</Text>
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
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bgSecondary}]}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>˂ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>收银台</Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} />}
      >
        <View style={styles.checkoutHero}>
          <Text style={styles.checkoutLabel}>应付总额</Text>
          <Text style={styles.checkoutAmount}>{formatMoney(totalPay)}</Text>
          <View style={styles.checkoutOrderInfo}>
            <Text style={styles.checkoutOrderNo}>NO. {detail.order_no}</Text>
            <View style={styles.checkoutOrderDivider} />
            <Text style={styles.checkoutOrderTitle} numberOfLines={1}>{detail.title}</Text>
          </View>
        </View>

        {result ? (
          <View style={[styles.resultBanner, result.mode === 'success' ? styles.resultBannerSuccess : styles.resultBannerError]}>
            <View style={styles.resultIconWrap}>
              <Text style={styles.resultEmoji}>{result.mode === 'success' ? '✅' : '⚠️'}</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.resultTitle}>{result.title}</Text>
              <Text style={styles.resultDesc}>{result.desc}</Text>
            </View>
            <TouchableOpacity
              style={styles.resultActionBtn}
              onPress={() => navigation.navigate('OrderDetail', {id: detail.id, orderId: detail.id})}>
              <Text style={styles.resultActionText}>查看进度</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>选择支付方式</Text>
          <View style={styles.methodList}>
            {METHODS.map(method => (
              <TouchableOpacity
                key={method.key}
                style={[styles.methodRow, selected === method.key && styles.methodRowActive]}
                onPress={() => setSelected(method.key)}>
                <View style={[styles.methodIconBox, {backgroundColor: method.key === 'mock' ? theme.primaryBg : theme.bgSecondary}]}>
                  <Text style={styles.methodEmoji}>{method.icon}</Text>
                </View>
                <View style={styles.methodMain}>
                  <Text style={styles.methodTitle}>{method.label}</Text>
                  <Text style={styles.methodSubtitle}>{method.desc}</Text>
                </View>
                <View style={[styles.customRadio, selected === method.key && styles.customRadioActive]}>
                  {selected === method.key && <View style={styles.customRadioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

        {selected === 'mock' && (
          <View style={styles.sandboxNotice}>
            <Text style={styles.sandboxTitle}>✅ 当前可使用快速确认</Text>
            <Text style={styles.sandboxText}>提交后会直接返回支付结果，方便你继续查看后续订单进度。</Text>
          </View>
        )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>费用拆分</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>运输服务费 (含税)</Text>
            <Text style={styles.priceValue}>{formatMoney(detail.total_amount)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>履约保证金 (任务完结后自动返还)</Text>
            <Text style={styles.priceValue}>{formatMoney(detail.financial_summary?.deposit_amount || 0)}</Text>
          </View>
          <View style={[styles.priceRow, styles.priceRowTotal]}>
            <Text style={styles.priceLabelTotal}>合计应付</Text>
            <Text style={styles.priceValueTotal}>{formatMoney(totalPay)}</Text>
          </View>
        </View>

        {payments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>最近流水</Text>
            {payments.map(item => (
              <View key={item.id} style={styles.paymentRecord}>
                <View style={styles.recordTop}>
                  <Text style={styles.recordNo}>{item.payment_no}</Text>
                  <StatusBadge label={({'paid':'支付成功','pending':'待确认','refunded':'已退款','failed':'失败'} as Record<string,string>)[item.status || ''] || item.status || '未知'} tone={getPaymentStatusTone(item.status) as any} />
                </View>
                <View style={styles.recordBottom}>
                  <Text style={styles.recordType}>{item.payment_method === 'mock' ? '快速确认' : item.payment_method}</Text>
                  <Text style={styles.recordAmount}>{formatMoney(item.amount)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{height: 120}} />
      </ScrollView>

      <View style={styles.footerAction}>
        <TouchableOpacity
          style={[styles.payBtn, (!canPay || paying) && styles.payBtnDisabled]}
          disabled={!canPay || paying}
          onPress={handlePay}>
          {paying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.payBtnText}>{primaryActionLabel}</Text>}
        </TouchableOpacity>
        {!canPay && <Text style={styles.payTip}>订单当前状态暂不开放支付</Text>}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1},
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: theme.bg,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  backBtn: {width: 60},
  backText: {fontSize: 16, color: theme.primaryText, fontWeight: '600'},
  headerTitle: {fontSize: 17, fontWeight: '800', color: theme.text},
  centerState: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40},
  stateText: {marginTop: 16, fontSize: 14, color: theme.textSub},
  content: {padding: 16},

  checkoutHero: {
    backgroundColor: theme.card, borderRadius: 24, padding: 24,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: theme.divider,
  },
  checkoutLabel: {fontSize: 13, color: theme.textSub, fontWeight: '600'},
  checkoutAmount: {fontSize: 36, fontWeight: '900', color: theme.text, marginTop: 10, marginBottom: 16},
  checkoutOrderInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.bgSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  checkoutOrderNo: {fontSize: 11, color: theme.textHint, fontWeight: '700'},
  checkoutOrderDivider: {width: 1, height: 10, backgroundColor: theme.divider},
  checkoutOrderTitle: {fontSize: 12, color: theme.textSub, fontWeight: '600', maxWidth: 160},

  resultBanner: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20,
    marginBottom: 16, borderWidth: 1, gap: 12,
  },
  resultBannerSuccess: {backgroundColor: theme.success + '10', borderColor: theme.success + '20'},
  resultBannerError: {backgroundColor: theme.danger + '10', borderColor: theme.danger + '20'},
  resultIconWrap: {width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center'},
  resultEmoji: {fontSize: 20},
  resultTitle: {fontSize: 15, fontWeight: '800', color: theme.text},
  resultDesc: {fontSize: 12, color: theme.textSub, marginTop: 4, lineHeight: 18},
  resultActionBtn: {backgroundColor: theme.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8},
  resultActionText: {fontSize: 12, fontWeight: '700', color: theme.primaryText},

  card: {
    backgroundColor: theme.card, borderRadius: 20, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: theme.divider,
  },
  sectionTitle: {fontSize: 15, fontWeight: '800', color: theme.text, marginBottom: 16},
  methodList: {gap: 12},
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 16, backgroundColor: theme.bgSecondary,
    borderWidth: 1, borderColor: 'transparent',
  },
  methodRowActive: {borderColor: theme.primary, backgroundColor: theme.primaryBg},
  methodIconBox: {width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  methodEmoji: {fontSize: 20},
  methodMain: {flex: 1},
  methodTitle: {fontSize: 15, fontWeight: '700', color: theme.text},
  methodSubtitle: {fontSize: 11, color: theme.textHint, marginTop: 2},
  customRadio: {width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.divider, alignItems: 'center', justifyContent: 'center'},
  customRadioActive: {borderColor: theme.primary},
  customRadioInner: {width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary},

  sandboxNotice: {
    marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: theme.primaryBg, borderWidth: 1, borderColor: theme.primaryBorder,
  },
  sandboxTitle: {fontSize: 13, fontWeight: '800', color: theme.primaryText, marginBottom: 4},
  sandboxText: {fontSize: 12, color: theme.textSub, lineHeight: 18},

  priceRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8},
  priceLabel: {fontSize: 13, color: theme.textSub, fontWeight: '500'},
  priceValue: {fontSize: 14, color: theme.text, fontWeight: '700'},
  priceRowTotal: {marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.divider},
  priceLabelTotal: {fontSize: 15, color: theme.text, fontWeight: '800'},
  priceValueTotal: {fontSize: 20, color: theme.danger, fontWeight: '900'},

  paymentRecord: {
    backgroundColor: theme.bgSecondary, padding: 14, borderRadius: 14,
    marginBottom: 10, borderWidth: 1, borderColor: theme.divider,
  },
  recordTop: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  recordNo: {fontSize: 11, color: theme.textHint, fontWeight: '700'},
  recordBottom: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  recordType: {fontSize: 13, color: theme.text, fontWeight: '600'},
  recordAmount: {fontSize: 14, color: theme.text, fontWeight: '800'},

  footerAction: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.card, padding: 16, borderTopWidth: 1, borderTopColor: theme.divider,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  payBtn: {
    height: 52, borderRadius: 16, backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.primary, shadowOpacity: 0.2, shadowOffset: {width: 0, height: 4}, shadowRadius: 8, elevation: 4,
  },
  payBtnDisabled: {backgroundColor: theme.divider, opacity: 0.6},
  payBtnText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
  payTip: {marginTop: 8, fontSize: 11, color: theme.textHint, textAlign: 'center'},
});
