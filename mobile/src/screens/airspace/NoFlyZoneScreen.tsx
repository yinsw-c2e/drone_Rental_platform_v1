import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  listNoFlyZones,
  findNearbyNoFlyZones,
  checkAirspaceAvailability,
  NoFlyZone,
  AirspaceCheckResult,
} from '../../services/airspace';

const ZONE_TYPE_MAP: Record<string, {label: string; color: string}> = {
  airport: {label: '机场净空区', color: '#ff4d4f'},
  military: {label: '军事管制区', color: '#722ed1'},
  government: {label: '政府重要区域', color: '#fa8c16'},
  nature_reserve: {label: '自然保护区', color: '#52c41a'},
  temporary: {label: '临时限飞区', color: '#1890ff'},
  custom: {label: '自定义区域', color: '#666'},
};

const RESTRICTION_MAP: Record<string, {label: string; color: string}> = {
  no_fly: {label: '禁飞', color: '#ff4d4f'},
  restricted: {label: '限飞', color: '#faad14'},
  caution: {label: '注意', color: '#1890ff'},
};

export default function NoFlyZoneScreen({navigation, route}: any) {
  const [zones, setZones] = useState<NoFlyZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'nearby'>('all');
  const [checkResult, setCheckResult] = useState<AirspaceCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  // default coordinates (Chengdu)
  const latitude = route?.params?.latitude || 30.5723;
  const longitude = route?.params?.longitude || 104.0665;

  useEffect(() => {
    loadZones();
  }, [viewMode]);

  const loadZones = async () => {
    try {
      if (viewMode === 'nearby') {
        const data = await findNearbyNoFlyZones(latitude, longitude, 50000);
        setZones(data || []);
      } else {
        const result = await listNoFlyZones({status: 'active', page_size: 100});
        setZones(result.data || []);
      }
    } catch (err: any) {
      console.log('加载禁飞区失败:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCheckAvailability = async () => {
    setChecking(true);
    try {
      const result = await checkAirspaceAvailability(latitude, longitude, 120);
      setCheckResult(result);
      if (result.available) {
        Alert.alert('空域可用', '当前位置空域可正常飞行');
      } else {
        Alert.alert('空域受限', `当前位置存在${result.restrictions.length}个飞行限制`);
      }
    } catch (err: any) {
      Alert.alert('检查失败', err.message);
    } finally {
      setChecking(false);
    }
  };

  const renderZoneCard = (zone: NoFlyZone) => {
    const typeInfo = ZONE_TYPE_MAP[zone.zone_type] || {label: zone.zone_type, color: '#999'};
    const restrictInfo = RESTRICTION_MAP[zone.restriction_level] || {label: zone.restriction_level, color: '#999'};

    return (
      <View key={zone.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{flex: 1}}>
            <Text style={styles.cardTitle}>{zone.name}</Text>
            <View style={styles.tagRow}>
              <View style={[styles.tag, {backgroundColor: typeInfo.color + '15'}]}>
                <Text style={[styles.tagText, {color: typeInfo.color}]}>{typeInfo.label}</Text>
              </View>
              <View style={[styles.tag, {backgroundColor: restrictInfo.color + '15'}]}>
                <Text style={[styles.tagText, {color: restrictInfo.color}]}>{restrictInfo.label}</Text>
              </View>
              {zone.allowed_with_permit && (
                <View style={[styles.tag, {backgroundColor: '#1890ff15'}]}>
                  <Text style={[styles.tagText, {color: '#1890ff'}]}>可申请许可</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.restrictionBadge, {backgroundColor: restrictInfo.color}]}>
            <Text style={styles.restrictionBadgeText}>{restrictInfo.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {zone.description ? <Text style={styles.description}>{zone.description}</Text> : null}

          <View style={styles.infoGrid}>
            {zone.geometry_type === 'circle' && zone.radius > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>半径</Text>
                <Text style={styles.infoValue}>{zone.radius >= 1000 ? `${(zone.radius / 1000).toFixed(1)}km` : `${zone.radius}m`}</Text>
              </View>
            )}
            {(zone.min_altitude > 0 || zone.max_altitude > 0) && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>高度范围</Text>
                <Text style={styles.infoValue}>{zone.min_altitude}m - {zone.max_altitude}m</Text>
              </View>
            )}
            {zone.center_latitude > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>中心坐标</Text>
                <Text style={styles.infoValue}>{zone.center_latitude.toFixed(4)}, {zone.center_longitude.toFixed(4)}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>时效</Text>
              <Text style={styles.infoValue}>{zone.is_permanent ? '永久' : '临时'}</Text>
            </View>
          </View>

          {zone.authority ? (
            <Text style={styles.authorityText}>管理机构: {zone.authority}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1890ff" style={{marginTop: 100}} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* View mode toggle & check button */}
      <View style={styles.toolbar}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'all' && styles.toggleBtnActive]}
            onPress={() => setViewMode('all')}>
            <Text style={[styles.toggleText, viewMode === 'all' && styles.toggleTextActive]}>全部</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'nearby' && styles.toggleBtnActive]}
            onPress={() => setViewMode('nearby')}>
            <Text style={[styles.toggleText, viewMode === 'nearby' && styles.toggleTextActive]}>附近</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.checkBtn, checking && {opacity: 0.6}]}
          onPress={handleCheckAvailability}
          disabled={checking}>
          <Text style={styles.checkBtnText}>{checking ? '检测中...' : '空域检测'}</Text>
        </TouchableOpacity>
      </View>

      {/* Availability check result */}
      {checkResult && (
        <View style={[styles.checkResultBar, {backgroundColor: checkResult.available ? '#f6ffed' : '#fff2f0'}]}>
          <Text style={[styles.checkResultText, {color: checkResult.available ? '#52c41a' : '#ff4d4f'}]}>
            {checkResult.available
              ? '当前位置空域可用，无飞行限制'
              : `当前位置存在 ${checkResult.restrictions.length} 个飞行限制`}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadZones();}} />}>
        {zones.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{viewMode === 'nearby' ? '附近暂无禁飞区' : '暂无禁飞区数据'}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultCount}>共 {zones.length} 个禁飞区/限飞区</Text>
            {zones.map(renderZoneCard)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  toolbar: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8'},
  toggleRow: {flexDirection: 'row', borderRadius: 6, borderWidth: 1, borderColor: '#d9d9d9', overflow: 'hidden'},
  toggleBtn: {paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#fff'},
  toggleBtnActive: {backgroundColor: '#1890ff'},
  toggleText: {fontSize: 13, color: '#666'},
  toggleTextActive: {color: '#fff'},
  checkBtn: {backgroundColor: '#722ed1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6},
  checkBtnText: {color: '#fff', fontSize: 13, fontWeight: '500'},
  checkResultBar: {paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8'},
  checkResultText: {fontSize: 13, fontWeight: '500'},
  content: {padding: 16},
  resultCount: {fontSize: 13, color: '#999', marginBottom: 12},
  card: {backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 10},
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8},
  tagRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  tag: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  tagText: {fontSize: 11, fontWeight: '500'},
  restrictionBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginLeft: 8},
  restrictionBadgeText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  cardBody: {paddingHorizontal: 16, paddingBottom: 16},
  description: {fontSize: 13, color: '#666', marginBottom: 10, lineHeight: 18},
  infoGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  infoItem: {minWidth: '40%'},
  infoLabel: {fontSize: 11, color: '#999', marginBottom: 2},
  infoValue: {fontSize: 13, color: '#333', fontWeight: '500'},
  authorityText: {fontSize: 12, color: '#999', marginTop: 8},
  empty: {alignItems: 'center', paddingTop: 60},
  emptyText: {fontSize: 16, color: '#999'},
});
