import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {dispatchV2Service} from '../../services/dispatchV2';
import {V2DispatchTaskSummary} from '../../types';
import {RootState} from '../../store/store';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';

const STATUS_TABS = [
  {key: 'all', label: '全部'},
  {key: 'pending_response', label: '待响应'},
  {key: 'accepted', label: '已接单'},
  {key: 'executing', label: '执行中'},
  {key: 'closed', label: '已结束'},
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]['key'];

const CLOSED_STATUSES = ['rejected', 'expired', 'exception', 'completed', 'finished'];

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

const getStatusMatched = (status: string, filter: StatusFilter) => {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'closed') {
    return CLOSED_STATUSES.includes(String(status || '').toLowerCase());
  }
  return String(status || '').toLowerCase() === filter;
};

const getPilotLabel = (task: V2DispatchTaskSummary) => {
  if (task.target_pilot?.nickname) {
    return task.target_pilot.nickname;
  }
  if (task.target_pilot?.user_id) {
    return `执行人员 #${task.target_pilot.user_id}`;
  }
  return '待指定执行人员';
};

export default function DispatchTaskListScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary));
  const canManageDispatch = providerCapabilities.canArrangeDispatch;
  const [tasks, setTasks] = useState<V2DispatchTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');

  const loadData = useCallback(async () => {
    if (!canManageDispatch) {
      setTasks([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await dispatchV2Service.list({role: 'owner', page: 1, page_size: 50});
      setTasks(res.data?.items || []);
    } catch (error) {
      console.error('获取履约任务列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageDispatch]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const filteredTasks = useMemo(
    () => tasks.filter(task => getStatusMatched(task.status, activeStatus)),
    [activeStatus, tasks],
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <FlatList
        data={filteredTasks}
        keyExtractor={item => String(item.id)}
        renderItem={({item}) => (
          <ObjectCard style={styles.card} onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <SourceTag source="dispatch_task" />
                <StatusBadge label="" meta={getObjectStatusMeta('dispatch_task', item.status)} />
              </View>
              <Text style={styles.code}>{item.dispatch_no}</Text>
            </View>

            <Text style={styles.title}>{item.order?.title || '履约任务'}</Text>
            <Text style={styles.route} numberOfLines={2}>
              {item.order?.service_address || '未设置起点'}
              {item.order?.dest_address ? ` -> ${item.order.dest_address}` : ''}
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>目标执行人员：{getPilotLabel(item)}</Text>
              <Text style={styles.metaText}>安排来源：{item.dispatch_source || '-'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>订单状态：{getObjectStatusMeta('order', item.order?.status).label}</Text>
              <Text style={styles.metaText}>重派次数：{item.retry_count || 0}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>发出时间：{formatDateTime(item.sent_at)}</Text>
              <Text style={styles.metaText}>订单金额：{formatMoney(item.order?.total_amount)}</Text>
            </View>
          </ObjectCard>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadData();
        }} colors={[theme.refreshColor]} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>执行安排</Text>
              <Text style={styles.heroTitle}>履约任务一目了然</Text>
              <Text style={styles.heroDesc}>
                这里展示已安排的履约任务，以及当前确认和执行状态。
              </Text>
            </View>

            <ObjectCard style={styles.filterCard}>
              <Text style={styles.filterTitle}>状态筛选</Text>
              <View style={styles.filterRow}>
                {STATUS_TABS.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, activeStatus === tab.key && styles.filterChipActive]}
                    onPress={() => setActiveStatus(tab.key)}>
                    <Text style={[styles.filterChipText, activeStatus === tab.key && styles.filterChipTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ObjectCard>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <ObjectCard>
              <EmptyState
                icon="📡"
                title={canManageDispatch ? '当前没有执行安排' : '设备服务能力未开通'}
                description={canManageDispatch ? '如果订单还没进入履约阶段，请先去订单页确认待处理订单；已安排的履约任务会出现在这里。' : '审核通过后才能查看执行安排和发起履约任务。'}
                actionText={canManageDispatch ? '查看订单' : undefined}
                onAction={canManageDispatch ? () => navigation.navigate('MyOrders', {roleFilter: 'owner'}) : undefined}
              />
            </ObjectCard>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: theme.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)',
  },
  filterCard: {
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primaryBg,
  },
  filterChipText: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: theme.primaryText,
  },
  loading: {
    paddingVertical: 48,
  },
  card: {
    marginBottom: 12,
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
});
