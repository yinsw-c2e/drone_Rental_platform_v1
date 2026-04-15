import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {dispatchV2Service} from '../../services/dispatchV2';
import {RootState} from '../../store/store';
import {V2DispatchTaskDetail, V2DispatchTaskSummary} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type ActionButton = {
  label: string;
  tone: 'primary' | 'danger' | 'ghost';
  onPress: () => void;
};

const formatMoney = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;

const MONITORABLE_ORDER_STATUSES = [
  'assigned',
  'confirmed',
  'airspace_applying',
  'airspace_approved',
  'loading',
  'in_transit',
  'delivered',
  'completed',
];

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

const getPartyName = (task?: V2DispatchTaskSummary['provider'] | V2DispatchTaskSummary['target_pilot'], fallback = '-') => {
  if (!task) {
    return fallback;
  }
  if (task.nickname) {
    return task.nickname;
  }
  if (task.user_id) {
    return `${fallback} #${task.user_id}`;
  }
  return fallback;
};

const getOrderSourceLabel = (orderSource?: string) => {
  if (orderSource === 'supply_direct') {
    return '快速下单';
  }
  if (orderSource === 'demand_market') {
    return '任务转单';
  }
  return '订单';
};

function DetailRow({label, value}: {label: string; value?: string}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '-'}</Text>
    </View>
  );
}

export default function DispatchTaskDetailScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const currentUserId = Number(useSelector((state: RootState) => state.auth.user?.id) || 0);
  const dispatchId = Number(route?.params?.id || route?.params?.dispatchId || 0);
  const [detail, setDetail] = useState<V2DispatchTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectSheet, setShowRejectSheet] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    if (!dispatchId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await dispatchV2Service.get(dispatchId);
      setDetail(res.data || null);
    } catch (error) {
      console.error('获取正式派单详情失败:', error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [dispatchId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const task = detail?.dispatch_task;
  const order = detail?.order || task?.order;
  const isOwner = currentUserId > 0 && currentUserId === Number(task?.provider?.user_id || 0);
  const isPilot = currentUserId > 0 && currentUserId === Number(task?.target_pilot?.user_id || 0);
  const canRespond = String(task?.status || '').toLowerCase() === 'pending_response' && isPilot;
  const canReassign = Boolean(
    isOwner &&
      task?.id &&
      order?.id &&
      ['pending_response', 'accepted', 'rejected', 'expired', 'exception'].includes(String(task?.status || '').toLowerCase()) &&
      ['assigned', 'pending_dispatch'].includes(String(order?.status || '').toLowerCase()),
  );
  const canOpenFlightMonitor = Boolean(order?.id && MONITORABLE_ORDER_STATUSES.includes(String(order?.status || '').toLowerCase()));

  const actionButtons = useMemo<ActionButton[]>(() => {
    if (!task || !order || actionLoading) {
      return [];
    }

    const actions: ActionButton[] = [
      {
        label: '查看关联订单',
        tone: 'ghost',
        onPress: () => navigation.navigate('OrderDetail', {id: order.id, orderId: order.id}),
      },
    ];

    if (canOpenFlightMonitor) {
      actions.unshift({
        label: '飞行监控',
        tone: 'ghost',
        onPress: () =>
          navigation.navigate('FlightMonitoring', {
            orderId: order.id,
            dispatchId: task.id,
          }),
      });
    }

    if (canReassign) {
      actions.unshift({
        label: '手动重派',
        tone: 'primary',
        onPress: () =>
          navigation.navigate('CreateDispatchTask', {
            orderId: order.id,
            dispatchId: task.id,
            id: order.id,
          }),
      });
    }

    if (canRespond) {
      actions.unshift(
        {
          label: '拒绝派单',
          tone: 'danger',
          onPress: () => {
            setRejectReason('');
            setShowRejectSheet(true);
          },
        },
        {
          label: '接受派单',
          tone: 'primary',
          onPress: () => {
            Alert.alert('接受正式派单', '确认接受这条正式派单吗？接受后订单会进入已分配状态。', [
              {text: '取消', style: 'cancel'},
              {
                text: '确认接受',
                onPress: async () => {
                  setActionLoading(true);
                  try {
                    await dispatchV2Service.accept(task.id);
                    await loadData();
                    Alert.alert('已接受', '正式派单已接受，你现在可以继续进入订单详情或飞行监控。');
                  } catch (error: any) {
                    Alert.alert('操作失败', error?.message || '请稍后重试');
                  } finally {
                    setActionLoading(false);
                  }
                },
              },
            ]);
          },
        },
      );
    }

    return actions;
  }, [actionLoading, canOpenFlightMonitor, canReassign, canRespond, loadData, navigation, order, task]);

  const handleReject = async () => {
    if (!task?.id) {
      return;
    }
    setActionLoading(true);
    try {
      await dispatchV2Service.reject(task.id, rejectReason.trim() || undefined);
      setShowRejectSheet(false);
      setRejectReason('');
      Alert.alert('已拒绝', '这条正式派单已回退。系统若找到下一位可用飞手，会自动生成新的正式派单。', [
        {
          text: '返回待办',
          onPress: () => navigation.navigate('PilotTaskList', {entry: 'assigned', refreshedAt: Date.now()}),
        },
        {
          text: '查看订单',
          onPress: () => order?.id && navigation.navigate('OrderDetail', {id: order.id, orderId: order.id}),
        },
      ]);
    } catch (error: any) {
      Alert.alert('操作失败', error?.message || '请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail?.dispatch_task) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>正式派单不存在或当前账号没有查看权限。</Text>
        </View>
      </SafeAreaView>
    );
  }

  const taskData = detail.dispatch_task;
  const orderData = detail.order || taskData.order;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTags}>
              <SourceTag source="dispatch_task" />
              <StatusBadge label="" meta={getObjectStatusMeta('dispatch_task', taskData.status)} />
            </View>
            <Text style={styles.heroCode}>{taskData.dispatch_no}</Text>
          </View>
          <Text style={styles.heroTitle}>{orderData?.title || '正式派单详情'}</Text>
          <Text style={styles.heroDesc}>
            正式派单只表达执行指令：派给谁、为何派、是否已响应，以及如果飞手拒绝后系统是否已开始自动重派。
          </Text>
        </View>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>派单摘要</Text>
          <DetailRow label="派单状态" value={getObjectStatusMeta('dispatch_task', taskData.status).label} />
          <DetailRow label="派单来源" value={taskData.dispatch_source || '-'} />
          <DetailRow label="目标飞手" value={getPartyName(taskData.target_pilot, '飞手')} />
          <DetailRow label="机主" value={getPartyName(taskData.provider, '机主')} />
          <DetailRow label="重派次数" value={String(taskData.retry_count || 0)} />
          <DetailRow label="发出时间" value={formatDateTime(taskData.sent_at)} />
          <DetailRow label="响应时间" value={formatDateTime(taskData.responded_at)} />
          {taskData.reason ? <DetailRow label="派单说明" value={taskData.reason} /> : null}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>订单上下文</Text>
          <DetailRow label="订单号" value={orderData?.order_no} />
          <DetailRow label="订单来源" value={getOrderSourceLabel(orderData?.order_source)} />
          <DetailRow label="订单状态" value={getObjectStatusMeta('order', orderData?.status).label} />
          <DetailRow label="执行模式" value={orderData?.execution_mode || '-'} />
          <DetailRow label="起始地址" value={orderData?.service_address || '-'} />
          <DetailRow label="目的地址" value={orderData?.dest_address || '-'} />
          <DetailRow label="订单金额" value={formatMoney(orderData?.total_amount)} />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>派单日志</Text>
          {detail.logs && detail.logs.length > 0 ? (
            detail.logs.map((log, index) => {
              const isLast = index === detail.logs.length - 1;
              return (
                <View key={`${log.id}-${index}`} style={styles.timelineItem}>
                  <View style={styles.timelineAxis}>
                    <View style={styles.timelineDot} />
                    {!isLast ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{log.note || log.action_type}</Text>
                    <Text style={styles.timelineMeta}>
                      {formatDateTime(log.created_at)}
                      {log.operator_nickname ? ` · ${log.operator_nickname}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyLogs}>当前还没有派单日志。</Text>
          )}
        </ObjectCard>
      </ScrollView>

      {actionButtons.length > 0 ? (
        <View style={styles.actionBar}>
          {actionLoading ? <ActivityIndicator color={theme.primary} style={styles.actionSpinner} /> : null}
          {actionButtons.map(button => (
            <TouchableOpacity
              key={button.label}
              style={[
                styles.actionButton,
                button.tone === 'primary' && styles.actionButtonPrimary,
                button.tone === 'danger' && styles.actionButtonDanger,
                button.tone === 'ghost' && styles.actionButtonGhost,
              ]}
              disabled={actionLoading}
              onPress={button.onPress}>
              <Text
                style={[
                  styles.actionButtonText,
                  button.tone === 'primary' && styles.actionButtonTextPrimary,
                  button.tone === 'danger' && styles.actionButtonTextDanger,
                  button.tone === 'ghost' && styles.actionButtonTextGhost,
                ]}>
                {button.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {showRejectSheet ? (
        <View style={styles.rejectSheet}>
          <Text style={styles.rejectTitle}>拒绝正式派单</Text>
          <TextInput
            style={styles.rejectInput}
            placeholder="选填：补充拒绝原因，方便机主判断是否需要重派或调整执行来源"
            multiline
            value={rejectReason}
            onChangeText={setRejectReason}
          />
          <View style={styles.rejectActions}>
            <TouchableOpacity style={styles.sheetGhostBtn} onPress={() => setShowRejectSheet(false)}>
              <Text style={styles.sheetGhostText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetDangerBtn} onPress={handleReject}>
              <Text style={styles.sheetDangerText}>确认拒绝</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.textSub,
    textAlign: 'center',
  },
  content: {
    padding: 14,
    paddingBottom: 132,
  },
  hero: {
    backgroundColor: theme.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTags: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCode: {
    fontSize: 12,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 24,
    lineHeight: 30,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  sectionCard: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  rowLabel: {
    width: 88,
    fontSize: 13,
    color: theme.textSub,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 20,
    color: theme.text,
    fontWeight: '600',
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timelineAxis: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.divider,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 16,
  },
  timelineTitle: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
  },
  timelineMeta: {
    marginTop: 4,
    fontSize: 12,
    color: theme.textSub,
  },
  emptyLogs: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionSpinner: {
    width: '100%',
  },
  actionButton: {
    flexGrow: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  actionButtonPrimary: {
    backgroundColor: theme.primary,
  },
  actionButtonDanger: {
    backgroundColor: theme.danger + '22',
    borderWidth: 1,
    borderColor: theme.danger + '44',
  },
  actionButtonGhost: {
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonTextPrimary: {
    color: theme.btnPrimaryText,
  },
  actionButtonTextDanger: {
    color: theme.danger,
  },
  actionButtonTextGhost: {
    color: theme.textSub,
  },
  rejectSheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 92,
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  rejectTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
  },
  rejectInput: {
    marginTop: 12,
    minHeight: 100,
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 14,
    color: theme.text,
  },
  rejectActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sheetGhostBtn: {
    borderRadius: 999,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  sheetGhostText: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
  },
  sheetDangerBtn: {
    borderRadius: 999,
    backgroundColor: theme.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sheetDangerText: {
    fontSize: 13,
    color: theme.btnPrimaryText,
    fontWeight: '700',
  },
});
