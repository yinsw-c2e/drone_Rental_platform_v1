import React, {useEffect, useState, useCallback} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, Alert,
} from 'react-native';
import {droneService} from '../../services/drone';
import {Drone} from '../../types';
import {getCurrentPosition} from '../../utils/LocationService';
import {DEV_DEFAULT_LOCATION} from '../../config/mockData';

// 开发模式配置
const DEV_MODE = __DEV__;
const DEV_DEFAULT_COORDS = {
  latitude: DEV_DEFAULT_LOCATION.latitude,
  longitude: DEV_DEFAULT_LOCATION.longitude,
  description: DEV_DEFAULT_LOCATION.address,
};

export default function NearbyDronesScreen({navigation}: any) {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  /**
   * 获取用户位置（生产环境使用真实定位，开发环境支持fallback）
   */
  const getUserLocation = useCallback(async (): Promise<{lat: number; lng: number}> => {
    try {
      const position = await getCurrentPosition();
      const location = {lat: position.latitude, lng: position.longitude};
      setCurrentLocation(location);
      setLocationError(null);
      return location;
    } catch (error: any) {
      const errMsg = error.message || '定位失败';
      setLocationError(errMsg);
      
      // 开发模式：定位失败时使用默认坐标
      if (DEV_MODE) {
        console.warn('[DEV] 定位失败，使用数据库真实坐标:', DEV_DEFAULT_COORDS, '错误:', errMsg);
        const devLocation = {lat: DEV_DEFAULT_COORDS.latitude, lng: DEV_DEFAULT_COORDS.longitude};
        setCurrentLocation(devLocation);
        return devLocation;
      }
      
      // 生产环境：定位失败时提示用户
      throw new Error(errMsg);
    }
  }, []);

  const fetchDrones = useCallback(async () => {
    try {
      setLocationError(null);
      const location = await getUserLocation();
      
      // 调用后端API查询附近无人机（默认半径50公里）
      const res = await droneService.nearby(location.lat, location.lng, 50);
      setDrones(res.data?.list || []);
    } catch (e: any) {
      console.warn('获取附近无人机失败:', e);
      
      // 生产环境：定位失败时提示用户
      if (!DEV_MODE && e.message) {
        Alert.alert(
          '定位失败',
          e.message + '\n\n请检查位置权限是否开启',
          [
            {text: '取消', style: 'cancel'},
            {text: '重试', onPress: () => fetchDrones()},
          ],
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getUserLocation]);

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
      {/* 开发模式提示 */}
      {DEV_MODE && locationError && (
        <View style={styles.devBanner}>
          <Text style={styles.devText}>
            🔧 开发模式：使用数据库真实坐标 ({DEV_DEFAULT_COORDS.description})
          </Text>
        </View>
      )}
      
      {/* 当前定位显示（可选） */}
      {currentLocation && !locationError && (
        <View style={styles.locationBanner}>
          <Text style={styles.locationText}>
            📍 当前位置: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
          </Text>
        </View>
      )}
      
      <FlatList
        data={drones}
        keyExtractor={item => String(item.id)}
        renderItem={renderDrone}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1890ff']} />}
        contentContainerStyle={{padding: 12}}
        ListEmptyComponent={
          <View style={{alignItems: 'center', paddingTop: 80}}>
            <Text style={{fontSize: 48, marginBottom: 12}}>📍</Text>
            <Text style={{fontSize: 16, color: '#999'}}>
              {loading ? '搜索中...' : locationError ? '定位失败，无法查询附近无人机' : '附近暂无可用无人机'}
            </Text>
            {locationError && !DEV_MODE && (
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={() => {
                  setLoading(true);
                  fetchDrones();
                }}
              >
                <Text style={styles.retryText}>重新定位</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  devBanner: {
    backgroundColor: '#fff3cd',
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ffc107',
  },
  devText: {fontSize: 12, color: '#856404'},
  locationBanner: {
    backgroundColor: '#e6f7ff',
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#91d5ff',
  },
  locationText: {fontSize: 11, color: '#0050b3'},
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
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#1890ff',
    borderRadius: 6,
  },
  retryText: {fontSize: 14, color: '#fff', fontWeight: '600'},
});
