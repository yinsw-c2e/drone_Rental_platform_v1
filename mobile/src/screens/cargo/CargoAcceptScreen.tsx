import React, {useEffect, useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {droneService} from '../../services/drone';
import {orderService} from '../../services/order';
import {Drone, CargoDemand} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

export default function CargoAcceptScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {cargoId, cargoData} = route.params as {cargoId: number; cargoData: CargoDemand};
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    fetchMyDrones();
  }, []);

  const fetchMyDrones = async () => {
    try {
      const res = await droneService.myDrones({page: 1, page_size: 100});
      const availableDrones = (res.data?.list || []).filter(
        (d: Drone) => d.availability_status === 'available'
      );
      setDrones(availableDrones);
      if (availableDrones.length > 0) {
        setSelectedDrone(availableDrones[0]);
      }
    } catch (e) {
      console.error('获取无人机失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDrone) {
      Alert.alert('提示', '请选择一架无人机');
      return;
    }

    // 立即禁用按钮，防止重复提交
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      // 创建货运订单（直接为 accepted 状态）
      const orderData = {
        order_type: 'cargo',
        related_id: cargoId,
        drone_id: selectedDrone.id,
        title: `货运: ${cargoData.pickup_address} → ${cargoData.delivery_address}`,
        service_type: cargoData.cargo_type,
        start_time: cargoData.pickup_time,
        end_time: cargoData.pickup_time, // 货运无结束时间，使用取货时间
        service_address: cargoData.pickup_address,
        total_amount: cargoData.offered_price,
        deposit_amount: 0, // 货运无押金
        auto_accept: true, // 标记为自动接单
      };

      const res = await orderService.create(orderData);
      
      Alert.alert('接单成功', '订单已创建，请尽快完成配送！', [
        {
          text: '查看订单',
          onPress: () => {
            navigation.navigate('OrderDetail', {id: res.data.id});
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('接单失败', e.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const renderDrone = ({item}: {item: Drone}) => (
    <TouchableOpacity
      style={[styles.droneItem, selectedDrone?.id === item.id && styles.droneItemSelected]}
      onPress={() => setSelectedDrone(item)}>
      <View style={styles.droneIcon}>
        <Text style={styles.droneIconText}>🚁</Text>
      </View>
      <View style={styles.droneInfo}>
        <Text style={styles.droneName}>{item.brand} {item.model}</Text>
        <Text style={styles.droneSpecs}>
          载重 {item.max_load}kg · 续航 {item.max_flight_time}min
        </Text>
      </View>
      {selectedDrone?.id === item.id && (
        <View style={styles.checkMark}>
          <Text style={styles.checkMarkText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator size="large" color={theme.warning} style={{marginTop: 100}} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      {/* 货运信息卡片 */}
      <View style={styles.cargoCard}>
        <Text style={styles.cardTitle}>货运信息</Text>
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>🔵</Text>
          <Text style={styles.routeText} numberOfLines={1}>
            {cargoData.pickup_address}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>🔴</Text>
          <Text style={styles.routeText} numberOfLines={1}>
            {cargoData.delivery_address}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>货物重量</Text>
          <Text style={styles.infoValue}>{cargoData.cargo_weight} kg</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>运费</Text>
          <Text style={styles.priceValue}>¥{(cargoData.offered_price / 100).toFixed(2)}</Text>
        </View>
      </View>

      {/* 选择无人机 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择您的无人机</Text>
        {drones.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>您还没有可用的无人机</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddDrone')}>
              <Text style={styles.addBtnText}>去添加</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={drones}
            keyExtractor={item => String(item.id)}
            renderItem={renderDrone}
            contentContainerStyle={styles.droneList}
          />
        )}
      </View>

      {/* 底部确认按钮 */}
      {drones.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, submitting && {opacity: 0.6}]}
            onPress={handleConfirm}
            disabled={submitting}>
            <Text style={styles.confirmBtnText}>
              {submitting ? '提交中...' : '确认接单'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  cargoCard: {
    backgroundColor: theme.card, margin: 16, padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: theme.warning + '44',
  },
  cardTitle: {fontSize: 16, fontWeight: 'bold', color: theme.text, marginBottom: 12},
  routeRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  routeIcon: {fontSize: 16, marginRight: 8},
  routeText: {flex: 1, fontSize: 14, color: theme.text},
  routeLine: {width: 2, height: 16, backgroundColor: theme.divider, marginLeft: 7, marginBottom: 4},
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: theme.divider,
  },
  infoLabel: {fontSize: 14, color: theme.textSub},
  infoValue: {fontSize: 14, color: theme.text, fontWeight: '500'},
  priceValue: {fontSize: 18, color: theme.warning, fontWeight: 'bold'},
  section: {flex: 1, backgroundColor: theme.card, margin: 16, marginTop: 0, borderRadius: 12, padding: 16},
  sectionTitle: {fontSize: 16, fontWeight: 'bold', color: theme.text, marginBottom: 12},
  droneList: {paddingBottom: 16},
  droneItem: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 8, borderWidth: 2, borderColor: theme.divider,
    marginBottom: 12, backgroundColor: theme.bgSecondary,
  },
  droneItemSelected: {borderColor: theme.warning, backgroundColor: theme.warning + '22'},
  droneIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: theme.card,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  droneIconText: {fontSize: 24},
  droneInfo: {flex: 1},
  droneName: {fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 4},
  droneSpecs: {fontSize: 12, color: theme.textSub},
  checkMark: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: theme.warning,
    justifyContent: 'center', alignItems: 'center',
  },
  checkMarkText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: 'bold'},
  empty: {alignItems: 'center', paddingVertical: 40},
  emptyText: {fontSize: 14, color: theme.textSub, marginBottom: 16},
  addBtn: {
    paddingHorizontal: 24, paddingVertical: 10, backgroundColor: theme.warning,
    borderRadius: 20,
  },
  addBtnText: {color: theme.btnPrimaryText, fontSize: 14, fontWeight: '600'},
  footer: {
    backgroundColor: theme.card, padding: 16, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: theme.divider,
  },
  confirmBtn: {
    height: 48, backgroundColor: theme.warning, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmBtnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: 'bold'},
});
