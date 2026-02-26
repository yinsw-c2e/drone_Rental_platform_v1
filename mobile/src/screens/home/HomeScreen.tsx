import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {demandService} from '../../services/demand';
import {RentalOffer, RentalDemand, CargoDemand} from '../../types';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export default function HomeScreen({navigation}: any) {
  const [offers, setOffers] = useState<RentalOffer[]>([]);
  const [demands, setDemands] = useState<RentalDemand[]>([]);
  const [cargos, setCargos] = useState<CargoDemand[]>([]);
  const [offersTotal, setOffersTotal] = useState(0);
  const [demandsTotal, setDemandsTotal] = useState(0);
  const [cargosTotal, setCargosTotal] = useState(0);
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
      console.log('首页数据加载详情:', {
        offersRes,
        demandsRes,
        cargosRes,
      });
      
      // 提取数据和总数
      const offersList = offersRes.data?.list || [];
      const demandsList = demandsRes.data?.list || [];
      const cargosList = cargosRes.data?.list || [];
      
      setOffers(offersList);
      setDemands(demandsList);
      setCargos(cargosList);
      setOffersTotal(offersRes.data?.total || offersList.length || 0);
      setDemandsTotal(demandsRes.data?.total || demandsList.length || 0);
      setCargosTotal(cargosRes.data?.total || cargosList.length || 0);
      
      console.log('首页数据设置完成:', {
        offers: offersList.length,
        demands: demandsList.length,
        cargos: cargosList.length,
        offersTotal: offersRes.data?.total,
        demandsTotal: demandsRes.data?.total,
        cargosTotal: cargosRes.data?.total,
      });
    } catch (e) {
      console.error('首页数据加载失败:', e);
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
      >
        {/* 轮播图 */}
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={banners[bannerIndex].gradient}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.banner}>
            <Text style={styles.bannerTitle}>{banners[bannerIndex].title}</Text>
            <Text style={styles.bannerSubtitle}>{banners[bannerIndex].subtitle}</Text>
          </LinearGradient>
          <View style={styles.bannerDots}>
            {banners.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setBannerIndex(index)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
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
            <Text style={styles.statNumber}>{offersTotal}</Text>
            <Text style={styles.statLabel}>在线供给</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{demandsTotal}</Text>
            <Text style={styles.statLabel}>租赁需求</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{cargosTotal}</Text>
            <Text style={styles.statLabel}>货运订单</Text>
          </View>
        </View>
  
        {/* 快捷操作 */}
        <View style={styles.grid}>
          {cards.map((card, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.card,
                {borderLeftColor: card.color},
                (index + 1) % 2 === 0 && {marginRight: 0}, // 每行第2个卡片去掉右边距
              ]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(card.screen)}>
              <View style={[styles.cardIconContainer, {backgroundColor: card.color + '15'}]}>
                <Text style={styles.cardIcon}>{card.icon}</Text>
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 最新供给 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最新供给</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('OfferList')}>
            <Text style={styles.moreText}>查看更多 &gt;</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{paddingVertical: 20}} color="#1890ff" />
        ) : offers.length > 0 ? (
          offers.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.listItem, {borderLeftWidth: 3, borderLeftColor: '#1890ff'}]}
              activeOpacity={0.8}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚁</Text>
            <Text style={styles.emptyText}>暂无供给信息</Text>
            <Text style={styles.emptyHint}>快来发布第一个供给吧</Text>
          </View>
        )}

        {/* 最新需求 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最新需求</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('DemandList')}>
            <Text style={styles.moreText}>查看更多 &gt;</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{paddingVertical: 20}} color="#1890ff" />
        ) : demands.length > 0 ? (
          demands.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.listItem, {borderLeftWidth: 3, borderLeftColor: '#52c41a'}]}
              activeOpacity={0.8}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>暂无需求信息</Text>
            <Text style={styles.emptyHint}>期待您的租赁需求</Text>
          </View>
        )}

        {/* 最新货运 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最新货运</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('CargoList')}>
            <Text style={styles.moreText}>查看更多 &gt;</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{paddingVertical: 20}} color="#fa8c16" />
        ) : cargos.length > 0 ? (
          cargos.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.listItem, {borderLeftWidth: 3, borderLeftColor: '#fa8c16'}]}
              activeOpacity={0.8}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>暂无货运需求</Text>
            <Text style={styles.emptyHint}>发布您的货运任务</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scrollView: {flex: 1},
  scrollContent: {paddingBottom: 80},
  // 轮播图样式
  bannerContainer: {
    height: 180,
    marginBottom: 16,
  },
  banner: {
    height: 160,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    borderRadius: 0,
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 8,
    letterSpacing: 0.3,
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#1890ff',
  },
  // 数据统计样式
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 24,
    shadowColor: '#1890ff',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#f0f0f0',
    alignSelf: 'center',
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8},
  card: {
    width: '48%', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginBottom: 12, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    marginRight: '4%',
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {fontSize: 32},
  cardTitle: {fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4},
  cardDesc: {fontSize: 12, color: '#999', lineHeight: 18},
  section: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16,
    marginTop: 8,
  },
  sectionTitle: {fontSize: 19, fontWeight: 'bold', color: '#333'},
  moreText: {fontSize: 14, color: '#1890ff', fontWeight: '500'},
  listItem: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16,
    marginBottom: 12, padding: 14, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
    alignItems: 'center',
  },
  offerIconBox: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
    borderWidth: 1,
    borderColor: '#bae7ff',
  },
  itemContent: {flex: 1, marginRight: 10},
  itemTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4},
  itemMeta: {fontSize: 13, color: '#999', marginTop: 2},
  itemPrice: {fontSize: 16, color: '#f5222d', fontWeight: 'bold'},
  itemLocation: {fontSize: 13, color: '#999', marginTop: 4},
  demandHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  demandBudget: {fontSize: 14, color: '#f5222d', marginTop: 2, fontWeight: '500'},
  urgentBadge: {backgroundColor: '#ff4d4f', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8},
  urgentText: {color: '#fff', fontSize: 11, fontWeight: '600'},
  cargoIconBox: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff7e6',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
    borderWidth: 1,
    borderColor: '#ffd591',
  },
  cargoMeta: {fontSize: 13, color: '#999', marginTop: 2},
  cargoPrice: {fontSize: 16, color: '#fa8c16', fontWeight: 'bold'},
  // 空状态样式
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#bbb',
  },
});
