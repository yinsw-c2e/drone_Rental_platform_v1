import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {pilotV2Service} from '../../services/pilotV2';
import {V2FlightRecordSummary} from '../../types';
import {
  aggregateFlightRecords,
  formatDateTime,
  formatDistanceKilometersShort,
  formatDistanceMeters,
  formatDurationSeconds,
  formatHoursFromSeconds,
  sortFlightRecords,
} from '../../utils/flightRecords';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

export default function FlightLogScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [records, setRecords] = useState<V2FlightRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const allRecords = await pilotV2Service.listAllFlightRecords({page_size: 100});
      setRecords(sortFlightRecords(allRecords));
    } catch (error) {
      console.error('获取真实履约飞行记录失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const stats = useMemo(() => aggregateFlightRecords(records), [records]);

  const renderHeader = () => (
    <View>
      <ObjectCard style={styles.statsCard}>
        <Text style={styles.statsTitle}>飞行统计</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{stats.totalFlights}</Text>
            <Text style={styles.statsLabel}>总飞行次数</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{formatHoursFromSeconds(stats.totalDurationSeconds)}</Text>
            <Text style={styles.statsLabel}>总飞行时长</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{formatDistanceKilometersShort(stats.totalDistanceM)}</Text>
            <Text style={styles.statsLabel}>总飞行距离</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{Math.round(stats.maxAltitudeM)}m</Text>
            <Text style={styles.statsLabel}>最高飞行高度</Text>
          </View>
        </View>
      </ObjectCard>

      <ObjectCard style={styles.tipCard}>
        <Text style={styles.tipTitle}>真实履约飞行记录</Text>
        <Text style={styles.tipText}>
          这里只展示订单执行中自动沉淀的飞行留痕，不再支持手动补录，避免统计口径和履约数据不一致。
        </Text>
      </ObjectCard>

      <Text style={styles.sectionTitle}>飞行记录</Text>
    </View>
  );

  const renderItem = ({item}: {item: V2FlightRecordSummary}) => (
    <ObjectCard
      style={styles.recordCard}
      onPress={item.order_id ? () => navigation.navigate('OrderDetail', {id: item.order_id, orderId: item.order_id}) : undefined}>
      <View style={styles.recordHeader}>
        <View style={styles.recordHeaderLeft}>
          <Text style={styles.recordCode}>{item.flight_no || `飞行记录 #${item.id}`}</Text>
          <View style={styles.tagRow}>
            <SourceTag source="flight_record" />
            <StatusBadge meta={getObjectStatusMeta('flight_record', item.status)} label="" />
            {item.order?.status ? (
              <StatusBadge meta={getObjectStatusMeta('order', item.order.status)} label="" />
            ) : null}
          </View>
        </View>
        <Text style={styles.recordTime}>{formatDateTime(item.takeoff_at || item.created_at)}</Text>
      </View>

      <Text style={styles.recordTitle} numberOfLines={2}>
        {item.order?.title || '履约飞行记录'}
      </Text>
      <Text style={styles.recordSubTitle}>
        {item.order?.order_no ? `关联订单 ${item.order.order_no}` : '未关联订单编号'}
      </Text>

      <View style={styles.metricRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>飞行时长</Text>
          <Text style={styles.metricValue}>{formatDurationSeconds(item.total_duration_seconds)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>飞行距离</Text>
          <Text style={styles.metricValue}>{formatDistanceMeters(item.total_distance_m)}</Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>最高高度</Text>
          <Text style={styles.metricValue}>{Math.round(Number(item.max_altitude_m || 0))}米</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>落地时间</Text>
          <Text style={styles.metricValue}>{formatDateTime(item.landing_at)}</Text>
        </View>
      </View>
    </ObjectCard>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.loadingText}>正在同步真实履约飞行记录...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={records}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <ObjectCard>
            <EmptyState
              icon="🛫"
              title="暂无真实飞行记录"
              description="当你接受正式派单并产生真实履约飞行后，记录会自动出现在这里。"
              actionText="查看待接派单"
              onAction={() => navigation.navigate('PilotTaskList')}
            />
          </ObjectCard>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} />}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.textSub,
  },
  statsCard: {
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsItem: {
    width: '50%',
    paddingVertical: 12,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.primaryText,
  },
  statsLabel: {
    marginTop: 6,
    fontSize: 13,
    color: theme.textSub,
  },
  tipCard: {
    backgroundColor: theme.bgSecondary,
    marginBottom: 16,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.primaryText,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  recordCard: {
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  recordHeaderLeft: {
    flex: 1,
    gap: 10,
  },
  recordCode: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSub,
  },
  recordTime: {
    fontSize: 12,
    color: theme.textHint,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordTitle: {
    marginTop: 14,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    color: theme.text,
  },
  recordSubTitle: {
    marginTop: 6,
    fontSize: 13,
    color: theme.textSub,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  metricItem: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.textSub,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
});
