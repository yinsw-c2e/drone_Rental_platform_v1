import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { getTonePalette } from '../../../components/business/visuals';
import { dispatchV2Service } from '../../../services/dispatchV2';
import { V2DispatchTaskSummary } from '../../../types';
import { formatUnknownEnumLabel, getObjectStatusMeta } from '../../../utils';
import './index.scss';

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending_response', label: '待响应' },
  { key: 'accepted', label: '已接单' },
  { key: 'closed', label: '已结束' },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]['key'];

const CLOSED_STATUSES = ['rejected', 'expired', 'exception', 'completed', 'finished'];
const DISPATCH_SOURCE_LABELS: Record<string, string> = {
  manual: '人工指派',
  auto: '自动派单',
  reassign: '重新指派',
  order_owner: '机主指派',
  platform: '平台安排',
};

const getStatusMatched = (status: string, filter: StatusFilter) => {
  if (filter === 'all') return true;
  if (filter === 'closed') return CLOSED_STATUSES.includes(String(status || '').toLowerCase());
  return String(status || '').toLowerCase() === filter;
};

const getPilotLabel = (task: V2DispatchTaskSummary) => {
  if (task.target_pilot?.nickname) return task.target_pilot.nickname;
  if (task.target_pilot?.user_id) return `飞手 #${task.target_pilot.user_id}`;
  return '待指定飞手';
};

export default function DispatchListPage() {
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const [tasks, setTasks] = useState<V2DispatchTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const role = roleSummary?.has_owner_role ? 'owner' : 'pilot';
      const res: any = await dispatchV2Service.list({ role, page: 1, page_size: 50 });
      setTasks(res.data?.items || res.items || []);
    } catch (error) {
      console.error('获取派单列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [roleSummary]);

  useDidShow(() => {
    loadData();
  });

  const filteredTasks = useMemo(
    () => tasks.filter(task => getStatusMatched(task.status, activeStatus)),
    [activeStatus, tasks],
  );

  return (
    <ScrollView
      scrollY
      className='dispatch-list-wrap'
    >
      {/* Hero */}
      <View className='page-hero dispatch-list-hero'>
        <Text className='page-hero-title'>正式派单</Text>
        <Text className='page-hero-sub'>这里只看执行指令</Text>
      </View>

      {/* Filter Tabs */}
      <View className='card'>
        <Text className='section-title'>状态筛选</Text>
        <View className='filter-tabs'>
          {STATUS_TABS.map(tab => (
            <View
              key={tab.key}
              className={`filter-tab ${activeStatus === tab.key ? 'filter-tab-active' : ''}`}
              onClick={() => setActiveStatus(tab.key)}
            >
              <Text>{tab.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View className='empty-state'>
          <Text className='empty-state-text'>加载中...</Text>
        </View>
      ) : filteredTasks.length === 0 ? (
        <View className='card'>
          <View className='empty-state'>
            <Text className='empty-state-icon'>📡</Text>
            <Text className='empty-state-text'>当前没有正式派单</Text>
          </View>
        </View>
      ) : (
        filteredTasks.map(task => (
          (() => {
            const statusMeta = getObjectStatusMeta('dispatch', task.status);
            const statusPalette = getTonePalette(statusMeta.tone as any, false);
            const orderMeta = getObjectStatusMeta('order', task.order?.status || '-');
            return (
              <View
                key={task.id}
                className='list-item dispatch-list-item'
                onClick={() => Taro.navigateTo({ url: `/pages/dispatch/detail/index?id=${task.id}` })}
              >
                <View className='list-item-header'>
                  <View className='list-item-header-left'>
                    <Text
                      className='status-badge dispatch-status-badge'
                      style={{ backgroundColor: statusPalette.bg, color: statusPalette.text, borderColor: statusPalette.border }}
                    >
                      {statusMeta.label}
                    </Text>
                  </View>
                  <Text className='list-item-no'>{task.dispatch_no}</Text>
                </View>
                <Text className='list-item-title'>{task.order?.title || '正式派单任务'}</Text>
                <View className='list-item-meta'>
                  <Text className='list-item-meta-text'>目标飞手：{getPilotLabel(task)}</Text>
                  <Text className='list-item-meta-text'>重派次数：{task.retry_count || 0}</Text>
                </View>
                <View className='list-item-meta'>
                  <Text className='list-item-meta-text'>派单来源：{DISPATCH_SOURCE_LABELS[String(task.dispatch_source || '').toLowerCase()] || formatUnknownEnumLabel(task.dispatch_source, '-')}</Text>
                  <Text className='list-item-meta-text'>订单状态：{orderMeta.label}</Text>
                </View>
              </View>
            );
          })()
        ))
      )}
    </ScrollView>
  );
}
