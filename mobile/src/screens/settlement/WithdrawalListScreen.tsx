import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useSelector} from 'react-redux';
import {useFocusEffect} from '@react-navigation/native';
import ProviderAccessNotice from '../../components/business/ProviderAccessNotice';
import {listMyWithdrawals, WithdrawalRecord} from '../../services/settlement';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const STATUS_MAP: Record<string, {label: string; colorKey: 'warning' | 'primary' | 'success' | 'danger'}> = {
  pending: {label: '待审核', colorKey: 'warning'},
  processing: {label: '处理中', colorKey: 'primary'},
  completed: {label: '已完成', colorKey: 'success'},
  rejected: {label: '已拒绝', colorKey: 'danger'},
  failed: {label: '失败', colorKey: 'danger'},
};

const METHOD_MAP: Record<string, string> = {
  bank_card: '银行卡',
  alipay: '支付宝',
  wechat: '微信',
};

export default function WithdrawalListScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canUseProviderFinance = Boolean(isAuthenticated && providerCapabilities.canUseWorkbench);
  const [records, setRecords] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!canUseProviderFinance) {
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const result = await listMyWithdrawals(1, 100);
      setRecords(result.data || []);
    } catch (err: any) {
      console.log('加载提现记录失败:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canUseProviderFinance]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const formatAmount = (fen: number) => (fen / 100).toFixed(2);

  const renderItem = ({item}: {item: WithdrawalRecord}) => {
    const statusInfo = STATUS_MAP[item.status] || {label: item.status, colorKey: 'textHint' as const};
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>提现到 {METHOD_MAP[item.withdraw_method] || item.withdraw_method}</Text>
          <View style={[styles.badge, {backgroundColor: theme[statusInfo.colorKey] + '20'}]}>
            <Text style={[styles.badgeText, {color: theme[statusInfo.colorKey]}]}>{statusInfo.label}</Text>
          </View>
        </View>
        <Text style={styles.amount}>¥{formatAmount(item.amount)}</Text>
        <View style={styles.cardBody}>
          <Text style={styles.info}>手续费: ¥{formatAmount(item.service_fee)}</Text>
          <Text style={styles.info}>实际到账: ¥{formatAmount(item.actual_amount)}</Text>
          {item.bank_name ? <Text style={styles.info}>银行: {item.bank_name}</Text> : null}
          {item.review_notes ? <Text style={[styles.info, {color: theme.danger}]}>备注: {item.review_notes}</Text> : null}
        </View>
        <Text style={styles.time}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
      </View>
    );
  };

  if (!canUseProviderFinance) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ProviderAccessNotice
          title={isAuthenticated ? '服务商财务能力未开通' : '请先登录服务商账号'}
          description={isAuthenticated ? '服务商审核通过后，才能查看提现记录。' : '登录后才能查看服务商提现记录。'}
          actionText={isAuthenticated ? '查看服务商入驻' : undefined}
          onAction={isAuthenticated ? () => navigation.navigate('ProviderOnboarding') : undefined}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={records}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <Text style={styles.emptyText}>暂无提现记录</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  listContent: {padding: 16},
  card: {backgroundColor: theme.card, borderRadius: 10, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  cardTitle: {fontSize: 16, fontWeight: '600', color: theme.text},
  amount: {fontSize: 24, fontWeight: '800', color: theme.text, marginBottom: 8},
  badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  badgeText: {fontSize: 11, fontWeight: '500'},
  cardBody: {},
  info: {fontSize: 13, color: theme.textSub, marginBottom: 3},
  time: {fontSize: 11, color: theme.textHint, marginTop: 6},
  loading: {marginTop: 80},
  emptyText: {textAlign: 'center', color: theme.textHint, fontSize: 14, paddingTop: 60},
});
