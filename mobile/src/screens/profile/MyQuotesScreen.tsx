import React, {useCallback, useEffect, useMemo, useState} from 'react';
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

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {ownerService} from '../../services/owner';
import {DemandQuoteSummary} from '../../types';

const STATUS_GROUPS = [
  {key: 'all', label: '全部'},
  {key: 'submitted', label: '已提交'},
  {key: 'selected', label: '已选中'},
  {key: 'rejected', label: '未中选'},
  {key: 'expired', label: '已过期'},
] as const;

type StatusGroupKey = (typeof STATUS_GROUPS)[number]['key'];

const formatQuoteAmount = (amount?: number) => `¥${((amount || 0) / 100).toFixed(2)}`;

export default function MyQuotesScreen({navigation}: any) {
  const [quotes, setQuotes] = useState<DemandQuoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGroup, setActiveGroup] = useState<StatusGroupKey>('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await ownerService.listMyQuotes({page: 1, page_size: 100});
      setQuotes(res.data?.items || []);
    } catch (error) {
      console.warn('获取我的报价失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredQuotes = useMemo(
    () => quotes.filter(item => activeGroup === 'all' || item.status === activeGroup),
    [activeGroup, quotes],
  );

  const renderItem = ({item}: {item: DemandQuoteSummary}) => {
    const demandId = item.demand?.id || item.demand_id;

    return (
      <ObjectCard
        style={styles.card}
        onPress={() => navigation.navigate('DemandDetail', {id: demandId, marketMode: 'owner'})}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <SourceTag source="quote" />
            <StatusBadge label="" meta={getObjectStatusMeta('quote', item.status)} />
          </View>
          <Text style={styles.code}>{item.quote_no}</Text>
        </View>

        <Text style={styles.title}>{item.demand?.title || `需求 #${item.demand_id}`}</Text>
        <Text style={styles.subTitle}>关联需求：{item.demand?.demand_no || `#${item.demand_id}`}</Text>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>报价金额</Text>
          <Text style={styles.metricValue}>{formatQuoteAmount(item.price_amount)}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricText}>执行设备：{item.drone?.brand || '未选择'} {item.drone?.model || ''}</Text>
          <Text style={styles.metricText}>需求状态：{item.demand?.status || '未知'}</Text>
        </View>

        {item.execution_plan ? (
          <Text style={styles.plan} numberOfLines={2}>
            方案摘要：{item.execution_plan}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('DemandDetail', {id: demandId, marketMode: 'owner'})}>
            <Text style={styles.primaryBtnText}>查看需求</Text>
          </TouchableOpacity>
        </View>
      </ObjectCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredQuotes}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0f5cab']} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>我的报价</Text>
              <Text style={styles.heroTitle}>机主报价和需求分开看</Text>
              <Text style={styles.heroDesc}>
                这里专门跟踪自己提交过的报价，快速看是否被选中、是否过期，以及要不要回到需求详情继续调整方案。
              </Text>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>报价分组</Text>
              <View style={styles.filterRow}>
                {STATUS_GROUPS.map(group => (
                  <TouchableOpacity
                    key={group.key}
                    style={[
                      styles.filterChip,
                      activeGroup === group.key && styles.filterChipActive,
                    ]}
                    onPress={() => setActiveGroup(group.key)}>
                    <Text
                      style={[
                        styles.filterChipText,
                        activeGroup === group.key && styles.filterChipTextActive,
                      ]}>
                      {group.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color="#0f5cab" />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="💬"
                title={activeGroup === 'all' ? '还没有报价记录' : '这个分组下暂无报价'}
                description="进入需求市场后，选择合适需求提交报价，这里会统一追踪所有报价状态。"
                actionText="去需求市场"
                onAction={() => navigation.navigate('DemandList', {mode: 'owner'})}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3f8',
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: '#5b3ab7',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    color: '#f4e8ff',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: '#fff',
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#f4e8ff',
  },
  filterCard: {
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '700',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: '#5b3ab7',
    backgroundColor: '#f9f0ff',
  },
  filterChipText: {
    fontSize: 12,
    color: '#595959',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#5b3ab7',
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  code: {
    fontSize: 12,
    color: '#8c8c8c',
    fontWeight: '600',
  },
  title: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 24,
    color: '#1f1f1f',
    fontWeight: '700',
  },
  subTitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#8c8c8c',
  },
  metricRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: '#595959',
  },
  metricValue: {
    fontSize: 18,
    color: '#5b3ab7',
    fontWeight: '800',
  },
  metricText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#595959',
  },
  plan: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#595959',
  },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    borderRadius: 999,
    backgroundColor: '#5b3ab7',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
});
