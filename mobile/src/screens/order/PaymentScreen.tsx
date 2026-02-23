import React, {useState} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert,
} from 'react-native';
import {paymentService} from '../../services/payment';
import {Order} from '../../types';

type PaymentMethod = 'wechat' | 'alipay' | 'mock';

const METHODS: {key: PaymentMethod; label: string; icon: string; desc: string}[] = [
  {key: 'wechat', label: '微信支付', icon: '\ud83d\udcf1', desc: '使用微信完成支付'},
  {key: 'alipay', label: '支付宝', icon: '\ud83d\udcb3', desc: '使用支付宝完成支付'},
  {key: 'mock', label: '模拟支付', icon: '\ud83e\uddea', desc: '开发测试用，立即完成支付'},
];

export default function PaymentScreen({route, navigation}: any) {
  const order: Order = route.params?.order;
  const [selected, setSelected] = useState<PaymentMethod>('mock');
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<'success' | 'fail' | null>(null);

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{color: '#999'}}>订单信息缺失</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalPay = order.total_amount + order.deposit_amount;

  const handlePay = async () => {
    console.log('开始支付流程...');
    setPaying(true);
    try {
      console.log('创建支付记录, order.id:', order.id, 'method:', selected);
      const createRes = await paymentService.create(order.id, selected);
      console.log('创建支付成功:', createRes);
      const paymentNo = createRes.data?.payment?.payment_no;
      console.log('paymentNo:', paymentNo);

      if (!paymentNo) {
        throw new Error('获取支付单号失败');
      }

      if (selected === 'mock' && paymentNo) {
        console.log('执行模拟支付回调, paymentNo:', paymentNo);
        const callbackRes = await paymentService.mockCallback(paymentNo);
        console.log('模拟支付回调成功:', callbackRes);
        console.log('设置结果为 success');
        setResult('success');
        console.log('result 已设置为 success');
      } else if (paymentNo) {
        console.log('轮询支付状态...');
        // For real payment, we'd invoke native SDK here.
        // For now, poll payment status after a delay.
        let attempts = 0;
        const poll = async (): Promise<boolean> => {
          const statusRes = await paymentService.getStatus(paymentNo);
          console.log('支付状态:', statusRes.data?.status);
          if (statusRes.data?.status === 'paid') return true;
          if (++attempts < 10) {
            await new Promise(r => setTimeout(r, 2000));
            return poll();
          }
          return false;
        };
        const paid = await poll();
        console.log('轮询结果:', paid);
        setResult(paid ? 'success' : 'fail');
      }
    } catch (e: any) {
      console.error('支付失败:', e);
      console.error('错误详情:', e.message, e.response?.data);
      Alert.alert('支付失败', e.message || '请稍后重试');
      setResult('fail');
    } finally {
      console.log('支付流程结束, paying 设置为 false');
      setPaying(false);
    }
  };

  if (result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <Text style={styles.resultIcon}>{result === 'success' ? '\u2705' : '\u274c'}</Text>
          <Text style={styles.resultTitle}>
            {result === 'success' ? '支付成功' : '支付失败'}
          </Text>
          <Text style={styles.resultDesc}>
            {result === 'success'
              ? `已支付 \u00a5${(totalPay / 100).toFixed(2)}`
              : '支付未完成，请稍后重试'}
          </Text>
          <TouchableOpacity
            style={styles.resultBtn}
            onPress={() => {
              if (result === 'success') {
                navigation.goBack();
              } else {
                setResult(null);
              }
            }}>
            <Text style={styles.resultBtnText}>
              {result === 'success' ? '返回订单' : '重新支付'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>支付金额</Text>
          <Text style={styles.amountValue}>
            {'\u00a5'}{(totalPay / 100).toFixed(2)}
          </Text>
          <View style={styles.amountBreakdown}>
            <Text style={styles.breakdownText}>
              订单金额 {'\u00a5'}{(order.total_amount / 100).toFixed(2)}
            </Text>
            {order.deposit_amount > 0 && (
              <Text style={styles.breakdownText}>
                {' + '}押金 {'\u00a5'}{(order.deposit_amount / 100).toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Order info */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>订单号</Text>
            <Text style={styles.infoValue}>{order.order_no}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务</Text>
            <Text style={styles.infoValue}>{order.title}</Text>
          </View>
        </View>

        {/* Payment methods */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>选择支付方式</Text>
          {METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodItem, selected === m.key && styles.methodItemActive]}
              onPress={() => setSelected(m.key)}>
              <Text style={styles.methodIcon}>{m.icon}</Text>
              <View style={{flex: 1}}>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <Text style={styles.methodDesc}>{m.desc}</Text>
              </View>
              <View style={[styles.radio, selected === m.key && styles.radioActive]}>
                {selected === m.key && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pay button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.payBtn, paying && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={paying}>
          {paying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>
              确认支付 {'\u00a5'}{(totalPay / 100).toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  content: {flex: 1},

  // Amount
  amountCard: {backgroundColor: '#1890ff', padding: 24, alignItems: 'center'},
  amountLabel: {fontSize: 14, color: 'rgba(255,255,255,0.8)'},
  amountValue: {fontSize: 36, fontWeight: '700', color: '#fff', marginTop: 4},
  amountBreakdown: {flexDirection: 'row', marginTop: 8},
  breakdownText: {fontSize: 12, color: 'rgba(255,255,255,0.7)'},

  // Card
  card: {backgroundColor: '#fff', marginTop: 10, padding: 16},
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12},

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: {fontSize: 14, color: '#666'},
  infoValue: {fontSize: 14, color: '#333'},

  // Payment methods
  methodItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  methodItemActive: {backgroundColor: '#f0f8ff'},
  methodIcon: {fontSize: 24, marginRight: 12},
  methodLabel: {fontSize: 15, fontWeight: '500', color: '#333'},
  methodDesc: {fontSize: 12, color: '#999', marginTop: 2},
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#d9d9d9', justifyContent: 'center', alignItems: 'center',
  },
  radioActive: {borderColor: '#1890ff'},
  radioInner: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#1890ff'},

  // Bottom
  bottomBar: {
    backgroundColor: '#fff', padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#e8e8e8',
  },
  payBtn: {
    height: 48, backgroundColor: '#1890ff', borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  payBtnDisabled: {backgroundColor: '#91caff'},
  payBtnText: {color: '#fff', fontSize: 17, fontWeight: '600'},

  // Result
  resultContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40},
  resultIcon: {fontSize: 64, marginBottom: 16},
  resultTitle: {fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 8},
  resultDesc: {fontSize: 15, color: '#666', marginBottom: 32},
  resultBtn: {
    paddingHorizontal: 40, paddingVertical: 12, backgroundColor: '#1890ff',
    borderRadius: 24,
  },
  resultBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});
