import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, FlatList, Dimensions,
  Alert,
} from 'react-native';
import {droneService} from '../../services/drone';
import {reviewService} from '../../services/review';
import {Drone, Review} from '../../types';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const AVAILABILITY_MAP: Record<string, {label: string; color: string}> = {
  available: {label: '可租赁', color: '#52c41a'},
  rented: {label: '租赁中', color: '#faad14'},
  maintenance: {label: '维护中', color: '#ff4d4f'},
  offline: {label: '已下线', color: '#999'},
};

export default function DroneDetailScreen({route, navigation}: any) {
  const {id} = route.params;
  const [drone, setDrone] = useState<Drone | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [droneRes, reviewRes] = await Promise.all([
        droneService.getById(id),
        reviewService.listByTarget('drone', id, {page: 1, page_size: 10}).catch(() => null),
      ]);
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
      Alert.alert('提示', '该无人机当前不可租赁');
      return;
    }
    // 只传递必要的字段，避免参数过大
    const droneParams = {
      id: drone.id,
      brand: drone.brand,
      model: drone.model,
      daily_price: drone.daily_price,
      deposit: drone.deposit,
      owner_id: drone.owner_id,
    };
    navigation.navigate('CreateOrder', {drone: droneParams});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>无人机详情</Text>
          <View style={{width: 60}} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1890ff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!drone) {
    return (
      <SafeAreaView style={styles.container}>
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

  const availability = AVAILABILITY_MAP[drone.availability_status] || {label: drone.availability_status, color: '#999'};
  const images = drone.images?.length ? drone.images : [];

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={{color: i <= rating ? '#faad14' : '#ddd', fontSize: 14}}>
          {'\u2605'}
        </Text>,
      );
    }
    return <View style={{flexDirection: 'row'}}>{stars}</View>;
  };

  return (
    <SafeAreaView style={styles.container}>
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
            <View style={[styles.statusBadge, {backgroundColor: availability.color}]}>
              <Text style={styles.statusText}>{availability.label}</Text>
            </View>
          </View>
          {drone.description ? (
            <Text style={styles.description}>{drone.description}</Text>
          ) : null}
          <View style={styles.ratingRow}>
            {renderStars(Math.round(drone.rating || 0))}
            <Text style={styles.ratingText}>{drone.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.orderCount}>{drone.order_count || 0}次租赁</Text>
          </View>
        </View>

        {/* Price Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>价格信息</Text>
          <View style={styles.priceRow}>
            {drone.daily_price > 0 && (
              <View style={styles.priceItem}>
                <Text style={styles.priceValue}>{'\u00a5'}{drone.daily_price}</Text>
                <Text style={styles.priceLabel}>日租金</Text>
              </View>
            )}
            {drone.hourly_price > 0 && (
              <View style={styles.priceItem}>
                <Text style={styles.priceValue}>{'\u00a5'}{drone.hourly_price}</Text>
                <Text style={styles.priceLabel}>时租金</Text>
              </View>
            )}
            {drone.deposit > 0 && (
              <View style={styles.priceItem}>
                <Text style={[styles.priceValue, {color: '#faad14'}]}>{'\u00a5'}{drone.deposit}</Text>
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
        {drone.owner && (
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
            {drone.availability_status === 'available' ? '立即租赁' : availability.label}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e8e8e8',
  },
  backBtn: {width: 60},
  backText: {fontSize: 16, color: '#1890ff'},
  headerTitle: {fontSize: 18, fontWeight: '600', color: '#333'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {fontSize: 16, color: '#999'},
  scrollContent: {flex: 1},

  // Image gallery
  imageSlide: {width: SCREEN_WIDTH, height: 240, backgroundColor: '#e6f7ff'},
  imagePlaceholder: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  imageUri: {fontSize: 12, color: '#999', marginTop: 8, paddingHorizontal: 20},
  imageDots: {flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, backgroundColor: '#fff'},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#ddd', marginHorizontal: 3},
  dotActive: {backgroundColor: '#1890ff', width: 16},
  noImage: {height: 200, backgroundColor: '#e6f7ff', justifyContent: 'center', alignItems: 'center'},
  noImageText: {fontSize: 14, color: '#999', marginTop: 8},

  // Cards
  card: {backgroundColor: '#fff', padding: 16, marginBottom: 10},
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12},

  // Title
  titleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  droneName: {fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  statusText: {color: '#fff', fontSize: 12, fontWeight: '500'},
  description: {fontSize: 14, color: '#666', marginTop: 8, lineHeight: 20},
  ratingRow: {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  ratingText: {fontSize: 14, color: '#faad14', fontWeight: '600', marginLeft: 6},
  orderCount: {fontSize: 12, color: '#999', marginLeft: 12},

  // Price
  priceRow: {flexDirection: 'row', justifyContent: 'space-around'},
  priceItem: {alignItems: 'center'},
  priceValue: {fontSize: 20, fontWeight: 'bold', color: '#f5222d'},
  priceLabel: {fontSize: 12, color: '#999', marginTop: 4},

  // Specs
  specGrid: {flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12},
  specItem: {alignItems: 'center'},
  specValue: {fontSize: 16, fontWeight: '600', color: '#333'},
  specLabel: {fontSize: 12, color: '#999', marginTop: 4},
  featureRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 4},
  featureTag: {
    backgroundColor: '#e6f7ff', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginRight: 8, marginBottom: 6,
  },
  featureText: {fontSize: 12, color: '#1890ff'},

  // Owner
  ownerRow: {flexDirection: 'row', alignItems: 'center'},
  ownerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1890ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  ownerAvatarText: {fontSize: 18, color: '#fff', fontWeight: 'bold'},
  ownerName: {fontSize: 15, fontWeight: '600', color: '#333'},
  ownerMeta: {fontSize: 12, color: '#999', marginTop: 2},
  contactBtn: {
    borderWidth: 1, borderColor: '#1890ff', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 16,
  },
  contactBtnText: {color: '#1890ff', fontSize: 13},

  // Location
  address: {fontSize: 14, color: '#666'},

  // Reviews
  reviewItem: {paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5'},
  reviewHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  reviewDate: {fontSize: 12, color: '#999'},
  reviewContent: {fontSize: 14, color: '#333', marginTop: 6, lineHeight: 20},
  emptyReview: {textAlign: 'center', color: '#999', paddingVertical: 16},

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 12,
    borderTopWidth: 1, borderTopColor: '#e8e8e8',
    paddingBottom: 24,
  },
  bottomContactBtn: {
    flex: 1, height: 44, borderWidth: 1, borderColor: '#1890ff',
    borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  bottomContactText: {color: '#1890ff', fontSize: 16, fontWeight: '600'},
  bottomRentBtn: {
    flex: 2, height: 44, backgroundColor: '#1890ff',
    borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  bottomRentText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  bottomBtnDisabled: {backgroundColor: '#ccc'},
});
