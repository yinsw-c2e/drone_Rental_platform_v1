import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { dispatchV2Service } from '../../services/dispatchV2';
import {
  devFlightSimulationService,
  DevFlightSimulationState,
} from '../../services/devFlightSimulation';
import { updateExecutionStatus } from '../../services/orderV2';
import { useTheme } from '../../theme/ThemeContext';
import StatusBadge from '../../components/business/StatusBadge';
import type { AppTheme } from '../../theme/index';
import { APP_CONFIG } from '../../constants';

// 执行状态定义
const EXEC_STEPS = [
  {
    status: 'assigned',
    label: '已派单',
    desc: '已分配派单，等待确认',
    icon: '📨',
  },
  {
    status: 'confirmed',
    label: '已确认接单',
    desc: '接单成功，等待出发',
    icon: '✅',
  },
  {
    status: 'airspace_applying',
    label: '申请空域中',
    desc: '正在办理空域报备或临时空域申请',
    icon: '📋',
  },
  {
    status: 'airspace_approved',
    label: '空域已批准',
    desc: '空域报备已通过，准备装货',
    icon: '✈️',
  },
  {
    status: 'loading',
    label: '装货中',
    desc: '飞手到达装货点，确认装货',
    icon: '📦',
  },
  {
    status: 'in_transit',
    label: '运输中',
    desc: '货物已装载，无人机起飞',
    icon: '🚁',
  },
  {
    status: 'delivered',
    label: '已送达',
    desc: '到达卸货点，等待客户确认签收',
    icon: '🏁',
  },
];

// 根据当前状态获取下一步操作
const NEXT_ACTION: Record<
  string,
  { label: string; nextStatus: string; confirmMsg: string }
> = {
  assigned: {
    label: '确认接单',
    nextStatus: 'confirmed',
    confirmMsg: '确认接受此任务？',
  },
  confirmed: {
    label: '申请空域',
    nextStatus: 'airspace_applying',
    confirmMsg: '确认开始办理本次作业的空域报备或临时空域申请？',
  },
  airspace_applying: {
    label: '空域已批准',
    nextStatus: 'airspace_approved',
    confirmMsg: '确认空域许可已获批？',
  },
  airspace_approved: {
    label: '确认装货',
    nextStatus: 'loading',
    confirmMsg: '已到达装货点，确认开始装货？',
  },
  loading: {
    label: '开始运输',
    nextStatus: 'in_transit',
    confirmMsg: '货物已装载完毕，确认起飞运输？',
  },
  in_transit: {
    label: '确认送达',
    nextStatus: 'delivered',
    confirmMsg: '已到达卸货点，确认卸货完成？',
  },
};

const formatSimulationDistance = (meters?: number) => {
  const value = Number(meters || 0);
  if (value <= 0) {
    return '-';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }
  return `${value.toFixed(0)} m`;
};

const formatSimulationDuration = (seconds?: number) => {
  const value = Number(seconds || 0);
  if (value <= 0) {
    return '-';
  }
  const minutes = Math.floor(value / 60);
  const remain = value % 60;
  if (minutes <= 0) {
    return `${remain}s`;
  }
  return `${minutes}m ${remain}s`;
};

const formatTelemetrySpeed = (speed?: number) => {
  const value = Number(speed || 0);
  return `${(value / 100).toFixed(1)} m/s`;
};

export default function PilotOrderExecutionScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { taskId } = route.params || {};
  const [order, setOrder] = useState<any | null>(null);
  const [simulation, setSimulation] = useState<DevFlightSimulationState | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [simulationSubmitting, setSimulationSubmitting] = useState(false);

  const loadSimulation = useCallback(async (orderId?: number | null) => {
    if (!APP_CONFIG.debugMode || !orderId) {
      setSimulation(null);
      return;
    }
    try {
      const res = await devFlightSimulationService.get(orderId);
      setSimulation(res.data || null);
    } catch {
      setSimulation(null);
    }
  }, []);

  const loadOrder = useCallback(async () => {
    try {
      const res = await dispatchV2Service.get(taskId);
      const detail = res.data;
      const nextOrder = detail?.order || detail?.dispatch_task?.order || null;
      setOrder(nextOrder);
      await loadSimulation(nextOrder?.id);
    } catch (e: any) {
      Alert.alert('错误', e.message || '获取订单失败');
      setOrder(null);
      setSimulation(null);
    } finally {
      setLoading(false);
    }
  }, [loadSimulation, taskId]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  useEffect(() => {
    if (
      !APP_CONFIG.debugMode ||
      !order?.id ||
      simulation?.status !== 'running'
    ) {
      return;
    }
    const intervalMs = Math.max(
      (simulation?.route?.interval_seconds || 3) * 1000,
      2500,
    );
    const timer = setInterval(() => {
      loadSimulation(order.id);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [
    loadSimulation,
    order?.id,
    simulation?.route?.interval_seconds,
    simulation?.status,
  ]);

  const handleNextStep = () => {
    if (!order) return;
    const action = NEXT_ACTION[order.status];
    if (!action) return;

    Alert.alert(action.label, action.confirmMsg, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          setSubmitting(true);
          try {
            await updateExecutionStatus(order.id, action.nextStatus);
            await loadOrder();
            if (action.nextStatus === 'completed') {
              Alert.alert('任务完成', '恭喜！运输任务已成功完成', [
                { text: '确定', onPress: () => navigation.goBack() },
              ]);
            }
          } catch (e: any) {
            Alert.alert('操作失败', e.message || '请重试');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const getCurrentStepIndex = (): number => {
    if (!order) return 0;
    return EXEC_STEPS.findIndex(s => s.status === order.status);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>加载任务信息...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>暂无执行任务</Text>
          <Text style={styles.emptySubText}>接受任务后将在此查看执行流程</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const currentStep = EXEC_STEPS[currentStepIndex];
  const nextAction = NEXT_ACTION[order.status];
  const isCompleted = order.status === 'completed';
  const isDelivered = order.status === 'delivered';
  const showSimulationCard = APP_CONFIG.debugMode;
  const canStartSimulation = order.status === 'in_transit';
  const simulationRunning = simulation?.status === 'running';

  const handleStartSimulation = () => {
    if (!order?.id) return;
    Alert.alert(
      '启动测试飞行',
      '系统会基于这笔订单的起点和终点，生成一条包含起飞、爬升、巡航、下降和着陆的测试轨迹，并清空本单已有的测试遥测。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始模拟',
          onPress: async () => {
            setSimulationSubmitting(true);
            try {
              const res = await devFlightSimulationService.start(order.id, {
                reset_existing_data: true,
                inject_sample_alerts: true,
              });
              setSimulation(res.data || null);
              Alert.alert(
                '测试飞行已启动',
                '现在可以进入“飞行监控”查看位置、阶段和告警变化。',
              );
            } catch (e: any) {
              Alert.alert('启动失败', e.message || '请重试');
            } finally {
              setSimulationSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const handleStopSimulation = () => {
    if (!order?.id) return;
    Alert.alert('停止测试飞行', '当前模拟会在最近一个上报点结束。', [
      { text: '取消', style: 'cancel' },
      {
        text: '停止',
        style: 'destructive',
        onPress: async () => {
          setSimulationSubmitting(true);
          try {
            const res = await devFlightSimulationService.stop(order.id);
            setSimulation(res.data || null);
          } catch (e: any) {
            Alert.alert('停止失败', e.message || '请重试');
          } finally {
            setSimulationSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>˂ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>任务执行工作台</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Focus Card */}
        <View
          style={[
            styles.focusCard,
            { borderColor: isCompleted ? theme.success : theme.primary },
          ]}
        >
          <View style={styles.focusHeader}>
            <Text style={styles.focusNo}>订单号：{order.order_no || '-'}</Text>
            <StatusBadge
              label={currentStep?.label || order.status}
              tone={isCompleted ? 'green' : 'blue'}
            />
          </View>
          <Text style={styles.focusTitle}>{order.title}</Text>

          <View style={styles.focusRoute}>
            <View style={styles.routeRow}>
              <View
                style={[styles.routeDot, { backgroundColor: theme.success }]}
              />
              <Text style={styles.routeAddr} numberOfLines={1}>
                {order.service_address || '起点'}
              </Text>
            </View>
            <View style={styles.routeLineSmall} />
            <View style={styles.routeRow}>
              <View
                style={[styles.routeDot, { backgroundColor: theme.danger }]}
              />
              <Text style={styles.routeAddr} numberOfLines={1}>
                {order.dest_address || '终点'}
              </Text>
            </View>
          </View>

          {order.total_amount > 0 && (
            <View style={styles.rewardRow}>
              <Text style={styles.rewardLabel}>预计任务收入</Text>
              <Text style={styles.rewardVal}>
                ¥{(order.total_amount / 100).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.liabilityBox}>
          <Text style={styles.liabilityTitle}>📜 数字化执行责任声明</Text>
          <Text style={styles.liabilityText}>
            本单已根据《电子服务合同》确立执行责任。
            {`\n`}• 您已确认拥有该设备的合法操作授权
            {`\n`}• 您已确认具备有效期内的民航飞行执照
            {`\n`}• 执行关键节点将实时存证，作为履约依据
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>执行环节</Text>
            <Text style={styles.sectionHint}>
              {currentStepIndex + 1} / {EXEC_STEPS.length}
            </Text>
          </View>

          <View style={styles.stepsBox}>
            {EXEC_STEPS.map((step, index) => {
              const isDone = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isFuture = index > currentStepIndex;

              return (
                <View key={step.status} style={styles.stepItem}>
                  <View style={styles.stepLeft}>
                    <View
                      style={[
                        styles.stepIndicator,
                        isDone && styles.stepIndicatorDone,
                        isCurrent && styles.stepIndicatorCurrent,
                        isFuture && styles.stepIndicatorFuture,
                      ]}
                    >
                      {isDone ? (
                        <Text style={styles.stepDoneIcon}>✓</Text>
                      ) : (
                        <Text
                          style={[
                            styles.stepIconText,
                            isCurrent && { color: '#FFFFFF' },
                          ]}
                        >
                          {step.icon}
                        </Text>
                      )}
                    </View>
                    {index < EXEC_STEPS.length - 1 && (
                      <View
                        style={[styles.stepLine, isDone && styles.stepLineDone]}
                      />
                    )}
                  </View>
                  <View style={styles.stepRight}>
                    <Text
                      style={[
                        styles.stepLabel,
                        isCurrent && styles.stepLabelCurrent,
                        isFuture && styles.stepLabelFuture,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <View style={styles.currentStepContent}>
                        <Text style={styles.stepDescText}>{step.desc}</Text>
                        <View style={styles.stepActionArea}>
                          {nextAction && !isCompleted && !isDelivered && (
                            <TouchableOpacity
                              style={[
                                styles.stepBtn,
                                submitting && styles.btnDisabled,
                              ]}
                              onPress={handleNextStep}
                              disabled={submitting}
                            >
                              {submitting ? (
                                <ActivityIndicator
                                  color="#FFFFFF"
                                  size="small"
                                />
                              ) : (
                                <Text style={styles.stepBtnText}>
                                  {nextAction.label}
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {showSimulationCard && (
          <View style={styles.simCard}>
            <View style={styles.simHeader}>
              <View style={styles.simHeaderText}>
                <Text style={styles.simEyebrow}>测试态飞行模拟</Text>
                <Text style={styles.simTitle}>
                  用订单起终点生成一条真实感更强的飞行轨迹
                </Text>
                <Text style={styles.simDesc}>
                  会按当前订单的两个地理位置持续上报起飞、爬升、巡航、下降和着陆数据，并插入一两条示例告警，方便你直接联调飞行监控。
                </Text>
              </View>
              <View
                style={[
                  styles.simStatusPill,
                  simulationRunning && styles.simStatusPillActive,
                  simulation?.status === 'completed' &&
                    styles.simStatusPillDone,
                ]}
              >
                <Text
                  style={[
                    styles.simStatusText,
                    simulationRunning && styles.simStatusTextActive,
                    simulation?.status === 'completed' &&
                      styles.simStatusTextDone,
                  ]}
                >
                  {simulation?.phase_label ||
                    (canStartSimulation ? '待启动' : '推进到运输中后可用')}
                </Text>
              </View>
            </View>

            <View style={styles.simMetrics}>
              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricLabel}>规划距离</Text>
                <Text style={styles.simMetricValue}>
                  {formatSimulationDistance(
                    simulation?.route?.estimated_distance_m,
                  )}
                </Text>
              </View>
              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricLabel}>巡航高度</Text>
                <Text style={styles.simMetricValue}>
                  {simulation?.route?.cruise_altitude_m
                    ? `${simulation.route.cruise_altitude_m}m`
                    : '-'}
                </Text>
              </View>
              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricLabel}>预计时长</Text>
                <Text style={styles.simMetricValue}>
                  {formatSimulationDuration(
                    simulation?.route?.estimated_duration_seconds,
                  )}
                </Text>
              </View>
              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricLabel}>已上报点位</Text>
                <Text style={styles.simMetricValue}>
                  {simulation?.position_count ?? 0}
                </Text>
              </View>
            </View>

            {simulation?.latest_telemetry ? (
              <View style={styles.simTelemetryBox}>
                <Text style={styles.simTelemetryTitle}>最近一笔遥测</Text>
                <View style={styles.simTelemetryGrid}>
                  <Text style={styles.simTelemetryText}>
                    高度 {simulation.latest_telemetry.altitude}m
                  </Text>
                  <Text style={styles.simTelemetryText}>
                    速度{' '}
                    {formatTelemetrySpeed(simulation.latest_telemetry.speed)}
                  </Text>
                  <Text style={styles.simTelemetryText}>
                    电量 {simulation.latest_telemetry.battery_level}%
                  </Text>
                  <Text style={styles.simTelemetryText}>
                    信号 {simulation.latest_telemetry.signal_strength}%
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.simHint}>
                {canStartSimulation
                  ? '启动后会自动按航线持续上报位置和阶段数据。'
                  : '先把执行环节推进到“运输中”，再开启测试飞行。'}
              </Text>
            )}

            {simulation?.last_error ? (
              <Text style={styles.simErrorText}>
                上次模拟异常：{simulation.last_error}
              </Text>
            ) : null}

            <View style={styles.simActionRow}>
              <TouchableOpacity
                style={[
                  styles.simPrimaryBtn,
                  (!canStartSimulation ||
                    simulationRunning ||
                    simulationSubmitting) &&
                    styles.btnDisabled,
                ]}
                onPress={handleStartSimulation}
                disabled={
                  !canStartSimulation ||
                  simulationRunning ||
                  simulationSubmitting
                }
              >
                {simulationSubmitting && simulationRunning ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.simPrimaryBtnText}>
                    {simulation?.status === 'completed'
                      ? '重新模拟一遍'
                      : '开始测试飞行'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.simSecondaryBtn,
                  (!simulationRunning || simulationSubmitting) &&
                    styles.btnDisabled,
                ]}
                onPress={handleStopSimulation}
                disabled={!simulationRunning || simulationSubmitting}
              >
                <Text style={styles.simSecondaryBtnText}>停止模拟</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.simSecondaryBtn}
                onPress={() =>
                  navigation.navigate('FlightMonitoring', { orderId: order.id })
                }
              >
                <Text style={styles.simSecondaryBtnText}>查看飞行监控</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数字化辅助</Text>
          <View style={styles.linkGrid}>
            <TouchableOpacity
              style={styles.linkCard}
              onPress={() =>
                navigation.navigate('FlightMonitoring', { orderId: order.id })
              }
            >
              <Text style={styles.linkIcon}>📍</Text>
              <Text style={styles.linkCardTitle}>飞行监控</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkCard}
              onPress={() =>
                navigation.navigate('TrajectoryRecord', { orderId: order.id })
              }
            >
              <Text style={styles.linkIcon}>🧭</Text>
              <Text style={styles.linkCardTitle}>轨迹记录</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isDelivered && (
          <View style={styles.statusBanner}>
            <Text style={styles.bannerEmoji}>📦</Text>
            <Text style={styles.bannerTitle}>已送达，待签收</Text>
            <Text style={styles.bannerDesc}>
              客户签收后本任务将自动完结并进入结算。
            </Text>
          </View>
        )}

        {isCompleted && (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: theme.success + '15',
                borderColor: theme.success + '30',
              },
            ]}
          >
            <Text style={styles.bannerEmoji}>🎉</Text>
            <Text style={[styles.bannerTitle, { color: theme.success }]}>
              运输任务已圆满完成
            </Text>
            <Text style={[styles.bannerDesc, { color: theme.success }]}>
              感谢您的专业执行，报酬将按约结算。
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgSecondary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    backBtn: { width: 60 },
    backText: { fontSize: 16, color: theme.primaryText, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: { marginTop: 12, color: theme.textSub, fontSize: 14 },
    emptyText: { fontSize: 16, color: theme.textSub, marginBottom: 8 },
    emptySubText: { fontSize: 13, color: theme.textSub },
    content: { padding: 16, paddingBottom: 40 },

    focusCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 3,
    },
    focusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    focusNo: { fontSize: 11, color: theme.textHint, fontWeight: '700' },
    focusTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 16,
    },
    focusRoute: {
      marginBottom: 16,
      backgroundColor: theme.bgSecondary,
      padding: 12,
      borderRadius: 16,
    },
    routeRow: { flexDirection: 'row', alignItems: 'center' },
    routeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
    routeAddr: { flex: 1, fontSize: 13, color: theme.text, fontWeight: '600' },
    routeLineSmall: {
      width: 1,
      height: 10,
      backgroundColor: theme.divider,
      marginLeft: 2.5,
      marginVertical: 2,
    },
    rewardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    rewardLabel: { fontSize: 12, color: theme.textSub, fontWeight: '600' },
    rewardVal: { fontSize: 18, fontWeight: '900', color: theme.danger },

    liabilityBox: {
      marginHorizontal: 4,
      backgroundColor: theme.primaryBg,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
    },
    liabilityTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.primaryText,
      marginBottom: 8,
    },
    liabilityText: {
      fontSize: 12,
      color: theme.primaryText,
      lineHeight: 20,
      opacity: 0.8,
    },

    section: { marginBottom: 24 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
    sectionHint: { fontSize: 12, color: theme.textHint, fontWeight: '700' },

    simCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.divider,
      marginBottom: 24,
    },
    simHeader: {
      gap: 14,
    },
    simHeaderText: {
      gap: 6,
    },
    simEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.primary,
      letterSpacing: 0.4,
    },
    simTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
      lineHeight: 24,
    },
    simDesc: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.textSub,
    },
    simStatusPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.warning + '18',
      borderWidth: 1,
      borderColor: theme.warning + '28',
    },
    simStatusPillActive: {
      backgroundColor: theme.primaryBg,
      borderColor: theme.primaryBorder,
    },
    simStatusPillDone: {
      backgroundColor: theme.success + '16',
      borderColor: theme.success + '24',
    },
    simStatusText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.warning,
    },
    simStatusTextActive: {
      color: theme.primaryText,
    },
    simStatusTextDone: {
      color: theme.success,
    },
    simMetrics: {
      marginTop: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    simMetricItem: {
      minWidth: '47%',
      flexGrow: 1,
      backgroundColor: theme.bgSecondary,
      borderRadius: 16,
      padding: 14,
    },
    simMetricLabel: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '700',
      marginBottom: 6,
    },
    simMetricValue: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '800',
    },
    simTelemetryBox: {
      marginTop: 14,
      backgroundColor: theme.primaryBg,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.primaryBorder,
    },
    simTelemetryTitle: {
      fontSize: 12,
      color: theme.primaryText,
      fontWeight: '800',
      marginBottom: 8,
    },
    simTelemetryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    simTelemetryText: {
      fontSize: 12,
      color: theme.primaryText,
      lineHeight: 18,
    },
    simHint: {
      marginTop: 14,
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSub,
    },
    simErrorText: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 18,
      color: theme.danger,
    },
    simActionRow: {
      marginTop: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    simPrimaryBtn: {
      flexGrow: 1,
      minWidth: 140,
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 18,
      alignItems: 'center',
    },
    simPrimaryBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    simSecondaryBtn: {
      flexGrow: 1,
      minWidth: 120,
      backgroundColor: theme.bgSecondary,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.divider,
    },
    simSecondaryBtnText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },

    stepsBox: { paddingLeft: 10 },
    stepItem: { flexDirection: 'row', minHeight: 64 },
    stepLeft: { alignItems: 'center', width: 40 },
    stepIndicator: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bgSecondary,
      borderWidth: 2,
      borderColor: theme.divider,
      zIndex: 2,
    },
    stepIndicatorDone: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    stepIndicatorCurrent: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    stepIndicatorFuture: {
      backgroundColor: theme.card,
      borderColor: theme.divider,
    },
    stepDoneIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    stepIconText: { fontSize: 16 },
    stepLine: {
      width: 2,
      flex: 1,
      backgroundColor: theme.divider,
      marginVertical: -2,
      zIndex: 1,
    },
    stepLineDone: { backgroundColor: theme.success },
    stepRight: { flex: 1, paddingLeft: 16, paddingBottom: 24 },
    stepLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSub,
      marginTop: 6,
    },
    stepLabelCurrent: { color: theme.text, fontWeight: '800', fontSize: 16 },
    stepLabelFuture: { color: theme.textHint, fontWeight: '500' },
    currentStepContent: { marginTop: 10 },
    stepDescText: { fontSize: 13, color: theme.textSub, lineHeight: 18 },
    stepActionArea: { marginTop: 16 },
    stepBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 14,
      alignItems: 'center',
      shadowColor: theme.primary,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 4,
    },
    stepBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    btnDisabled: { opacity: 0.6 },

    linkGrid: { flexDirection: 'row', gap: 12 },
    linkCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.divider,
    },
    linkIcon: { fontSize: 24, marginBottom: 8 },
    linkCardTitle: { fontSize: 13, fontWeight: '700', color: theme.text },

    statusBanner: {
      backgroundColor: theme.warning + '10',
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.warning + '25',
      marginTop: 10,
    },
    bannerEmoji: { fontSize: 32, marginBottom: 12 },
    bannerTitle: { fontSize: 18, fontWeight: '800', color: theme.warning },
    bannerDesc: {
      fontSize: 13,
      color: theme.textSub,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
  });
