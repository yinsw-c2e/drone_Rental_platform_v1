import React, {useEffect, useState} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import {useSelector} from 'react-redux';
import {demandService} from '../../services/demand';
import {RentalOffer} from '../../types';
import {RootState} from '../../store/store';

export default function OfferDetailScreen({route, navigation}: any) {
  const {id} = route.params;
  const [offer, setOffer] = useState<RentalOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  
  // 判断是否是自己的供给
  const isMyOffer = offer?.owner_id === currentUser?.id;

  useEffect(() => {
    fetchOffer();
  }, [id]);

  const fetchOffer = async () => {
    try {
      const res = await demandService.getOffer(id);
      setOffer(res.data);
    } catch (e) {
      Alert.alert('错误', '获取供给详情失败');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = () => {
    if (!offer?.price) return '价格面议';
    return offer.price_type === 'hourly'
      ? `¥${offer.price}/小时`
      : `¥${offer.price}/天`;
  };

  const handleUpdateStatus = async (newStatus: string) => {
    const statusTexts: Record<string, string> = {
      active: '恢复供给',
      paused: '暂停供给',
      closed: '关闭供给',
    };
    
    Alert.alert(
      '确认操作',
      `确认${statusTexts[newStatus]}？`,
      [
        {text: '取消', style: 'cancel'},
        {
          text: '确认',
          onPress: async () => {
            try {
              await demandService.updateOffer(id, {status: newStatus});
              Alert.alert('成功', `${statusTexts[newStatus]}成功`);
              fetchOffer(); // 重新加载
            } catch (e) {
              Alert.alert('错误', '操作失败');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 100}} color="#1890ff" />
      </SafeAreaView>
    );
  }

  if (!offer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚁</Text>
          <Text style={styles.emptyText}>供给信息不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Text style={{fontSize: 48}}>🚁</Text>
          </View>
          <Text style={styles.title}>{offer.title}</Text>
          <Text style={styles.price}>{formatPrice()}</Text>
          {offer.status !== 'active' && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {offer.status === 'closed' ? '已关闭' : '不可用'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服务信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务类型</Text>
            <Text style={styles.infoValue}>{offer.service_type || '租赁'}</Text>
          </View>

          {offer.drone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>无人机状态</Text>
              <View style={[styles.droneStatusBadge, {
                backgroundColor: offer.drone.availability_status === 'available' ? '#52c41a' : 
                                offer.drone.availability_status === 'rented' ? '#fa8c16' : '#999'
              }]}>
                <Text style={styles.droneStatusText}>
                  {offer.drone.availability_status === 'available' ? '空闲可租' :
                   offer.drone.availability_status === 'rented' ? '使用中，可预约' : '维护中'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>详细地址</Text>
            <Text style={styles.infoValue}>{offer.address || '未设置'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服务描述</Text>
          <Text style={styles.description}>{offer.description || '暂无描述'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>机主信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>昵称</Text>
            <Text style={styles.infoValue}>{offer.owner?.nickname || '未知'}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!isMyOffer && offer.status === 'active' && (
          <TouchableOpacity
            style={styles.rentBtn}
            onPress={() => {
              if (offer.drone?.availability_status === 'rented') {
                Alert.alert('提示', '无人机当前使用中，请联系机主预约');
                return;
              }
              // 跳转到创建订单页面
              navigation.navigate('CreateOrder', {
                offerId: offer.id,
                droneId: offer.drone_id,
                ownerId: offer.owner_id,
                serviceType: offer.service_type,
                title: offer.title,
                price: offer.price,
                priceType: offer.price_type,
              });
            }}>
            <Text style={styles.rentBtnText}>立即租赁</Text>
          </TouchableOpacity>
        )}
        
        {isMyOffer && (
          <>
            {offer.status === 'active' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.pauseBtn]}
                onPress={() => handleUpdateStatus('paused')}>
                <Text style={styles.actionBtnText}>暂停供给</Text>
              </TouchableOpacity>
            )}
            {offer.status === 'paused' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.resumeBtn]}
                onPress={() => handleUpdateStatus('active')}>
                <Text style={styles.actionBtnText}>恢复供给</Text>
              </TouchableOpacity>
            )}
            {offer.status !== 'closed' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.closeBtn]}
                onPress={() => handleUpdateStatus('closed')}>
                <Text style={styles.actionBtnText}>关闭供给</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        
        {!isMyOffer && (
          <TouchableOpacity
            style={[styles.contactBtn, offer.status === 'active' && styles.contactBtnSecondary]}
            onPress={() => {
              if (offer.owner?.id) {
                navigation.navigate('Messages', {
                  screen: 'Chat',
                  params: {peerId: offer.owner.id, peerName: offer.owner.nickname},
                });
              }
            }}>
            <Text style={[styles.contactBtnText, offer.status === 'active' && styles.contactBtnTextSecondary]}>
              联系机主
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scroll: {flex: 1},
  header: {
    backgroundColor: '#fff', padding: 24, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  iconBox: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  title: {fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center'},
  price: {fontSize: 24, color: '#f5222d', fontWeight: 'bold', marginTop: 8},
  statusBadge: {
    backgroundColor: '#ff4d4f', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, marginTop: 8,
  },
  statusText: {color: '#fff', fontSize: 12, fontWeight: '500'},
  section: {
    backgroundColor: '#fff', marginTop: 10, padding: 16,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0',
  },
  sectionTitle: {fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12},
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: {fontSize: 14, color: '#666'},
  infoValue: {fontSize: 14, color: '#333', fontWeight: '500'},
  description: {fontSize: 14, color: '#666', lineHeight: 22},
  footer: {
    backgroundColor: '#fff', padding: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0',
    flexDirection: 'row', gap: 10,
  },
  rentBtn: {
    flex: 1, backgroundColor: '#1890ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  rentBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  contactBtn: {
    flex: 1, backgroundColor: '#1890ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  contactBtnSecondary: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#1890ff',
  },
  contactBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  contactBtnTextSecondary: {color: '#1890ff'},
  droneStatusBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4},
  droneStatusText: {color: '#fff', fontSize: 12, fontWeight: '500'},
  actionBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center',
    marginHorizontal: 4,
  },
  pauseBtn: {backgroundColor: '#fa8c16'},
  resumeBtn: {backgroundColor: '#52c41a'},
  closeBtn: {backgroundColor: '#999'},
  actionBtnText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  empty: {alignItems: 'center', paddingTop: 100},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999'},
});
