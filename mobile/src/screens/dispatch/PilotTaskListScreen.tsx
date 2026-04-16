import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import EmptyState from '../../components/business/EmptyState';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {dispatchV2Service} from '../../services/dispatchV2';
import {pilotV2Service} from '../../services/pilotV2';
import {V2DispatchTaskSummary} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const formatMoney = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;

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

const getPilotEntryMeta = (entryMode: string) => {
  if (entryMode === 'assigned') {
    return {
      title: '待响应正式派单',
      hint: '这里只显示已经派到你名下、等待你确认的正式派单。',
      empty: '当前没有待响应的正式派单',
    };
  }
  return {
    title: '我的正式派单',
    hint: '这里只展示正式派单，不再混公开需求、候选报名和旧任务池。',
    empty: '当前没有分配给你的正式派单',
  };
};

export default function PilotTaskListScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [tasks, setTasks] = useState<V2DispatchTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<V2DispatchTaskSummary | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pilotProfile, setPilotProfile] = useState<any>(null);
  const entryMode = String(route?.params?.entry || 'all');
  const entryMeta = useMemo(() => getPilotEntryMeta(entryMode), [entryMode]);
  const eligibility = pilotProfile?.eligibility;
  const candidateReady = eligibility?.can_apply_candidate && !eligibility?.can_accept_dispatch;

  const loadData = useCallback(async () => {
    try {
      const status = entryMode === 'assigned' ? 'pending_response' : (entryMode === 'accepted' ? 'accepted' : undefined);
      const [dispatchRes, profileRes] = await Promise.all([
        dispatchV2Service.list({role: 'pilot', status, page: 1, page_size: 100}),
        pilotV2Service.getProfile().catch(() => null),
      ]);
      setTasks(dispatchRes.data?.items || []);
      setPilotProfile(profileRes?.data || null);
    } catch (error) {
      console.error('获取飞手正式派单失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entryMode]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const visibleTasks = useMemo(() => {
    if (entryMode === 'assigned') {
      return tasks.filter(item => String(item.status || '').toLowerCase() === 'pending_response');
    }
    if (entryMode === 'accepted') {
      return tasks.filter(item => {
        const s = String(item.status || '').toLowerCase();
        const os = String(item.order?.status || '').toLowerCase();
        return s === 'accepted' && os !== 'completed' && os !== 'cancelled';
      });
    }
    return tasks;
  }, [entryMode, tasks]);

  const handleAccept = (task: V2DispatchTaskSummary) => {
    Alert.alert('确认接单', '接受正式派单即表示你已阅读设备操作责任说明，并承诺按平台流程安全执行。确认继续吗？', [
      {text: '取消', style: 'cancel'},
      {
                text: '确认接单',
                onPress: async () => {
                  try {
                    await dispatchV2Service.accept(task.id);
                    await loadData();
                    Alert.alert('接单成功', '正式派单已接受，你现在可以直接进入执行工作台，继续推进本次任务。', [
                      {
                        text: '进入执行',
                        onPress: () => navigation.navigate('PilotOrderExecution', {taskId: task.id}),
                      },
                      {
                        text: '查看详情',
                        onPress: () => navigation.navigate('DispatchTaskDetail', {id: task.id}),
              },
              {
                text: '查看订单',
                onPress: () => navigation.navigate('OrderDetail', {id: task.order?.id, orderId: task.order?.id}),
              },
              {text: '稍后', onPress: () => loadData()},
            ]);
          } catch (error: any) {
            Alert.alert('操作失败', error?.response?.data?.message || '请稍后重试');
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    if (!selectedTask) {
      return;
    }
    try {
      await dispatchV2Service.reject(selectedTask.id, rejectReason.trim() || undefined);
      Alert.alert('已拒绝', '这条正式派单已回退，系统可能会自动重派。');
      setSelectedTask(null);
      setRejectReason('');
      loadData();
    } catch (error: any) {
      Alert.alert('操作失败', error?.response?.data?.message || '请稍后重试');
    }
  };

  const renderItem = ({item}: {item: V2DispatchTaskSummary}) => {
    const canRespond = String(item.status || '').toLowerCase() === 'pending_response';
    const isAccepted = String(item.status || '').toLowerCase() === 'accepted';
    const os = String(item.order?.status || '').toLowerCase();
    const isExecuting = isAccepted && !['completed', 'cancelled'].includes(os);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.taskCard, {backgroundColor: theme.card, borderColor: theme.cardBorder}, canRespond && styles.cardHighlight]}
        onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>

        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <StatusBadge label="" meta={getObjectStatusMeta('dispatch_task', item.status)} />
            <Text style={styles.dispatchNo}>{item.dispatch_no}</Text>
          </View>
          <Text style={styles.timeText}>{formatDateTime(item.sent_at)} 发出</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.order?.title || '正式派单任务'}</Text>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, {backgroundColor: theme.success}]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.order?.service_address || '起点'}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, {backgroundColor: theme.danger}]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.order?.dest_address || '终点'}</Text>
          </View>
        </View>

        <View style={styles.cardMetaGrid}>
          <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>安排方式</Text>
            <Text style={styles.metaValue}>{item.dispatch_source || '系统'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>预估报酬</Text>
            <Text style={[styles.metaValue, {color: theme.danger}]}>{formatMoney(item.order?.total_amount)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>重派次数</Text>
            <Text style={styles.metaValue}>{item.retry_count || 0}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>机主：{item.provider?.nickname || '机主'}</Text>
          </View>
          <View style={styles.actionButtons}>
            {canRespond ? (
              <>
                <TouchableOpacity
                  style={styles.inlineRejectBtn}
                  onPress={() => {
                    setSelectedTask(item);
                    setRejectReason('');
                  }}>
                  <Text style={styles.inlineRejectText}>拒绝</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineAcceptBtn} onPress={() => handleAccept(item)}>
                  <Text style={styles.inlineAcceptText}>确认接单</Text>
                </TouchableOpacity>
              </>
            ) : isExecuting ? (
              <TouchableOpacity style={styles.inlineExecuteBtn} onPress={() => navigation.navigate('PilotOrderExecution', {taskId: item.id})}>
                <Text style={styles.inlineExecuteText}>进入执行工作台</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.inlineGhostBtn} onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>
                <Text style={styles.inlineGhostBtnText}>详情</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{entryMeta.title}</Text>
        <Text style={styles.bannerHint}>{entryMeta.hint}</Text>
      </View>

      {eligibility ? (
        <View style={styles.eligibilitySection}>
          <View style={styles.eligibilityHeader}>
            <Text style={styles.eligibilityTitle}>{eligibility.label || '准入状态'}</Text>
            <StatusBadge
              label={candidateReady ? '限报需求' : eligibility?.can_accept_dispatch ? '准入已开' : '待补资料'}
              tone={candidateReady ? 'orange' : eligibility?.can_accept_dispatch ? 'green' : 'gray'}
            />
          </View>
          <Text style={styles.eligibilityDesc}>
            {eligibility.recommended_next_step || '完善飞手认证资料以获得完整接单能力。'}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={visibleTasks}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} colors={[theme.refreshColor]} />}
        contentContainerStyle={styles.content}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.warning} />
          ) : (
            <View style={styles.emptyCard}>
              <EmptyState
                icon="🧭"
                title={entryMeta.empty}
                description="正式派单会在这里统一收口。若您还未完成资质认证，请先参与「报名需求」累积履约记录。"
                actionText="查看可报名需求"
                onAction={() => navigation.navigate('DemandList', {mode: 'pilot'})}
              />
            </View>
          )
        }
      />

      {selectedTask ? (
        <View style={styles.rejectSheet}>
          <Text style={styles.rejectTitle}>拒绝正式派单</Text>
          <TextInput
            style={styles.rejectInput}
            placeholder="选填：说明拒绝原因，便于机主判断是否需要重派"
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
          />
          <View style={styles.rejectActions}>
            <TouchableOpacity style={styles.sheetGhostBtn} onPress={() => setSelectedTask(null)}>
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
  banner: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  bannerTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  bannerHint: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  eligibilitySection: {
    backgroundColor: theme.card,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  eligibilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eligibilityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
  },
  eligibilityDesc: {
    fontSize: 12,
    color: theme.textSub,
    lineHeight: 18,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  taskCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHighlight: {
    borderColor: theme.warning,
    backgroundColor: theme.warning + '05',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dispatchNo: {
    fontSize: 11,
    color: theme.textHint,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 11,
    color: theme.textHint,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  routeContainer: {
    marginBottom: 20,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeText: {
    fontSize: 14,
    color: theme.textSub,
    fontWeight: '600',
    flex: 1,
  },
  routeLine: {
    width: 1,
    height: 14,
    backgroundColor: theme.divider,
    marginLeft: 3.5,
    marginVertical: 2,
  },
  cardMetaGrid: {
    flexDirection: 'row',
    backgroundColor: theme.bgSecondary,
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 18,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    color: theme.textHint,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    paddingTop: 16,
  },
  providerInfo: {
    flex: 1,
    marginRight: 12,
  },
  providerName: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineRejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.danger + '10',
  },
  inlineRejectText: {
    fontSize: 13,
    color: theme.danger,
    fontWeight: '700',
  },
  inlineAcceptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.warning,
  },
  inlineAcceptText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  inlineExecuteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.primary,
  },
  inlineExecuteText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  inlineGhostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  inlineGhostBtnText: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
  },
  loading: {
    paddingVertical: 48,
  },
  emptyCard: {
    marginTop: 40,
  },
  rejectSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    borderRadius: 24,
    backgroundColor: theme.card,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  rejectTitle: {
    fontSize: 18,
    color: theme.text,
    fontWeight: '800',
  },
  rejectInput: {
    marginTop: 16,
    minHeight: 100,
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    textAlignVertical: 'top',
  },
  rejectActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  sheetGhostBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
  },
  sheetGhostText: {
    fontSize: 14,
    color: theme.textSub,
    fontWeight: '700',
  },
  sheetDangerBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.danger,
  },
  sheetDangerText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
