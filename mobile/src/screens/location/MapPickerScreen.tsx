import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import {MapView} from 'react-native-amap3d';
import type {CameraEvent} from 'react-native-amap3d';
import type {NativeSyntheticEvent} from 'react-native';
import {locationService} from '../../services/location';
import {POIItem, AddressData} from '../../types';
import {getCurrentPosition} from '../../utils/LocationService';

export default function MapPickerScreen({navigation, route}: any) {
  const onSelect: ((addr: AddressData) => void) | undefined = route.params?.onSelect;
  const initialLat: number | undefined = route.params?.latitude;
  const initialLng: number | undefined = route.params?.longitude;

  const [currentAddr, setCurrentAddr] = useState<string>('定位中...');
  const [latitude, setLatitude] = useState(initialLat || 0);
  const [longitude, setLongitude] = useState(initialLng || 0);
  const [nearbyPOIs, setNearbyPOIs] = useState<POIItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [geoInfo, setGeoInfo] = useState<{province?: string; city?: string; district?: string}>({});
  const mapRef = useRef<any>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 保存地图 SDK 上报的用户实时位置（GCJ-02 坐标，比 GPS 更准更快）
  const myLocationRef = useRef<{latitude: number; longitude: number} | null>(null);
  // 用于强制 MapView 重新挂载，从而移动到新位置
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    initLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initLocation = async () => {
    setLoading(true);
    try {
      let lat = initialLat || 0;
      let lng = initialLng || 0;

      if (!lat || !lng) {
        try {
          const pos = await getCurrentPosition();
          lat = pos.latitude;
          lng = pos.longitude;
        } catch {
          // 定位失败，使用默认位置（广州市中心）让地图先显示出来
          lat = 23.129163;
          lng = 113.264435;
          setCurrentAddr('定位失败，已显示默认位置，可拖动地图选点');
        }
      }

      setLatitude(lat);
      setLongitude(lng);
      await fetchAddressAndNearby(lng, lat);
    } catch (e: any) {
      setCurrentAddr('获取地址失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddressAndNearby = async (lng: number, lat: number) => {
    try {
      const [geoRes, nearbyRes] = await Promise.all([
        locationService.reverseGeoCode(lng, lat),
        locationService.searchNearby({lng, lat, radius: 1000, page_size: 20}),
      ]);

      if (geoRes.data) {
        setCurrentAddr(geoRes.data.formatted_address);
        setGeoInfo({
          province: geoRes.data.province,
          city: geoRes.data.city,
          district: geoRes.data.district,
        });
      }
      setNearbyPOIs(nearbyRes.data?.list || []);
    } catch {
      setCurrentAddr('获取地址失败');
    }
  };

  // 地图拖拽结束后，防抖获取新地址
  const handleCameraIdle = useCallback((event: NativeSyntheticEvent<CameraEvent>) => {
    const {cameraPosition} = event.nativeEvent;
    if (!cameraPosition?.target) {return;}

    const {latitude: newLat, longitude: newLng} = cameraPosition.target;
    setLatitude(newLat);
    setLongitude(newLng);
    setSelectedIndex(-1);

    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
    }
    fetchTimerRef.current = setTimeout(() => {
      fetchAddressAndNearby(newLng, newLat);
    }, 500);
  }, []);

  // 地图 SDK 实时上报用户位置
  const handleLocationUpdate = useCallback((event: any) => {
    const coords = event.nativeEvent?.coords;
    if (coords?.latitude && coords?.longitude) {
      myLocationRef.current = {latitude: coords.latitude, longitude: coords.longitude};
    }
  }, []);

  // 回到当前位置
  const handleRelocate = async () => {
    let loc = myLocationRef.current;
    if (!loc) {
      try {
        const pos = await getCurrentPosition();
        loc = {latitude: pos.latitude, longitude: pos.longitude};
      } catch (e: any) {
        Alert.alert('定位失败', e.message || '无法获取当前位置');
        return;
      }
    }
    setLatitude(loc.latitude);
    setLongitude(loc.longitude);
    // 强制 MapView 重新挂载，以新坐标为中心
    setMapKey(prev => prev + 1);
    await fetchAddressAndNearby(loc.longitude, loc.latitude);
  };

  const handleSelectCurrent = () => {
    setSelectedIndex(-1);
    const addr: AddressData = {
      name: currentAddr,
      address: currentAddr,
      province: geoInfo.province,
      city: geoInfo.city,
      district: geoInfo.district,
      latitude,
      longitude,
    };
    if (onSelect) {
      onSelect(addr);
    }
    navigation.goBack();
  };

  const handleSelectPOI = (poi: POIItem, index: number) => {
    setSelectedIndex(index);
    const addr: AddressData = {
      name: poi.name,
      address: poi.address || poi.name,
      province: poi.province,
      city: poi.city,
      district: poi.district,
      latitude: poi.latitude,
      longitude: poi.longitude,
    };
    if (onSelect) {
      onSelect(addr);
    }
    navigation.goBack();
  };

  const renderPOI = ({item, index}: {item: POIItem; index: number}) => (
    <TouchableOpacity
      style={[styles.poiItem, selectedIndex === index && styles.poiItemActive]}
      onPress={() => handleSelectPOI(item, index)}
      activeOpacity={0.6}>
      <View style={styles.poiInfo}>
        <Text style={styles.poiName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.poiAddr} numberOfLines={1}>
          {[item.district, item.address].filter(Boolean).join(' ')}
        </Text>
      </View>
      {item.distance && (
        <Text style={styles.poiDist}>
          {Number(item.distance) >= 1000
            ? (Number(item.distance) / 1000).toFixed(1) + 'km'
            : item.distance + 'm'}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 高德地图区域 */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color="#1890ff" />
            <Text style={styles.mapLoadingText}>正在定位...</Text>
          </View>
        ) : (
          <>
            <MapView
              key={mapKey}
              ref={mapRef}
              style={styles.map}
              initialCameraPosition={{
                target: {latitude, longitude},
                zoom: 16,
              }}
              myLocationEnabled
              zoomControlsEnabled={false}
              onCameraIdle={handleCameraIdle}
              // @ts-ignore: onLocation 在原生层支持但 TS 类型未声明
              onLocation={handleLocationUpdate}
            />

            {/* 中心点指示器 */}
            <View style={styles.centerPin} pointerEvents="none">
              <Text style={styles.centerPinIcon}>&#128205;</Text>
            </View>

            {/* 回到当前位置按钮 */}
            <TouchableOpacity style={styles.relocateBtn} onPress={handleRelocate} activeOpacity={0.7}>
              <Text style={styles.relocateIcon}>&#9678;</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 当前定位地址 */}
      <TouchableOpacity style={styles.currentBar} onPress={handleSelectCurrent} activeOpacity={0.7}>
        <View style={styles.locIcon}>
          <Text style={styles.locIconText}>&#9678;</Text>
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.currentLabel}>当前位置</Text>
          <Text style={styles.currentAddr} numberOfLines={1}>{currentAddr}</Text>
        </View>
        <Text style={styles.useBtn}>使用</Text>
      </TouchableOpacity>

      {/* 附近 POI 列表 */}
      <View style={styles.nearbyHeader}>
        <Text style={styles.nearbyTitle}>附近地点</Text>
      </View>
      <FlatList
        data={nearbyPOIs}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderPOI}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>暂无附近地点</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  mapContainer: {height: 280, position: 'relative'},
  mapLoading: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#e8f4fd',
  },
  mapLoadingText: {fontSize: 13, color: '#999', marginTop: 8},
  map: {flex: 1},
  centerPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -15, marginTop: -30,
  },
  centerPinIcon: {fontSize: 30},
  relocateBtn: {
    position: 'absolute', bottom: 12, right: 12,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  relocateIcon: {fontSize: 20, color: '#1890ff'},
  currentBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8',
    backgroundColor: '#fafffe',
  },
  locIcon: {marginRight: 12},
  locIconText: {fontSize: 20, color: '#1890ff'},
  currentLabel: {fontSize: 15, fontWeight: '600', color: '#333'},
  currentAddr: {fontSize: 13, color: '#999', marginTop: 2},
  useBtn: {fontSize: 14, color: '#1890ff', fontWeight: '500', paddingLeft: 12},
  nearbyHeader: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fafafa',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8',
  },
  nearbyTitle: {fontSize: 13, color: '#999', fontWeight: '500'},
  poiItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0',
  },
  poiItemActive: {backgroundColor: '#e6f7ff'},
  poiInfo: {flex: 1},
  poiName: {fontSize: 15, color: '#333', fontWeight: '500'},
  poiAddr: {fontSize: 13, color: '#999', marginTop: 3},
  poiDist: {fontSize: 12, color: '#bbb', marginLeft: 10},
  emptyWrap: {alignItems: 'center', paddingTop: 40},
  emptyText: {fontSize: 14, color: '#999'},
});
