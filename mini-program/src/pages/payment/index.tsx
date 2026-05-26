import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { orderFinanceV2Service } from '../../services/orderFinanceV2';
import { orderV2Service } from '../../services/orderV2';
import './index.scss';

type PaymentMethodKey = 'wechat' | 'alipay' | 'mock';

const canUseMockPayment = () => {
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    const envVersion = Taro.getAccountInfoSync?.().miniProgram?.envVersion;
    return envVersion === 'develop' || envVersion === 'trial';
  } catch {
    return false;
  }
};

const basePaymentMethods: Array<{
  key: PaymentMethodKey;
  mark: string;
  label: string;
  desc: string;
}> = [
  {
    key: 'wechat',
    mark: 'WX',
    label: '微信支付',
    desc: '生成微信待支付单',
  },
  {
    key: 'alipay',
    mark: 'ALI',
    label: '支付宝',
    desc: '生成支付宝待支付单',
  },
  {
    key: 'mock',
    mark: 'DEV',
    label: '模拟支付',
    desc: '开发联调自动回写',
  },
];

export default function PaymentPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [errorText, setErrorText] = useState('');
  const [activeMethod, setActiveMethod] = useState<PaymentMethodKey | null>(null);
  const mockPaymentEnabled = canUseMockPayment();

  useDidShow(() => {
    if (!orderId) {
      setErrorText('缺少订单号，无法发起支付');
      return;
    }
    orderV2Service.get(orderId)
      .then(res => {
        setOrder(res as any);
        setErrorText('');
      })
      .catch((e: any) => {
        setErrorText(e?.message || '订单读取失败');
      });
  });

  const handlePay = async (method: PaymentMethodKey) => {
    if (!orderId) {
      Taro.showToast({ title: '缺少订单号', icon: 'none' });
      return;
    }
    if (method === 'mock' && !mockPaymentEnabled) {
      Taro.showToast({ title: '当前构建不允许模拟支付', icon: 'none' });
      return;
    }
    setLoading(true);
    setActiveMethod(method);
    try {
      const result = await orderFinanceV2Service.createPayment(orderId, method);
      const payment = (result as any)?.payment;
      const flow = (result as any)?.payment_flow;
      const paid = payment?.status === 'paid' || flow?.auto_completed || Boolean((result as any)?.order?.paid_at);

      if (paid) {
        Taro.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => {
          Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` }).catch(() => Taro.navigateBack());
        }, 900);
        return;
      }

      Taro.showModal({
        title: '支付单已创建',
        content: flow?.notice || '当前渠道等待支付回调确认，订单暂不会进入已支付状态。',
        confirmText: '查看订单',
        showCancel: false,
      }).then(() => {
        Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` }).catch(() => Taro.navigateBack());
      });
    } catch (e: any) {
      Taro.showToast({ title: e.message || '支付失败', icon: 'none' });
    } finally {
      setLoading(false);
      setActiveMethod(null);
    }
  };

  const amount = ((order?.total_amount || 0) / 100).toFixed(2);
  const visiblePaymentMethods = basePaymentMethods.filter(item => item.key !== 'mock' || mockPaymentEnabled);

  return (
    <View className="payment-wrap">
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

      <Text className="section-title">选择支付方式</Text>

      {errorText ? (
        <View className="payment-error">
          <Text className="payment-error-text">{errorText}</Text>
        </View>
      ) : null}

      {visiblePaymentMethods.map(method => (
        <View
          key={method.key}
          className={`payment-method ${activeMethod === method.key ? 'payment-method-active' : ''}`}
          onClick={() => !loading && handlePay(method.key)}
        >
          <View className="payment-method-left">
            <Text className={`payment-method-mark payment-method-mark-${method.key}`}>{method.mark}</Text>
            <View className="payment-method-copy">
              <Text className="payment-method-label">{method.label}</Text>
              <Text className="payment-method-desc">{method.desc}</Text>
            </View>
          </View>
          {loading && activeMethod === method.key && <Text className="payment-method-hint">处理中...</Text>}
        </View>
      ))}

      <View className="payment-notice">
        <Text className="payment-notice-text">
          {mockPaymentEnabled
            ? '当前为开发构建，可使用模拟支付完成联调；正式支付渠道需等待商户回调。'
            : '当前构建不开放模拟支付；支付结果以正式渠道回调为准。'}
        </Text>
      </View>
    </View>
  );
}
