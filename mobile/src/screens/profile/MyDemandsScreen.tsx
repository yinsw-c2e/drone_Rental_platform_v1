import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import {demandService} from '../../services/demand';
import {RentalDemand} from '../../types';

export default function MyDemandsScreen({navigation}: any) {
  const [demands, setDemands] = useState<RentalDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await demandService.myDemands({page: 1, page_size: 100});
      setDemands(res.data?.list || []);
    } catch (e) {
      console.warn('获取需求失败:', e);
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

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      open: '待匹配',
      matched: '已匹配',
      closed: '已关闭',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      open: '#1890ff',
      matched: '#52c41a',
      closed: '#999',
      cancelled: '#ff4d4f',
    };
    return colorMap[status] || '#999';
  };

  const renderItem = ({item}: {item: RentalDemand}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <View style={[styles.statusBadge, {backgroundColor: getStatusColor(item.status)}]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.itemDesc} numberOfLines={2}>{item.description || '暂无描述'}</Text>
      <View style={styles.itemFooter}>
        <Text style={styles.itemBudget}>
          预算：¥{item.budget_min || 0} - ¥{item.budget_max || 0}
        </Text>
        <Text style={styles.itemMeta}>
          {item.demand_type || '租赁'}
          {item.urgency === 'urgent' && ' · 🔥 紧急'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 100}} color="#1890ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={demands}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>暂无需求</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Home', {screen: 'PublishDemand'})}>
              <Text style={styles.emptyBtnText}>发布需求</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  list: {padding: 12},
  item: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  itemHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  itemTitle: {flex: 1, fontSize: 16, fontWeight: '600', color: '#333', marginRight: 8},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4},
  statusText: {color: '#fff', fontSize: 11, fontWeight: '500'},
  itemDesc: {fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 12},
  itemFooter: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  itemBudget: {fontSize: 14, color: '#f5222d', fontWeight: '500'},
  itemMeta: {fontSize: 12, color: '#999'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999', marginBottom: 20},
  emptyBtn: {
    backgroundColor: '#1890ff', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  emptyBtnText: {color: '#fff', fontSize: 14, fontWeight: '500'},
});
