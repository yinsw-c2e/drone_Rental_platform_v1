import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import { RichText, ScrollView, Text, View } from '@tarojs/components';
import { orderFinanceV2Service } from '../../../services/orderFinanceV2';
import { store } from '../../../store/store';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const statusLabelOf = (status?: string) => {
  if (status === 'pending') return '待签署';
  if (status === 'client_signed') return '客户已签署';
  if (status === 'provider_signed') return '服务方已签署';
  if (status === 'fully_signed') return '双方已签署';
  if (status === 'voided') return '已作废';
  return status || '合同状态未知';
};

const formatMoney = (value?: number) =>
  `¥${(Number(value || 0) / 100).toFixed(2)}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return '待签署';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
};

export default function ContractPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [contract, setContract] = useState<any | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [errorText, setErrorText] = useState('');
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setContract(null);
      setErrorText('缺少订单信息，无法读取合同');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText('');
    try {
      const res = await orderFinanceV2Service.getContract(orderId);
      const data = (res as any)?.data || res;
      if (!data?.id) {
        setContract(null);
        setErrorText('合同尚未生成');
        return;
      }
      setContract(data);
    } catch (error: any) {
      setContract(null);
      setErrorText(friendlyErrorMessage(error, '合同加载失败'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useDidShow(() => {
    load();
  });

  const currentUserId = Number(store.getState().auth.user?.id || 0);
  const isClient = currentUserId > 0 && currentUserId === Number(contract?.client_user_id || 0);
  const fullySigned = contract?.status === 'fully_signed';
  const canSign = Boolean(contract?.can_sign) && !fullySigned;

  const handlePrimary = async () => {
    if (!contract) return;
    if (fullySigned) {
      if (isClient && contract.order_status === 'pending_payment') {
        Taro.redirectTo({ url: `/pages/payment/index?orderId=${orderId}` });
        return;
      }
      Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
      return;
    }
    if (!canSign) {
      Taro.showToast({ title: contract.sign_block_reason || '当前暂不可签署', icon: 'none' });
      return;
    }
    const confirm = await Taro.showModal({
      title: '确认签署',
      content: '确认以当前账号签署这份电子合同？',
      confirmText: '签署',
      cancelText: '取消',
    }).catch(() => null);
    if (!confirm?.confirm) return;

    setSigning(true);
    try {
      const res = await orderFinanceV2Service.signContract(orderId);
      const data = (res as any)?.data || res;
      setContract(data);
      Taro.showToast({ title: '已签署', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '签署失败'), icon: 'none' });
    } finally {
      setSigning(false);
    }
  };

  const primaryText = fullySigned
    ? (isClient && contract?.order_status === 'pending_payment' ? '去支付' : '返回订单')
    : canSign
      ? (signing ? '签署中...' : '签署合同')
      : (contract?.sign_block_reason || '等待签署条件');

  return (
    <View className="contract-page">
      <View className="contract-hero">
        <Text className="contract-hero-title">电子合同</Text>
        <Text className="contract-hero-desc">查看并签署运输协议</Text>
      </View>

      <ScrollView scrollY className="contract-scroll">
        {!contract ? (
          <View className="contract-empty">
            <Text className="contract-empty-title">{loading ? '合同加载中' : '无法读取合同'}</Text>
            <Text className="contract-empty-desc">{loading ? '请稍候，正在同步合同数据。' : errorText}</Text>
          </View>
        ) : (
          <View className="contract-body">
            <View className="contract-card">
              <View className="contract-title-row">
                <Text className="contract-title">{contract.title || '无人机服务合同'}</Text>
                <Text className={`contract-status contract-status-${contract.status || 'unknown'}`}>
                  {statusLabelOf(contract.status)}
                </Text>
              </View>
              <View className="contract-row">
                <Text className="contract-label">合同编号</Text>
                <Text className="contract-value">{contract.contract_no || '-'}</Text>
              </View>
              <View className="contract-row">
                <Text className="contract-label">订单号</Text>
                <Text className="contract-value">{contract.order_no || '-'}</Text>
              </View>
              <View className="contract-row">
                <Text className="contract-label">合同金额</Text>
                <Text className="contract-value contract-amount">{formatMoney(contract.contract_amount)}</Text>
              </View>
              <View className="contract-row">
                <Text className="contract-label">客户签署</Text>
                <Text className="contract-value">{formatDateTime(contract.client_signed_at)}</Text>
              </View>
              <View className="contract-row contract-row-last">
                <Text className="contract-label">服务方签署</Text>
                <Text className="contract-value">{formatDateTime(contract.provider_signed_at)}</Text>
              </View>
            </View>

            <View className="contract-card contract-html-card">
              <Text className="contract-section-title">合同正文</Text>
              <RichText className="contract-html" nodes={contract.contract_html || '<p>暂无合同正文</p>'} />
            </View>
          </View>
        )}
      </ScrollView>

      {contract ? (
        <View className="contract-footer">
          <View
            className={`contract-primary ${(!canSign && !fullySigned) || signing ? 'contract-primary-disabled' : ''}`}
            onClick={handlePrimary}
          >
            <Text className="contract-primary-text">{primaryText}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
