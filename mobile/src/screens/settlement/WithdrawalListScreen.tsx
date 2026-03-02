import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
} from 'react-native';
import {listMyWithdrawals, WithdrawalRecord} from '../../services/settlement';

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待审核', color: '#faad14'},
  processing: {label: '处理中', color: '#1890ff'},
  completed: {label: '已到账', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
  failed: {label: '失败', color: '#ff4d4f'},
};

const METHOD_MAP: Record<string, string> = {
  bank_card: '银行卡',
  alipay: '支付宝',
  wechat: '微信',
};

export default function WithdrawalListScreen() {
  const [records, setRecords] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await listMyWithdrawals(1, 50);
      setRecords(result.data || []);
    } catch (err: any) {
      console.log('加载提现记录失败:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatAmount = (fen: number) => (fen / 100).toFixed(2);

  const renderItem = ({item}: {item: WithdrawalRecord}) => {
    const statusInfo = STATUS_MAP[item.status] || {label: item.status, color: '#999'};
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>提现 ¥{formatAmount(item.amount)}</Text>
          <View style={[styles.badge, {backgroundColor: statusInfo.color + '20'}]}>
            <Text style={[styles.badgeText, {color: statusInfo.color}]}>{statusInfo.label}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.info}>方式: {METHOD_MAP[item.withdraw_method] || item.withdraw_method}</Text>
          <Text style={styles.info}>手续费: ¥{formatAmount(item.service_fee)}</Text>
          <Text style={styles.info}>实际到账: ¥{formatAmount(item.actual_amount)}</Text>
          {item.bank_name ? <Text style={styles.info}>银行: {item.bank_name}</Text> : null}
          {item.review_notes ? <Text style={[styles.info, {color: '#ff4d4f'}]}>备注: {item.review_notes}</Text> : null}
        </View>
        <Text style={styles.time}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} />}
        ListEmptyComponent={<Text style={styles.emptyText}>暂无提现记录</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  listContent: {padding: 16},
  card: {backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333'},
  badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  badgeText: {fontSize: 11, fontWeight: '500'},
  cardBody: {},
  info: {fontSize: 13, color: '#666', marginBottom: 3},
  time: {fontSize: 11, color: '#ccc', marginTop: 6},
  emptyText: {textAlign: 'center', color: '#ccc', fontSize: 14, paddingTop: 60},
});
