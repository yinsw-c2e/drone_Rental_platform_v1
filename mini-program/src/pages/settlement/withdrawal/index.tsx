import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { requestWithdrawal } from '../../../services/settlement';
import { RootState } from '../../../store/store';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import './index.scss';

const METHODS = [
  { key: 'bank_card', label: '银行卡' },
  { key: 'alipay', label: '支付宝' },
  { key: 'wechat', label: '微信' },
];

export default function WithdrawalPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canUseProviderFinance = Boolean(isAuthenticated && providerCapabilities.canUseWorkbench);
  const [method, setMethod] = useState('bank_card');
  const [amountStr, setAmountStr] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [alipayAccount, setAlipayAccount] = useState('');
  const [wechatAccount, setWechatAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!canUseProviderFinance) {
      Taro.showToast({ title: '服务商财务开通后才能提现', icon: 'none' });
      return;
    }
    const amount = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amount) || amount <= 0) return Taro.showToast({ title: '请输入正确的金额', icon: 'none' });
    if (amount <= 100) return Taro.showToast({ title: '最低提现2元', icon: 'none' });

    if (method === 'bank_card') {
      if (!bankName.trim()) return Taro.showToast({ title: '请输入银行名称', icon: 'none' });
      if (!accountNo.trim()) return Taro.showToast({ title: '请输入银行卡号', icon: 'none' });
      if (!accountName.trim()) return Taro.showToast({ title: '请输入持卡人姓名', icon: 'none' });
    } else if (method === 'alipay') {
      if (!alipayAccount.trim()) return Taro.showToast({ title: '请输入支付宝账号', icon: 'none' });
    } else if (method === 'wechat') {
      if (!wechatAccount.trim()) return Taro.showToast({ title: '请输入微信账号', icon: 'none' });
    }

    setSubmitting(true);
    try {
      Taro.showLoading({ title: '提交中' });
      await requestWithdrawal({
        amount, method, bank_name: bankName, bank_branch: bankBranch,
        account_no: accountNo, account_name: accountName, alipay_account: alipayAccount, wechat_account: wechatAccount
      });
      Taro.hideLoading();
      Taro.showToast({ title: '提现申请已提交', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: e.message || '提现失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canUseProviderFinance) {
    return (
      <ProviderAccessNotice
        title={isAuthenticated ? '服务商财务未开通' : '请先登录服务商账号'}
        description={isAuthenticated ? '服务商资质审核通过并产生可提现余额后，才能提交提现申请。' : '登录后才能提交服务商提现申请。'}
        actionText={isAuthenticated ? '查看服务商入驻' : undefined}
        onAction={isAuthenticated ? () => Taro.navigateTo({ url: '/pages/provider/onboarding/index' }) : undefined}
      />
    );
  }

  return (
    <View className="page-wrap">
      <ScrollView scrollY className="form-content">
        <Text className="section-title">提现金额</Text>
        <View className="amount-row">
          <Text className="amount-prefix">¥</Text>
          <Input className="amount-input" type="digit" placeholder="0.00" value={amountStr} onInput={e => setAmountStr(e.detail.value)} />
        </View>
        <Text className="hint">手续费: 0.1% (最低1元)，最低提现2元</Text>

        <Text className="section-title">提现方式</Text>
        <View className="method-row">
          {METHODS.map(m => (
            <View key={m.key} className={`method-chip ${method === m.key ? 'active' : ''}`} onClick={() => setMethod(m.key)}>
              <Text className={`method-text ${method === m.key ? 'active-text' : ''}`}>{m.label}</Text>
            </View>
          ))}
        </View>

        <View className="form-group">
          {method === 'bank_card' && (
            <View>
              <View className="form-item"><Text className="form-label">银行名称</Text><Input className="form-input" placeholder="例如：招商银行" value={bankName} onInput={e => setBankName(e.detail.value)} /></View>
              <View className="form-item"><Text className="form-label">支行名称</Text><Input className="form-input" placeholder="选填，例如：高新支行" value={bankBranch} onInput={e => setBankBranch(e.detail.value)} /></View>
              <View className="form-item"><Text className="form-label">银行卡号</Text><Input className="form-input" type="number" placeholder="输入银行卡号" value={accountNo} onInput={e => setAccountNo(e.detail.value)} /></View>
              <View className="form-item border-none"><Text className="form-label">持卡人姓名</Text><Input className="form-input" placeholder="输入持卡人姓名" value={accountName} onInput={e => setAccountName(e.detail.value)} /></View>
            </View>
          )}
          {method === 'alipay' && (
            <View className="form-item border-none"><Text className="form-label">支付宝账号</Text><Input className="form-input" placeholder="输入支付宝账号(手机号或邮箱)" value={alipayAccount} onInput={e => setAlipayAccount(e.detail.value)} /></View>
          )}
          {method === 'wechat' && (
            <View className="form-item border-none"><Text className="form-label">微信账号</Text><Input className="form-input" placeholder="输入微信号或绑定的手机号" value={wechatAccount} onInput={e => setWechatAccount(e.detail.value)} /></View>
          )}
        </View>

        <View className={`btn-primary ${submitting ? 'disabled' : ''}`} onClick={handleSubmit}>
          <Text className="btn-text">确认提现</Text>
        </View>
      </ScrollView>
    </View>
  );
}
