import React, {useEffect, useState} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {demandService} from '../../services/demand';
import {CargoDemand} from '../../types';

export default function CargoDetailScreen({route, navigation}: any) {
  const {id} = route.params;
  const [cargo, setCargo] = useState<CargoDemand | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    fetchCargo();
  }, [id]);

  const fetchCargo = async () => {
    try {
      const res = await demandService.getCargo(id);
      setCargo(res.data);
    } catch (e) {
      Alert.alert('错误', '获取货运需求详情失败');
    } finally {
      setLoading(false);
    }
  };

  const getCargoTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      package: '包裹快递',
      equipment: '设备器材',
      material: '物资材料',
      other: '其他货物',
    };
    return typeMap[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      active: '待接单',
      matched: '已匹配',
      in_progress: '运输中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      active: '#52c41a',
      matched: '#1890ff',
      in_progress: '#fa8c16',
      completed: '#999',
      cancelled: '#999',
    };
    return colorMap[status] || '#999';
  };

  const handleContact = () => {
    if (!cargo?.publisher_id) return;
    // 跳转到聊天页面（使用嵌套导航）
    navigation.navigate('Messages', {
      screen: 'Chat',
      params: {
        peerId: cargo.publisher_id,
        peerName: cargo.publisher?.nickname || '发布者',
      },
    });
  };

  const handleAccept = () => {
    // 跳转到选择无人机页面，然后创建货运订单
    navigation.navigate('CargoAccept', {
      cargoId: cargo?.id,
      cargoData: cargo,
    });
  };

  // 判断是否为发布者
  const isPublisher = cargo?.publisher_id === currentUser?.id;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 100}} color="#fa8c16" />
      </SafeAreaView>
    );
  }

  if (!cargo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>货运需求不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 状态标签 */}
        <View style={[styles.statusBadge, {backgroundColor: getStatusColor(cargo.status) + '20'}]}>
          <Text style={[styles.statusText, {color: getStatusColor(cargo.status)}]}>
            {getStatusLabel(cargo.status)}
          </Text>
        </View>

        {/* 基本信息卡片 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>货物信息</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{getCargoTypeLabel(cargo.cargo_type)}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>重量：</Text>
            <Text style={styles.infoValue}>{cargo.cargo_weight} kg</Text>
          </View>
          {cargo.cargo_description && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>描述：</Text>
              <Text style={[styles.infoValue, {flex: 1}]}>{cargo.cargo_description}</Text>
            </View>
          )}
        </View>

        {/* 配送信息卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>配送信息</Text>
          <View style={styles.addressBox}>
            <View style={styles.addressIcon}>
              <Text style={styles.addressIconText}>🔵</Text>
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>取货地址</Text>
              <Text style={styles.addressText}>{cargo.pickup_address}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.addressBox}>
            <View style={styles.addressIcon}>
              <Text style={styles.addressIconText}>🔴</Text>
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>送达地址</Text>
              <Text style={styles.addressText}>{cargo.delivery_address}</Text>
            </View>
          </View>
          {cargo.distance > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>配送距离：</Text>
              <Text style={styles.infoValue}>{cargo.distance.toFixed(1)} km</Text>
            </View>
          )}
          {cargo.pickup_time && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>取货时间：</Text>
              <Text style={styles.infoValue}>{cargo.pickup_time.slice(0, 16).replace('T', ' ')}</Text>
            </View>
          )}
        </View>

        {/* 价格信息卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>价格信息</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>货主出价</Text>
            <Text style={styles.priceValue}>¥{(cargo.offered_price / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* 发布者信息 */}
        {cargo.publisher && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>发布者</Text>
            <View style={styles.publisherRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {cargo.publisher.nickname?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={styles.publisherInfo}>
                <Text style={styles.publisherName}>{cargo.publisher.nickname || '未命名'}</Text>
                <Text style={styles.publisherMeta}>
                  信用分：{cargo.publisher.credit_score || 0}
                </Text>
              </View>
              {!isPublisher && (
                <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
                  <Text style={styles.contactBtnText}>联系</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 底部操作栏 */}
      {cargo.status === 'active' && !isPublisher && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptBtnText}>接单</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  content: {paddingBottom: 100},
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, margin: 16, marginBottom: 8,
  },
  statusText: {fontSize: 14, fontWeight: '600'},
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 8,
    borderRadius: 12, padding: 16,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  cardTitle: {fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12},
  typeBadge: {
    backgroundColor: '#fff7e6', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1, borderColor: '#ffd591',
  },
  typeText: {fontSize: 12, color: '#fa8c16', fontWeight: '600'},
  infoRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  infoLabel: {fontSize: 14, color: '#999', minWidth: 80},
  infoValue: {fontSize: 14, color: '#333', fontWeight: '500'},
  addressBox: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8},
  addressIcon: {width: 24, alignItems: 'center', marginRight: 8},
  addressIconText: {fontSize: 16},
  addressContent: {flex: 1},
  addressLabel: {fontSize: 12, color: '#999', marginBottom: 4},
  addressText: {fontSize: 14, color: '#333', lineHeight: 20},
  routeLine: {
    width: 2, height: 20, backgroundColor: '#e8e8e8',
    marginLeft: 11, marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  priceLabel: {fontSize: 15, color: '#666'},
  priceValue: {fontSize: 22, color: '#fa8c16', fontWeight: 'bold'},
  publisherRow: {flexDirection: 'row', alignItems: 'center'},
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fa8c16',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: {fontSize: 18, color: '#fff', fontWeight: 'bold'},
  publisherInfo: {flex: 1},
  publisherName: {fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4},
  publisherMeta: {fontSize: 12, color: '#999'},
  contactBtn: {
    paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#fa8c16',
    borderRadius: 20,
  },
  contactBtnText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  acceptBtn: {
    height: 48, backgroundColor: '#fa8c16', borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  acceptBtnText: {color: '#fff', fontSize: 17, fontWeight: 'bold'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 64, marginBottom: 16},
  emptyText: {fontSize: 16, color: '#999'},
});
