import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import {demandService} from '../../services/demand';
import {RentalOffer} from '../../types';

export default function MyOffersScreen({navigation}: any) {
  const [offers, setOffers] = useState<RentalOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await demandService.myOffers({page: 1, page_size: 100});
      setOffers(res.data?.list || []);
    } catch (e) {
      console.warn('获取供给失败:', e);
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

  const formatPrice = (offer: RentalOffer) => {
    if (!offer.price) return '价格面议';
    return offer.price_type === 'hourly'
      ? `¥${offer.price}/小时`
      : `¥${offer.price}/天`;
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: '进行中',
      closed: '已关闭',
      paused: '已暂停',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      active: '#52c41a',
      closed: '#999',
      paused: '#fa8c16',
    };
    return colorMap[status] || '#999';
  };

  const renderItem = ({item}: {item: RentalOffer}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <View style={[styles.statusBadge, {backgroundColor: getStatusColor(item.status)}]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.itemDesc} numberOfLines={2}>{item.description || '暂无描述'}</Text>
      <View style={styles.itemFooter}>
        <Text style={styles.itemPrice}>{formatPrice(item)}</Text>
        <Text style={styles.itemMeta}>
          {item.service_type || '租赁'} · 浏览 {item.views || 0} 次
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
        data={offers}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>暂无供给</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Home', {screen: 'PublishOffer'})}>
              <Text style={styles.emptyBtnText}>发布供给</Text>
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
  itemPrice: {fontSize: 16, color: '#f5222d', fontWeight: 'bold'},
  itemMeta: {fontSize: 12, color: '#999'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999', marginBottom: 20},
  emptyBtn: {
    backgroundColor: '#1890ff', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  emptyBtnText: {color: '#fff', fontSize: 14, fontWeight: '500'},
});
