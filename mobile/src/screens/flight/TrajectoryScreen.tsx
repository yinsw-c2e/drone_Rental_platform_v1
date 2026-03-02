import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
  Switch,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  startTrajectory,
  stopTrajectory,
  getTrajectory,
  createRouteFromTrajectory,
  listMyRoutes,
  listPublicRoutes,
  deleteRoute,
  FlightTrajectory,
  FlightWaypoint,
  SavedRoute,
} from '../../services/flight';

type TabKey = 'recording' | 'myRoutes' | 'publicRoutes';

const TRAJECTORY_STATUS_MAP: Record<string, {label: string; color: string}> = {
  recording: {label: '记录中', color: '#52c41a'},
  completed: {label: '已完成', color: '#1890ff'},
  cancelled: {label: '已取消', color: '#999'},
};

export default function TrajectoryScreen({route, navigation}: any) {
  const orderId = route?.params?.orderId;

  const [activeTab, setActiveTab] = useState<TabKey>('recording');
  const [trajectory, setTrajectory] = useState<FlightTrajectory | null>(null);
  const [waypoints, setWaypoints] = useState<FlightWaypoint[]>([]);
  const [myRoutes, setMyRoutes] = useState<SavedRoute[]>([]);
  const [publicRoutes, setPublicRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Save route modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveRouteName, setSaveRouteName] = useState('');
  const [saveRouteDesc, setSaveRouteDesc] = useState('');
  const [saveRoutePublic, setSaveRoutePublic] = useState(false);

  const loadRoutes = async () => {
    try {
      const [my, pub] = await Promise.all([
        listMyRoutes().catch(() => []),
        listPublicRoutes().catch(() => []),
      ]);
      setMyRoutes(my || []);
      setPublicRoutes(pub || []);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRoutes();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRoutes();
    setRefreshing(false);
  };

  const handleStartRecording = async () => {
    if (!orderId) {
      Alert.alert('提示', '请从订单详情进入轨迹记录');
      return;
    }
    try {
      setLoading(true);
      const traj = await startTrajectory(orderId);
      setTrajectory(traj);
      Alert.alert('成功', '轨迹记录已开始');
    } catch (e: any) {
      Alert.alert('操作失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecording = () => {
    if (!trajectory) return;
    Alert.alert('停止记录', '确定要停止轨迹记录吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认停止',
        onPress: async () => {
          try {
            setLoading(true);
            const traj = await stopTrajectory(trajectory.id);
            setTrajectory(traj);
            // Load waypoints
            try {
              const detail = await getTrajectory(trajectory.id);
              setWaypoints(detail.waypoints || []);
            } catch {}
            Alert.alert('成功', '轨迹记录已停止');
          } catch (e: any) {
            Alert.alert('操作失败', e.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleViewTrajectory = async (trajectoryId: number) => {
    try {
      setLoading(true);
      const detail = await getTrajectory(trajectoryId);
      setTrajectory(detail.trajectory);
      setWaypoints(detail.waypoints || []);
      setActiveTab('recording');
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!trajectory) return;
    if (!saveRouteName.trim()) {
      Alert.alert('提示', '请输入路线名称');
      return;
    }
    try {
      await createRouteFromTrajectory(trajectory.id, {
        name: saveRouteName.trim(),
        description: saveRouteDesc.trim() || undefined,
        is_public: saveRoutePublic,
      });
      setShowSaveModal(false);
      setSaveRouteName('');
      setSaveRouteDesc('');
      setSaveRoutePublic(false);
      Alert.alert('成功', '路线已保存');
      loadRoutes();
    } catch (e: any) {
      Alert.alert('保存失败', e.message);
    }
  };

  const handleDeleteRoute = (routeId: number) => {
    Alert.alert('删除路线', '确定要删除此路线吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoute(routeId);
            loadRoutes();
          } catch (e: any) {
            Alert.alert('操作失败', e.message);
          }
        },
      },
    ]);
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m ${Math.floor(seconds % 60)}s`;
  };

  const formatDistance = (meters: number): string => {
    if (!meters) return '-';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters.toFixed(0)} m`;
  };

  const renderRecordingTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Recording controls */}
      <View style={styles.recordingCard}>
        <Text style={styles.cardTitle}>轨迹记录</Text>
        {trajectory ? (
          <>
            <View style={styles.trajectoryInfo}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>状态</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {backgroundColor: (TRAJECTORY_STATUS_MAP[trajectory.status] || TRAJECTORY_STATUS_MAP.completed).color + '20'},
                  ]}>
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {color: (TRAJECTORY_STATUS_MAP[trajectory.status] || TRAJECTORY_STATUS_MAP.completed).color},
                    ]}>
                    {(TRAJECTORY_STATUS_MAP[trajectory.status] || TRAJECTORY_STATUS_MAP.completed).label}
                  </Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statsItem}>
                  <Text style={styles.statsValue}>
                    {formatDistance(trajectory.total_distance)}
                  </Text>
                  <Text style={styles.statsLabel}>总距离</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsValue}>
                    {formatDuration(trajectory.total_duration)}
                  </Text>
                  <Text style={styles.statsLabel}>总时长</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsValue}>
                    {trajectory.max_altitude?.toFixed(0) || '-'}m
                  </Text>
                  <Text style={styles.statsLabel}>最大高度</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsValue}>
                    {trajectory.max_speed?.toFixed(1) || '-'}m/s
                  </Text>
                  <Text style={styles.statsLabel}>最大速度</Text>
                </View>
              </View>
              <View style={styles.extraStats}>
                <Text style={styles.extraStatsText}>
                  平均速度: {trajectory.avg_speed?.toFixed(1) || '-'} m/s | 航点数: {trajectory.waypoint_count || 0}
                </Text>
                {trajectory.start_time && (
                  <Text style={styles.extraStatsText}>
                    开始: {new Date(trajectory.start_time).toLocaleString()}
                  </Text>
                )}
                {trajectory.end_time && (
                  <Text style={styles.extraStatsText}>
                    结束: {new Date(trajectory.end_time).toLocaleString()}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.recordActions}>
              {trajectory.status === 'recording' ? (
                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={handleStopRecording}
                  disabled={loading}>
                  <Text style={styles.stopBtnText}>
                    {loading ? '处理中...' : '停止记录'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.completedActions}>
                  <TouchableOpacity
                    style={styles.saveRouteBtn}
                    onPress={() => setShowSaveModal(true)}>
                    <Text style={styles.saveRouteBtnText}>保存为路线</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.newRecordBtn}
                    onPress={() => {
                      setTrajectory(null);
                      setWaypoints([]);
                    }}>
                    <Text style={styles.newRecordBtnText}>新记录</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.noRecordContainer}>
            <Text style={styles.noRecordText}>暂无正在进行的轨迹记录</Text>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStartRecording}
              disabled={loading}>
              <Text style={styles.startBtnText}>
                {loading ? '启动中...' : '开始记录'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Waypoints */}
      {waypoints.length > 0 && (
        <View style={styles.waypointsCard}>
          <Text style={styles.cardTitle}>航点列表 ({waypoints.length})</Text>
          {waypoints.slice(0, 30).map((wp, index) => (
            <View key={wp.id || index} style={styles.waypointItem}>
              <View style={styles.waypointSeq}>
                <Text style={styles.waypointSeqText}>{wp.sequence || index + 1}</Text>
              </View>
              <View style={styles.waypointInfo}>
                <Text style={styles.waypointCoord}>
                  {wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}
                </Text>
                <Text style={styles.waypointMeta}>
                  高度 {wp.altitude.toFixed(0)}m | 速度 {wp.speed?.toFixed(1) || '0'}m/s
                </Text>
              </View>
              <Text style={styles.waypointTime}>
                {wp.recorded_at ? new Date(wp.recorded_at).toLocaleTimeString() : '-'}
              </Text>
            </View>
          ))}
          {waypoints.length > 30 && (
            <Text style={styles.moreText}>还有 {waypoints.length - 30} 个航点未显示</Text>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderRouteItem = ({item, isOwner}: {item: SavedRoute; isOwner: boolean}) => (
    <View style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
        {item.is_public && (
          <View style={styles.publicBadge}>
            <Text style={styles.publicBadgeText}>公开</Text>
          </View>
        )}
      </View>
      {item.description ? (
        <Text style={styles.routeDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}
      <View style={styles.routeStatsRow}>
        <Text style={styles.routeStat}>
          距离: {formatDistance(item.total_distance)}
        </Text>
        <Text style={styles.routeStat}>
          预计: {formatDuration(item.estimated_duration)}
        </Text>
      </View>
      <View style={styles.routeMetaRow}>
        {item.start_address ? (
          <Text style={styles.routeAddr} numberOfLines={1}>
            {item.start_address} → {item.end_address || ''}
          </Text>
        ) : null}
      </View>
      <View style={styles.routeFooter}>
        <Text style={styles.routeUseCount}>
          使用 {item.use_count || 0} 次 | 评分 {item.average_rating?.toFixed(1) || '-'}
        </Text>
        {isOwner && (
          <TouchableOpacity onPress={() => handleDeleteRoute(item.id)}>
            <Text style={styles.deleteText}>删除</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderMyRoutesTab = () => (
    <FlatList
      data={myRoutes}
      renderItem={({item}) => renderRouteItem({item, isOwner: true})}
      keyExtractor={item => item.id.toString()}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无保存的路线</Text>
          <Text style={styles.emptySubText}>完成轨迹记录后可保存为可复用路线</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );

  const renderPublicRoutesTab = () => (
    <FlatList
      data={publicRoutes}
      renderItem={({item}) => renderRouteItem({item, isOwner: false})}
      keyExtractor={item => item.id.toString()}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无公开路线</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );

  const TABS: {key: TabKey; label: string}[] = [
    {key: 'recording', label: '轨迹记录'},
    {key: 'myRoutes', label: '我的路线'},
    {key: 'publicRoutes', label: '公开路线'},
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'recording' && renderRecordingTab()}
      {activeTab === 'myRoutes' && renderMyRoutesTab()}
      {activeTab === 'publicRoutes' && renderPublicRoutesTab()}

      {/* Save Route Modal */}
      <Modal
        visible={showSaveModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSaveModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>保存为路线</Text>

            <Text style={styles.fieldLabel}>路线名称 *</Text>
            <TextInput
              style={styles.input}
              placeholder="输入路线名称"
              value={saveRouteName}
              onChangeText={setSaveRouteName}
            />

            <Text style={styles.fieldLabel}>描述</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="路线描述（选填）"
              value={saveRouteDesc}
              onChangeText={setSaveRouteDesc}
              multiline
              numberOfLines={3}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>公开路线</Text>
              <Switch
                value={saveRoutePublic}
                onValueChange={setSaveRoutePublic}
                trackColor={{false: '#ddd', true: '#1890ff'}}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.switchHint}>公开路线可被其他飞手搜索和使用</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowSaveModal(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSaveRoute}>
                <Text style={styles.modalConfirmText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tabItem: {flex: 1, paddingVertical: 14, alignItems: 'center'},
  tabItemActive: {borderBottomWidth: 2, borderBottomColor: '#1890ff'},
  tabText: {fontSize: 15, color: '#666'},
  tabTextActive: {color: '#1890ff', fontWeight: '600'},
  tabContent: {flex: 1},
  listContent: {padding: 16, paddingBottom: 24},
  recordingCard: {
    backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16,
  },
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 14},
  trajectoryInfo: {},
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {fontSize: 14, color: '#666'},
  statusBadge: {paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12},
  statusBadgeText: {fontSize: 13, fontWeight: '500'},
  statsGrid: {flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12},
  statsItem: {width: '50%', alignItems: 'center', paddingVertical: 10},
  statsValue: {fontSize: 20, fontWeight: 'bold', color: '#1890ff'},
  statsLabel: {fontSize: 12, color: '#666', marginTop: 4},
  extraStats: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12,
  },
  extraStatsText: {fontSize: 13, color: '#666', lineHeight: 20},
  recordActions: {marginTop: 16},
  stopBtn: {
    backgroundColor: '#ff4d4f', paddingVertical: 14, borderRadius: 8,
    alignItems: 'center',
  },
  stopBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  completedActions: {flexDirection: 'row', gap: 12},
  saveRouteBtn: {
    flex: 2, backgroundColor: '#1890ff', paddingVertical: 14,
    borderRadius: 8, alignItems: 'center',
  },
  saveRouteBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  newRecordBtn: {
    flex: 1, borderWidth: 1, borderColor: '#1890ff', paddingVertical: 14,
    borderRadius: 8, alignItems: 'center',
  },
  newRecordBtnText: {color: '#1890ff', fontSize: 16, fontWeight: '600'},
  noRecordContainer: {alignItems: 'center', paddingVertical: 24},
  noRecordText: {fontSize: 14, color: '#999', marginBottom: 20},
  startBtn: {
    backgroundColor: '#52c41a', paddingHorizontal: 40, paddingVertical: 14,
    borderRadius: 8,
  },
  startBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  waypointsCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16,
  },
  waypointItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  waypointSeq: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#e6f7ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  waypointSeqText: {fontSize: 12, fontWeight: '600', color: '#1890ff'},
  waypointInfo: {flex: 1},
  waypointCoord: {fontSize: 13, color: '#333', fontWeight: '500'},
  waypointMeta: {fontSize: 12, color: '#666', marginTop: 2},
  waypointTime: {fontSize: 11, color: '#999'},
  moreText: {textAlign: 'center', color: '#999', fontSize: 13, paddingVertical: 12},
  routeCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
  },
  routeHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  routeName: {fontSize: 16, fontWeight: '600', color: '#333', flex: 1},
  publicBadge: {
    backgroundColor: '#e6f7ff', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginLeft: 8,
  },
  publicBadgeText: {fontSize: 11, color: '#1890ff'},
  routeDesc: {fontSize: 13, color: '#666', marginBottom: 10, lineHeight: 18},
  routeStatsRow: {flexDirection: 'row', gap: 20, marginBottom: 6},
  routeStat: {fontSize: 13, color: '#333'},
  routeMetaRow: {marginBottom: 8},
  routeAddr: {fontSize: 12, color: '#999'},
  routeFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f5f5f5', paddingTop: 10,
  },
  routeUseCount: {fontSize: 12, color: '#999'},
  deleteText: {fontSize: 13, color: '#ff4d4f'},
  emptyContainer: {paddingTop: 60, alignItems: 'center'},
  emptyText: {fontSize: 16, color: '#666', marginBottom: 8},
  emptySubText: {fontSize: 14, color: '#999'},
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%'},
  modalTitle: {fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 20},
  fieldLabel: {fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '500'},
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 16,
  },
  textArea: {height: 80, textAlignVertical: 'top'},
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  switchLabel: {fontSize: 14, color: '#333'},
  switchHint: {fontSize: 12, color: '#999', marginBottom: 20},
  modalActions: {flexDirection: 'row', gap: 12},
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
  },
  modalCancelText: {fontSize: 16, color: '#666'},
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#1890ff', alignItems: 'center',
  },
  modalConfirmText: {fontSize: 16, color: '#fff', fontWeight: '600'},
});
