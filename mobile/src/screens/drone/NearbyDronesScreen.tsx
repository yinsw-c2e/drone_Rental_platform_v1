import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl,
} from 'react-native';
import {droneService} from '../../services/drone';
import {Drone} from '../../types';

export default function NearbyDronesScreen({navigation}: any) {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDrones = useCallback(async () => {
    try {
      // Default to Beijing coordinates for demo; real app would use geolocation
      const res = await droneService.nearby(39.9042, 116.4074, 50);
      setDrones(res.data?.list || []);
    } catch (e) {
      console.warn('获取附近无人机失败:', e);
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

  const renderDrone = ({item}: {item: Drone}) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DroneDetail', {id: item.id})}>
      <View style={styles.droneIcon}><Text style={{fontSize: 24}}>🚁</Text></View>
      <View style={{flex: 1}}>
        <Text style={styles.name}>{item.brand} {item.model}</Text>
        <Text style={styles.meta}>{item.owner?.nickname || '无人机主'} · ⭐{item.rating || '0.0'}</Text>
        <Text style={styles.address}>{item.address || item.city || '位置未知'}</Text>
      </View>
      <Text style={styles.price}>¥{(item.daily_price / 100).toFixed(0)}/天</Text>
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
          <View style={{alignItems: 'center', paddingTop: 80}}>
            <Text style={{fontSize: 48, marginBottom: 12}}>📍</Text>
            <Text style={{fontSize: 16, color: '#999'}}>{loading ? '搜索中...' : '附近暂无可用无人机'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 10, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  droneIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  name: {fontSize: 15, fontWeight: '600', color: '#333'},
  meta: {fontSize: 12, color: '#999', marginTop: 3},
  address: {fontSize: 12, color: '#999', marginTop: 2},
  price: {fontSize: 14, color: '#f5222d', fontWeight: 'bold'},
});
