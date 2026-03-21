import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, FlatList, Dimensions,
  Alert,
} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {droneService} from '../../services/drone';
import {reviewService} from '../../services/review';
import {Drone, Review} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const AVAILABILITY_MAP: Record<string, {label: string; colorKey: 'success' | 'warning' | 'danger' | 'textHint'}> = {
  available: {label: '可接单', colorKey: 'success'},
  rented: {label: '执行中', colorKey: 'warning'},
  maintenance: {label: '维护中', colorKey: 'danger'},
  offline: {label: '已下线', colorKey: 'textHint'},
};

export default function DroneDetailScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {id} = route.params;
  console.log('[DroneDetailScreen] Mounted with params:', route.params, 'id:', id);
  
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [drone, setDrone] = useState<Drone | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);

  // 判断是否是自己的无人机
  const isOwner = drone?.owner_id === currentUser?.id;

  const fetchData = useCallback(async () => {
    console.log('[DroneDetailScreen] fetchData called with id:', id);
    setLoading(true);
    try {
      const [droneRes, reviewRes] = await Promise.all([
        droneService.getById(id),
        reviewService.listByTarget('drone', id, {page: 1, page_size: 10}).catch(() => null),
      ]);
      console.log('[DroneDetailScreen] API responses:', { droneRes, reviewRes });
      setDrone(droneRes.data);
      if (reviewRes?.data?.list) {
        setReviews(reviewRes.data.list);
      }
    } catch (e) {
      console.error('获取无人机详情失败:', e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleContact = () => {
    if (!drone?.owner) {
      Alert.alert('提示', '无法获取机主信息');
      return;
    }
    navigation.navigate('Messages', {
      screen: 'Chat',
      params: {peerId: drone.owner_id, peerName: drone.owner.nickname},
    });
  };

  const handleRent = () => {
    if (!drone) return;
    if (drone.availability_status !== 'available') {
      Alert.alert('提示', '该无人机当前不可接入市场链路');
      return;
    }
    Alert.alert('入口已切换', '新版下单链路统一从供给市场发起。', [
      {text: '取消', style: 'cancel'},
      {text: '去供给市场', onPress: () => navigation.navigate('OfferList')},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>无人机详情</Text>
          <View style={{width: 60}} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!drone) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>无人机详情</Text>
          <View style={{width: 60}} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>无人机不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  const availability = AVAILABILITY_MAP[drone.availability_status] || {label: drone.availability_status, colorKey: 'textHint' as const};
    const availColor = theme[availability.colorKey];
  const images = drone.images?.length ? drone.images : [];

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={{color: i <= rating ? theme.warning : theme.divider, fontSize: 14}}>
          {'\u2605'}
        </Text>,
      );
    }
    return <View style={{flexDirection: 'row'}}>{stars}</View>;
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>无人机详情</Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView style={styles.scrollContent}>
        {/* Image Gallery */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                setCurrentImage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
              }}>
              {images.map((uri, idx) => (
                <View key={idx} style={styles.imageSlide}>
                  <View style={styles.imagePlaceholder}>
                    <Text style={{fontSize: 48}}>{'🚁'}</Text>
                    <Text style={styles.imageUri} numberOfLines={1}>{uri}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.imageDots}>
                {images.map((_, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, idx === currentImage && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noImage}>
            <Text style={{fontSize: 64}}>{'🚁'}</Text>
            <Text style={styles.noImageText}>暂无图片</Text>
          </View>
        )}

        {/* Basic Info */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.droneName}>{drone.brand} {drone.model}</Text>
            <View style={[styles.statusBadge, {backgroundColor: availColor}]}>
              <Text style={styles.statusText}>{availability.label}</Text>
            </View>
          </View>
          {drone.description ? (
            <Text style={styles.description}>{drone.description}</Text>
          ) : null}
          <View style={styles.ratingRow}>
            {renderStars(Math.round(drone.rating || 0))}
            <Text style={styles.ratingText}>{drone.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.orderCount}>{drone.order_count || 0}次履约</Text>
          </View>
        </View>

        {/* Price Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>价格信息</Text>
          <View style={styles.priceRow}>
            {drone.daily_price > 0 && (
              <View style={styles.priceItem}>
                <Text style={styles.priceValue}>{'¥'}{(drone.daily_price / 100).toFixed(0)}</Text>
                <Text style={styles.priceLabel}>日租金</Text>
              </View>
            )}
            {drone.hourly_price > 0 && (
              <View style={styles.priceItem}>
                <Text style={styles.priceValue}>{'¥'}{(drone.hourly_price / 100).toFixed(0)}</Text>
                <Text style={styles.priceLabel}>时租金</Text>
              </View>
            )}
            {drone.deposit > 0 && (
              <View style={styles.priceItem}>
                <Text style={[styles.priceValue, {color: theme.warning}]}>{'¥'}{(drone.deposit / 100).toFixed(0)}</Text>
                <Text style={styles.priceLabel}>押金</Text>
              </View>
            )}
          </View>
        </View>

        {/* Specs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>设备规格</Text>
          <View style={styles.specGrid}>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{drone.max_load || '-'} kg</Text>
              <Text style={styles.specLabel}>最大载重</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{drone.max_flight_time || '-'} min</Text>
              <Text style={styles.specLabel}>最大续航</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{drone.max_distance || '-'} km</Text>
              <Text style={styles.specLabel}>最远距离</Text>
            </View>
          </View>
          {drone.features?.length > 0 && (
            <View style={styles.featureRow}>
              {drone.features.map((f, i) => (
                <View key={i} style={styles.featureTag}>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Owner Info */}
        {drone.owner && !isOwner && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>机主信息</Text>
            <View style={styles.ownerRow}>
              <View style={styles.ownerAvatar}>
                <Text style={styles.ownerAvatarText}>
                  {drone.owner.nickname?.charAt(0) || 'U'}
                </Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.ownerName}>{drone.owner.nickname}</Text>
                <Text style={styles.ownerMeta}>
                  {drone.owner.id_verified === 'approved' ? '已实名认证' : '未认证'}
                  {' '}|{' '}信用分 {drone.owner.credit_score || 100}
                </Text>
              </View>
              <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
                <Text style={styles.contactBtnText}>联系</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Location */}
        {drone.address ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>设备位置</Text>
            <Text style={styles.address}>{drone.address}</Text>
          </View>
        ) : null}

        {/* Reviews */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            用户评价 {reviews.length > 0 ? `(${reviews.length})` : ''}
          </Text>
          {reviews.length > 0 ? (
            reviews.map(review => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  {renderStars(review.rating)}
                  <Text style={styles.reviewDate}>
                    {review.created_at?.slice(0, 10)}
                  </Text>
                </View>
                <Text style={styles.reviewContent}>{review.content}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyReview}>暂无评价</Text>
          )}
        </View>

        <View style={{height: 100}} />
      </ScrollView>

      {/* Bottom Action Bar */}
      {!isOwner && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomContactBtn} onPress={handleContact}>
            <Text style={styles.bottomContactText}>联系机主</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.bottomRentBtn,
              drone.availability_status !== 'available' && styles.bottomBtnDisabled,
            ]}
            onPress={handleRent}>
            <Text style={styles.bottomRentText}>
              {drone.availability_status === 'available' ? '去供给市场' : availability.label}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.card, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  backBtn: {width: 60},
  backText: {fontSize: 16, color: theme.primaryText},
  headerTitle: {fontSize: 18, fontWeight: '600', color: theme.text},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {fontSize: 16, color: theme.textSub},
  scrollContent: {flex: 1},

  // Image gallery
  imageSlide: {width: SCREEN_WIDTH, height: 240, backgroundColor: theme.primaryBg},
  imagePlaceholder: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  imageUri: {fontSize: 12, color: theme.textSub, marginTop: 8, paddingHorizontal: 20},
  imageDots: {flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, backgroundColor: theme.card},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: theme.divider, marginHorizontal: 3},
  dotActive: {backgroundColor: theme.primary, width: 16},
  noImage: {height: 200, backgroundColor: theme.primaryBg, justifyContent: 'center', alignItems: 'center'},
  noImageText: {fontSize: 14, color: theme.textSub, marginTop: 8},

  // Cards
  card: {backgroundColor: theme.card, padding: 16, marginBottom: 10},
  cardTitle: {fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 12},

  // Title
  titleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  droneName: {fontSize: 20, fontWeight: 'bold', color: theme.text, flex: 1},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  statusText: {color: theme.btnPrimaryText, fontSize: 12, fontWeight: '500'},
  description: {fontSize: 14, color: theme.textSub, marginTop: 8, lineHeight: 20},
  ratingRow: {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  ratingText: {fontSize: 14, color: theme.warning, fontWeight: '600', marginLeft: 6},
  orderCount: {fontSize: 12, color: theme.textSub, marginLeft: 12},

  // Price
  priceRow: {flexDirection: 'row', justifyContent: 'space-around'},
  priceItem: {alignItems: 'center'},
  priceValue: {fontSize: 20, fontWeight: 'bold', color: theme.danger},
  priceLabel: {fontSize: 12, color: theme.textSub, marginTop: 4},

  // Specs
  specGrid: {flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12},
  specItem: {alignItems: 'center'},
  specValue: {fontSize: 16, fontWeight: '600', color: theme.text},
  specLabel: {fontSize: 12, color: theme.textSub, marginTop: 4},
  featureRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 4},
  featureTag: {
    backgroundColor: theme.primaryBg, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginRight: 8, marginBottom: 6,
  },
  featureText: {fontSize: 12, color: theme.primaryText},

  // Owner
  ownerRow: {flexDirection: 'row', alignItems: 'center'},
  ownerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  ownerAvatarText: {fontSize: 18, color: theme.btnPrimaryText, fontWeight: 'bold'},
  ownerName: {fontSize: 15, fontWeight: '600', color: theme.text},
  ownerMeta: {fontSize: 12, color: theme.textSub, marginTop: 2},
  contactBtn: {
    borderWidth: 1, borderColor: theme.primary, paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 16,
  },
  contactBtnText: {color: theme.primaryText, fontSize: 13},

  // Location
  address: {fontSize: 14, color: theme.textSub},

  // Reviews
  reviewItem: {paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider},
  reviewHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  reviewDate: {fontSize: 12, color: theme.textSub},
  reviewContent: {fontSize: 14, color: theme.text, marginTop: 6, lineHeight: 20},
  emptyReview: {textAlign: 'center', color: theme.textSub, paddingVertical: 16},

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', backgroundColor: theme.card, padding: 12,
    borderTopWidth: 1, borderTopColor: theme.divider,
    paddingBottom: 24,
  },
  bottomContactBtn: {
    flex: 1, height: 44, borderWidth: 1, borderColor: theme.primary,
    borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  bottomContactText: {color: theme.primaryText, fontSize: 16, fontWeight: '600'},
  bottomRentBtn: {
    flex: 2, height: 44, backgroundColor: theme.primary,
    borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  bottomRentText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '600'},
  bottomBtnDisabled: {backgroundColor: theme.cardBorder},
});
