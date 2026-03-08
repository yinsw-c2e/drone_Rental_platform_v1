import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import {useSelector} from 'react-redux';
import {useFocusEffect} from '@react-navigation/native';
import {orderService} from '../../services/order';
import {Order} from '../../types';
import {ORDER_STATUS} from '../../constants';
import {RootState} from '../../store/store';
import {
  acceptTask,
  getOrderByTaskId,
  listClientTasks,
  listPilotTasks,
  rejectTask,
  DispatchTask,
} from '../../services/dispatch';

type Bucket = 'pending' | 'in_progress' | 'completed';
type TabKey = 'all' | Bucket;

type PilotTaskItem = {
  id: number;
  task_id: number;
  task_no?: string;
  order_no?: string;
  status: string;
  task_type?: string;
  pickup_address?: string;
  delivery_address?: string;
  quoted_price?: number;
  total_score?: number;
  created_at?: string;
  deadline?: string;
  order_id?: number;
  related_order_status?: string;
  related_order_no?: string;
};

type UnifiedItem =
  | {
      kind: 'order';
      key: string;
      bucket: Bucket;
      sortTime: number;
      data: Order;
      sourceTags: ('order' | 'pilot_task' | 'client_task')[];
    }
  | {
      kind: 'pilot_task';
      key: string;
      bucket: Bucket;
      sortTime: number;
      data: PilotTaskItem;
    }
  | {
      kind: 'client_task';
      key: string;
      bucket: Bucket;
      sortTime: number;
      data: DispatchTask;
    };

type ListEntry =
  | {
      kind: 'section_header';
      key: string;
      bucket: Bucket;
      count: number;
    }
  | {
      kind: 'item';
      key: string;
      data: UnifiedItem;
    };

type PendingVisual = {
  label: string;
  borderColor: string;
  bgColor: string;
  badgeBg: string;
  badgeTextColor: string;
  hint?: string;
};

type SourceTag = 'order' | 'pilot_task' | 'client_task';

const SOURCE_TAG_META: Record<SourceTag, {label: string; bg: string; color: string}> = {
  order: {label: '订单', bg: '#e6f7ff', color: '#1890ff'},
  pilot_task: {label: '飞手任务', bg: '#fff7e6', color: '#fa8c16'},
  client_task: {label: '派单任务', bg: '#f6ffed', color: '#52c41a'},
};

const TABS: {key: TabKey; label: string}[] = [
  {key: 'all', label: '全部'},
  {key: 'pending', label: '待处理'},
  {key: 'in_progress', label: '进行中'},
  {key: 'completed', label: '已完成'},
];

const ROLE_TABS = [
  {key: 'all', label: '全部'},
  {key: 'renter', label: '我租的'},
  {key: 'owner', label: '我出租的'},
];

const BUCKET_LABEL: Record<Bucket, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
};

const isIgnorableTaskError = (error: any): boolean => {
  const msg = String(error?.message || '');
  return msg.includes('请先注册成为飞手') || msg.includes('请先注册成为业主');
};

const ORDER_STATUS_RANK: Record<string, number> = {
  created: 10,
  accepted: 20,
  paid: 30,
  in_progress: 40,
  confirmed: 45,
  cancelled: 80,
  rejected: 80,
  refunded: 85,
  delivered: 90,
  completed: 90,
};

const parseTimeSafe = (date?: string): number => {
  if (!date) return 0;
  const value = new Date(date).getTime();
  return Number.isFinite(value) ? value : 0;
};

const chooseBetterOrderSnapshot = (current: Order, next: Order): Order => {
  const currentRank = ORDER_STATUS_RANK[current.status] ?? 0;
  const nextRank = ORDER_STATUS_RANK[next.status] ?? 0;
  if (nextRank !== currentRank) return nextRank > currentRank ? next : current;

  const currentTs = parseTimeSafe((current as any).updated_at || current.created_at);
  const nextTs = parseTimeSafe((next as any).updated_at || next.created_at);
  if (nextTs !== currentTs) return nextTs > currentTs ? next : current;

  return next;
};

const parsePositiveInt = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(num) && num > 0 ? num : 0;
};

const normalizeOrderNo = (value: unknown): string => {
  const text = String(value || '').trim();
  return text ? text.toUpperCase() : '';
};

const addSourceTag = (item: UnifiedItem, tag: SourceTag): UnifiedItem => {
  if (item.kind !== 'order') return item;
  if (item.sourceTags.includes(tag)) return item;
  return {
    ...item,
    sourceTags: [...item.sourceTags, tag],
  };
};

const getOrderBucket = (status: string): Bucket | null => {
  if (status === 'created' || status === 'accepted' || status === 'paid') return 'pending';
  if (
    status === 'in_progress' ||
    status === 'confirmed' ||
    status === 'airspace_applying' ||
    status === 'airspace_approved' ||
    status === 'loading' ||
    status === 'in_transit'
  ) {
    return 'in_progress';
  }
  if (status === 'completed' || status === 'delivered') return 'completed';
  return null;
};

const getPilotEffectiveStatus = (task: PilotTaskItem): string =>
  String(task.related_order_status || task.status || '').toLowerCase();

const getPilotTaskBucket = (task: PilotTaskItem): Bucket | null => {
  const status = getPilotEffectiveStatus(task);
  if (status === 'notified' || status === 'pending' || status === 'created' || status === 'paid') return 'pending';
  if (
    status === 'accepted' ||
    status === 'confirmed' ||
    status === 'in_progress' ||
    status === 'airspace_applying' ||
    status === 'airspace_approved' ||
    status === 'loading' ||
    status === 'in_transit'
  ) {
    return 'in_progress';
  }
  if (status === 'completed' || status === 'delivered') return 'completed';
  return null;
};

const getClientTaskBucket = (status: string): Bucket | null => {
  if (status === 'pending' || status === 'matching' || status === 'dispatching' || status === 'assigned') return 'pending';
  if (status === 'accepted' || status === 'in_progress') return 'in_progress';
  if (status === 'completed') return 'completed';
  return null;
};

export default function OrderListScreen({navigation}: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pilotTasks, setPilotTasks] = useState<PilotTaskItem[]>([]);
  const [clientTasks, setClientTasks] = useState<DispatchTask[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [activeRole, setActiveRole] = useState('all');
  const [loading, setLoading] = useState(false);
  const [actingTaskId, setActingTaskId] = useState<number | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const isPilot = user?.user_type === 'pilot';

  const toTime = (date?: string): number => {
    if (!date) return 0;
    const value = new Date(date).getTime();
    return Number.isFinite(value) ? value : 0;
  };

  const getPriorityWeight = (priority: unknown): number => {
    if (priority === 'critical' || priority === 10 || priority === '10') return 3;
    if (priority === 'urgent' || priority === 8 || priority === '8') return 2;
    return 1;
  };

  const getDeadlineHint = (deadline?: string): string | undefined => {
    const ts = toTime(deadline);
    if (!ts) return undefined;
    const diff = ts - Date.now();
    if (diff <= 0) return '已超时';
    const hours = Math.ceil(diff / (60 * 60 * 1000));
    if (hours <= 24) return `剩余${hours}小时`;
    const d = new Date(ts);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `截止${month}-${day} ${hour}:${minute}`;
  };

  const getPendingVisual = (item: UnifiedItem): PendingVisual | null => {
    if (item.bucket !== 'pending') return null;

    if (item.kind === 'pilot_task') {
      const hint = getDeadlineHint(item.data.deadline);
      return {
        label: '优先接单',
        borderColor: '#ff9c6e',
        bgColor: '#fffaf5',
        badgeBg: '#fff1f0',
        badgeTextColor: '#d4380d',
        hint,
      };
    }

    if (item.kind === 'client_task') {
      const rawDeadline = (item.data as any).dispatch_deadline || item.data.deadline;
      const hint = getDeadlineHint(rawDeadline);
      const priorityWeight = getPriorityWeight(item.data.priority);
      const deadlineTs = toTime(rawDeadline);
      const nearDeadline = deadlineTs > 0 && deadlineTs - Date.now() <= 2 * 60 * 60 * 1000;
      const overdue = deadlineTs > 0 && deadlineTs <= Date.now();
      if (overdue || nearDeadline || priorityWeight >= 3) {
        return {
          label: '紧急任务',
          borderColor: '#ff7875',
          bgColor: '#fff5f5',
          badgeBg: '#fff1f0',
          badgeTextColor: '#cf1322',
          hint,
        };
      }
      if (priorityWeight >= 2) {
        return {
          label: '高优先',
          borderColor: '#ffa940',
          bgColor: '#fffaf0',
          badgeBg: '#fff7e6',
          badgeTextColor: '#d46b08',
          hint,
        };
      }
      return {
        label: '待派发',
        borderColor: '#ffd666',
        bgColor: '#fffef5',
        badgeBg: '#fffbe6',
        badgeTextColor: '#ad6800',
        hint,
      };
    }

    const isNewOrder = item.data.status === 'created' || item.data.status === 'accepted';
    return {
      label: isNewOrder ? '待确认订单' : '待支付订单',
      borderColor: '#91caff',
      bgColor: '#f8fbff',
      badgeBg: '#e6f4ff',
      badgeTextColor: '#0958d9',
      hint: undefined,
    };
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let fetchedOrders: Order[] = [];

      if (activeRole === 'all') {
        // 查询作为租客和机主的所有订单
        const [renterRes, ownerRes] = await Promise.all([
          orderService.list({role: 'renter', page: 1, page_size: 50}),
          orderService.list({role: 'owner', page: 1, page_size: 50}),
        ]);
        const allOrders = [
          ...(renterRes.data.list || []),
          ...(ownerRes.data.list || []),
        ];
        
        // 去重（避免同一订单ID重复）
        const orderMap = new Map<number, Order>();
        allOrders.forEach(order => {
          const existing = orderMap.get(order.id);
          if (!existing) {
            orderMap.set(order.id, order);
            return;
          }
          orderMap.set(order.id, chooseBetterOrderSnapshot(existing, order));
        });
        fetchedOrders = Array.from(orderMap.values());

        // 按创建时间排序
        fetchedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        // 按角色查询
        const res = await orderService.list({role: activeRole, page: 1, page_size: 50});
        fetchedOrders = res.data.list || [];
      }

      setOrders(fetchedOrders);

      // 角色筛选非“全部”时，仅展示订单，避免任务和角色维度混淆
      if (activeRole !== 'all') {
        setPilotTasks([]);
        setClientTasks([]);
      } else {
        if (isPilot) {
          try {
            const pilotRes = await listPilotTasks({page: 1, page_size: 50});
            const rawTasks = (pilotRes.data || []) as PilotTaskItem[];
            const normalizedTasks = await Promise.all(
              rawTasks.map(async raw => {
                const task: PilotTaskItem = {...raw};
                const linkedOrderId =
                  parsePositiveInt((raw as any).order_id) || parsePositiveInt((raw as any).related_order_id);
                if (linkedOrderId > 0) {
                  task.order_id = linkedOrderId;
                }

                const inlineOrderStatus =
                  (raw as any).related_order_status || (raw as any).order_status || (raw as any).order?.status;
                if (inlineOrderStatus) {
                  task.related_order_status = String(inlineOrderStatus);
                }
                const inlineOrderNo =
                  (raw as any).related_order_no || (raw as any).order_no || (raw as any).order?.order_no;
                if (inlineOrderNo) {
                  task.related_order_no = String(inlineOrderNo);
                }

                // 如果飞手任务本身没有带关联订单状态，补查一次真实订单状态，避免“列表进行中、详情已完成”。
                const shouldLookupOrder =
                  task.task_id > 0 &&
                  task.status !== 'notified' &&
                  task.status !== 'pending' &&
                  task.status !== 'rejected' &&
                  task.status !== 'expired';
                if (shouldLookupOrder) {
                  try {
                    const linkedOrder = await getOrderByTaskId(task.task_id);
                    const id = parsePositiveInt(linkedOrder?.id);
                    if (id > 0) task.order_id = id;
                    if (linkedOrder?.status) task.related_order_status = String(linkedOrder.status);
                    if (linkedOrder?.order_no) task.related_order_no = String(linkedOrder.order_no);
                  } catch {
                    // 忽略单条任务补查失败，不影响列表主流程
                  }
                }
                return task;
              }),
            );
            setPilotTasks(normalizedTasks);
          } catch (error) {
            if (!isIgnorableTaskError(error)) {
              console.error('获取飞手任务失败:', error);
            }
            setPilotTasks([]);
          }
          setClientTasks([]);
        } else {
          try {
            const clientRes = await listClientTasks({page: 1, page_size: 50});
            setClientTasks(clientRes.list || []);
          } catch (error) {
            if (!isIgnorableTaskError(error)) {
              console.error('获取派单任务失败:', error);
            }
            setClientTasks([]);
          }
          setPilotTasks([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [activeRole, isPilot]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  const handleAcceptPilotTask = (task: PilotTaskItem) => {
    if (task.status !== 'notified') return;
    Alert.alert('确认接单', '确定要接受此任务吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认',
        onPress: async () => {
          if (actingTaskId === task.id) return;
          setActingTaskId(task.id);
          try {
            await acceptTask(task.id);
            await fetchOrders();
            Alert.alert('接单成功', '任务已进入进行中');
          } catch (error: any) {
            Alert.alert('操作失败', error?.message || '请稍后重试');
          } finally {
            setActingTaskId(null);
          }
        },
      },
    ]);
  };

  const handleRejectPilotTask = (task: PilotTaskItem) => {
    if (task.status !== 'notified') return;
    Alert.alert('拒绝任务', '确定拒绝此任务吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认拒绝',
        style: 'destructive',
        onPress: async () => {
          if (actingTaskId === task.id) return;
          setActingTaskId(task.id);
          try {
            await rejectTask(task.id);
            await fetchOrders();
          } catch (error: any) {
            Alert.alert('操作失败', error?.message || '请稍后重试');
          } finally {
            setActingTaskId(null);
          }
        },
      },
    ]);
  };

  const items = useMemo<UnifiedItem[]>(() => {
    const merged: UnifiedItem[] = [];
    const orderIndexById = new Map<number, number>();
    const orderIndexByNo = new Map<string, number>();

    for (const order of orders) {
      const bucket = getOrderBucket(order.status);
      if (!bucket) continue;
      const normalizedNo = normalizeOrderNo(order.order_no);
      const index = merged.length;
      orderIndexById.set(order.id, index);
      if (normalizedNo) orderIndexByNo.set(normalizedNo, index);
      merged.push({
        kind: 'order',
        key: `order-${order.id}`,
        bucket,
        sortTime: toTime(order.created_at),
        data: order,
        sourceTags: ['order'],
      });
    }

    for (const task of pilotTasks) {
      const bucket = getPilotTaskBucket(task);
      if (!bucket) continue;
      const linkedOrderId =
        parsePositiveInt(task.order_id) || parsePositiveInt((task as any).related_order_id);
      const linkedOrderNo = normalizeOrderNo(task.related_order_no || task.order_no);
      const linkedOrderIndex =
        (linkedOrderId > 0 ? orderIndexById.get(linkedOrderId) : undefined) ??
        (linkedOrderNo ? orderIndexByNo.get(linkedOrderNo) : undefined);
      if (typeof linkedOrderIndex === 'number') {
        merged[linkedOrderIndex] = addSourceTag(merged[linkedOrderIndex], 'pilot_task');
        continue;
      }
      merged.push({
        kind: 'pilot_task',
        key: `pilot-${task.id}`,
        bucket,
        sortTime: toTime(task.created_at),
        data: task,
      });
    }

    for (const task of clientTasks) {
      const bucket = getClientTaskBucket(task.status);
      if (!bucket) continue;
      const linkedOrderId = (task as any).related_order_id || task.order_id;
      const linkedOrderNo = normalizeOrderNo((task as any).order_no);
      const linkedOrderIndex =
        (typeof linkedOrderId === 'number' && linkedOrderId > 0 ? orderIndexById.get(linkedOrderId) : undefined) ??
        (linkedOrderNo ? orderIndexByNo.get(linkedOrderNo) : undefined);
      if (typeof linkedOrderIndex === 'number') {
        merged[linkedOrderIndex] = addSourceTag(merged[linkedOrderIndex], 'client_task');
        continue;
      }
      merged.push({
        kind: 'client_task',
        key: `client-${task.id}`,
        bucket,
        sortTime: toTime(task.created_at),
        data: task,
      });
    }

    const bucketRank: Record<Bucket, number> = {
      pending: 0,
      in_progress: 1,
      completed: 2,
    };

    merged.sort((a, b) => {
      if (a.bucket !== b.bucket) {
        return bucketRank[a.bucket] - bucketRank[b.bucket];
      }

      if (a.bucket === 'pending') {
        const aUrgency = a.kind === 'client_task' ? getPriorityWeight(a.data.priority) : a.kind === 'pilot_task' ? 2 : 1;
        const bUrgency = b.kind === 'client_task' ? getPriorityWeight(b.data.priority) : b.kind === 'pilot_task' ? 2 : 1;
        if (aUrgency !== bUrgency) return bUrgency - aUrgency;

        const aDeadline = a.kind === 'client_task' ? toTime((a.data as any).dispatch_deadline || (a.data as any).deadline) : toTime((a.data as any).deadline);
        const bDeadline = b.kind === 'client_task' ? toTime((b.data as any).dispatch_deadline || (b.data as any).deadline) : toTime((b.data as any).deadline);
        if (aDeadline > 0 && bDeadline > 0 && aDeadline !== bDeadline) return aDeadline - bDeadline;
      }

      return b.sortTime - a.sortTime;
    });

    return merged;
  }, [orders, pilotTasks, clientTasks]);

  const stats = useMemo(() => {
    const pending = items.filter(i => i.bucket === 'pending').length;
    const inProgress = items.filter(i => i.bucket === 'in_progress').length;
    const completed = items.filter(i => i.bucket === 'completed').length;
    return {pending, inProgress, completed};
  }, [items]);

  const tabCounts = useMemo<Record<TabKey, number>>(
    () => ({
      all: items.length,
      pending: stats.pending,
      in_progress: stats.inProgress,
      completed: stats.completed,
    }),
    [items.length, stats.completed, stats.inProgress, stats.pending],
  );

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter(item => item.bucket === activeTab);
  }, [items, activeTab]);

  const displayItems = useMemo<ListEntry[]>(() => {
    if (activeTab !== 'all') {
      return filteredItems.map(item => ({
        kind: 'item',
        key: item.key,
        data: item,
      }));
    }

    const grouped: ListEntry[] = [];
    const buckets: Bucket[] = ['pending', 'in_progress', 'completed'];
    for (const bucket of buckets) {
      const group = filteredItems.filter(item => item.bucket === bucket);
      if (group.length === 0) continue;
      grouped.push({
        kind: 'section_header',
        key: `header-${bucket}`,
        bucket,
        count: group.length,
      });
      grouped.push(
        ...group.map(item => ({
          kind: 'item' as const,
          key: item.key,
          data: item,
        })),
      );
    }
    return grouped;
  }, [activeTab, filteredItems]);

  const renderOrderCard = (
    item: Order,
    sourceTags: SourceTag[],
    pendingVisual?: PendingVisual | null,
  ) => (
    <TouchableOpacity
      style={[
        styles.card,
        pendingVisual && styles.priorityCard,
        pendingVisual && {borderColor: pendingVisual.borderColor, backgroundColor: pendingVisual.bgColor},
      ]}
      onPress={() => navigation.navigate('OrderDetail', {id: item.id})}>
      <View style={styles.cardHeader}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Text style={styles.orderNo}>{item.order_no}</Text>
          {sourceTags.map(tag => {
            const meta = SOURCE_TAG_META[tag];
            return (
              <View key={`${item.id}-${tag}`} style={[styles.typeBadge, {backgroundColor: meta.bg}]}>
                <Text style={[styles.typeBadgeText, {color: meta.color}]}>{meta.label}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.status, {color: item.status === 'completed' ? '#52c41a' : '#1890ff'}]}>
          {ORDER_STATUS[item.status as keyof typeof ORDER_STATUS] || item.status}
        </Text>
      </View>
      {pendingVisual && (
        <View style={[styles.priorityTag, {backgroundColor: pendingVisual.badgeBg}]}>
          <Text style={[styles.priorityTagText, {color: pendingVisual.badgeTextColor}]}>{pendingVisual.label}</Text>
          {pendingVisual.hint ? (
            <Text style={[styles.priorityTagHint, {color: pendingVisual.badgeTextColor}]}>· {pendingVisual.hint}</Text>
          ) : null}
        </View>
      )}
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.amount}>{(item.total_amount / 100).toFixed(2)} 元</Text>
        <Text style={styles.time}>{item.created_at?.slice(0, 10)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderPilotTaskCard = (item: PilotTaskItem, pendingVisual?: PendingVisual | null) => {
    const statusMap: Record<string, {label: string; color: string}> = {
      notified: {label: '请确认接单', color: '#ff7a00'},
      pending: {label: '待响应', color: '#faad14'},
      accepted: {label: '已接单', color: '#52c41a'},
      confirmed: {label: '已确认接单', color: '#1890ff'},
      airspace_applying: {label: '申请空域中', color: '#1890ff'},
      airspace_approved: {label: '空域已批准', color: '#1890ff'},
      loading: {label: '装货中', color: '#1890ff'},
      in_transit: {label: '运输中', color: '#1890ff'},
      delivered: {label: '已送达', color: '#52c41a'},
      completed: {label: '已完成', color: '#52c41a'},
      rejected: {label: '已拒绝', color: '#ff4d4f'},
      expired: {label: '已过期', color: '#8c8c8c'},
    };
    const effectiveStatus = getPilotEffectiveStatus(item);
    const status = statusMap[effectiveStatus] || statusMap[item.status] || {label: item.status, color: '#666'};
    const canAct = item.status === 'notified';
    const isActing = actingTaskId === item.id;
    const amount = Number(item.quoted_price || 0);
    const displayNo = item.related_order_no || item.order_no || item.task_no || `任务#${item.task_id}`;
    const showTaskNoMeta =
      Boolean(item.task_no) && Boolean(item.related_order_no || item.order_no) && item.task_no !== (item.related_order_no || item.order_no);

    return (
      <View
        style={[
          styles.card,
          canAct && styles.pendingCard,
          pendingVisual && styles.priorityCard,
          pendingVisual && {borderColor: pendingVisual.borderColor, backgroundColor: pendingVisual.bgColor},
        ]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (item.task_id > 0) {
              navigation.navigate('PilotOrderExecution', {taskId: item.task_id, taskNo: item.task_no});
            }
          }}>
          <View style={styles.cardHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.orderNo}>{displayNo}</Text>
              <View style={[styles.typeBadge, {backgroundColor: '#fff7e6'}]}>
                <Text style={[styles.typeBadgeText, {color: '#fa8c16'}]}>飞手任务</Text>
              </View>
            </View>
            <Text style={[styles.status, {color: status.color}]}>{status.label}</Text>
          </View>
          {showTaskNoMeta && <Text style={styles.taskMeta}>任务号: {item.task_no}</Text>}
          {pendingVisual && (
            <View style={[styles.priorityTag, {backgroundColor: pendingVisual.badgeBg}]}>
              <Text style={[styles.priorityTagText, {color: pendingVisual.badgeTextColor}]}>
                {pendingVisual.label}
              </Text>
              {pendingVisual.hint ? (
                <Text style={[styles.priorityTagHint, {color: pendingVisual.badgeTextColor}]}>
                  · {pendingVisual.hint}
                </Text>
              ) : null}
            </View>
          )}
          <Text style={styles.title} numberOfLines={2}>
            派单货运: {item.pickup_address || '待确认'} {'->'} {item.delivery_address || '待确认'}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.amount}>{amount > 0 ? `${(amount / 100).toFixed(2)} 元` : '待定'}</Text>
            <Text style={styles.time}>{item.created_at?.slice(0, 10)}</Text>
          </View>
        </TouchableOpacity>
        {canAct && (
          <View style={styles.inlineActionRow}>
            <TouchableOpacity
              disabled={isActing}
              style={[styles.rejectBtn, isActing && styles.actionBtnDisabled]}
              onPress={() => handleRejectPilotTask(item)}>
              <Text style={[styles.rejectBtnText, isActing && styles.actionBtnTextDisabled]}>
                {isActing ? '处理中...' : '拒绝'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isActing}
              style={[styles.acceptBtn, isActing && styles.actionBtnDisabled]}
              onPress={() => handleAcceptPilotTask(item)}>
              <Text style={styles.acceptBtnText}>{isActing ? '处理中...' : '接受任务'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderClientTaskCard = (item: DispatchTask, pendingVisual?: PendingVisual | null) => {
    const statusMap: Record<string, {label: string; color: string}> = {
      pending: {label: '待派单', color: '#faad14'},
      matching: {label: '匹配中', color: '#1890ff'},
      dispatching: {label: '派单中', color: '#1890ff'},
      assigned: {label: '已分配', color: '#52c41a'},
      accepted: {label: '已接受', color: '#52c41a'},
      in_progress: {label: '执行中', color: '#1890ff'},
      completed: {label: '已完成', color: '#52c41a'},
    };
    const status = statusMap[item.status] || {label: item.status, color: '#666'};
    const amount = Number(item.max_budget || item.offered_price || 0);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          pendingVisual && styles.priorityCard,
          pendingVisual && {borderColor: pendingVisual.borderColor, backgroundColor: pendingVisual.bgColor},
        ]}
        onPress={() => navigation.navigate('DispatchTaskDetail', {id: item.id})}>
        <View style={styles.cardHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.orderNo}>{item.task_no || `任务#${item.id}`}</Text>
            <View style={[styles.typeBadge, {backgroundColor: '#f6ffed'}]}>
              <Text style={[styles.typeBadgeText, {color: '#52c41a'}]}>派单任务</Text>
            </View>
          </View>
          <Text style={[styles.status, {color: status.color}]}>{status.label}</Text>
        </View>
        {pendingVisual && (
          <View style={[styles.priorityTag, {backgroundColor: pendingVisual.badgeBg}]}>
            <Text style={[styles.priorityTagText, {color: pendingVisual.badgeTextColor}]}>
              {pendingVisual.label}
            </Text>
            {pendingVisual.hint ? (
              <Text style={[styles.priorityTagHint, {color: pendingVisual.badgeTextColor}]}>
                · {pendingVisual.hint}
              </Text>
            ) : null}
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {item.pickup_address || '待确认'} {'->'} {item.delivery_address || '待确认'}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.amount}>{amount > 0 ? `${(amount / 100).toFixed(2)} 元` : '系统定价'}</Text>
          <Text style={styles.time}>{item.created_at?.slice(0, 10)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUnifiedItem = (item: UnifiedItem) => {
    const pendingVisual = getPendingVisual(item);
    if (item.kind === 'order') return renderOrderCard(item.data, item.sourceTags, pendingVisual);
    if (item.kind === 'pilot_task') return renderPilotTaskCard(item.data, pendingVisual);
    return renderClientTaskCard(item.data, pendingVisual);
  };

  const renderListItem = ({item}: {item: ListEntry}) => {
    if (item.kind === 'section_header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderTitle}>{BUCKET_LABEL[item.bucket]}</Text>
          <Text style={styles.sectionHeaderCount}>{item.count}</Text>
        </View>
      );
    }
    return renderUnifiedItem(item.data);
  };

  const renderEmptyState = () => {
    const roleText = activeRole === 'renter' ? '我租的' : activeRole === 'owner' ? '我出租的' : '全部';
    const statusText = TABS.find(tab => tab.key === activeTab)?.label || '全部';
    const title =
      activeRole === 'all'
        ? `${statusText}暂无内容`
        : `${roleText}视角下暂无${activeTab === 'all' ? '订单' : statusText}`;
    const desc =
      activeRole === 'all'
        ? '可下拉刷新，或等待新任务/订单进入列表。'
        : '当前角色筛选只展示订单，如需查看任务请切回“全部”。';

    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyDesc}>{desc}</Text>
        {activeRole !== 'all' && (
          <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setActiveRole('all')}>
            <Text style={styles.emptyActionBtnText}>切换到全部</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.roleTabs}>
        {ROLE_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.roleTab, activeRole === tab.key && styles.roleTabActive]}
            onPress={() => setActiveRole(tab.key)}>
            <Text style={[styles.roleTabText, activeRole === tab.key && styles.roleTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.summaryChip, activeTab === tab.key && styles.summaryChipActive]}
            onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.summaryLabel, activeTab === tab.key && styles.summaryLabelActive]}>
              {tab.label} {tabCounts[tab.key]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={item => item.key}
        renderItem={renderListItem}
        refreshing={loading}
        onRefresh={fetchOrders}
        contentContainerStyle={{padding: 12}}
        ListEmptyComponent={renderEmptyState()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryChip: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  summaryChipActive: {
    backgroundColor: '#e6f7ff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  summaryLabelActive: {
    color: '#1890ff',
  },
  roleTabs: {
    flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  roleTab: {flex: 1, paddingVertical: 10, alignItems: 'center'},
  roleTabActive: {borderBottomWidth: 2, borderBottomColor: '#52c41a'},
  roleTabText: {fontSize: 13, color: '#666'},
  roleTabTextActive: {color: '#52c41a', fontWeight: 'bold'},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  sectionHeaderCount: {
    fontSize: 12,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  priorityCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  priorityTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  priorityTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priorityTagHint: {
    fontSize: 11,
    marginLeft: 4,
  },
  typeBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderNo: {fontSize: 12, color: '#999'},
  taskMeta: {fontSize: 11, color: '#bfbfbf', marginBottom: 6},
  status: {fontSize: 14, fontWeight: 'bold'},
  title: {fontSize: 16, color: '#333', marginBottom: 8},
  cardFooter: {flexDirection: 'row', justifyContent: 'space-between'},
  amount: {fontSize: 16, color: '#f5222d', fontWeight: 'bold'},
  time: {fontSize: 12, color: '#999'},
  emptyWrap: {
    marginTop: 64,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  emptyActionBtnText: {
    color: '#1890ff',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: '#ffd591',
    backgroundColor: '#fffdf7',
  },
  inlineActionRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ff4d4f',
    borderRadius: 8,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#ff4d4f',
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnTextDisabled: {
    color: '#bfbfbf',
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#1890ff',
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
