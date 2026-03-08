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
  getDispatchTask,
  cancelDispatchTask,
  getTaskCandidates,
  getTaskLogs,
  triggerMatch,
  DispatchTask,
  DispatchCandidate,
  DispatchLog,
} from '../../services/dispatch';

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待派单', color: '#faad14'},
  matching: {label: '匹配中', color: '#1890ff'},
  dispatching: {label: '派单中', color: '#1890ff'},
  assigned: {label: '已分配', color: '#52c41a'},
  accepted: {label: '已接受', color: '#52c41a'},
  in_progress: {label: '执行中', color: '#1890ff'},
  completed: {label: '已完成', color: '#8c8c8c'},
  cancelled: {label: '已取消', color: '#ff4d4f'},
  expired: {label: '已过期', color: '#ff4d4f'},
  failed: {label: '匹配失败', color: '#ff4d4f'},
};

const TASK_TYPE_MAP: Record<string, string> = {
  cargo_delivery: '货物运输', agriculture: '农业植保',
  mapping: '航拍测绘', inspection: '巡检监测',
  emergency: '应急救援', other: '其他',
};

const PRIORITY_MAP: Record<string, {label: string; color: string}> = {
  '5': {label: '普通', color: '#8c8c8c'},
  '8': {label: '加急', color: '#fa8c16'},
  '10': {label: '紧急', color: '#ff4d4f'},
  normal: {label: '普通', color: '#8c8c8c'},
  urgent: {label: '加急', color: '#fa8c16'},
  critical: {label: '紧急', color: '#ff4d4f'},
};

const CANDIDATE_STATUS: Record<string, {label: string; color: string}> = {
  pending: {label: '待响应', color: '#faad14'},
  accepted: {label: '已接受', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
  expired: {label: '已过期', color: '#999'},
};

const LOG_ACTION_MAP: Record<string, string> = {
  created: '任务创建', matching_started: '开始匹配', candidate_found: '发现候选飞手',
  accepted: '飞手已接受', rejected: '飞手已拒绝', cancelled: '任务取消',
  completed: '任务完成', expired: '任务过期', failed: '匹配失败',
};

type TabType = 'detail' | 'candidates' | 'logs';

export default function DispatchTaskDetailScreen({navigation, route}: any) {
  const {id} = route.params;
  const [task, setTask] = useState<DispatchTask | null>(null);
  const [candidates, setCandidates] = useState<DispatchCandidate[]>([]);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [matching, setMatching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('detail');

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [taskRes, candRes, logRes] = await Promise.allSettled([
        getDispatchTask(id),
        getTaskCandidates(id),
        getTaskLogs(id),
      ]);
      if (taskRes.status === 'fulfilled') setTask(taskRes.value);
      if (candRes.status === 'fulfilled') setCandidates(candRes.value || []);
      if (logRes.status === 'fulfilled') setLogs(logRes.value || []);
    } catch (e: any) {
      Alert.alert('加载失败', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleRefresh = () => { setRefreshing(true); loadData(true); };

  const handleCancel = () => {
    Alert.alert('确认取消', '确定要取消这个派单任务吗？', [
      {text: '返回', style: 'cancel'},
      {text: '确认取消', style: 'destructive', onPress: async () => {
        setCancelling(true);
        try {
          await cancelDispatchTask(id);
          Alert.alert('成功', '任务已取消', [{text: '确定', onPress: () => navigation.goBack()}]);
        } catch (e: any) {
          Alert.alert('取消失败', e.message);
        } finally { setCancelling(false); }
      }},
    ]);
  };

  const handleTriggerMatch = async () => {
    setMatching(true);
    try {
      const result = await triggerMatch(id);
      await loadData(true);
      const count = Array.isArray(result) ? result.length : 0;
      Alert.alert(
        '匹配完成',
        count > 0
          ? `找到 ${count} 位候选飞手，已通知飞手响应`
          : '暂未找到合适飞手，请稍后重试',
      );
      if (count > 0) setActiveTab('candidates');
    } catch (e: any) {
      const msg = e?.message || '匹配请求失败，请检查网络后重试';
      // 兼容后端返回"未找到合适的飞手"时刷新一次数据
      await loadData(true);
      Alert.alert('匹配结果', msg);
    } finally {
      setMatching(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1890ff" style={{marginTop: 60}} />
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}><Text style={styles.emptyText}>任务不存在</Text></View>
      </SafeAreaView>
    );
  }

  const status = STATUS_MAP[task.status] || STATUS_MAP.pending;
  const priority = PRIORITY_MAP[String(task.priority)] || PRIORITY_MAP.normal;
  const taskType = TASK_TYPE_MAP[task.task_type] || task.task_type;
  const canCancel = ['pending', 'matching', 'dispatching'].includes(task.status);
  const canMatch = ['pending', 'matching'].includes(task.status);

  const renderDetail = () => (
    <>
      {/* 路线信息 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>路线信息</Text>
        <View style={styles.routeRow}>
          <View style={styles.greenDot} />
          <View style={{flex: 1}}>
            <Text style={styles.routeLabel}>取货地址</Text>
            <Text style={styles.routeAddr}>{task.pickup_address || '未设置'}</Text>
          </View>
        </View>
        <View style={styles.vertLine} />
        <View style={styles.routeRow}>
          <View style={styles.redDot} />
          <View style={{flex: 1}}>
            <Text style={styles.routeLabel}>送达地址</Text>
            <Text style={styles.routeAddr}>{task.delivery_address || '未设置'}</Text>
          </View>
        </View>
      </View>

      {/* 货物信息 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>货物信息</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>重量</Text>
            <Text style={styles.infoValue}>{task.cargo_weight ? `${task.cargo_weight} kg` : '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>预算上限</Text>
            <Text style={styles.infoValue}>
              {task.max_budget ? `¥${(task.max_budget / 100).toFixed(0)}` : '系统定价'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>匹配尝试</Text>
            <Text style={styles.infoValue}>{task.match_attempts ?? 0} / {3}</Text>
          </View>
        </View>
        {task.cargo_description ? (
          <View style={styles.descRow}>
            <Text style={styles.infoLabel}>描述</Text>
            <Text style={styles.infoValue}>{task.cargo_description}</Text>
          </View>
        ) : null}
      </View>

      {/* 时间信息 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>时间信息</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>创建时间</Text>
            <Text style={styles.infoValue}>{task.created_at?.substring(0, 16) || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>预约时间</Text>
            <Text style={styles.infoValue}>{task.scheduled_time?.substring(0, 16) || '立即派单'}</Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderCandidates = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>匹配候选飞手（{candidates.length}）</Text>
      {candidates.length === 0 ? (
        <View style={styles.tabEmpty}>
          <Text style={styles.tabEmptyText}>暂无候选飞手</Text>
          <Text style={styles.tabEmptyHint}>
            {canMatch ? '请点击下方「触发匹配」按钮开始匹配' : '系统将在合适时自动匹配'}
          </Text>
        </View>
      ) : (
        candidates.map((c, idx) => {
          const cs = CANDIDATE_STATUS[c.status] || CANDIDATE_STATUS.pending;
          return (
            <View key={c.id} style={[styles.candidateCard, idx === 0 && styles.candidateCardFirst]}>
              <View style={styles.candidateHeader}>
                <View style={{flex: 1}}>
                  <Text style={styles.candidateName}>✈️ 飞手 #{c.pilot_id}</Text>
                  <Text style={styles.candidateScore}>综合评分 {c.total_score ?? '-'} 分</Text>
                </View>
                <View style={[styles.candidateStatusBadge, {backgroundColor: cs.color + '20'}]}>
                  <Text style={[styles.candidateStatusText, {color: cs.color}]}>{cs.label}</Text>
                </View>
              </View>
              <View style={styles.candidateStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>距离</Text>
                  <Text style={styles.statValue}>{c.distance != null ? `${c.distance.toFixed(1)} km` : '-'}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>报价</Text>
                  <Text style={styles.statValue}>
                    {c.quoted_price ? `¥${(c.quoted_price / 100).toFixed(0)}` : '待报价'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>无人机</Text>
                  <Text style={styles.statValue}>#{c.drone_id ?? '-'}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>响应截止</Text>
                  <Text style={styles.statValue}>{c.notified_at?.substring(11, 16) || '-'}</Text>
                </View>
              </View>
              {c.response_note ? (
                <Text style={styles.rejectReason}>拒绝原因：{c.response_note}</Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );

  const renderLogs = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>任务日志</Text>
      {logs.length === 0 ? (
        <View style={styles.tabEmpty}>
          <Text style={styles.tabEmptyText}>暂无日志记录</Text>
        </View>
      ) : (
        logs.map((log, idx) => (
          <View key={log.id} style={styles.logRow}>
            <View style={styles.logDotWrap}>
              <View style={[styles.logDot, {backgroundColor: idx === 0 ? '#1890ff' : '#d9d9d9'}]} />
              {idx < logs.length - 1 && <View style={styles.logLine} />}
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logAction}>
                {LOG_ACTION_MAP[log.action] || log.action}
                {log.actor_type === 'system' ? ' (系统)' : log.actor_type === 'pilot' ? ' (飞手)' : ''}
              </Text>
              <Text style={styles.logTime}>{log.created_at?.substring(0, 16)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 状态头 */}
      <View style={styles.header}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusDot, {backgroundColor: status.color}]} />
          <Text style={[styles.statusLabel, {color: status.color}]}>{status.label}</Text>
          <View style={[styles.priorityBadge, {backgroundColor: priority.color + '20'}]}>
            <Text style={[styles.priorityText, {color: priority.color}]}>{priority.label}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.taskNo}>{task.task_no}</Text>
          <Text style={styles.taskType}>{taskType}</Text>
        </View>

        {/* Tab 切换 */}
        <View style={styles.tabBar}>
          {([
            {key: 'detail', label: '详情'},
            {key: 'candidates', label: `候选飞手${candidates.length > 0 ? `(${candidates.length})` : ''}`},
            {key: 'logs', label: `日志${logs.length > 0 ? `(${logs.length})` : ''}`},
          ] as {key: TabType; label: string}[]).map(tab => (
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
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        {activeTab === 'detail' && renderDetail()}
        {activeTab === 'candidates' && renderCandidates()}
        {activeTab === 'logs' && renderLogs()}

        {/* 操作按钮区 */}
        <View style={styles.actions}>
          {canMatch && (
            <TouchableOpacity
              style={[styles.matchBtn, matching && styles.btnDisabled]}
              onPress={handleTriggerMatch}
              disabled={matching}>
              <Text style={styles.matchBtnText}>
                {matching ? '匹配中...' : '🔍 触发匹配'}
              </Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity
              style={[styles.cancelBtn, cancelling && styles.btnDisabled]}
              onPress={handleCancel}
              disabled={cancelling}>
              <Text style={styles.cancelBtnText}>
                {cancelling ? '取消中...' : '取消任务'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0},
  content: {padding: 12, paddingBottom: 40},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80},
  emptyText: {fontSize: 16, color: '#999'},

  statusHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 6},
  statusDot: {width: 10, height: 10, borderRadius: 5, marginRight: 8},
  statusLabel: {fontSize: 17, fontWeight: 'bold', marginRight: 10},
  priorityBadge: {paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12},
  priorityText: {fontSize: 12, fontWeight: '500'},
  section: {marginBottom: 12},
  taskNo: {fontSize: 12, color: '#999', marginBottom: 2},
  taskType: {fontSize: 18, fontWeight: 'bold', color: '#333'},

  tabBar: {flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4},
  tabItem: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabItemActive: {borderBottomWidth: 2, borderBottomColor: '#1890ff'},
  tabText: {fontSize: 13, color: '#666'},
  tabTextActive: {color: '#1890ff', fontWeight: '600'},

  card: {backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12},
  cardTitle: {fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 12},

  routeRow: {flexDirection: 'row', alignItems: 'flex-start', marginVertical: 4},
  greenDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#52c41a', marginRight: 12, marginTop: 4},
  redDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff4d4f', marginRight: 12, marginTop: 4},
  vertLine: {width: 1, height: 12, backgroundColor: '#ddd', marginLeft: 4, marginVertical: 2},
  routeLabel: {fontSize: 12, color: '#999', marginBottom: 2},
  routeAddr: {fontSize: 14, color: '#333'},

  infoGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  infoItem: {width: '50%', marginBottom: 12},
  infoLabel: {fontSize: 12, color: '#999', marginBottom: 4},
  infoValue: {fontSize: 14, color: '#333', fontWeight: '500'},
  descRow: {marginTop: 4},

  tabEmpty: {paddingVertical: 30, alignItems: 'center'},
  tabEmptyText: {fontSize: 15, color: '#999', marginBottom: 6},
  tabEmptyHint: {fontSize: 12, color: '#ccc', textAlign: 'center'},

  // 候选人
  candidateCard: {
    borderTopWidth: 1, borderTopColor: '#f5f5f5', paddingTop: 12, marginTop: 12,
  },
  candidateCardFirst: {borderTopWidth: 0, marginTop: 0, paddingTop: 0},
  candidateHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  candidateName: {fontSize: 15, fontWeight: '600', color: '#333'},
  candidateScore: {fontSize: 12, color: '#1890ff', marginTop: 2},
  candidateStatusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  candidateStatusText: {fontSize: 12, fontWeight: '500'},
  candidateStats: {flexDirection: 'row', flexWrap: 'wrap'},
  statItem: {width: '25%', marginBottom: 8},
  statLabel: {fontSize: 11, color: '#999', marginBottom: 2},
  statValue: {fontSize: 13, color: '#333', fontWeight: '500'},
  rejectReason: {fontSize: 12, color: '#ff4d4f', marginTop: 4},

  // 日志
  logRow: {flexDirection: 'row', marginBottom: 4},
  logDotWrap: {alignItems: 'center', width: 20, marginRight: 10},
  logDot: {width: 8, height: 8, borderRadius: 4},
  logLine: {flex: 1, width: 1, backgroundColor: '#f0f0f0', marginTop: 2},
  logContent: {flex: 1, paddingBottom: 12},
  logAction: {fontSize: 14, color: '#333', fontWeight: '500'},
  logTime: {fontSize: 12, color: '#999', marginTop: 2},

  // 操作
  actions: {gap: 10, marginTop: 4},
  matchBtn: {
    backgroundColor: '#1890ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  matchBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  cancelBtn: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ff4d4f',
    borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: {opacity: 0.5},
  cancelBtnText: {fontSize: 16, color: '#ff4d4f', fontWeight: '600'},
});
