import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {orderService} from '../../services/order';
import {Order} from '../../types';

interface TimelineItem {
  id: number;
  status: string;
  note: string;
  operator_type: string;
  created_at: string;
}

const ORDER_STATUS: Record<string, {label: string; color: string}> = {
  created: {label: '待接单', color: '#faad14'},
  accepted: {label: '已接单', color: '#1890ff'},
  paid: {label: '已支付', color: '#52c41a'},
  in_progress: {label: '进行中', color: '#722ed1'},
  completed: {label: '已完成', color: '#52c41a'},
  cancelled: {label: '已取消', color: '#999'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
  refunded: {label: '已退款', color: '#faad14'},
};

const SERVICE_TYPE_MAP: Record<string, string> = {
  rental: '租赁',
  aerial_photo: '航拍',
  cargo: '货运',
};

export default function OrderDetailScreen({route, navigation}: any) {
  const {id} = route.params;
  const user = useSelector((state: RootState) => state.auth.user);
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, timelineRes] = await Promise.all([
        orderService.getById(id),
        orderService.getTimeline(id).catch(() => null),
      ]);
      setOrder(orderRes.data);
      if (timelineRes?.data) {
        setTimeline(Array.isArray(timelineRes.data) ? timelineRes.data : []);
      }
    } catch (e) {
      console.error('获取订单详情失败:', e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isOwner = user?.id === order?.owner_id;
  const isRenter = user?.id === order?.renter_id;

  const handleAction = async (
    action: () => Promise<any>,
    confirmMsg: string,
    successMsg: string,
  ) => {
    Alert.alert('确认操作', confirmMsg, [
      {text: '取消', style: 'cancel'},
      {
        text: '确定',
        onPress: async () => {
          setActionLoading(true);
          try {
            await action();
            Alert.alert('成功', successMsg);
            fetchData();
          } catch (e: any) {
            Alert.alert('操作失败', e?.response?.data?.message || '请稍后重试');
          }
          setActionLoading(false);
        },
      },
    ]);
  };

  const handleAccept = () =>
    handleAction(() => orderService.accept(id), '确认接受此订单？', '订单已接受');

  const handleReject = () =>
    handleAction(
      () => orderService.reject(id, '机主拒绝'),
      '确认拒绝此订单？',
      '订单已拒绝',
    );

  const handleCancel = () =>
    handleAction(
      () => orderService.cancel(id, '用户取消'),
      '确认取消此订单？',
      '订单已取消',
    );

  const handleStart = () =>
    handleAction(() => orderService.start(id), '确认开始服务？', '服务已开始');

  const handleComplete = () =>
    handleAction(() => orderService.complete(id), '确认完成订单？', '订单已完成');

  const handlePay = () => {
    navigation.navigate('Payment', {order});
  };

  const handleReview = () => {
    navigation.navigate('Review', {order});
  };

  const renderActions = () => {
    if (!order || actionLoading) return null;
    const buttons: {label: string; onPress: () => void; type: 'primary' | 'danger' | 'default'}[] = [];

    if (order.status === 'created') {
      if (isOwner) {
        buttons.push({label: '接受订单', onPress: handleAccept, type: 'primary'});
        buttons.push({label: '拒绝', onPress: handleReject, type: 'danger'});
      }
      if (isRenter) {
        buttons.push({label: '取消订单', onPress: handleCancel, type: 'danger'});
      }
    } else if (order.status === 'accepted') {
      if (isRenter) {
        buttons.push({label: '去支付', onPress: handlePay, type: 'primary'});
        buttons.push({label: '取消订单', onPress: handleCancel, type: 'danger'});
      }
    } else if (order.status === 'paid') {
      if (isOwner) {
        buttons.push({label: '开始服务', onPress: handleStart, type: 'primary'});
      }
      buttons.push({label: '取消订单', onPress: handleCancel, type: 'danger'});
    } else if (order.status === 'in_progress') {
      if (isOwner) {
        buttons.push({label: '完成订单', onPress: handleComplete, type: 'primary'});
      }
    } else if (order.status === 'completed') {
      buttons.push({label: '去评价', onPress: handleReview, type: 'primary'});
    }

    if (buttons.length === 0) return null;

    return (
      <View style={styles.actionBar}>
        {actionLoading && <ActivityIndicator color="#1890ff" style={{marginRight: 12}} />}
        {buttons.map((btn, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.actionBtn,
              btn.type === 'primary' && styles.actionBtnPrimary,
              btn.type === 'danger' && styles.actionBtnDanger,
              btn.type === 'default' && styles.actionBtnDefault,
            ]}
            onPress={btn.onPress}
            disabled={actionLoading}>
            <Text
              style={[
                styles.actionBtnText,
                btn.type === 'primary' && styles.actionBtnTextPrimary,
                btn.type === 'danger' && styles.actionBtnTextDanger,
              ]}>
              {btn.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTimeline = () => {
    if (timeline.length === 0) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>订单进度</Text>
        {timeline.map((item, index) => {
          const status = ORDER_STATUS[item.status] || {label: item.status, color: '#999'};
          const isLast = index === timeline.length - 1;
          return (
            <View key={item.id} style={styles.timelineItem}>
              <View style={styles.timelineDotCol}>
                <View style={[styles.timelineDot, {backgroundColor: index === 0 ? status.color : '#ddd'}]} />
                {!isLast && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineStatus, index === 0 && {color: status.color, fontWeight: '600'}]}>
                  {item.note || status.label}
                </Text>
                <Text style={styles.timelineTime}>{item.created_at?.slice(0, 19).replace('T', ' ')}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
          <View style={{width: 60}} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
          <View style={{width: 60}} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>订单不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = ORDER_STATUS[order.status] || {label: order.status, color: '#999'};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>订单详情</Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, {backgroundColor: statusInfo.color}]}>
          <Text style={styles.statusLabel}>订单状态</Text>
          <Text style={styles.statusValue}>{statusInfo.label}</Text>
          {order.status === 'cancelled' && (order as any).cancel_reason && (
            <Text style={styles.cancelReason}>原因: {(order as any).cancel_reason}</Text>
          )}
        </View>

        {/* Order Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>订单信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>订单号</Text>
            <Text style={styles.infoValue}>{order.order_no}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务标题</Text>
            <Text style={styles.infoValue}>{order.title}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务类型</Text>
            <Text style={styles.infoValue}>
              {SERVICE_TYPE_MAP[order.service_type] || order.service_type}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务地址</Text>
            <Text style={styles.infoValue}>{(order as any).service_address || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>开始时间</Text>
            <Text style={styles.infoValue}>{order.start_time?.slice(0, 16).replace('T', ' ') || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>结束时间</Text>
            <Text style={styles.infoValue}>{order.end_time?.slice(0, 16).replace('T', ' ') || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>创建时间</Text>
            <Text style={styles.infoValue}>{order.created_at?.slice(0, 16).replace('T', ' ') || '-'}</Text>
          </View>
        </View>

        {/* Cost Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>费用信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>订单总额</Text>
            <Text style={styles.infoValueHighlight}>
              {'\u00a5'}{(order.total_amount / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>押金</Text>
            <Text style={styles.infoValue}>
              {'\u00a5'}{(order.deposit_amount / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>平台佣金</Text>
            <Text style={styles.infoValue}>
              {'\u00a5'}{(order.platform_commission / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>机主收入</Text>
            <Text style={styles.infoValue}>
              {'\u00a5'}{(order.owner_amount / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>参与方</Text>
          {order.owner && (
            <View style={styles.participantRow}>
              <View style={styles.participantAvatar}>
                <Text style={styles.participantAvatarText}>{order.owner.nickname?.charAt(0) || 'U'}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.participantName}>{order.owner.nickname}</Text>
                <Text style={styles.participantRole}>出租方{isOwner ? ' (我)' : ''}</Text>
              </View>
            </View>
          )}
          {order.renter && (
            <View style={styles.participantRow}>
              <View style={[styles.participantAvatar, {backgroundColor: '#52c41a'}]}>
                <Text style={styles.participantAvatarText}>{order.renter.nickname?.charAt(0) || 'U'}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.participantName}>{order.renter.nickname}</Text>
                <Text style={styles.participantRole}>承租方{isRenter ? ' (我)' : ''}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Drone Info */}
        {order.drone && (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('DroneDetail', {id: order.drone_id})}>
            <Text style={styles.cardTitle}>无人机信息</Text>
            <View style={styles.droneRow}>
              <View style={styles.droneIcon}>
                <Text style={{fontSize: 24}}>{'\ud83d\ude81'}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.droneName}>{order.drone.brand} {order.drone.model}</Text>
                <Text style={styles.droneMeta}>
                  载重 {order.drone.max_load}kg | 续航 {order.drone.max_flight_time}min
                </Text>
              </View>
              <Text style={{color: '#1890ff', fontSize: 14}}>{'>'}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Timeline */}
        {renderTimeline()}

        <View style={{height: 100}} />
      </ScrollView>

      {/* Bottom action buttons */}
      {renderActions()}
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
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  errorText: {fontSize: 16, color: '#999'},
  content: {flex: 1},

  // Status card
  statusCard: {padding: 24, alignItems: 'center', marginBottom: 10},
  statusLabel: {fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4},
  statusValue: {fontSize: 26, fontWeight: '700', color: '#fff'},
  cancelReason: {fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6},

  // Cards
  card: {backgroundColor: '#fff', padding: 16, marginBottom: 10},
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12},

  // Info rows
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: {fontSize: 14, color: '#666'},
  infoValue: {fontSize: 14, color: '#333', flex: 1, textAlign: 'right'},
  infoValueHighlight: {fontSize: 18, fontWeight: '700', color: '#ff4d4f'},

  // Participants
  participantRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8},
  participantAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1890ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  participantAvatarText: {color: '#fff', fontSize: 14, fontWeight: 'bold'},
  participantName: {fontSize: 15, fontWeight: '500', color: '#333'},
  participantRole: {fontSize: 12, color: '#999', marginTop: 2},

  // Drone
  droneRow: {flexDirection: 'row', alignItems: 'center'},
  droneIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  droneName: {fontSize: 15, fontWeight: '600', color: '#333'},
  droneMeta: {fontSize: 12, color: '#999', marginTop: 2},

  // Timeline
  timelineItem: {flexDirection: 'row', minHeight: 50},
  timelineDotCol: {width: 24, alignItems: 'center'},
  timelineDot: {width: 10, height: 10, borderRadius: 5, marginTop: 4},
  timelineLine: {width: 2, flex: 1, backgroundColor: '#e8e8e8', marginTop: 4},
  timelineContent: {flex: 1, paddingLeft: 8, paddingBottom: 16},
  timelineStatus: {fontSize: 14, color: '#666'},
  timelineTime: {fontSize: 12, color: '#999', marginTop: 4},

  // Action bar
  actionBar: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 12,
    borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingBottom: 24,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    marginLeft: 10, borderWidth: 1,
  },
  actionBtnPrimary: {backgroundColor: '#1890ff', borderColor: '#1890ff'},
  actionBtnDanger: {backgroundColor: '#fff', borderColor: '#ff4d4f'},
  actionBtnDefault: {backgroundColor: '#fff', borderColor: '#d9d9d9'},
  actionBtnText: {fontSize: 14, fontWeight: '500', color: '#333'},
  actionBtnTextPrimary: {color: '#fff'},
  actionBtnTextDanger: {color: '#ff4d4f'},
});
