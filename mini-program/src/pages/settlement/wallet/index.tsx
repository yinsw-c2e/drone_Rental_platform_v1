import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { getWallet, getWalletTransactions, listMySettlements } from '../../../services/settlement';
import { formatUnknownEnumLabel } from '../../../utils';
import './index.scss';

const TX_TYPE_MAP: Record<string, { label: string; tone: string; sign: string }> = {
  income: { label: '收入', tone: 'green', sign: '+' },
  withdraw: { label: '提现', tone: 'red', sign: '-' },
  freeze: { label: '冻结', tone: 'orange', sign: '-' },
  unfreeze: { label: '解冻', tone: 'blue', sign: '+' },
  deduct: { label: '扣款', tone: 'red', sign: '-' },
  refund: { label: '退款', tone: 'green', sign: '+' },
};

const SETTLEMENT_STATUS_MAP: Record<string, { label: string; tone: string }> = {
  pending: { label: '待计算', tone: 'gray' },
  calculated: { label: '已计算', tone: 'orange' },
  confirmed: { label: '已确认', tone: 'blue' },
  settled: { label: '已结算', tone: 'green' },
  disputed: { label: '争议中', tone: 'red' },
};

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'settlements'>('overview');
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [walletData, txData, settleData] = await Promise.all([
        getWallet().catch(() => null),
        getWalletTransactions({ page: 1, page_size: 50 }).catch(() => ({ data: [] })),
        listMySettlements({ page: 1, page_size: 50 }).catch(() => ({ data: [] })),
      ]);
      setWallet(walletData);
      setTransactions(txData.data || []);
      setSettlements(settleData.data || []);
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    loadData();
  });

  const formatAmount = (amountFen: number) => {
    return ((amountFen || 0) / 100).toFixed(2);
  };

  const renderWalletCard = () => {
    if (!wallet) return null;
    return (
      <View className="wallet-card">
        <Text className="wallet-label">可用余额(元)</Text>
        <Text className="wallet-balance">{formatAmount(wallet.available_balance)}</Text>
        <View className="wallet-stats">
          <View className="stat-item">
            <Text className="stat-label">冻结金额</Text>
            <Text className="stat-value">{formatAmount(wallet.frozen_balance)}</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <Text className="stat-label">累计收入</Text>
            <Text className="stat-value highlight">{formatAmount(wallet.total_income)}</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <Text className="stat-label">累计提现</Text>
            <Text className="stat-value">{formatAmount(wallet.total_withdrawn)}</Text>
          </View>
        </View>
        <View className="btn-withdraw" onClick={() => Taro.navigateTo({ url: '/pages/settlement/withdrawal/index' })}>
          <Text className="btn-withdraw-text">提现</Text>
        </View>
      </View>
    );
  };

  const renderTxItem = (tx: any) => {
    const info = TX_TYPE_MAP[tx.type] || { label: formatUnknownEnumLabel(tx.type, '资金变动'), tone: 'gray', sign: '' };
    return (
      <View key={tx.id} className="tx-item">
        <View className="tx-left">
          <Text className="tx-desc">{tx.description || info.label}</Text>
          <Text className="tx-time">{new Date(tx.created_at).toLocaleString()}</Text>
        </View>
        <View className="tx-right">
          <Text className={`tx-amount tx-${info.tone}`}>{info.sign}{formatAmount(Math.abs(tx.amount))}</Text>
        </View>
      </View>
    );
  };

  const renderSettleItem = (item: any) => {
    const info = SETTLEMENT_STATUS_MAP[item.status] || { label: formatUnknownEnumLabel(item.status, '状态未知'), tone: 'gray' };
    return (
      <View key={item.id} className="settle-card">
        <View className="settle-header">
          <Text className="settle-title">订单 {item.order_no}</Text>
          <View className={`status-badge badge-${info.tone}`}><Text className={`status-text text-${info.tone}`}>{info.label}</Text></View>
        </View>
        <View className="settle-body">
          <View className="settle-row"><Text className="s-label">订单总额</Text><Text className="s-value">{formatAmount(item.final_amount)}元</Text></View>
          <View className="settle-row"><Text className="s-label">平台服务费({(item.platform_fee_rate * 100).toFixed(0)}%)</Text><Text className="s-value s-red">-{formatAmount(item.platform_fee)}</Text></View>
          {item.pilot_fee > 0 && <View className="settle-row"><Text className="s-label">飞手劳务费({(item.pilot_fee_rate * 100).toFixed(0)}%)</Text><Text className="s-value s-green">{formatAmount(item.pilot_fee)}</Text></View>}
          {item.owner_fee > 0 && <View className="settle-row"><Text className="s-label">机主设备费({(item.owner_fee_rate * 100).toFixed(0)}%)</Text><Text className="s-value s-green">{formatAmount(item.owner_fee)}</Text></View>}
        </View>
        <Text className="settle-time">{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    );
  };

  return (
    <View className="page-wrap">
      <View className="tabs-header">
        <View className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}><Text className="tab-text">概览</Text></View>
        <View className={`tab-item ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}><Text className="tab-text">流水</Text></View>
        <View className={`tab-item ${activeTab === 'settlements' ? 'active' : ''}`} onClick={() => setActiveTab('settlements')}><Text className="tab-text">结算</Text></View>
      </View>
      <ScrollView scrollY className="tab-content">
        {loading ? (
          <View className="empty-state"><Text className="empty-state-text">加载中...</Text></View>
        ) : (
          <>
            {activeTab === 'overview' && (
              <View className="overview-container">
                {renderWalletCard()}
                <View className="quick-actions">
                  <View className="action-item" onClick={() => setActiveTab('transactions')}>
                    <Text className="action-icon">💰</Text>
                    <Text className="action-label">全部流水</Text>
                  </View>
                  <View className="action-item" onClick={() => setActiveTab('settlements')}>
                    <Text className="action-icon">🧾</Text>
                    <Text className="action-label">结算明细</Text>
                  </View>
                  <View className="action-item" onClick={() => Taro.navigateTo({ url: '/pages/settlement/withdrawal/index' })}>
                    <Text className="action-icon">🏦</Text>
                    <Text className="action-label">我要提现</Text>
                  </View>
                  <View className="action-item" onClick={() => Taro.navigateTo({ url: '/pages/settlement/withdrawal-list/index' })}>
                    <Text className="action-icon">📜</Text>
                    <Text className="action-label">提现记录</Text>
                  </View>
                </View>
                <Text className="section-title">最近流水</Text>
                {transactions.slice(0, 5).map(renderTxItem)}
                {transactions.length === 0 && <View className="empty-state"><Text className="empty-state-text">暂无流水记录</Text></View>}
              </View>
            )}
            {activeTab === 'transactions' && (
              <View className="tx-list">
                {transactions.map(renderTxItem)}
                {transactions.length === 0 && <View className="empty-state"><Text className="empty-state-text">暂无流水记录</Text></View>}
              </View>
            )}
            {activeTab === 'settlements' && (
              <View className="settle-list">
                {settlements.map(renderSettleItem)}
                {settlements.length === 0 && <View className="empty-state"><Text className="empty-state-text">暂无结算单</Text></View>}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
