import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import {demandService} from '../../services/demand';
import {RentalOffer, RentalDemand} from '../../types';

export default function HomeScreen({navigation}: any) {
  const [offers, setOffers] = useState<RentalOffer[]>([]);
  const [demands, setDemands] = useState<RentalDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cards = [
    {title: '发布出租', desc: '发布无人机出租服务', screen: 'PublishOffer', color: '#1890ff', icon: '🚁'},
    {title: '租赁需求', desc: '发布无人机租赁需求', screen: 'PublishDemand', color: '#52c41a', icon: '📋'},
    {title: '货运需求', desc: '发布吊运/运输需求', screen: 'PublishCargo', color: '#fa8c16', icon: '📦'},
    {title: '附近无人机', desc: '查看附近可用无人机', screen: 'NearbyDrones', color: '#722ed1', icon: '📍'},
  ];

  const fetchData = useCallback(async () => {
    try {
      const [offersRes, demandsRes] = await Promise.all([
        demandService.listOffers({page: 1, page_size: 5}),
        demandService.listDemands({page: 1, page_size: 5}),
      ]);
      setOffers(offersRes.data?.list || []);
      setDemands(demandsRes.data?.list || []);
    } catch (e) {
      console.warn('首页数据加载失败:', e);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>无人机租赁平台</Text>
          <Text style={styles.headerSubtitle}>智能匹配，高效撮合</Text>
        </View>

        <View style={styles.grid}>
          {cards.map((card, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.card, {borderLeftColor: card.color}]}
              onPress={() => navigation.navigate(card.screen)}>
              <Text style={styles.cardIcon}>{card.icon}</Text>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 最新供给 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最新供给</Text>
          <TouchableOpacity onPress={() => navigation.navigate('OfferList')}>
            <Text style={styles.moreText}>查看更多 &gt;</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{paddingVertical: 20}} color="#1890ff" />
        ) : offers.length > 0 ? (
          offers.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.listItem}
              onPress={() => navigation.navigate('OfferDetail', {id: item.id})}>
              <View style={styles.offerIconBox}>
                <Text style={{fontSize: 24}}>🚁</Text>
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.itemMeta}>
                  {item.owner?.nickname || '无人机主'} · {item.service_type || '租赁'}
                </Text>
                <Text style={styles.itemLocation} numberOfLines={1}>{item.address || '位置未设置'}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatPrice(item)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>暂无供给信息</Text>
        )}

        {/* 最新需求 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最新需求</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DemandList')}>
            <Text style={styles.moreText}>查看更多 &gt;</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{paddingVertical: 20}} color="#1890ff" />
        ) : demands.length > 0 ? (
          demands.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.listItem}
              onPress={() => navigation.navigate('DemandDetail', {id: item.id})}>
              <View style={styles.itemContent}>
                <View style={styles.demandHeader}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  {item.urgency === 'urgent' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentText}>紧急</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.demandBudget}>
                  预算：¥{item.budget_min || 0} - ¥{item.budget_max || 0}
                </Text>
                <Text style={styles.itemLocation}>
                  {item.city || item.address || '位置未设置'} · {item.demand_type || '租赁'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>暂无需求信息</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scrollView: {flex: 1},
  scrollContent: {paddingBottom: 20},
  header: {backgroundColor: '#1890ff', padding: 24, paddingTop: 16},
  headerTitle: {fontSize: 24, fontWeight: 'bold', color: '#fff'},
  headerSubtitle: {fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4},
  grid: {flexDirection: 'row', flexWrap: 'wrap', padding: 12},
  card: {
    width: '47%', backgroundColor: '#fff', borderRadius: 8,
    padding: 16, margin: '1.5%', borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardIcon: {fontSize: 28, marginBottom: 8},
  cardTitle: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  cardDesc: {fontSize: 12, color: '#999', marginTop: 4},
  section: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  sectionTitle: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  moreText: {fontSize: 14, color: '#1890ff'},
  listItem: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16,
    marginBottom: 10, padding: 12, borderRadius: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    alignItems: 'center',
  },
  offerIconBox: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  itemContent: {flex: 1, marginRight: 8},
  itemTitle: {fontSize: 15, fontWeight: '600', color: '#333'},
  itemMeta: {fontSize: 12, color: '#999', marginTop: 3},
  itemPrice: {fontSize: 14, color: '#f5222d', fontWeight: 'bold'},
  itemLocation: {fontSize: 12, color: '#999', marginTop: 2},
  demandHeader: {flexDirection: 'row', alignItems: 'center'},
  demandBudget: {fontSize: 13, color: '#f5222d', marginTop: 4},
  urgentBadge: {backgroundColor: '#ff4d4f', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, marginLeft: 8},
  urgentText: {color: '#fff', fontSize: 10},
  emptyText: {textAlign: 'center', color: '#999', padding: 20},
});
