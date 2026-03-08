import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  getFlightLogs,
  addFlightLog,
  getFlightStats,
  getBoundDrones,
  PilotFlightLog,
  FlightStats,
  AddFlightLogRequest,
  PilotDroneBinding,
} from '../../services/pilot';

const WEATHER_OPTIONS = [
  {label: '晴朗', value: 'sunny'},
  {label: '多云', value: 'cloudy'},
  {label: '阴天', value: 'overcast'},
  {label: '小雨', value: 'light_rain'},
  {label: '大风', value: 'windy'},
];

const PURPOSE_OPTIONS = [
  {label: '货物运输', value: 'cargo_delivery'},
  {label: '农业植保', value: 'agriculture'},
  {label: '航拍测绘', value: 'mapping'},
  {label: '巡检监测', value: 'inspection'},
  {label: '培训练习', value: 'training'},
  {label: '其他', value: 'other'},
];

export default function FlightLogScreen() {
  const [logs, setLogs] = useState<PilotFlightLog[]>([]);
  const [stats, setStats] = useState<FlightStats | null>(null);
  const [boundDrones, setBoundDrones] = useState<PilotDroneBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单字段
  const [selectedDroneId, setSelectedDroneId] = useState<number | null>(null);
  const [flightDate, setFlightDate] = useState('');
  const [flightDuration, setFlightDuration] = useState('');
  const [flightDistance, setFlightDistance] = useState('');
  const [takeoffLocation, setTakeoffLocation] = useState('');
  const [landingLocation, setLandingLocation] = useState('');
  const [maxAltitude, setMaxAltitude] = useState('');
  const [weatherCondition, setWeatherCondition] = useState('sunny');
  const [flightPurpose, setFlightPurpose] = useState('cargo_delivery');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async (isRefresh = false, targetPage?: number) => {
    try {
      const currentPage = isRefresh ? 1 : (targetPage ?? 1);
      const [logsRes, statsData, dronesData] = await Promise.all([
        getFlightLogs({page: currentPage, page_size: 20}),
        currentPage === 1 ? getFlightStats() : Promise.resolve(null),
        currentPage === 1 ? getBoundDrones() : Promise.resolve(null),
      ]);

      const newLogs = logsRes.data || [];
      if (isRefresh) {
        setLogs(newLogs);
        setPage(1);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }
      setHasMore(newLogs.length === 20);
      
      if (currentPage === 1) {
        setStats((statsData as FlightStats) || null);
        setBoundDrones((dronesData as PilotDroneBinding[]) || []);
      }
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(false, nextPage);
  };

  const resetForm = () => {
    setSelectedDroneId(null);
    setFlightDate('');
    setFlightDuration('');
    setFlightDistance('');
    setTakeoffLocation('');
    setLandingLocation('');
    setMaxAltitude('');
    setWeatherCondition('sunny');
    setFlightPurpose('cargo_delivery');
    setNotes('');
  };

  const validateDate = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateStr);
  };

  const handleSubmit = async () => {
    if (!selectedDroneId) {
      Alert.alert('提示', '请选择使用的无人机');
      return;
    }
    if (!flightDate || !validateDate(flightDate)) {
      Alert.alert('提示', '请输入正确的飞行日期 (格式: YYYY-MM-DD)');
      return;
    }
    if (!flightDuration || isNaN(parseFloat(flightDuration))) {
      Alert.alert('提示', '请输入飞行时长 (分钟)');
      return;
    }
    if (!flightDistance || isNaN(parseFloat(flightDistance))) {
      Alert.alert('提示', '请输入飞行距离 (米)');
      return;
    }
    if (!takeoffLocation.trim()) {
      Alert.alert('提示', '请输入起飞地点');
      return;
    }
    if (!landingLocation.trim()) {
      Alert.alert('提示', '请输入降落地点');
      return;
    }

    const data: AddFlightLogRequest = {
      drone_id: selectedDroneId,
      flight_date: flightDate,
      flight_duration: parseFloat(flightDuration),
      flight_distance: parseFloat(flightDistance),
      takeoff_location: takeoffLocation.trim(),
      landing_location: landingLocation.trim(),
      max_altitude: maxAltitude ? parseFloat(maxAltitude) : undefined,
      weather_condition: weatherCondition,
      flight_purpose: flightPurpose,
      notes: notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await addFlightLog(data);
      Alert.alert('成功', '飞行记录已添加');
      setShowModal(false);
      resetForm();
      loadData(true);
    } catch (e: any) {
      Alert.alert('添加失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getWeatherLabel = (value: string): string => {
    const found = WEATHER_OPTIONS.find(w => w.value === value);
    return found?.label || value;
  };

  const getPurposeLabel = (value: string): string => {
    const found = PURPOSE_OPTIONS.find(p => p.value === value);
    return found?.label || value;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes.toFixed(0)}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}米`;
    }
    return `${(meters / 1000).toFixed(2)}公里`;
  };

  const formatTotalHours = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const renderLogItem = ({item}: {item: PilotFlightLog}) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={styles.logDate}>{item.flight_date?.substring(0, 10)}</Text>
        <Text style={styles.logPurpose}>{getPurposeLabel(item.flight_purpose)}</Text>
      </View>
      <View style={styles.logBody}>
        <View style={styles.logRow}>
          <View style={styles.logItem}>
            <Text style={styles.logLabel}>飞行时长</Text>
            <Text style={styles.logValue}>{formatDuration(item.flight_duration)}</Text>
          </View>
          <View style={styles.logItem}>
            <Text style={styles.logLabel}>飞行距离</Text>
            <Text style={styles.logValue}>{formatDistance(item.flight_distance)}</Text>
          </View>
        </View>
        <View style={styles.logRow}>
          <View style={styles.logItem}>
            <Text style={styles.logLabel}>起飞地点</Text>
            <Text style={styles.logValue} numberOfLines={1}>{item.takeoff_location}</Text>
          </View>
          <View style={styles.logItem}>
            <Text style={styles.logLabel}>降落地点</Text>
            <Text style={styles.logValue} numberOfLines={1}>{item.landing_location}</Text>
          </View>
        </View>
        {item.max_altitude > 0 && (
          <View style={styles.logDetailRow}>
            <Text style={styles.logDetailLabel}>最高高度: {item.max_altitude}米</Text>
            <Text style={styles.logDetailLabel}>天气: {getWeatherLabel(item.weather_condition)}</Text>
          </View>
        )}
        {item.notes && (
          <Text style={styles.logNotes} numberOfLines={2}>{item.notes}</Text>
        )}
      </View>
    </View>
  );

  const renderHeader = () => (
    <View>
      {/* 统计概览 */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>飞行统计</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{stats?.total_flights || 0}</Text>
            <Text style={styles.statsLabel}>总飞行次数</Text>
          </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>
                {formatTotalHours(stats?.total_hours || 0)}
              </Text>
              <Text style={styles.statsLabel}>总飞行时长</Text>
            </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>
              {((stats?.total_distance || 0) / 1000).toFixed(1)}km
            </Text>
            <Text style={styles.statsLabel}>总飞行距离</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>
              {(stats?.max_altitude || 0).toFixed(0)}m
            </Text>
            <Text style={styles.statsLabel}>最高飞行高度</Text>
          </View>
        </View>
      </View>

      {/* 添加记录按钮 */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          if (boundDrones.length === 0) {
            Alert.alert('提示', '请先绑定无人机后再添加飞行记录');
            return;
          }
          resetForm();
          setShowModal(true);
        }}>
        <Text style={styles.addBtnIcon}>+</Text>
        <Text style={styles.addBtnText}>添加飞行记录</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>飞行记录</Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>加载更多...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无飞行记录</Text>
      <Text style={styles.emptySubText}>完成飞行任务后记录会自动生成</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />

      {/* 添加记录弹窗 */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加飞行记录</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* 选择无人机 */}
              <Text style={styles.label}>使用无人机 *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.droneContainer}>
                  {boundDrones.map(binding => (
                    <TouchableOpacity
                      key={binding.id}
                      style={[
                        styles.droneOption,
                        selectedDroneId === binding.drone_id && styles.droneOptionActive,
                      ]}
                      onPress={() => setSelectedDroneId(binding.drone_id)}>
                      <Text
                        style={[
                          styles.droneOptionText,
                          selectedDroneId === binding.drone_id && styles.droneOptionTextActive,
                        ]}>
                        {binding.drone?.model || `无人机#${binding.drone_id}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* 飞行日期 */}
              <Text style={styles.label}>飞行日期 *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={flightDate}
                onChangeText={setFlightDate}
              />

              {/* 飞行时长和距离 */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>飞行时长 (分钟) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="如: 30"
                    value={flightDuration}
                    onChangeText={setFlightDuration}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>飞行距离 (米) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="如: 5000"
                    value={flightDistance}
                    onChangeText={setFlightDistance}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* 起飞/降落地点 */}
              <Text style={styles.label}>起飞地点 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入起飞地点"
                value={takeoffLocation}
                onChangeText={setTakeoffLocation}
              />

              <Text style={styles.label}>降落地点 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入降落地点"
                value={landingLocation}
                onChangeText={setLandingLocation}
              />

              {/* 最高高度 */}
              <Text style={styles.label}>最高高度 (米)</Text>
              <TextInput
                style={styles.input}
                placeholder="选填"
                value={maxAltitude}
                onChangeText={setMaxAltitude}
                keyboardType="numeric"
              />

              {/* 天气状况 */}
              <Text style={styles.label}>天气状况</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.optionContainer}>
                  {WEATHER_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.smallOption,
                        weatherCondition === option.value && styles.smallOptionActive,
                      ]}
                      onPress={() => setWeatherCondition(option.value)}>
                      <Text
                        style={[
                          styles.smallOptionText,
                          weatherCondition === option.value && styles.smallOptionTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* 飞行用途 */}
              <Text style={styles.label}>飞行用途</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.optionContainer}>
                  {PURPOSE_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.smallOption,
                        flightPurpose === option.value && styles.smallOptionActive,
                      ]}
                      onPress={() => setFlightPurpose(option.value)}>
                      <Text
                        style={[
                          styles.smallOptionText,
                          flightPurpose === option.value && styles.smallOptionTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* 备注 */}
              <Text style={styles.label}>备注</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="选填，记录本次飞行的特殊情况"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              {/* 提交按钮 */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitBtnText}>
                  {submitting ? '提交中...' : '保存记录'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  listContent: {
    paddingBottom: 24,
  },
  statsCard: {
    backgroundColor: '#1890ff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statsValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1890ff',
  },
  addBtnIcon: {
    fontSize: 18,
    color: '#1890ff',
    marginRight: 8,
  },
  addBtnText: {
    fontSize: 16,
    color: '#1890ff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  logCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  logDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  logPurpose: {
    fontSize: 13,
    color: '#1890ff',
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  logBody: {
    padding: 14,
  },
  logRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  logItem: {
    flex: 1,
  },
  logLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  logValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  logDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  logDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  logNotes: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#999',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  droneContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  droneOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginRight: 10,
  },
  droneOptionActive: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
  },
  droneOptionText: {
    fontSize: 14,
    color: '#666',
  },
  droneOptionTextActive: {
    color: '#fff',
  },
  optionContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  smallOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    marginRight: 8,
  },
  smallOptionActive: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
  },
  smallOptionText: {
    fontSize: 13,
    color: '#666',
  },
  smallOptionTextActive: {
    color: '#fff',
  },
  submitBtn: {
    height: 50,
    backgroundColor: '#1890ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
