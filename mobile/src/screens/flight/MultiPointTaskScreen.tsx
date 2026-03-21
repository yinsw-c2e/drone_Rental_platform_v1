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
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  createMultiPointTask,
  getMultiPointTask,
  startMultiPointTask,
  arriveAtStop,
  completeStop,
  MultiPointTask,
  MultiPointTaskStop,
  CreateMultiPointTaskRequest,
} from '../../services/flight';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const TASK_STATUS_MAP: Record<string, {label: string; colorKey: 'warning' | 'info' | 'success' | 'textHint'}> = {
  pending: {label: '待开始', colorKey: 'warning'},
  in_progress: {label: '进行中', colorKey: 'info'},
  completed: {label: '已完成', colorKey: 'success'},
  cancelled: {label: '已取消', colorKey: 'textHint'},
};

const STOP_STATUS_MAP: Record<string, {label: string; colorKey: 'textHint' | 'warning' | 'success'}> = {
  pending: {label: '待到达', colorKey: 'textHint'},
  arrived: {label: '已到达', colorKey: 'warning'},
  completed: {label: '已完成', colorKey: 'success'},
  skipped: {label: '已跳过', colorKey: 'textHint'},
};

const ACTION_TYPE_MAP: Record<string, string> = {
  pickup: '取货',
  delivery: '送达',
  inspection: '检查',
  charging: '充电',
  waypoint: '途经点',
};

export default function MultiPointTaskScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const orderId = route?.params?.orderId;
  const taskIdParam = route?.params?.taskId;

  const [task, setTask] = useState<MultiPointTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Create task form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [stops, setStops] = useState<CreateMultiPointTaskRequest['stops']>([]);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [stopName, setStopName] = useState('');
  const [stopAddress, setStopAddress] = useState('');
  const [stopLat, setStopLat] = useState('');
  const [stopLng, setStopLng] = useState('');
  const [stopAction, setStopAction] = useState('pickup');
  const [stopNotes, setStopNotes] = useState('');

  const loadTask = async () => {
    if (!taskIdParam) return;
    try {
      const data = await getMultiPointTask(taskIdParam);
      setTask(data);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (taskIdParam) {
        setLoading(true);
        loadTask();
      }
    }, [taskIdParam]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTask();
  };

  const handleStartTask = () => {
    if (!task) return;
    Alert.alert('开始任务', '确定要开始执行此多点任务吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '开始',
        onPress: async () => {
          try {
            await startMultiPointTask(task.id);
            Alert.alert('成功', '任务已开始');
            loadTask();
          } catch (e: any) {
            Alert.alert('操作失败', e.message);
          }
        },
      },
    ]);
  };

  const handleArrive = async () => {
    if (!task) return;
    try {
      await arriveAtStop(task.id);
      Alert.alert('成功', '已标记到达当前站点');
      loadTask();
    } catch (e: any) {
      Alert.alert('操作失败', e.message);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    try {
      setCompleting(true);
      await completeStop(task.id, completeNotes.trim() || undefined);
      setShowCompleteModal(false);
      setCompleteNotes('');
      Alert.alert('成功', '站点已完成');
      loadTask();
    } catch (e: any) {
      Alert.alert('操作失败', e.message);
    } finally {
      setCompleting(false);
    }
  };

  const addStop = () => {
    if (!stopName.trim() || !stopAddress.trim()) {
      Alert.alert('提示', '请填写站点名称和地址');
      return;
    }
    const lat = parseFloat(stopLat);
    const lng = parseFloat(stopLng);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('提示', '请输入有效的经纬度');
      return;
    }
    setStops([
      ...stops,
      {
        stop_name: stopName.trim(),
        address: stopAddress.trim(),
        latitude: lat,
        longitude: lng,
        action_type: stopAction,
        notes: stopNotes.trim() || undefined,
      },
    ]);
    setShowAddStopModal(false);
    resetStopForm();
  };

  const resetStopForm = () => {
    setStopName('');
    setStopAddress('');
    setStopLat('');
    setStopLng('');
    setStopAction('pickup');
    setStopNotes('');
  };

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index));
  };

  const handleCreateTask = async () => {
    if (!orderId) {
      Alert.alert('提示', '请从订单详情进入');
      return;
    }
    if (!taskName.trim()) {
      Alert.alert('提示', '请输入任务名称');
      return;
    }
    if (stops.length < 2) {
      Alert.alert('提示', '至少需要2个站点');
      return;
    }
    try {
      setLoading(true);
      const created = await createMultiPointTask({
        order_id: orderId,
        task_name: taskName.trim(),
        stops,
      });
      setTask(created);
      setShowCreateModal(false);
      setTaskName('');
      setStops([]);
      Alert.alert('成功', '多点任务已创建');
    } catch (e: any) {
      Alert.alert('创建失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStop = (): MultiPointTaskStop | undefined => {
    if (!task?.stops) return undefined;
    return task.stops.find(s => s.stop_sequence === task.current_stop);
  };

  const getProgressPercent = (): number => {
    if (!task || !task.total_stops) return 0;
    return Math.round((task.completed_stops / task.total_stops) * 100);
  };

  // No task loaded and no param - show create option
  if (!taskIdParam && !task) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centeredContainer}>
          <Text style={styles.noTaskText}>暂无多点任务</Text>
          <Text style={styles.noTaskSubText}>创建多点任务来管理多站点配送</Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setShowCreateModal(true)}>
            <Text style={styles.createBtnText}>创建多点任务</Text>
          </TouchableOpacity>
        </View>

        {renderCreateModal()}
        {renderAddStopModal()}
      </SafeAreaView>
    );
  }

  // Loading
  if (loading && !task) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centeredContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  function renderCreateModal() {
    return (
      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={styles.modalFullScreen}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancel}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>创建多点任务</Text>
            <TouchableOpacity onPress={handleCreateTask} disabled={loading}>
              <Text style={[styles.modalSave, loading && {opacity: 0.5}]}>
                {loading ? '创建中...' : '创建'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.fieldLabel}>任务名称 *</Text>
            <TextInput
              style={styles.input}
              placeholder="如: 城区多点配送"
              value={taskName}
              onChangeText={setTaskName}
            />

            <View style={styles.stopsHeader}>
              <Text style={styles.fieldLabel}>站点列表 ({stops.length})</Text>
              <TouchableOpacity onPress={() => setShowAddStopModal(true)}>
                <Text style={styles.addStopBtn}>+ 添加站点</Text>
              </TouchableOpacity>
            </View>

            {stops.length === 0 ? (
              <View style={styles.emptyStops}>
                <Text style={styles.emptyStopsText}>请添加至少2个站点</Text>
              </View>
            ) : (
              stops.map((stop, index) => (
                <View key={index} style={styles.stopPreviewCard}>
                  <View style={styles.stopPreviewHeader}>
                    <View style={styles.stopSeqBadge}>
                      <Text style={styles.stopSeqText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stopPreviewName}>{stop.stop_name}</Text>
                    <View style={styles.stopActionBadge}>
                      <Text style={styles.stopActionText}>
                        {ACTION_TYPE_MAP[stop.action_type] || stop.action_type}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeStop(index)}>
                      <Text style={styles.removeStopText}>删除</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.stopPreviewAddr}>{stop.address}</Text>
                  <Text style={styles.stopPreviewCoord}>
                    {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  function renderAddStopModal() {
    const ACTION_OPTIONS = [
      {key: 'pickup', label: '取货'},
      {key: 'delivery', label: '送达'},
      {key: 'inspection', label: '检查'},
      {key: 'charging', label: '充电'},
      {key: 'waypoint', label: '途经点'},
    ];

    return (
      <Modal
        visible={showAddStopModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAddStopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加站点</Text>

            <Text style={styles.fieldLabel}>站点名称 *</Text>
            <TextInput
              style={styles.input}
              placeholder="如: 仓库A"
              value={stopName}
              onChangeText={setStopName}
            />

            <Text style={styles.fieldLabel}>地址 *</Text>
            <TextInput
              style={styles.input}
              placeholder="详细地址"
              value={stopAddress}
              onChangeText={setStopAddress}
            />

            <View style={styles.coordInputRow}>
              <View style={styles.coordInputItem}>
                <Text style={styles.fieldLabel}>纬度 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="如: 30.57"
                  value={stopLat}
                  onChangeText={setStopLat}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.coordInputItem}>
                <Text style={styles.fieldLabel}>经度 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="如: 104.06"
                  value={stopLng}
                  onChangeText={setStopLng}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>操作类型</Text>
            <View style={styles.actionTypeRow}>
              {ACTION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.actionTypeChip,
                    stopAction === opt.key && styles.actionTypeChipActive,
                  ]}
                  onPress={() => setStopAction(opt.key)}>
                  <Text
                    style={[
                      styles.actionTypeChipText,
                      stopAction === opt.key && styles.actionTypeChipTextActive,
                    ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>备注</Text>
            <TextInput
              style={styles.input}
              placeholder="选填"
              value={stopNotes}
              onChangeText={setStopNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddStopModal(false);
                  resetStopForm();
                }}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={addStop}>
                <Text style={styles.modalConfirmText}>添加</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Task detail view
  const currentStop = getCurrentStop();
  const progress = getProgressPercent();
  const taskStatus = TASK_STATUS_MAP[task?.status || 'pending'] || TASK_STATUS_MAP.pending;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Task header */}
        <View style={styles.taskHeader}>
          <View style={styles.taskTitleRow}>
            <Text style={styles.taskName}>{task?.task_name || '多点任务'}</Text>
            <View style={[styles.taskStatusBadge, {backgroundColor: theme[taskStatus.colorKey] + '20'}]}>
              <Text style={[styles.taskStatusText, {color: theme[taskStatus.colorKey]}]}>
                {taskStatus.label}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, {width: `${progress}%`}]} />
            </View>
            <Text style={styles.progressText}>
              {task?.completed_stops || 0} / {task?.total_stops || 0} 站点已完成 ({progress}%)
            </Text>
          </View>
        </View>

        {/* Current stop highlight */}
        {currentStop && task?.status === 'in_progress' && (
          <View style={styles.currentStopCard}>
            <Text style={styles.currentStopLabel}>当前站点</Text>
            <Text style={styles.currentStopName}>{currentStop.stop_name}</Text>
            <Text style={styles.currentStopAddr}>{currentStop.address}</Text>
            <View style={styles.currentStopMeta}>
              <View style={styles.currentStopActionBadge}>
                <Text style={styles.currentStopActionText}>
                  {ACTION_TYPE_MAP[currentStop.action_type] || currentStop.action_type}
                </Text>
              </View>
              <Text style={styles.currentStopCoord}>
                {currentStop.latitude.toFixed(5)}, {currentStop.longitude.toFixed(5)}
              </Text>
            </View>
            {currentStop.notes ? (
              <Text style={styles.currentStopNotes}>备注: {currentStop.notes}</Text>
            ) : null}

            <View style={styles.currentStopActions}>
              {currentStop.status === 'pending' && (
                <TouchableOpacity style={styles.arriveBtn} onPress={handleArrive}>
                  <Text style={styles.arriveBtnText}>标记到达</Text>
                </TouchableOpacity>
              )}
              {currentStop.status === 'arrived' && (
                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={() => setShowCompleteModal(true)}>
                  <Text style={styles.completeBtnText}>完成站点</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Task actions */}
        {task?.status === 'pending' && (
          <View style={styles.taskActionsCard}>
            <TouchableOpacity style={styles.startTaskBtn} onPress={handleStartTask}>
              <Text style={styles.startTaskBtnText}>开始执行任务</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* All stops */}
        <View style={styles.stopsCard}>
          <Text style={styles.cardTitle}>全部站点 ({task?.total_stops || 0})</Text>
          {(task?.stops || []).map((stop, index) => {
            const stopStatus = STOP_STATUS_MAP[stop.status] || STOP_STATUS_MAP.pending;
            const isCurrent = stop.stop_sequence === task?.current_stop && task?.status === 'in_progress';
            return (
              <View
                key={stop.id || index}
                style={[styles.stopItem, isCurrent && styles.stopItemCurrent]}>
                <View style={styles.stopTimeline}>
                  <View
                    style={[
                      styles.stopDot,
                      {backgroundColor: theme[stopStatus.colorKey]},
                      isCurrent && styles.stopDotCurrent,
                    ]}
                  />
                  {index < (task?.stops?.length || 0) - 1 && (
                    <View
                      style={[
                        styles.stopLine,
                        stop.status === 'completed' && styles.stopLineCompleted,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.stopContent}>
                  <View style={styles.stopContentHeader}>
                    <Text style={[styles.stopItemName, isCurrent && {color: theme.primaryText}]}>
                      {stop.stop_name}
                    </Text>
                    <Text style={[styles.stopItemStatus, {color: theme[stopStatus.colorKey]}]}>
                      {stopStatus.label}
                    </Text>
                  </View>
                  <Text style={styles.stopItemAddr}>{stop.address}</Text>
                  <View style={styles.stopItemMetaRow}>
                    <Text style={styles.stopItemAction}>
                      {ACTION_TYPE_MAP[stop.action_type] || stop.action_type}
                    </Text>
                    {stop.arrived_at && (
                      <Text style={styles.stopItemTime}>
                        到达: {new Date(stop.arrived_at).toLocaleTimeString()}
                      </Text>
                    )}
                    {stop.completed_at && (
                      <Text style={styles.stopItemTime}>
                        完成: {new Date(stop.completed_at).toLocaleTimeString()}
                      </Text>
                    )}
                  </View>
                  {stop.notes ? (
                    <Text style={styles.stopItemNotes}>{stop.notes}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Task timing */}
        {task && (
          <View style={styles.timingCard}>
            <Text style={styles.cardTitle}>时间信息</Text>
            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>创建时间</Text>
              <Text style={styles.timingValue}>
                {task.created_at ? new Date(task.created_at).toLocaleString() : '-'}
              </Text>
            </View>
            {task.started_at && (
              <View style={styles.timingRow}>
                <Text style={styles.timingLabel}>开始时间</Text>
                <Text style={styles.timingValue}>
                  {new Date(task.started_at).toLocaleString()}
                </Text>
              </View>
            )}
            {task.completed_at && (
              <View style={styles.timingRow}>
                <Text style={styles.timingLabel}>完成时间</Text>
                <Text style={styles.timingValue}>
                  {new Date(task.completed_at).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Complete stop modal */}
      <Modal
        visible={showCompleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCompleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>完成站点</Text>
            <Text style={styles.modalSubtitle}>
              确认完成 "{currentStop?.stop_name}" 的操作
            </Text>
            <Text style={styles.fieldLabel}>备注（选填）</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="如: 已完成取货，共5件"
              value={completeNotes}
              onChangeText={setCompleteNotes}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCompleteModal(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleComplete}
                disabled={completing}>
                <Text style={styles.modalConfirmText}>
                  {completing ? '处理中...' : '确认完成'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {renderCreateModal()}
      {renderAddStopModal()}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  centeredContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
  loadingText: {fontSize: 16, color: theme.textSub},
  noTaskText: {fontSize: 18, color: theme.text, fontWeight: '600', marginBottom: 8},
  noTaskSubText: {fontSize: 14, color: theme.textSub, marginBottom: 24},
  createBtn: {
    backgroundColor: theme.primary, paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 8,
  },
  createBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '600'},
  // Task header
  taskHeader: {backgroundColor: theme.card, padding: 16, marginBottom: 1},
  taskTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  taskName: {fontSize: 18, fontWeight: '600', color: theme.text, flex: 1},
  taskStatusBadge: {paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginLeft: 12},
  taskStatusText: {fontSize: 13, fontWeight: '500'},
  progressSection: {},
  progressBarBg: {
    height: 8, backgroundColor: theme.divider, borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: {height: '100%', backgroundColor: theme.success, borderRadius: 4},
  progressText: {fontSize: 13, color: theme.textSub, marginTop: 8, textAlign: 'center'},
  // Current stop
  currentStopCard: {
    backgroundColor: theme.primaryBg, margin: 16, marginBottom: 0,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.primary + '44',
  },
  currentStopLabel: {fontSize: 12, color: theme.primaryText, fontWeight: '600', marginBottom: 8},
  currentStopName: {fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 4},
  currentStopAddr: {fontSize: 14, color: theme.textSub, marginBottom: 10},
  currentStopMeta: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  currentStopActionBadge: {
    backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginRight: 12,
  },
  currentStopActionText: {color: theme.btnPrimaryText, fontSize: 12},
  currentStopCoord: {fontSize: 12, color: theme.textSub},
  currentStopNotes: {fontSize: 13, color: theme.textSub, fontStyle: 'italic', marginBottom: 8},
  currentStopActions: {marginTop: 12},
  arriveBtn: {
    backgroundColor: theme.warning, paddingVertical: 14, borderRadius: 8,
    alignItems: 'center',
  },
  arriveBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '600'},
  completeBtn: {
    backgroundColor: theme.success, paddingVertical: 14, borderRadius: 8,
    alignItems: 'center',
  },
  completeBtnText: {color: theme.btnPrimaryText, fontSize: 16, fontWeight: '600'},
  // Task actions
  taskActionsCard: {margin: 16, marginBottom: 0},
  startTaskBtn: {
    backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 8,
    alignItems: 'center',
  },
  startTaskBtnText: {color: theme.btnPrimaryText, fontSize: 18, fontWeight: '600'},
  // Stops list
  stopsCard: {
    backgroundColor: theme.card, margin: 16, marginBottom: 0, borderRadius: 12, padding: 16,
  },
  cardTitle: {fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 14},
  stopItem: {flexDirection: 'row', minHeight: 80},
  stopItemCurrent: {backgroundColor: theme.primaryBg, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8},
  stopTimeline: {alignItems: 'center', width: 24, marginRight: 12},
  stopDot: {
    width: 12, height: 12, borderRadius: 6, marginTop: 4,
  },
  stopDotCurrent: {
    width: 16, height: 16, borderRadius: 8, marginTop: 2,
    borderWidth: 3, borderColor: theme.primary,
  },
  stopLine: {
    width: 2, flex: 1, backgroundColor: theme.divider, marginVertical: 4,
  },
  stopLineCompleted: {backgroundColor: theme.success},
  stopContent: {flex: 1, paddingBottom: 16},
  stopContentHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  stopItemName: {fontSize: 15, fontWeight: '600', color: theme.text},
  stopItemStatus: {fontSize: 12, fontWeight: '500'},
  stopItemAddr: {fontSize: 13, color: theme.textSub, marginBottom: 4},
  stopItemMetaRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  stopItemAction: {fontSize: 12, color: theme.primaryText, fontWeight: '500'},
  stopItemTime: {fontSize: 12, color: theme.textSub},
  stopItemNotes: {fontSize: 12, color: theme.textSub, fontStyle: 'italic', marginTop: 4},
  // Timing
  timingCard: {
    backgroundColor: theme.card, margin: 16, borderRadius: 12, padding: 16,
  },
  timingRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  timingLabel: {fontSize: 14, color: theme.textSub},
  timingValue: {fontSize: 14, color: theme.text},
  modalFullScreen: {flex: 1, backgroundColor: theme.card},
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  modalCancel: {fontSize: 16, color: theme.textSub},
  modalHeaderTitle: {fontSize: 17, fontWeight: '600', color: theme.text},
  modalSave: {fontSize: 16, color: theme.primaryText, fontWeight: '600'},
  modalBody: {padding: 16},
  fieldLabel: {fontSize: 14, color: theme.text, marginBottom: 6, fontWeight: '500'},
  input: {
    borderWidth: 1, borderColor: theme.divider, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, backgroundColor: theme.bgSecondary, marginBottom: 16,
  },
  textArea: {height: 80, textAlignVertical: 'top'},
  stopsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  addStopBtn: {fontSize: 14, color: theme.primaryText, fontWeight: '600'},
  emptyStops: {paddingVertical: 30, alignItems: 'center'},
  emptyStopsText: {fontSize: 14, color: theme.textSub},
  stopPreviewCard: {
    backgroundColor: theme.bgSecondary, borderRadius: 8, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: theme.divider,
  },
  stopPreviewHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
  },
  stopSeqBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  stopSeqText: {color: theme.btnPrimaryText, fontSize: 12, fontWeight: '600'},
  stopPreviewName: {fontSize: 15, fontWeight: '600', color: theme.text, flex: 1},
  stopActionBadge: {
    backgroundColor: theme.primaryBg, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginRight: 8,
  },
  stopActionText: {fontSize: 11, color: theme.primaryText},
  removeStopText: {fontSize: 13, color: theme.danger},
  stopPreviewAddr: {fontSize: 13, color: theme.textSub, marginLeft: 32},
  stopPreviewCoord: {fontSize: 12, color: theme.textSub, marginLeft: 32, marginTop: 2},
  // Add stop modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {backgroundColor: theme.card, borderRadius: 16, padding: 24, width: '90%'},
  modalTitle: {fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 16},
  modalSubtitle: {fontSize: 14, color: theme.textSub, marginBottom: 16},
  coordInputRow: {flexDirection: 'row', gap: 12},
  coordInputItem: {flex: 1},
  actionTypeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16},
  actionTypeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: theme.divider, backgroundColor: theme.bgSecondary,
  },
  actionTypeChipActive: {borderColor: theme.primary, backgroundColor: theme.primaryBg},
  actionTypeChipText: {fontSize: 13, color: theme.textSub},
  actionTypeChipTextActive: {color: theme.primaryText, fontWeight: '500'},
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 8},
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: theme.divider, alignItems: 'center',
  },
  modalCancelText: {fontSize: 16, color: theme.textSub},
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: theme.primary, alignItems: 'center',
  },
  modalConfirmText: {fontSize: 16, color: theme.btnPrimaryText, fontWeight: '600'},
});
