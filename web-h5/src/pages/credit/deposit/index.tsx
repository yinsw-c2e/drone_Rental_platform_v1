import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { creditService } from '../../../services/credit';
import { formatUnknownEnumLabel } from '../../../utils';
import './index.scss';

const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  pending: { label: '待缴纳', tone: 'orange' },
  paid: { label: '已缴纳', tone: 'green' },
  frozen: { label: '已冻结', tone: 'red' },
  refunding: { label: '退款中', tone: 'blue' },
  refunded: { label: '已退还', tone: 'gray' },
};

export default function DepositPage() {
  const [deposit, setDeposit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(true);
    creditService.getMyDeposit().then(res => {
      setDeposit(res.data || res);
    }).catch(() => {}).finally(() => setLoading(false));
  });

  if (loading) return <View className="page-wrap"><Text className="loading">加载中...</Text></View>;
  if (!deposit) return <View className="page-wrap"><View className="empty"><Text className="empty-text">暂无保证金记录</Text></View></View>;

  const statusInfo = STATUS_MAP[deposit.status] || { label: formatUnknownEnumLabel(deposit.status, '状态未知'), tone: 'gray' };

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="deposit-card">
        <Text className="d-title">保证金余额</Text>
        <Text className="d-amount">¥{((deposit.paid_amount || 0) / 100).toFixed(2)}</Text>
        <View className="d-status-row">
          <Text className="d-status-label">当前状态</Text>
          <View className={`badge badge-${statusInfo.tone}`}><Text className={`badge-text text-${statusInfo.tone}`}>{statusInfo.label}</Text></View>
        </View>
      </View>

      <View className="d-info-list">
        <View className="d-info-item">
          <Text className="d-info-label">应缴金额</Text>
          <Text className="d-info-value">¥{((deposit.required_amount || 0) / 100).toFixed(2)}</Text>
        </View>
        <View className="d-info-item">
          <Text className="d-info-label">冻结金额</Text>
          <Text className="d-info-value" style={{ color: '#EF4444' }}>¥{((deposit.frozen_amount || 0) / 100).toFixed(2)}</Text>
        </View>
        <View className="d-info-item">
          <Text className="d-info-label">已退金额</Text>
          <Text className="d-info-value">¥{((deposit.refunded_amount || 0) / 100).toFixed(2)}</Text>
        </View>
      </View>

      {deposit.status === 'pending' && (
        <View className="btn-wrap">
          <View className="btn-primary" onClick={() => Taro.showToast({ title: '保证金缴纳暂未开放', icon: 'none' })}>
            <Text className="btn-text">缴纳保证金</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
