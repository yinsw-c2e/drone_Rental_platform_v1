import Taro, { useDidShow } from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { listMyWithdrawals } from '../../../services/settlement';
import { RootState } from '../../../store/store';
import { formatUnknownEnumLabel } from '../../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import './index.scss';

const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  pending: { label: '待审核', tone: 'orange' },
  processing: { label: '处理中', tone: 'blue' },
  completed: { label: '已完成', tone: 'green' },
  failed: { label: '失败', tone: 'red' },
  rejected: { label: '已驳回', tone: 'red' },
};

const METHOD_MAP: Record<string, string> = {
  bank_card: '银行卡',
  alipay: '支付宝',
  wechat: '微信',
};

export default function WithdrawalListPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canUseProviderFinance = Boolean(isAuthenticated && providerCapabilities.canUseWorkbench);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (!canUseProviderFinance) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listMyWithdrawals(1, 100).then(res => {
      setList(res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  });

  if (!canUseProviderFinance) {
    return (
      <ProviderAccessNotice
        title={isAuthenticated ? '服务商财务未开通' : '请先登录服务商账号'}
        description={isAuthenticated ? '服务商资质审核通过后，才能查看提现记录。' : '登录后才能查看服务商提现记录。'}
        actionText={isAuthenticated ? '查看服务商入驻' : undefined}
        onAction={isAuthenticated ? () => Taro.navigateTo({ url: '/pages/provider/onboarding/index' }) : undefined}
      />
    );
  }

  return (
    <ScrollView scrollY className="page-wrap">
      {loading ? (
        <View className="empty-state"><Text className="empty-state-text">加载中...</Text></View>
      ) : list.length === 0 ? (
        <View className="empty-state"><Text className="empty-state-text">暂无提现记录</Text></View>
      ) : (
        list.map(item => {
          const info = STATUS_MAP[item.status] || { label: formatUnknownEnumLabel(item.status, '状态未知'), tone: 'gray' };
          const methodName = METHOD_MAP[item.withdraw_method] || formatUnknownEnumLabel(item.withdraw_method, '提现账户');
          return (
            <View key={item.id} className="wd-item">
              <View className="wd-header">
                <Text className="wd-title">提现到 {methodName}</Text>
                <View className={`status-badge badge-${info.tone}`}>
                  <Text className={`status-text text-${info.tone}`}>{info.label}</Text>
                </View>
              </View>
              <Text className="wd-amount">¥{((item.amount || 0) / 100).toFixed(2)}</Text>
              <View className="wd-footer">
                <Text className="wd-time">{new Date(item.created_at).toLocaleString()}</Text>
                <Text className="wd-no">单号: {item.withdrawal_no}</Text>
              </View>
              {item.review_notes && (
                <View className="wd-notes"><Text className="wd-notes-text">备注: {item.review_notes}</Text></View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
