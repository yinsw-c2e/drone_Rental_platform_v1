import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, Dimensions,
  Alert, Platform,
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

const isApprovedStatus = (value?: string) => value === 'approved' || value === 'verified';

export default function DroneDetailScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {id} = route.params;

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [drone, setDrone] = useState<Drone | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);

  // 判断是否是自己的无人机
  const isOwner = drone?.owner_id === currentUser?.id;

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
    if (!drone?.owner_id) {
      Alert.alert('提示', '无法获取机主信息');
      return;
    }
    navigation.navigate('Messages', {
      screen: 'Chat',
      params: {peerId: drone.owner_id, peerName: drone.owner?.nickname || '机主'},
    });
  };

  const handleRent = () => {
    if (!drone) return;
    if (drone.availability_status !== 'available') {
      Alert.alert('提示', '该无人机当前不可接入市场链路');
      return;
    }
    Alert.alert('入口已切换', '新版下单链路统一从服务列表发起。', [
      {text: '取消', style: 'cancel'},
      {text: '快速下单', onPress: () => navigation.navigate('QuickOrderEntry')},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>˂ 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>资产详情</Text>
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
            <Text style={styles.backText}>˂ 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>资产详情</Text>
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
  const approvedCount = [
    drone.certification_status,
    drone.uom_verified,
    drone.insurance_verified,
    drone.airworthiness_verified,
  ].filter(value => isApprovedStatus(value)).length;

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
          <Text style={styles.backText}>˂ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>资产详情</Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                    <Text style={{fontSize: 64}}>{'🚁'}</Text>
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
            <Text style={styles.noImageText}>暂无实拍图</Text>
          </View>
        )}

        {/* Hero Info */}
        <View style={styles.heroInfoCard}>
          <View style={styles.titleRow}>
            <View style={{flex: 1}}>
              <Text style={styles.droneName}>{drone.brand} {drone.model}</Text>
              <Text style={styles.droneSn}>SN: {(drone as any).sn || '未录入'}</Text>
            </View>
            <View style={[styles.statusBadge, {backgroundColor: availColor + '20'}]}>
              <View style={[styles.statusDot, {backgroundColor: availColor}]} />
              <Text style={[styles.statusText, {color: availColor}]}>{availability.label}</Text>
            </View>
          </View>
          <View style={styles.ratingBar}>
            {renderStars(Math.round(drone.rating || 0))}
            <Text style={styles.ratingVal}>{drone.rating?.toFixed(1) || '5.0'}</Text>
            <View style={styles.ratingDivider} />
            <Text style={styles.usageCount}>{drone.order_count || 0} 次任务执行</Text>
          </View>
        </View>

        {/* Qualifications - Market Readiness */}
        {isOwner && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>准入合规进度</Text>
              <View style={styles.readyCountBadge}>
                <Text style={styles.readyCountText}>{approvedCount}/4</Text>
              </View>
            </View>
            <Text style={styles.progressSub}>上架主市场需完成以下四项核心资质审核：</Text>
            <View style={styles.checklist}>
              <ChecklistItem label="基础资质备案" status={drone.certification_status} theme={theme} />
              <ChecklistItem label="UOM 实名认证" status={drone.uom_verified} theme={theme} />
              <ChecklistItem label="三者险/机身险" status={drone.insurance_verified} theme={theme} />
              <ChecklistItem label="适航证/登记证" status={drone.airworthiness_verified} theme={theme} />
            </View>
            <TouchableOpacity
              style={styles.manageCertBtn}
              onPress={() => navigation.navigate('DroneCertification', {id: drone.id})}
            >
              <Text style={styles.manageCertText}>管理资质证明 ˃</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Key Specs Datasheet */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>核心规格参数</Text>
          <View style={styles.specGridRow}>
            <View style={styles.specBox}>
              <Text style={styles.specVal}>{drone.max_load || '-'} <Text style={styles.specUnit}>kg</Text></Text>
              <Text style={styles.specLab}>最大载重</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specVal}>{drone.max_flight_time || '-'} <Text style={styles.specUnit}>min</Text></Text>
              <Text style={styles.specLab}>最大续航</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specVal}>{drone.max_distance || '-'} <Text style={styles.specUnit}>km</Text></Text>
              <Text style={styles.specLab}>最远航程</Text>
            </View>
          </View>
          <View style={styles.featureTagsRow}>
            {(drone.features || []).map((f, i) => (
              <View key={i} style={styles.fTag}>
                <Text style={styles.fTagText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Detailed Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>设备说明</Text>
          <Text style={styles.longDesc}>{drone.description || '机主未提供详细文字描述。'}</Text>
          <View style={styles.infoList}>
            <InfoItem label="目前位置" value={drone.address || '机主未公开'} theme={theme} />
            <InfoItem label="日常维护" value={drone.availability_status === 'maintenance' ? '维护中' : '正常'} theme={theme} />
          </View>
        </View>

        {/* Owner context if not owner */}
        {drone.owner && !isOwner && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>所属机主</Text>
            <View style={styles.ownerBrief}>
              <View style={styles.ownerAvatar}>
                <Text style={styles.ownerInitial}>{drone.owner.nickname?.charAt(0) || 'U'}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.ownerNick}>{drone.owner.nickname}</Text>
                <Text style={styles.ownerBadge}>{drone.owner.id_verified === 'approved' ? '✅ 已实名认证' : '⚠️ 身份待核实'}</Text>
              </View>
              <TouchableOpacity style={styles.inlineContactBtn} onPress={handleContact}>
                <Text style={styles.inlineContactText}>联系</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{height: 120}} />
      </ScrollView>

      {!isOwner && (
        <View style={styles.footerBar}>
          <TouchableOpacity style={styles.footerGhostBtn} onPress={handleContact}>
            <Text style={styles.footerGhostText}>咨询机主</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerMainBtn, drone.availability_status !== 'available' && styles.footerDisabledBtn]}
            onPress={handleRent}>
            <Text style={styles.footerMainText}>
              {drone.availability_status === 'available' ? '找相关服务' : availability.label}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function ChecklistItem({label, status, theme}: {label: string; status?: string; theme: AppTheme}) {
  const isOk = isApprovedStatus(status);
  const isPending = status === 'pending';
  const styles = getStyles(theme);
  return (
    <View style={styles.checkItem}>
      <Text style={styles.checkLabel}>{label}</Text>
      <View style={[styles.checkStatus, {backgroundColor: isOk ? theme.success + '15' : (isPending ? theme.warning + '15' : theme.bgSecondary)}]}>
        <Text style={[styles.checkStatusText, {color: isOk ? theme.success : (isPending ? theme.warning : theme.textHint)}]}>
          {isOk ? '已达标' : (isPending ? '审核中' : '未就绪')}
        </Text>
      </View>
    </View>
  );
}

function InfoItem({label, value, theme}: {label: string; value: string; theme: AppTheme}) {
  const styles = getStyles(theme);
  return (
    <View style={styles.infoRowItem}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.bg, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  backBtn: {width: 60},
  backText: {fontSize: 16, color: theme.primaryText, fontWeight: '600'},
  headerTitle: {fontSize: 17, fontWeight: '800', color: theme.text},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {fontSize: 16, color: theme.textSub},
  scrollContent: {flex: 1},

  imageSlide: {width: SCREEN_WIDTH, height: 260, backgroundColor: theme.bgSecondary},
  imagePlaceholder: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  imageDots: {flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, backgroundColor: theme.bg},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: theme.divider, marginHorizontal: 4},
  dotActive: {backgroundColor: theme.primary, width: 18},
  noImage: {height: 220, backgroundColor: theme.bgSecondary, justifyContent: 'center', alignItems: 'center'},
  noImageText: {fontSize: 13, color: theme.textHint, marginTop: 12},

  heroInfoCard: {
    backgroundColor: theme.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  titleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  droneName: {fontSize: 22, fontWeight: '900', color: theme.text},
  droneSn: {fontSize: 12, color: theme.textHint, marginTop: 4, letterSpacing: 0.5},
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusDot: {width: 6, height: 6, borderRadius: 3, marginRight: 6},
  statusText: {fontSize: 12, fontWeight: '800'},
  ratingBar: {flexDirection: 'row', alignItems: 'center', marginTop: 16},
  ratingVal: {fontSize: 14, fontWeight: '800', color: theme.warning, marginLeft: 8},
  ratingDivider: {width: 1, height: 12, backgroundColor: theme.divider, marginHorizontal: 12},
  usageCount: {fontSize: 12, color: theme.textSub, fontWeight: '600'},

  card: {backgroundColor: theme.card, padding: 20, marginTop: 10},
  cardHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  cardTitle: {fontSize: 16, fontWeight: '800', color: theme.text},
  readyCountBadge: {backgroundColor: theme.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6},
  readyCountText: {fontSize: 13, fontWeight: '800', color: theme.primaryText},
  progressSub: {fontSize: 12, color: theme.textSub, marginBottom: 16, lineHeight: 18},
  checklist: {gap: 10},
  checkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.bgSecondary,
    padding: 12,
    borderRadius: 12,
  },
  checkLabel: {fontSize: 14, fontWeight: '600', color: theme.text},
  checkStatus: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6},
  checkStatusText: {fontSize: 11, fontWeight: '800'},
  manageCertBtn: {marginTop: 16, alignSelf: 'flex-end'},
  manageCertText: {fontSize: 13, fontWeight: '700', color: theme.primaryText},

  specGridRow: {flexDirection: 'row', gap: 12, marginBottom: 16},
  specBox: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  specVal: {fontSize: 18, fontWeight: '800', color: theme.text},
  specUnit: {fontSize: 11, color: theme.textHint, fontWeight: '600'},
  specLab: {fontSize: 11, color: theme.textSub, marginTop: 4, fontWeight: '600'},
  featureTagsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  fTag: {backgroundColor: theme.primaryBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8},
  fTagText: {fontSize: 12, color: theme.primaryText, fontWeight: '600'},

  longDesc: {fontSize: 14, color: theme.textSub, lineHeight: 22, marginBottom: 16},
  infoList: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider},
  infoRowItem: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider},
  infoRowLabel: {fontSize: 13, color: theme.textHint, fontWeight: '600'},
  infoRowValue: {fontSize: 13, color: theme.text, fontWeight: '700'},

  ownerBrief: {flexDirection: 'row', alignItems: 'center', gap: 12},
  ownerAvatar: {width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center'},
  ownerInitial: {fontSize: 18, color: '#FFFFFF', fontWeight: '800'},
  ownerNick: {fontSize: 15, fontWeight: '700', color: theme.text},
  ownerBadge: {fontSize: 11, color: theme.textSub, marginTop: 2},
  inlineContactBtn: {borderWidth: 1, borderColor: theme.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10},
  inlineContactText: {fontSize: 13, color: theme.primaryText, fontWeight: '700'},

  footerBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: theme.card, padding: 16,
    borderTopWidth: 1, borderTopColor: theme.divider,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    gap: 12,
  },
  footerGhostBtn: {flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.divider, alignItems: 'center', justifyContent: 'center'},
  footerGhostText: {fontSize: 15, fontWeight: '700', color: theme.text},
  footerMainBtn: {flex: 2, height: 50, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center'},
  footerMainText: {fontSize: 15, fontWeight: '800', color: '#FFFFFF'},
  footerDisabledBtn: {backgroundColor: theme.divider, opacity: 0.6},
});
