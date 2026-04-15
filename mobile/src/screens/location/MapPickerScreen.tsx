import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, ActivityIndicator, Alert, Platform,
} from 'react-native';
import {MapView} from 'react-native-amap3d';
import type {CameraEvent} from 'react-native-amap3d';
import type {NativeSyntheticEvent} from 'react-native';
import {locationService} from '../../services/location';
import {POIItem, AddressData} from '../../types';
import {getCurrentPosition} from '../../utils/LocationService';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const MAP_EXIT_DELAY_MS = Platform.OS === 'android' ? 400 : 0;

export default function MapPickerScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const onSelect: ((addr: AddressData) => void) | undefined = route.params?.onSelect;
  const selectionReturnDepth = Number(route.params?.selectionReturnDepth) || 1;
  const initialLat: number | undefined = route.params?.latitude;
  const initialLng: number | undefined = route.params?.longitude;

  const [currentAddr, setCurrentAddr] = useState<string>('定位中...');
  const [latitude, setLatitude] = useState(initialLat || 0);
  const [longitude, setLongitude] = useState(initialLng || 0);
  const [nearbyPOIs, setNearbyPOIs] = useState<POIItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [geoInfo, setGeoInfo] = useState<{province?: string; city?: string; district?: string}>({});
  const isMountedRef = useRef(true);
  const mapRef = useRef<any>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 保存地图 SDK 上报的用户实时位置（GCJ-02 坐标，比 GPS 更准更快）
  const myLocationRef = useRef<{latitude: number; longitude: number} | null>(null);
  // 用于强制 MapView 重新挂载，从而移动到新位置
  const [mapKey, setMapKey] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const allowRemoveRef = useRef(false);

  useEffect(() => {
    initLocation();
    return () => {
      isMountedRef.current = false;
      // 清理定时器
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginSafeExit = useCallback((leave: () => void) => {
    if (allowRemoveRef.current) {
      leave();
      return;
    }

    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    setIsClosing(true);
    // 不再卸载 MapView —— 保持挂载，退出时随屏幕一起自然销毁
    // 避免提前 unmount 原生地图组件导致 AMap SDK 崩溃

    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }

    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      allowRemoveRef.current = true;
      leave();
    }, MAP_EXIT_DELAY_MS);
  }, []);

  // 拦截回退操作，先隐藏地图再执行回退，避免原生层崩溃 (react-native-amap3d#821)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (allowRemoveRef.current) { return; }

      e.preventDefault();

      if (isClosingRef.current) { return; }

      beginSafeExit(() => {
        navigation.dispatch(e.data.action);
      });
    });

    return unsubscribe;
  }, [beginSafeExit, navigation]);

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
          if (!isMountedRef.current) { return; }
          setCurrentAddr('定位失败，已显示默认位置，可拖动地图选点');
        }
      }

      if (!isMountedRef.current) { return; }
      setLatitude(lat);
      setLongitude(lng);
      await fetchAddressAndNearby(lng, lat);
    } catch {
      if (!isMountedRef.current) { return; }
      setCurrentAddr('获取地址失败');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchAddressAndNearby = async (lng: number, lat: number) => {
    try {
      const [geoRes, nearbyRes] = await Promise.all([
        locationService.reverseGeoCode(lng, lat),
        locationService.searchNearby({lng, lat, radius: 1000, page_size: 20}),
      ]);

      if (!isMountedRef.current) { return; }
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
      if (!isMountedRef.current) { return; }
      setCurrentAddr('获取地址失败');
    }
  };

  // 地图拖拽结束后，防抖获取新地址
  const handleCameraIdle = useCallback((event: NativeSyntheticEvent<CameraEvent>) => {
    if (isClosingRef.current) { return; }
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
    if (isClosingRef.current) { return; }
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
    // 清理旧定时器，强制 MapView 重新挂载，以新坐标为中心
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }
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

    beginSafeExit(() => {
      if (selectionReturnDepth > 1 && typeof navigation.pop === 'function') {
        navigation.pop(selectionReturnDepth);
        return;
      }
      navigation.goBack();
    });
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

    beginSafeExit(() => {
      if (selectionReturnDepth > 1 && typeof navigation.pop === 'function') {
        navigation.pop(selectionReturnDepth);
        return;
      }
      navigation.goBack();
    });
  };

  const handleHeaderBack = () => {
    beginSafeExit(() => {
      navigation.goBack();
    });
  };

  const renderPOI = ({item, index}: {item: POIItem; index: number}) => (
    <TouchableOpacity
      style={[styles.poiItem, selectedIndex === index && styles.poiItemActive]}
      onPress={() => handleSelectPOI(item, index)}
      disabled={isClosing}
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
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={handleHeaderBack}
          disabled={isClosing}
          activeOpacity={0.7}>
          <Text style={styles.headerBackIcon}>&#8249;</Text>
          <Text style={styles.headerBackText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>地图选点</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 高德地图区域 */}
      <View style={styles.mapContainer} pointerEvents={isClosing ? 'none' : 'auto'}>
        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={theme.primary} />
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
            {isClosing && (
              <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            )}

            {/* 中心点指示器 */}
            <View style={styles.centerPin} pointerEvents="none">
              <Text style={styles.centerPinIcon}>&#128205;</Text>
            </View>

            {/* 回到当前位置按钮 */}
            <TouchableOpacity
              style={styles.relocateBtn}
              onPress={handleRelocate}
              disabled={isClosing}
              activeOpacity={0.7}>
              <Text style={styles.relocateIcon}>&#9678;</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 当前定位地址 */}
      <TouchableOpacity
        style={styles.currentBar}
        onPress={handleSelectCurrent}
        disabled={isClosing}
        activeOpacity={0.7}>
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
        scrollEnabled={!isClosing}
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

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.card},
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
    backgroundColor: theme.card,
  },
  headerBack: {
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerBackIcon: {
    fontSize: 28,
    lineHeight: 28,
    color: theme.primaryText,
    marginRight: 2,
  },
  headerBackText: {
    fontSize: 15,
    color: theme.primaryText,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    color: theme.text,
    fontWeight: '600',
  },
  headerSpacer: {minWidth: 72},
  mapContainer: {height: 280, position: 'relative'},
  mapLoading: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.primaryBg,
  },
  mapLoadingText: {fontSize: 13, color: theme.textSub, marginTop: 8},
  map: {flex: 1},
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primaryBg,
  },
  centerPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -15, marginTop: -30,
  },
  centerPinIcon: {fontSize: 30},
  relocateBtn: {
    position: 'absolute', bottom: 12, right: 12,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  relocateIcon: {fontSize: 20, color: theme.primaryText},
  currentBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider,
    backgroundColor: theme.bgSecondary,
  },
  locIcon: {marginRight: 12},
  locIconText: {fontSize: 20, color: theme.primaryText},
  currentLabel: {fontSize: 15, fontWeight: '600', color: theme.text},
  currentAddr: {fontSize: 13, color: theme.textSub, marginTop: 2},
  useBtn: {fontSize: 14, color: theme.primaryText, fontWeight: '500', paddingLeft: 12},
  nearbyHeader: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: theme.bgSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider,
  },
  nearbyTitle: {fontSize: 13, color: theme.textSub, fontWeight: '500'},
  poiItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider,
  },
  poiItemActive: {backgroundColor: theme.primaryBg},
  poiInfo: {flex: 1},
  poiName: {fontSize: 15, color: theme.text, fontWeight: '500'},
  poiAddr: {fontSize: 13, color: theme.textSub, marginTop: 3},
  poiDist: {fontSize: 12, color: theme.textHint, marginLeft: 10},
  emptyWrap: {alignItems: 'center', paddingTop: 40},
  emptyText: {fontSize: 14, color: theme.textSub},
});
