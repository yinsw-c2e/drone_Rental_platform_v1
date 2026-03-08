import React, {useState, useCallback} from 'react';
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
import {useFocusEffect} from '@react-navigation/native';
import {getOrderByTaskId, updateExecutionStatus} from '../../services/dispatch';

// 执行状态定义
const EXEC_STEPS = [
  {status: 'confirmed',         label: '已确认接单',    desc: '接单成功，等待出发',                  icon: '✅'},
  {status: 'airspace_applying', label: '申请空域中',    desc: '正在申请飞行空域许可',                icon: '📋'},
  {status: 'airspace_approved', label: '空域已批准',    desc: '空域许可已获批，准备装货',            icon: '✈️'},
  {status: 'loading',           label: '装货中',        desc: '飞手到达装货点，确认装货',            icon: '📦'},
  {status: 'in_transit',        label: '运输中',        desc: '货物已装载，无人机起飞',              icon: '🚁'},
  {status: 'delivered',         label: '已送达',        desc: '到达卸货点，完成卸货',                icon: '🏁'},
  {status: 'completed',         label: '已完成',        desc: '收货人签收，任务完成',                icon: '🎉'},
];

// 根据当前状态获取下一步操作
const NEXT_ACTION: Record<string, {label: string; nextStatus: string; confirmMsg: string}> = {
  confirmed:         {label: '申请空域', nextStatus: 'airspace_applying', confirmMsg: '确认申请空域许可？'},
  airspace_applying: {label: '空域已批准', nextStatus: 'airspace_approved', confirmMsg: '确认空域许可已获批？'},
  airspace_approved: {label: '确认装货', nextStatus: 'loading', confirmMsg: '已到达装货点，确认开始装货？'},
  loading:           {label: '开始运输', nextStatus: 'in_transit', confirmMsg: '货物已装载完毕，确认起飞运输？'},
  in_transit:        {label: '确认送达', nextStatus: 'delivered', confirmMsg: '已到达卸货点，确认卸货完成？'},
  delivered:         {label: '完成任务', nextStatus: 'completed', confirmMsg: '收货人已签收，确认任务完成？'},
};

export default function PilotOrderExecutionScreen({route, navigation}: any) {
  const {taskId} = route.params || {};
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const data = await getOrderByTaskId(taskId);
      setOrder(data);
    } catch (e: any) {
      Alert.alert('错误', e.message || '获取订单失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  const handleNextStep = () => {
    if (!order) return;
    const action = NEXT_ACTION[order.status];
    if (!action) return;

    Alert.alert(action.label, action.confirmMsg, [
      {text: '取消', style: 'cancel'},
      {
        text: '确认',
        onPress: async () => {
          setSubmitting(true);
          try {
            await updateExecutionStatus(order.id, action.nextStatus);
            await loadOrder();
            if (action.nextStatus === 'completed') {
              Alert.alert('任务完成', '恭喜！运输任务已成功完成', [
                {text: '确定', onPress: () => navigation.goBack()},
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
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>加载订单信息...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>暂无执行订单</Text>
          <Text style={styles.emptySubText}>接受任务后将在此查看执行流程</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const currentStep = EXEC_STEPS[currentStepIndex];
  const nextAction = NEXT_ACTION[order.status];
  const isCompleted = order.status === 'completed';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 订单头部信息 */}
        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderNo}>{order.order_no || '-'}</Text>
            <View style={[styles.statusBadge, {backgroundColor: isCompleted ? '#52c41a20' : '#1890ff20'}]}>
              <Text style={[styles.statusText, {color: isCompleted ? '#52c41a' : '#1890ff'}]}>
                {currentStep?.label || order.status}
              </Text>
            </View>
          </View>
          <Text style={styles.orderTitle} numberOfLines={2}>{order.title}</Text>
          <View style={styles.routeInfo}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, {backgroundColor: '#52c41a'}]} />
              <Text style={styles.routeAddr} numberOfLines={1}>{order.service_address || '取货点'}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, {backgroundColor: '#f5222d'}]} />
              <Text style={styles.routeAddr} numberOfLines={1}>{order.dest_address || '卸货点'}</Text>
            </View>
          </View>
          {order.total_amount > 0 && (
            <Text style={styles.rewardText}>预估报酬：¥{(order.total_amount / 100).toFixed(0)}</Text>
          )}
        </View>

        {/* 执行步骤进度 */}
        <View style={styles.stepsCard}>
          <Text style={styles.sectionTitle}>执行进度</Text>
          {EXEC_STEPS.map((step, index) => {
            const isDone = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isFuture = index > currentStepIndex;
            return (
              <View key={step.status} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={[
                    styles.stepCircle,
                    isDone && styles.stepCircleDone,
                    isCurrent && styles.stepCircleCurrent,
                    isFuture && styles.stepCircleFuture,
                  ]}>
                    <Text style={[styles.stepIcon, isFuture && {opacity: 0.3}]}>
                      {isDone ? '✓' : step.icon}
                    </Text>
                  </View>
                  {index < EXEC_STEPS.length - 1 && (
                    <View style={[styles.stepConnector, isDone && styles.stepConnectorDone]} />
                  )}
                </View>
                <View style={styles.stepRight}>
                  <Text style={[
                    styles.stepLabel,
                    isDone && styles.stepLabelDone,
                    isCurrent && styles.stepLabelCurrent,
                    isFuture && styles.stepLabelFuture,
                  ]}>
                    {step.label}
                  </Text>
                  {isCurrent && (
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* 飞行入口 */}
        <View style={styles.stepsCard}>
          <Text style={styles.sectionTitle}>飞行数据</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('FlightMonitoring', {orderId: order.id})}>
            <Text style={styles.linkText}>飞行监控</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkRow, {borderBottomWidth: 0}]}
            onPress={() => navigation.navigate('TrajectoryRecord', {orderId: order.id})}>
            <Text style={styles.linkText}>轨迹记录</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 操作按钮 */}
        {!isCompleted && nextAction && (
          <TouchableOpacity
            style={[styles.actionBtn, submitting && styles.actionBtnDisabled]}
            onPress={handleNextStep}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.actionBtnText}>{nextAction.label}</Text>
                <Text style={styles.actionBtnSub}>点击进入下一步</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>🎉 任务已完成！</Text>
            <Text style={styles.completedSub}>结算将在24小时内到账</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24},
  loadingText: {marginTop: 12, color: '#666', fontSize: 14},
  emptyText: {fontSize: 16, color: '#666', marginBottom: 8},
  emptySubText: {fontSize: 13, color: '#999'},
  content: {padding: 16, paddingBottom: 32},

  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  orderHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  orderNo: {fontSize: 12, color: '#999'},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  statusText: {fontSize: 12, fontWeight: '600'},
  orderTitle: {fontSize: 14, color: '#333', fontWeight: '600', marginBottom: 12},
  routeInfo: {marginBottom: 10},
  routeRow: {flexDirection: 'row', alignItems: 'center', marginVertical: 3},
  dot: {width: 8, height: 8, borderRadius: 4, marginRight: 8},
  routeAddr: {flex: 1, fontSize: 13, color: '#555'},
  routeLine: {width: 1, height: 12, backgroundColor: '#ddd', marginLeft: 3, marginVertical: 1},
  rewardText: {fontSize: 16, color: '#f5222d', fontWeight: 'bold', marginTop: 8},

  stepsCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 16, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  sectionTitle: {fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 16},
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkText: {fontSize: 14, color: '#333'},
  linkArrow: {fontSize: 18, color: '#1890ff'},
  stepRow: {flexDirection: 'row', marginBottom: 0},
  stepLeft: {alignItems: 'center', width: 36},
  stepCircle: {
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  stepCircleDone: {backgroundColor: '#52c41a'},
  stepCircleCurrent: {backgroundColor: '#1890ff'},
  stepCircleFuture: {backgroundColor: '#f0f0f0'},
  stepIcon: {fontSize: 14},
  stepConnector: {width: 2, height: 24, backgroundColor: '#e8e8e8', marginVertical: 2},
  stepConnectorDone: {backgroundColor: '#52c41a'},
  stepRight: {flex: 1, paddingLeft: 12, paddingTop: 6, paddingBottom: 20},
  stepLabel: {fontSize: 14, color: '#999'},
  stepLabelDone: {color: '#52c41a', fontWeight: '500'},
  stepLabelCurrent: {color: '#1890ff', fontWeight: '700', fontSize: 15},
  stepLabelFuture: {color: '#bbb'},
  stepDesc: {fontSize: 12, color: '#666', marginTop: 3},

  actionBtn: {
    backgroundColor: '#1890ff', borderRadius: 12, padding: 18,
    alignItems: 'center', marginBottom: 12,
  },
  actionBtnDisabled: {backgroundColor: '#aaa'},
  actionBtnText: {fontSize: 18, color: '#fff', fontWeight: '700'},
  actionBtnSub: {fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4},

  completedBanner: {
    backgroundColor: '#f6ffed', borderRadius: 12, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#b7eb8f',
  },
  completedText: {fontSize: 20, fontWeight: '700', color: '#52c41a'},
  completedSub: {fontSize: 13, color: '#73d13d', marginTop: 6},
});
