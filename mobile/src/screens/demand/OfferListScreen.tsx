import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl,
} from 'react-native';
import {demandService} from '../../services/demand';
import {RentalOffer} from '../../types';

export default function OfferListScreen({navigation}: any) {
  const [offers, setOffers] = useState<RentalOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchOffers = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      const res = await demandService.listOffers({page: pageNum, page_size: 10});
      const list = res.data?.list || [];
      if (isRefresh || pageNum === 1) {
        setOffers(list);
      } else {
        setOffers(prev => [...prev, ...list]);
      }
      setHasMore(list.length === 10);
    } catch (e) {
      console.warn('获取供给列表失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers(1, true);
  }, [fetchOffers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchOffers(1, true);
  }, [fetchOffers]);

  const onLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchOffers(nextPage);
    }
  }, [loading, hasMore, page, fetchOffers]);

  const formatPrice = (offer: RentalOffer) => {
    if (!offer.price) return '价格面议';
    return offer.price_type === 'hourly'
      ? `¥${offer.price}/小时`
      : `¥${offer.price}/天`;
  };

  const renderItem = ({item}: {item: RentalOffer}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
      <View style={styles.iconBox}>
        <Text style={{fontSize: 28}}>🚁</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.meta}>{item.owner?.nickname || '无人机主'} · {item.service_type || '租赁'}</Text>
        <Text style={styles.location} numberOfLines={1}>{item.address || '位置未设置'}</Text>
      </View>
      <Text style={styles.price}>{formatPrice(item)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={offers}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{padding: 12}}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚁</Text>
            <Text style={styles.emptyText}>{loading ? '加载中...' : '暂无供给信息'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  item: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 10, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  iconBox: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  content: {flex: 1, marginRight: 8},
  title: {fontSize: 15, fontWeight: '600', color: '#333'},
  meta: {fontSize: 12, color: '#999', marginTop: 4},
  location: {fontSize: 12, color: '#999', marginTop: 2},
  price: {fontSize: 14, color: '#f5222d', fontWeight: 'bold'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999'},
});
