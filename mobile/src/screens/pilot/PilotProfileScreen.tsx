import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
  Image,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  getPilotProfile,
  updatePilotAvailability,
  getFlightStats,
  Pilot,
  FlightStats,
} from '../../services/pilot';

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待审核', color: '#faad14'},
  verified: {label: '已认证', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
};

const AVAILABILITY_STATUS_MAP: Record<string, {label: string; color: string}> = {
  online: {label: '接单中', color: '#52c41a'},
  available: {label: '接单中', color: '#52c41a'},
  busy: {label: '忙碌中', color: '#faad14'},
  offline: {label: '离线', color: '#999'},
};

export default function PilotProfileScreen({navigation}: any) {
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [flightStats, setFlightStats] = useState<FlightStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const loadData = async () => {
    try {
      const [profileData, statsData] = await Promise.all([
        getPilotProfile(),
        getFlightStats(),
      ]);
      setPilot(profileData);
      setFlightStats(statsData);
      // availability_status: 'online'/'available' = 接单中
      setIsAvailable(
        profileData.availability_status === 'online' ||
        profileData.availability_status === 'available' ||
        profileData.is_available === true
      );
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleAvailability = async (value: boolean) => {
    try {
      await updatePilotAvailability(value);
      setIsAvailable(value);
      Alert.alert('提示', value ? '已开启接单' : '已关闭接单');
    } catch (e: any) {
      Alert.alert('错误', e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pilot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>您还不是飞手</Text>
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => navigation.navigate('PilotRegister')}>
            <Text style={styles.registerBtnText}>申请成为飞手</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const verificationStatus = STATUS_MAP[pilot.verification_status] || STATUS_MAP.pending;
  const availabilityStatus = AVAILABILITY_STATUS_MAP[pilot.availability_status] || AVAILABILITY_STATUS_MAP.offline;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* 头部信息 */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {pilot.license_type?.charAt(0)?.toUpperCase() || 'P'}
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                {backgroundColor: availabilityStatus.color},
              ]}
            />
          </View>
          <Text style={styles.licenseNo}>{pilot.license_no}</Text>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusIndicator,
                {backgroundColor: verificationStatus.color},
              ]}
            />
            <Text style={[styles.statusText, {color: verificationStatus.color}]}>
              {verificationStatus.label}
            </Text>
          </View>
        </View>

        {/* 接单开关 */}
        {pilot.verification_status === 'verified' && (
          <View style={styles.availabilityCard}>
            <View style={styles.availabilityRow}>
              <Text style={styles.availabilityLabel}>接单状态</Text>
              <View style={styles.availabilityRight}>
                <Text style={[styles.availabilityStatus, {color: availabilityStatus.color}]}>
                  {availabilityStatus.label}
                </Text>
                <Switch
                  value={isAvailable}
                  onValueChange={toggleAvailability}
                  trackColor={{false: '#ddd', true: '#52c41a'}}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        )}

        {/* 飞行统计 */}
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>飞行统计</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{flightStats?.total_flights || 0}</Text>
              <Text style={styles.statsLabel}>总飞行次数</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>
                {(flightStats?.total_hours || 0).toFixed(1)}h
              </Text>
              <Text style={styles.statsLabel}>总飞行时长</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>
                {((flightStats?.total_distance || 0) / 1000).toFixed(1)}km
              </Text>
              <Text style={styles.statsLabel}>总飞行距离</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{pilot.average_rating?.toFixed(1) || '5.0'}</Text>
              <Text style={styles.statsLabel}>平均评分</Text>
            </View>
          </View>
        </View>

        {/* 资质信息 */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>资质信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>执照类型</Text>
            <Text style={styles.infoValue}>{pilot.license_type || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>执照编号</Text>
            <Text style={styles.infoValue}>{pilot.license_no || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>发证机关</Text>
            <Text style={styles.infoValue}>{pilot.license_issuer || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>有效期至</Text>
            <Text style={styles.infoValue}>
              {pilot.license_expire_date?.substring(0, 10) || '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>服务半径</Text>
            <Text style={styles.infoValue}>{pilot.service_radius_km || 50} 公里</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>信用分</Text>
            <Text style={styles.infoValue}>{pilot.credit_score || 600}</Text>
          </View>
        </View>

        {/* 认证状态 */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>认证状态</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>无犯罪记录</Text>
            <Text
              style={[
                styles.infoValue,
                {color: STATUS_MAP[pilot.criminal_check_status]?.color || '#999'},
              ]}>
              {STATUS_MAP[pilot.criminal_check_status]?.label || '未提交'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>健康证明</Text>
            <Text
              style={[
                styles.infoValue,
                {color: STATUS_MAP[pilot.health_check_status]?.color || '#999'},
              ]}>
              {STATUS_MAP[pilot.health_check_status]?.label || '未提交'}
            </Text>
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionCard}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('PilotTaskList')}>
            <Text style={styles.actionText}>接单任务</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('FlightMonitoring', {orderId: undefined})}>
            <Text style={styles.actionText}>飞行监控</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('TrajectoryRecord')}>
            <Text style={styles.actionText}>轨迹与路线</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('CertificationUpload')}>
            <Text style={styles.actionText}>证书管理</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('FlightLog')}>
            <Text style={styles.actionText}>飞行记录</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('BoundDrones')}>
            <Text style={styles.actionText}>绑定的无人机</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  registerBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#1890ff',
    borderRadius: 8,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#1890ff',
    paddingVertical: 30,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  statusDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  licenseNo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  availabilityCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  availabilityRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 12,
  },
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
  },
  actionArrow: {
    fontSize: 20,
    color: '#ccc',
  },
});
