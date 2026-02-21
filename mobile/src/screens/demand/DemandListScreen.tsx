import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl,
} from 'react-native';
import {demandService} from '../../services/demand';
import {RentalDemand} from '../../types';

export default function DemandListScreen({navigation}: any) {
  const [demands, setDemands] = useState<RentalDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchDemands = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      const res = await demandService.listDemands({page: pageNum, page_size: 10});
      const list = res.data?.list || [];
      if (isRefresh || pageNum === 1) {
        setDemands(list);
      } else {
        setDemands(prev => [...prev, ...list]);
      }
      setHasMore(list.length === 10);
    } catch (e) {
      console.warn('获取需求列表失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDemands(1, true);
  }, [fetchDemands]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchDemands(1, true);
  }, [fetchDemands]);

  const onLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchDemands(nextPage);
    }
  }, [loading, hasMore, page, fetchDemands]);

  const renderItem = ({item}: {item: RentalDemand}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          {item.urgency === 'urgent' && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>紧急</Text>
            </View>
          )}
        </View>
        <Text style={styles.budget}>
          预算：¥{item.budget_min || 0} - ¥{item.budget_max || 0}
        </Text>
        <Text style={styles.meta}>
          {item.address || '位置未设置'} · {item.demand_type || '租赁'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={demands}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{padding: 12}}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>{loading ? '加载中...' : '暂无需求信息'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  item: {
    backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  content: {flex: 1},
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  title: {fontSize: 15, fontWeight: '600', color: '#333', flex: 1},
  urgentBadge: {backgroundColor: '#ff4d4f', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginLeft: 8},
  urgentText: {color: '#fff', fontSize: 10, fontWeight: 'bold'},
  budget: {fontSize: 14, color: '#f5222d', fontWeight: '500', marginBottom: 4},
  meta: {fontSize: 12, color: '#999'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999'},
});
