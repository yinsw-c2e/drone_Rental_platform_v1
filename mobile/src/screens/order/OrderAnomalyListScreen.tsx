import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import EmptyState from '../../components/business/EmptyState';
import OrderAnomalyBanner from '../../components/business/OrderAnomalyBanner';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {orderAnomalyV2Service} from '../../services/orderAnomalyV2';
import {V2OrderAnomaly, V2OrderAnomalySummary} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type RoleFilter = 'client' | 'owner' | 'pilot' | 'all';
type SeverityFilter = 'all' | 'critical' | 'warning';

const severityTabs: {key: SeverityFilter; label: string}[] = [
  {key: 'all', label: '全部'},
  {key: 'critical', label: '严重'},
  {key: 'warning', label: '提醒'},
];

const emptySummary: V2OrderAnomalySummary = {
  total: 0,
  critical_count: 0,
  warning_count: 0,
  by_anomaly_type: [],
  by_order_status: [],
};

export default function OrderAnomalyListScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const roleFilter = String(route?.params?.roleFilter || 'all') as RoleFilter;
  const [items, setItems] = useState<V2OrderAnomaly[]>([]);
  const [summary, setSummary] = useState<V2OrderAnomalySummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severity, setSeverity] = useState<SeverityFilter>('all');

  const loadData = useCallback(async () => {
    try {
      const params = {
        role: roleFilter === 'all' ? undefined : roleFilter,
        severity: severity === 'all' ? undefined : severity,
        page: 1,
        page_size: 100,
      };
      const [listRes, summaryRes] = await Promise.all([
        orderAnomalyV2Service.list(params),
        orderAnomalyV2Service.summary({
          role: params.role,
          severity: params.severity,
        }),
      ]);
      setItems(listRes.data?.items || []);
      setSummary(summaryRes.data || emptySummary);
    } catch (error) {
      console.warn('加载异常订单失败:', error);
      setItems([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, severity]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const roleLabel = useMemo(() => {
    switch (roleFilter) {
      case 'client':
        return '客户视角';
      case 'owner':
        return '机主视角';
      case 'pilot':
        return '飞手视角';
      default:
        return '综合视角';
    }
  }, [roleFilter]);

  const openAnomaly = useCallback((item: V2OrderAnomaly) => {
    if (roleFilter === 'pilot' && item.dispatch_task_id) {
      navigation.navigate('DispatchTaskDetail', {id: item.dispatch_task_id, dispatchId: item.dispatch_task_id});
      return;
    }
    navigation.navigate('OrderDetail', {orderId: item.order_id, id: item.order_id});
  }, [navigation, roleFilter]);

  const renderItem = ({item}: {item: V2OrderAnomaly}) => (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.card, {backgroundColor: theme.card, borderColor: theme.cardBorder}]}
      onPress={() => openAnomaly(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <StatusBadge label="" meta={getObjectStatusMeta('order', item.status)} />
          <Text style={styles.orderNo}>{item.order_no}</Text>
        </View>
        <Text style={styles.stageText}>{item.stage_label || item.status}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <OrderAnomalyBanner anomaly={item} compact />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>异常订单中心</Text>
        <Text style={styles.heroDesc}>
          {roleLabel}下共 {summary.total} 条异常，严重 {summary.critical_count} 条，提醒 {summary.warning_count} 条。
        </Text>
      </View>

      <View style={styles.filterRow}>
        {severityTabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterChip, severity === tab.key && styles.filterChipActive]}
            onPress={() => setSeverity(tab.key)}>
            <Text style={[styles.filterChipText, severity === tab.key && styles.filterChipTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={item => `${item.order_id}-${item.anomaly_type}`}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[theme.refreshColor]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <EmptyState
              icon="🫧"
              title="当前没有异常订单"
              description="这里会集中展示异常原因、影响阶段和建议动作，方便你直接跟进。"
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgSecondary,
    },
    hero: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
    },
    heroDesc: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      color: theme.textSub,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 18,
      paddingBottom: 10,
    },
    filterChip: {
      borderWidth: 1,
      borderColor: theme.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: theme.card,
    },
    filterChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    filterChipText: {
      color: theme.textSub,
      fontSize: 13,
      fontWeight: '700',
    },
    filterChipTextActive: {
      color: theme.btnPrimaryText,
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 32,
      gap: 12,
    },
    loading: {
      marginTop: 80,
    },
    card: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    orderNo: {
      color: theme.textSub,
      fontSize: 12,
      fontWeight: '700',
    },
    stageText: {
      color: theme.textHint,
      fontSize: 12,
      fontWeight: '600',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      lineHeight: 22,
    },
  });
