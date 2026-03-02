import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  getWallet,
  getWalletTransactions,
  listMySettlements,
  UserWallet,
  WalletTransaction,
  OrderSettlement,
} from '../../services/settlement';

const TX_TYPE_MAP: Record<string, {label: string; color: string; sign: string}> = {
  income: {label: '收入', color: '#52c41a', sign: '+'},
  withdraw: {label: '提现', color: '#ff4d4f', sign: '-'},
  freeze: {label: '冻结', color: '#faad14', sign: '-'},
  unfreeze: {label: '解冻', color: '#1890ff', sign: '+'},
  deduct: {label: '扣款', color: '#ff4d4f', sign: '-'},
  refund: {label: '退款', color: '#52c41a', sign: '+'},
};

const SETTLEMENT_STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待计算', color: '#999'},
  calculated: {label: '已计算', color: '#faad14'},
  confirmed: {label: '已确认', color: '#1890ff'},
  settled: {label: '已结算', color: '#52c41a'},
  disputed: {label: '争议中', color: '#ff4d4f'},
};

type TabType = 'wallet' | 'transactions' | 'settlements';

export default function WalletScreen({navigation}: any) {
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [settlements, setSettlements] = useState<OrderSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const loadData = async () => {
    try {
      const [walletData, txData, settleData] = await Promise.all([
        getWallet(),
        getWalletTransactions({page: 1, page_size: 50}),
        listMySettlements({page: 1, page_size: 50}),
      ]);
      setWallet(walletData);
      setTransactions(txData.data || []);
      setSettlements(settleData.data || []);
    } catch (err: any) {
      console.log('加载钱包数据失败:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatAmount = (amountFen: number) => {
    return (amountFen / 100).toFixed(2);
  };

  const renderWalletCard = () => {
    if (!wallet) return null;
    return (
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>可用余额(元)</Text>
        <Text style={styles.walletBalance}>{formatAmount(wallet.available_balance)}</Text>
        <View style={styles.walletRow}>
          <View style={styles.walletItem}>
            <Text style={styles.walletItemLabel}>冻结金额</Text>
            <Text style={styles.walletItemValue}>{formatAmount(wallet.frozen_balance)}</Text>
          </View>
          <View style={styles.walletDivider} />
          <View style={styles.walletItem}>
            <Text style={styles.walletItemLabel}>累计收入</Text>
            <Text style={[styles.walletItemValue, {color: '#52c41a'}]}>{formatAmount(wallet.total_income)}</Text>
          </View>
          <View style={styles.walletDivider} />
          <View style={styles.walletItem}>
            <Text style={styles.walletItemLabel}>累计提现</Text>
            <Text style={styles.walletItemValue}>{formatAmount(wallet.total_withdrawn)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.withdrawBtn}
          onPress={() => navigation.navigate('Withdrawal')}>
          <Text style={styles.withdrawBtnText}>提现</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTransactionItem = ({item}: {item: WalletTransaction}) => {
    const typeInfo = TX_TYPE_MAP[item.type] || {label: item.type, color: '#999', sign: ''};
    return (
      <View style={styles.txItem}>
        <View style={styles.txLeft}>
          <Text style={styles.txDesc}>{item.description || typeInfo.label}</Text>
          <Text style={styles.txTime}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
        </View>
        <Text style={[styles.txAmount, {color: typeInfo.color}]}>
          {typeInfo.sign}{formatAmount(Math.abs(item.amount))}
        </Text>
      </View>
    );
  };

  const renderSettlementItem = ({item}: {item: OrderSettlement}) => {
    const statusInfo = SETTLEMENT_STATUS_MAP[item.status] || {label: item.status, color: '#999'};
    return (
      <TouchableOpacity style={styles.settleCard}>
        <View style={styles.settleHeader}>
          <Text style={styles.settleOrderNo}>订单 {item.order_no}</Text>
          <View style={[styles.settleBadge, {backgroundColor: statusInfo.color + '20'}]}>
            <Text style={[styles.settleBadgeText, {color: statusInfo.color}]}>{statusInfo.label}</Text>
          </View>
        </View>
        <View style={styles.settleBody}>
          <View style={styles.settleRow}>
            <Text style={styles.settleLabel}>订单总额</Text>
            <Text style={styles.settleValue}>{formatAmount(item.final_amount)}元</Text>
          </View>
          <View style={styles.settleRow}>
            <Text style={styles.settleLabel}>平台服务费({(item.platform_fee_rate * 100).toFixed(0)}%)</Text>
            <Text style={[styles.settleValue, {color: '#ff4d4f'}]}>-{formatAmount(item.platform_fee)}</Text>
          </View>
          {item.pilot_fee > 0 && (
            <View style={styles.settleRow}>
              <Text style={styles.settleLabel}>飞手劳务费({(item.pilot_fee_rate * 100).toFixed(0)}%)</Text>
              <Text style={[styles.settleValue, {color: '#52c41a'}]}>{formatAmount(item.pilot_fee)}</Text>
            </View>
          )}
          {item.owner_fee > 0 && (
            <View style={styles.settleRow}>
              <Text style={styles.settleLabel}>机主设备费({(item.owner_fee_rate * 100).toFixed(0)}%)</Text>
              <Text style={[styles.settleValue, {color: '#52c41a'}]}>{formatAmount(item.owner_fee)}</Text>
            </View>
          )}
          {item.insurance_deduction > 0 && (
            <View style={styles.settleRow}>
              <Text style={styles.settleLabel}>保险代扣</Text>
              <Text style={[styles.settleValue, {color: '#faad14'}]}>-{formatAmount(item.insurance_deduction)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.settleTime}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderWalletCard()}

      <View style={styles.tabs}>
        {([
          {key: 'wallet' as TabType, label: '概览'},
          {key: 'transactions' as TabType, label: '流水'},
          {key: 'settlements' as TabType, label: '结算'},
        ]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'transactions' && (
        <FlatList
          data={transactions}
          keyExtractor={item => String(item.id)}
          renderItem={renderTransactionItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} />}
          ListEmptyComponent={<Text style={styles.emptyText}>暂无流水记录</Text>}
        />
      )}

      {activeTab === 'settlements' && (
        <FlatList
          data={settlements}
          keyExtractor={item => String(item.id)}
          renderItem={renderSettlementItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} />}
          ListEmptyComponent={<Text style={styles.emptyText}>暂无结算记录</Text>}
        />
      )}

      {activeTab === 'wallet' && (
        <ScrollView
          style={styles.overview}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} />}>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveTab('transactions')}>
              <Text style={styles.actionIcon}>{'$'}</Text>
              <Text style={styles.actionLabel}>全部流水</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => setActiveTab('settlements')}>
              <Text style={styles.actionIcon}>{'#'}</Text>
              <Text style={styles.actionLabel}>结算明细</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Withdrawal')}>
              <Text style={styles.actionIcon}>{'>'}</Text>
              <Text style={styles.actionLabel}>我要提现</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('WithdrawalList')}>
              <Text style={styles.actionIcon}>{'='}</Text>
              <Text style={styles.actionLabel}>提现记录</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>最近流水</Text>
          {transactions.slice(0, 5).map(tx => {
            const typeInfo = TX_TYPE_MAP[tx.type] || {label: tx.type, color: '#999', sign: ''};
            return (
              <View key={tx.id} style={styles.txItem}>
                <View style={styles.txLeft}>
                  <Text style={styles.txDesc}>{tx.description || typeInfo.label}</Text>
                  <Text style={styles.txTime}>{tx.created_at ? new Date(tx.created_at).toLocaleString() : ''}</Text>
                </View>
                <Text style={[styles.txAmount, {color: typeInfo.color}]}>
                  {typeInfo.sign}{formatAmount(Math.abs(tx.amount))}
                </Text>
              </View>
            );
          })}
          {transactions.length === 0 && <Text style={styles.emptyText}>暂无流水记录</Text>}
          <View style={{height: 30}} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  walletCard: {backgroundColor: '#1890ff', padding: 20, paddingBottom: 16},
  walletLabel: {fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4},
  walletBalance: {fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 16},
  walletRow: {flexDirection: 'row', alignItems: 'center'},
  walletItem: {flex: 1, alignItems: 'center'},
  walletItemLabel: {fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2},
  walletItemValue: {fontSize: 15, fontWeight: '600', color: '#fff'},
  walletDivider: {width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)'},
  withdrawBtn: {marginTop: 16, backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 10, borderRadius: 8, alignItems: 'center'},
  withdrawBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},

  tabs: {flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8'},
  tab: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabActive: {borderBottomWidth: 2, borderBottomColor: '#1890ff'},
  tabText: {fontSize: 14, color: '#999'},
  tabTextActive: {color: '#1890ff', fontWeight: '600'},

  listContent: {padding: 16},
  txItem: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 8, marginBottom: 8},
  txLeft: {flex: 1, marginRight: 12},
  txDesc: {fontSize: 14, color: '#333', marginBottom: 4},
  txTime: {fontSize: 11, color: '#999'},
  txAmount: {fontSize: 16, fontWeight: '600'},

  settleCard: {backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10},
  settleHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  settleOrderNo: {fontSize: 14, fontWeight: '600', color: '#333'},
  settleBadge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  settleBadgeText: {fontSize: 11, fontWeight: '500'},
  settleBody: {},
  settleRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4},
  settleLabel: {fontSize: 13, color: '#666'},
  settleValue: {fontSize: 13, fontWeight: '500', color: '#333'},
  settleTime: {fontSize: 11, color: '#ccc', marginTop: 6},

  overview: {flex: 1},
  quickActions: {flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16, marginBottom: 10},
  actionItem: {flex: 1, alignItems: 'center'},
  actionIcon: {fontSize: 24, marginBottom: 4},
  actionLabel: {fontSize: 12, color: '#666'},
  sectionTitle: {fontSize: 15, fontWeight: '600', color: '#333', paddingHorizontal: 16, paddingVertical: 10},
  emptyText: {textAlign: 'center', color: '#ccc', fontSize: 14, paddingTop: 40},
});
