import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Image, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import {demandService} from '../../services/demand';
import {RentalOffer, RentalDemand, CargoDemand} from '../../types';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export default function HomeScreen({navigation}: any) {
  const [offers, setOffers] = useState<RentalOffer[]>([]);
  const [demands, setDemands] = useState<RentalDemand[]>([]);
  const [cargos, setCargos] = useState<CargoDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);

  // 轮播图数据
  const banners = [
    {
      title: '智能匹配，高效操合',
      subtitle: '专业的无人机租赁平台',
      gradient: ['#1890ff', '#096dd9'],
    },
    {
      title: '全程保障，安全可靠',
      subtitle: '实名认证，交易担保',
      gradient: ['#52c41a', '#389e0d'],
    },
    {
      title: '丰富资源，价格透明',
      subtitle: '数百家机主在线服务',
      gradient: ['#fa8c16', '#d46b08'],
    },
  ];

  // 自动轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex(prev => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const cards = [
    {title: '发布出租', desc: '发布无人机出租服务', screen: 'PublishOffer', color: '#1890ff', icon: '🚁'},
    {title: '租赁需求', desc: '发布无人机租赁需求', screen: 'PublishDemand', color: '#52c41a', icon: '📋'},
    {title: '货运需求', desc: '发布吊运/运输需求', screen: 'PublishCargo', color: '#fa8c16', icon: '📦'},
    {title: '附近无人机', desc: '查看附近可用无人机', screen: 'NearbyDrones', color: '#722ed1', icon: '📍'},
  ];

  const fetchData = useCallback(async () => {
    try {
      const [offersRes, demandsRes, cargosRes] = await Promise.all([
        demandService.listOffers({page: 1, page_size: 5}),
        demandService.listDemands({page: 1, page_size: 5}),
        demandService.listCargos({page: 1, page_size: 5}),
      ]);
      setOffers(offersRes.data?.list || []);
      setDemands(demandsRes.data?.list || []);
      setCargos(cargosRes.data?.list || []);
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
    const priceInYuan = (offer.price / 100).toFixed(0);
    return offer.price_type === 'hourly'
      ? `¥${priceInYuan}/小时`
      : `¥${priceInYuan}/天`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
      >
        {/* 轮播图 */}
        <View style={styles.bannerContainer}>
          <View style={[styles.banner, {backgroundColor: banners[bannerIndex].gradient[0]}]}>
            <Text style={styles.bannerTitle}>{banners[bannerIndex].title}</Text>
            <Text style={styles.bannerSubtitle}>{banners[bannerIndex].subtitle}</Text>
          </View>
          <View style={styles.bannerDots}>
            {banners.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === bannerIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </View>
  
        {/* 数据统计 */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{offers.length}</Text>
            <Text style={styles.statLabel}>在线供给</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{demands.length}</Text>
            <Text style={styles.statLabel}>租赁需求</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{cargos.length}</Text>
            <Text style={styles.statLabel}>货运订单</Text>
          </View>
        </View>
  
        {/* 快捷操作 */}
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

        {/* 最新货运 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最新货运</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CargoList')}>
            <Text style={styles.moreText}>查看更多 &gt;</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{paddingVertical: 20}} color="#fa8c16" />
        ) : cargos.length > 0 ? (
          cargos.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.listItem, {borderLeftColor: '#fa8c16'}]}
              onPress={() => navigation.navigate('CargoDetail', {id: item.id})}>
              <View style={styles.cargoIconBox}>
                <Text style={{fontSize: 20}}>📦</Text>
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.pickup_address} → {item.delivery_address}
                </Text>
                <Text style={styles.cargoMeta}>
                  {item.cargo_weight}kg · {item.distance > 0 ? `${item.distance.toFixed(1)}km` : '距离未知'}
                </Text>
              </View>
              <Text style={styles.cargoPrice}>¥{(item.offered_price / 100).toFixed(2)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>暂无货运需求</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scrollView: {flex: 1},
  scrollContent: {paddingBottom: 20},
  // 轮播图样式
  bannerContainer: {
    height: 160,
    marginBottom: 12,
  },
  banner: {
    height: 140,
    paddingHorizontal: 24,
    paddingTop: 40,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#fff',
  },
  // 数据统计样式
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
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
  cargoIconBox: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff7e6',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  cargoMeta: {fontSize: 12, color: '#999', marginTop: 3},
  cargoPrice: {fontSize: 14, color: '#fa8c16', fontWeight: 'bold'},
  emptyText: {textAlign: 'center', color: '#999', padding: 20},
});
