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
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const ZONE_TYPE_MAP: Record<string, {label: string; colorKey: 'danger' | 'primary' | 'warning' | 'success' | 'info' | 'textHint'}> = {
  airport: {label: '机场净空区', colorKey: 'danger'},
  military: {label: '军事管制区', colorKey: 'primary'},
  government: {label: '政府重要区域', colorKey: 'warning'},
  nature_reserve: {label: '自然保护区', colorKey: 'success'},
  temporary: {label: '临时限飞区', colorKey: 'info'},
  custom: {label: '自定义区域', colorKey: 'textHint'},
};

const RESTRICTION_MAP: Record<string, {label: string; colorKey: 'danger' | 'warning' | 'info'}> = {
  no_fly: {label: '禁飞', colorKey: 'danger'},
  restricted: {label: '限飞', colorKey: 'warning'},
  caution: {label: '注意', colorKey: 'info'},
};

export default function NoFlyZoneScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
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
    const typeInfo = ZONE_TYPE_MAP[zone.zone_type] || {label: zone.zone_type, colorKey: 'textHint' as const};
    const restrictInfo = RESTRICTION_MAP[zone.restriction_level] || {label: zone.restriction_level, colorKey: 'textHint' as const};

    return (
      <View key={zone.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{flex: 1}}>
            <Text style={styles.cardTitle}>{zone.name}</Text>
            <View style={styles.tagRow}>
              <View style={[styles.tag, {backgroundColor: theme[typeInfo.colorKey] + '15'}]}>
                <Text style={[styles.tagText, {color: theme[typeInfo.colorKey]}]}>{typeInfo.label}</Text>
              </View>
              <View style={[styles.tag, {backgroundColor: theme[restrictInfo.colorKey] + '15'}]}>
                <Text style={[styles.tagText, {color: theme[restrictInfo.colorKey]}]}>{restrictInfo.label}</Text>
              </View>
              {zone.allowed_with_permit && (
                <View style={[styles.tag, {backgroundColor: theme.primary + '15'}]}>
                  <Text style={[styles.tagText, {color: theme.primaryText}]}>可申请许可</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.restrictionBadge, {backgroundColor: theme[restrictInfo.colorKey]}]}>
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
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator size="large" color={theme.primary} style={{marginTop: 100}} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
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

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  toolbar: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider},
  toggleRow: {flexDirection: 'row', borderRadius: 6, borderWidth: 1, borderColor: theme.divider, overflow: 'hidden'},
  toggleBtn: {paddingHorizontal: 16, paddingVertical: 6, backgroundColor: theme.card},
  toggleBtnActive: {backgroundColor: theme.primary},
  toggleText: {fontSize: 13, color: theme.textSub},
  toggleTextActive: {color: theme.btnPrimaryText},
  checkBtn: {backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6},
  checkBtnText: {color: theme.btnPrimaryText, fontSize: 13, fontWeight: '500'},
  checkResultBar: {paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider},
  checkResultText: {fontSize: 13, fontWeight: '500'},
  content: {padding: 16},
  resultCount: {fontSize: 13, color: theme.textSub, marginBottom: 12},
  card: {backgroundColor: theme.card, borderRadius: 12, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2},
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 10},
  cardTitle: {fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 8},
  tagRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  tag: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  tagText: {fontSize: 11, fontWeight: '500'},
  restrictionBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginLeft: 8},
  restrictionBadgeText: {color: theme.btnPrimaryText, fontSize: 12, fontWeight: '600'},
  cardBody: {paddingHorizontal: 16, paddingBottom: 16},
  description: {fontSize: 13, color: theme.textSub, marginBottom: 10, lineHeight: 18},
  infoGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  infoItem: {minWidth: '40%'},
  infoLabel: {fontSize: 11, color: theme.textSub, marginBottom: 2},
  infoValue: {fontSize: 13, color: theme.text, fontWeight: '500'},
  authorityText: {fontSize: 12, color: theme.textSub, marginTop: 8},
  empty: {alignItems: 'center', paddingTop: 60},
  emptyText: {fontSize: 16, color: theme.textSub},
});
