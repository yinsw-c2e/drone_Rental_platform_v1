import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { orderFinanceV2Service } from '../../services/orderFinanceV2';
import { orderV2Service } from '../../services/orderV2';
import './index.scss';

export default function PaymentPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  useDidShow(() => {
    if (orderId) orderV2Service.get(orderId).then(res => setOrder(res as any)).catch(() => {});
  });

  const handlePay = async (method: string) => {
    setLoading(true);
    setActiveMethod(method);
    try {
      await orderFinanceV2Service.createPayment(orderId, method);
      Taro.showToast({ title: '支付成功!', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '支付失败', icon: 'none' });
    } finally { setLoading(false); setActiveMethod(null); }
  };

  const amount = ((order?.total_amount || 0) / 100).toFixed(2);

  return (
    <View className="payment-wrap">
      {/* ── 订单摘要卡片 ── */}
      <View className="card payment-summary-card">
        <Text className="section-title">收银台</Text>
        <View className="detail-row">
          <Text className="detail-row-label">订单金额</Text>
          <Text className="payment-amount">¥{amount}</Text>
        </View>
        <View className="detail-row" style={{ borderBottomWidth: 0 }}>
          <Text className="detail-row-label">订单号</Text>
          <Text className="detail-row-value">{order?.order_no || '-'}</Text>
        </View>
      </View>

      {/* ── 支付方式 ── */}
      <Text className="section-title">选择支付方式</Text>

      <View className={`payment-method ${activeMethod === 'wechat' ? 'payment-method-active' : ''}`}
        onClick={() => handlePay('wechat')}>
        <View className="payment-method-left">
          <Text className="payment-method-icon">💚</Text>
          <Text className="payment-method-label">微信支付</Text>
        </View>
        {loading && activeMethod === 'wechat' && <Text className="payment-method-hint">处理中...</Text>}
      </View>

      <View className={`payment-method ${activeMethod === 'alipay' ? 'payment-method-active' : ''}`}
        onClick={() => handlePay('alipay')}>
        <View className="payment-method-left">
          <Text className="payment-method-icon">💙</Text>
          <Text className="payment-method-label">支付宝</Text>
        </View>
        {loading && activeMethod === 'alipay' && <Text className="payment-method-hint">处理中...</Text>}
      </View>

      <View className={`payment-method ${activeMethod === 'mock' ? 'payment-method-active' : ''}`}
        onClick={() => handlePay('mock')}>
        <View className="payment-method-left">
          <Text className="payment-method-icon">🧪</Text>
          <Text className="payment-method-label">模拟支付（测试）</Text>
        </View>
        {loading && activeMethod === 'mock' && <Text className="payment-method-hint">处理中...</Text>}
      </View>
    </View>
  );
}
