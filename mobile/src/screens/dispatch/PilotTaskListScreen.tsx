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
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
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
                    Alert.alert('接单成功', '正式派单已接受，你可以继续查看派单详情或进入订单详情。', [
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

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{entryMeta.title}</Text>
        <Text style={styles.bannerHint}>{entryMeta.hint}</Text>
      </View>

      {eligibility ? (
        <ObjectCard style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>{eligibility.label || '飞手准入状态'}</Text>
            <StatusBadge
              label={candidateReady ? '先报名候选需求' : eligibility?.can_accept_dispatch ? '正式派单已开放' : '待补资料'}
              tone={candidateReady ? 'orange' : eligibility?.can_accept_dispatch ? 'green' : 'gray'}
            />
          </View>
          <Text style={styles.noticeDesc}>
            {eligibility.recommended_next_step || '系统会根据认证进度逐步开放候选需求、正式派单和执行能力。'}
          </Text>
          {candidateReady ? (
            <View style={styles.noticeActionRow}>
              <TouchableOpacity style={styles.noticeGhostBtn} onPress={() => navigation.navigate('DemandList')}>
                <Text style={styles.noticeGhostBtnText}>查看可报名任务</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.noticeGhostBtn} onPress={() => navigation.navigate('PilotRegister')}>
                <Text style={styles.noticeGhostBtnText}>继续补资料</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ObjectCard>
      ) : null}

      <FlatList
        data={visibleTasks}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} colors={[theme.refreshColor]} />}
        contentContainerStyle={styles.content}
        renderItem={({item}) => {
          const canRespond = String(item.status || '').toLowerCase() === 'pending_response';
          const isAccepted = String(item.status || '').toLowerCase() === 'accepted';
          return (
            <ObjectCard style={[styles.card, canRespond && styles.cardHighlight]} onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <SourceTag source="dispatch_task" />
                  <StatusBadge label="" meta={getObjectStatusMeta('dispatch_task', item.status)} />
                </View>
                <Text style={styles.code}>{item.dispatch_no}</Text>
              </View>

              <Text style={styles.title}>{item.order?.title || '正式派单任务'}</Text>
              <Text style={styles.route} numberOfLines={2}>
                {item.order?.service_address || '未设置起点'}
                {item.order?.dest_address ? ` -> ${item.order.dest_address}` : ''}
              </Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>机主：{item.provider?.nickname || `机主 #${item.provider?.user_id || '-'}`}</Text>
                <Text style={styles.metaText}>派单来源：{item.dispatch_source || '-'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>订单状态：{getObjectStatusMeta('order', item.order?.status).label}</Text>
                <Text style={styles.metaText}>发出时间：{formatDateTime(item.sent_at)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>重派次数：{item.retry_count || 0}</Text>
                <Text style={styles.metaText}>订单金额：{formatMoney(item.order?.total_amount)}</Text>
              </View>

              {canRespond ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => {
                      setSelectedTask(item);
                      setRejectReason('');
                    }}>
                    <Text style={styles.rejectBtnText}>拒绝</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                    <Text style={styles.acceptBtnText}>接受派单</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {isAccepted ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.executeBtn} onPress={() => navigation.navigate('PilotOrderExecution', {taskId: item.id})}>
                    <Text style={styles.executeBtnText}>进入执行</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ObjectCard>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.warning} />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="🧭"
                title={entryMeta.empty}
                description="正式派单会在这里统一收口。若您还未完成资质认证，请先至「可报名任务」参与低风险候选需求。"
                actionText="查看可报名任务"
                onAction={() => navigation.navigate('DemandList')}
              />
            </ObjectCard>
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
    backgroundColor: theme.bg,
  },
  banner: {
    backgroundColor: theme.warning,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  bannerTitle: {
    fontSize: 24,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  bannerHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)',
  },
  noticeCard: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    gap: 10,
  },
  noticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  noticeDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  noticeActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  noticeGhostBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeGhostBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primaryText,
  },
  content: {
    padding: 14,
    paddingBottom: 140,
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    marginBottom: 12,
  },
  cardHighlight: {
    borderWidth: 1,
    borderColor: theme.warning,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  code: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  title: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 24,
    color: theme.text,
    fontWeight: '700',
  },
  route: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  rejectBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.danger + '44',
    backgroundColor: theme.danger + '22',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  rejectBtnText: {
    fontSize: 12,
    color: theme.danger,
    fontWeight: '700',
  },
  acceptBtn: {
    borderRadius: 999,
    backgroundColor: theme.warning,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  acceptBtnText: {
    fontSize: 12,
    color: theme.btnPrimaryText,
    fontWeight: '700',
  },
  executeBtn: {
    borderRadius: 999,
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  executeBtnText: {
    fontSize: 12,
    color: theme.btnPrimaryText,
    fontWeight: '700',
  },
  rejectSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    borderRadius: 20,
    backgroundColor: theme.card,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.warning + '44',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    elevation: 4,
  },
  rejectTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
  },
  rejectInput: {
    marginTop: 12,
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.warning + '44',
    backgroundColor: theme.warning + '11',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  rejectActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  sheetGhostBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  sheetGhostText: {
    fontSize: 12,
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
    fontSize: 12,
    color: theme.btnPrimaryText,
    fontWeight: '700',
  },
});
