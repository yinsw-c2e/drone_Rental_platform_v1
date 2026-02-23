import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl,
} from 'react-native';
import {droneService} from '../../services/drone';
import {Drone} from '../../types';

export default function MyDronesScreen({navigation}: any) {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDrones = useCallback(async () => {
    try {
      const res = await droneService.myDrones({page: 1, page_size: 50});
      setDrones(res.data?.list || []);
    } catch (e) {
      console.warn('获取无人机列表失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDrones(); }, [fetchDrones]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDrones();
  }, [fetchDrones]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#52c41a';
      case 'rented': return '#fa8c16';
      case 'maintenance': return '#ff4d4f';
      default: return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return '可用';
      case 'rented': return '已出租';
      case 'maintenance': return '维护中';
      default: return '离线';
    }
  };

  const renderDrone = ({item}: {item: Drone}) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => {
        console.log('Navigating to DroneDetail with id:', item.id);
        navigation.navigate('DroneDetail', {id: item.id});
      }}>
      <View style={styles.cardTop}>
        <View style={styles.droneIcon}><Text style={{fontSize: 24}}>🚁</Text></View>
        <View style={{flex: 1}}>
          <Text style={styles.droneName}>{item.brand} {item.model}</Text>
          <Text style={styles.droneMeta}>SN: {item.serial_number || '-'}</Text>
        </View>
        <View style={[styles.statusBadge, {backgroundColor: getStatusColor(item.availability_status)}]}>
          <Text style={styles.statusText}>{getStatusLabel(item.availability_status)}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.spec}>载重 {item.max_load || 0}kg</Text>
        <Text style={styles.spec}>续航 {item.max_flight_time || 0}min</Text>
        <Text style={styles.priceText}>¥{(item.daily_price / 100).toFixed(0)}/天</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={drones}
        keyExtractor={item => String(item.id)}
        renderItem={renderDrone}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
        contentContainerStyle={{padding: 12}}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚁</Text>
            <Text style={styles.emptyText}>{loading ? '加载中...' : '还没有添加无人机'}</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddDrone')}>
              <Text style={styles.addBtnText}>添加无人机</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTop: {flexDirection: 'row', alignItems: 'center'},
  droneIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  droneName: {fontSize: 15, fontWeight: '600', color: '#333'},
  droneMeta: {fontSize: 12, color: '#999', marginTop: 2},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4},
  statusText: {color: '#fff', fontSize: 11, fontWeight: 'bold'},
  cardBottom: {flexDirection: 'row', marginTop: 10, alignItems: 'center'},
  spec: {fontSize: 12, color: '#666', marginRight: 14},
  priceText: {fontSize: 14, color: '#f5222d', fontWeight: 'bold', marginLeft: 'auto'},
  emptyContainer: {alignItems: 'center', paddingTop: 80},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#999', marginBottom: 20},
  addBtn: {paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1890ff', borderRadius: 20},
  addBtnText: {color: '#fff', fontSize: 14, fontWeight: '600'},
});
