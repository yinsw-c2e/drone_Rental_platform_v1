import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {orderV2Service, confirmReceipt} from '../../services/orderV2';
import {RootState} from '../../store/store';
import {
  OrderPartySummary,
  V2DispatchTaskSummary,
  V2OrderDetail,
  V2OrderTimelineItem,
} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type ActionButton = {
  label: string;
  tone: 'primary' | 'danger' | 'ghost';
  onPress: () => void;
};

const ACTIVE_EXECUTION_STATUSES = [
  'assigned',
  'confirmed',
  'airspace_applying',
  'airspace_approved',
  'loading',
  'in_transit',
  'delivered',
  'completed',
];

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

const getSourceTag = (orderSource?: string) =>
  orderSource === 'supply_direct' ? 'supply' : 'demand';

const getSourceLabel = (orderSource?: string) => {
  if (orderSource === 'supply_direct') {
    return '供给直达下单';
  }
  if (orderSource === 'demand_market') {
    return '需求市场成单';
  }
  return '订单';
};

const getExecutionModeLabel = (executionMode?: string) => {
  switch (String(executionMode || '').toLowerCase()) {
    case 'self_execute':
      return '机主自执行';
    case 'dispatch_bound_pilot':
      return '绑定飞手执行';
    case 'dispatch_candidate_pool':
      return '候选飞手池派单';
    case 'dispatch_pool':
      return '普通飞手池派单';
    default:
      return '未明确';
  }
};

const getDispatchFlowLabel = (detail?: V2OrderDetail | null) => {
  if (!detail) {
    return '-';
  }
  if (detail.execution_mode === 'self_execute' || detail.needs_dispatch === false) {
    return '未经过正式派单';
  }
  if (detail.current_dispatch || (detail.dispatch_history && detail.dispatch_history.length > 0)) {
    return '已进入正式派单';
  }
  return '待进入正式派单';
};

const summarizeParty = (party?: OrderPartySummary | null, fallback = '-') => {
  if (!party) {
    return fallback;
  }
  if (party.nickname) {
    return party.nickname;
  }
  if (party.user_id) {
    return `${fallback} #${party.user_id}`;
  }
  return fallback;
};

const getPartyInitial = (party?: OrderPartySummary | null, fallback = 'U') => {
  const value = party?.nickname || '';
  return value ? value.charAt(0).toUpperCase() : fallback;
};

const getSourceTitle = (detail?: V2OrderDetail | null) => {
  if (!detail?.source_info?.snapshots) {
    return '-';
  }
  const snapshots = detail.source_info.snapshots as Record<string, any>;
  return (
    snapshots?.demand?.title ||
    snapshots?.supply?.title ||
    snapshots?.client?.title ||
    '-'
  );
};

function DetailRow({label, value, highlight = false}: {label: string; value?: string; highlight?: boolean}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value || '-'}</Text>
    </View>
  );
}

function ParticipantCard({
  label,
  party,
  accent,
  isSelf,
  fallback,
}: {
  label: string;
  party?: OrderPartySummary | null;
  accent: string;
  isSelf?: boolean;
  fallback: string;
}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.participantCard}>
      <View style={[styles.participantAvatar, {backgroundColor: accent}]}> 
        <Text style={styles.participantAvatarText}>{getPartyInitial(party, label.charAt(0))}</Text>
      </View>
      <View style={styles.participantContent}>
        <Text style={styles.participantLabel}>{label}</Text>
        <Text style={styles.participantName}>{summarizeParty(party, fallback)}</Text>
        <Text style={styles.participantMeta}>
          {party?.phone || (isSelf ? '当前账号' : '等待补充联系方式')}
          {isSelf ? ' · 我' : ''}
        </Text>
      </View>
    </View>
  );
}

function DispatchPreview({task}: {task?: V2DispatchTaskSummary | null}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  if (!task) {
    return (
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>当前没有在途正式派单</Text>
        <Text style={styles.noticeDesc}>如果订单需要执行方，后续会在这里展示当前派单对象、响应状态和重派次数。</Text>
      </View>
    );
  }

  return (
    <View style={styles.dispatchBox}>
      <View style={styles.dispatchHeader}>
        <Text style={styles.dispatchNo}>{task.dispatch_no}</Text>
        <StatusBadge label="" meta={getObjectStatusMeta('dispatch_task', task.status)} />
      </View>
      <DetailRow label="派单方式" value={task.dispatch_source || '-'} />
      <DetailRow label="目标飞手" value={summarizeParty(task.target_pilot, '待指派飞手')} />
      <DetailRow label="重派次数" value={String(task.retry_count || 0)} />
      <DetailRow label="发出时间" value={formatDateTime(task.sent_at)} />
      <DetailRow label="响应时间" value={formatDateTime(task.responded_at)} />
      {task.reason ? <DetailRow label="说明" value={task.reason} /> : null}
    </View>
  );
}

function TimelineSection({items}: {items?: V2OrderTimelineItem[]}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  if (!items || items.length === 0) {
    return (
      <ObjectCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>订单时间线</Text>
        <Text style={styles.sectionHint}>当前还没有可展示的时间线记录。</Text>
      </ObjectCard>
    );
  }

  return (
    <ObjectCard style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>订单时间线</Text>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <View key={`${item.id}-${index}`} style={styles.timelineItem}>
            <View style={styles.timelineAxis}>
              <View style={[styles.timelineDot, {backgroundColor: getObjectStatusMeta('order', item.status).tone === 'green' ? '#389e0d' : '#114178'}]} />
              {!isLast ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>{item.note || getObjectStatusMeta('order', item.status).label}</Text>
              <Text style={styles.timelineMeta}>
                {formatDateTime(item.created_at)}
                {item.operator_type ? ` · ${item.operator_type}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </ObjectCard>
  );
}

export default function OrderDetailScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const orderId = Number(route?.params?.orderId || route?.params?.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await orderV2Service.get(orderId);
      setDetail(res.data || null);
    } catch (error) {
      console.error('获取订单详情失败:', error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
    }, [fetchDetail]),
  );

  const currentUserId = Number(user?.id || 0);
  const participants = detail?.participants;
  const client = participants?.client || detail?.client;
  const provider = participants?.provider || detail?.provider;
  const executor = participants?.executor || detail?.executor;
  const isClient = currentUserId > 0 && currentUserId === Number(client?.user_id || 0);
  const isProvider = currentUserId > 0 && currentUserId === Number(provider?.user_id || 0);
  const isExecutor = currentUserId > 0 && currentUserId === Number(executor?.user_id || 0);
  const canOpenFlightMonitor = ACTIVE_EXECUTION_STATUSES.includes(String(detail?.status || '').toLowerCase());
  const canOpenReview = String(detail?.status || '').toLowerCase() === 'completed' && (isClient || isProvider || isExecutor);
  const canOpenAfterSale =
    !!detail &&
    (detail.refunds?.length || detail.disputes?.length ||
      !['pending_provider_confirmation', 'provider_rejected', 'pending_payment'].includes(String(detail.status || '').toLowerCase()));

  const actionButtons = useMemo<ActionButton[]>(() => {
    if (!detail || actionLoading) {
      return [];
    }

    const buttons: ActionButton[] = [];
    if (detail.status === 'pending_provider_confirmation' && isProvider) {
      buttons.push({
        label: '确认承接',
        tone: 'primary',
        onPress: () => {
          Alert.alert('确认承接', '确认承接这笔直达订单吗？', [
            {text: '取消', style: 'cancel'},
            {
              text: '确认',
              onPress: async () => {
                setActionLoading(true);
                try {
                  await orderV2Service.providerConfirm(detail.id);
                  await fetchDetail();
                  Alert.alert('已确认', '订单已进入待支付状态。');
                } catch (error: any) {
                  Alert.alert('操作失败', error?.response?.data?.message || '请稍后重试');
                } finally {
                  setActionLoading(false);
                }
              },
            },
          ]);
        },
      });
      buttons.push({
        label: '拒绝订单',
        tone: 'danger',
        onPress: () => {
          Alert.alert('拒绝订单', '确认拒绝这笔订单吗？', [
            {text: '取消', style: 'cancel'},
            {
              text: '确认拒绝',
              style: 'destructive',
              onPress: async () => {
                setActionLoading(true);
                try {
                  await orderV2Service.providerReject(detail.id, '机主拒绝直达订单');
                  await fetchDetail();
                  Alert.alert('已拒绝', '客户会在订单详情里看到拒绝结果。');
                } catch (error: any) {
                  Alert.alert('操作失败', error?.response?.data?.message || '请稍后重试');
                } finally {
                  setActionLoading(false);
                }
              },
            },
          ]);
        },
      });
    }

    if (detail.status === 'pending_payment' && isClient) {
      buttons.push({
        label: '去支付',
        tone: 'primary',
        onPress: () => navigation.navigate('Payment', {orderId: detail.id, id: detail.id}),
      });
    }

    if (detail.status === 'delivered' && isClient) {
      buttons.push({
        label: '确认签收',
        tone: 'primary',
        onPress: () => {
          Alert.alert('确认签收', '确认已收到货物并完成签收？', [
            {text: '取消', style: 'cancel'},
            {
              text: '确认',
              onPress: async () => {
                setActionLoading(true);
                try {
                  await confirmReceipt(detail.id);
                  await fetchDetail();
                  Alert.alert('签收成功', '订单已完成，感谢您的使用！');
                } catch (error: any) {
                  Alert.alert('操作失败', error?.response?.data?.message || '请稍后重试');
                } finally {
                  setActionLoading(false);
                }
              },
            },
          ]);
        },
      });
    }

    if (detail.current_dispatch?.id) {
      buttons.push({
        label: '查看派单',
        tone: 'ghost',
        onPress: () =>
          navigation.navigate('DispatchTaskDetail', {
            id: detail.current_dispatch?.id,
            dispatchId: detail.current_dispatch?.id,
          }),
      });
    }

    if (detail.status === 'pending_dispatch' && isProvider && !detail.current_dispatch?.id) {
      buttons.push({
        label: '发起派单',
        tone: 'primary',
        onPress: () =>
          navigation.navigate('CreateDispatchTask', {
            orderId: detail.id,
            id: detail.id,
          }),
      });
    }

    if (canOpenFlightMonitor) {
      buttons.push({
        label: '飞行监控',
        tone: 'ghost',
        onPress: () =>
          navigation.navigate('FlightMonitoring', {
            orderId: detail.id,
            dispatchId: detail.current_dispatch?.id,
          }),
      });
    }

    if (canOpenReview) {
      buttons.push({
        label: '订单评价',
        tone: 'ghost',
        onPress: () => navigation.navigate('Review', {orderId: detail.id, id: detail.id}),
      });
    }

    if (canOpenAfterSale) {
      buttons.push({
        label: '售后处理',
        tone: 'ghost',
        onPress: () => navigation.navigate('OrderAfterSale', {orderId: detail.id, id: detail.id}),
      });
    }

    // 合同入口（所有状态可查看）
    buttons.push({
      label: '查看合同',
      tone: 'ghost',
      onPress: () => navigation.navigate('Contract', {orderId: detail.id}),
    });

    return buttons;
  }, [actionLoading, canOpenAfterSale, canOpenFlightMonitor, canOpenReview, detail, fetchDetail, isClient, isProvider, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>订单不存在或当前账号没有查看权限。</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sourceTitle = getSourceTitle(detail);
  const financial = detail.financial_summary;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>订单详情</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTagRow}>
              <SourceTag source={getSourceTag(detail.order_source)} />
              <StatusBadge label="" meta={getObjectStatusMeta('order', detail.status)} />
            </View>
            <Text style={styles.heroOrderNo}>{detail.order_no}</Text>
          </View>
          <Text style={styles.heroTitle}>{detail.title}</Text>
          <Text style={styles.heroRoute}>
            {detail.service_address || '未设置起点'}
            {detail.dest_address ? ` -> ${detail.dest_address}` : ''}
          </Text>
          <View style={styles.heroSummaryRow}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>订单金额</Text>
              <Text style={styles.heroMetricValue}>{formatMoney(detail.total_amount)}</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>来源链路</Text>
              <Text style={styles.heroMetricSecondary}>{getSourceLabel(detail.order_source)}</Text>
            </View>
          </View>
        </View>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>来源信息</Text>
          <DetailRow label="成单方式" value={getSourceLabel(detail.order_source)} />
          <DetailRow label="来源标题" value={sourceTitle} />
          <DetailRow label="需求 ID" value={detail.source_info?.demand_id ? String(detail.source_info.demand_id) : '-'} />
          <DetailRow label="供给 ID" value={detail.source_info?.source_supply_id ? String(detail.source_info.source_supply_id) : '-'} />
          <DetailRow label="计划开始" value={formatDateTime(detail.start_time)} />
          <DetailRow label="计划结束" value={formatDateTime(detail.end_time)} />
          <DetailRow label="起始地址" value={detail.service_address || '-'} />
          <DetailRow label="目的地址" value={detail.dest_address || '-'} />
        </ObjectCard>

        {detail.drone ? (
          <ObjectCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>执行设备</Text>
            <DetailRow label="品牌型号" value={`${detail.drone.brand} ${detail.drone.model}`} />
            {detail.drone.serial_number ? (
              <DetailRow label="序列号" value={detail.drone.serial_number} />
            ) : null}
            <DetailRow label="起飞重量" value={detail.drone.mtow_kg != null ? `${detail.drone.mtow_kg} kg` : '-'} />
            <DetailRow label="最大载重" value={detail.drone.max_payload_kg != null ? `${detail.drone.max_payload_kg} kg` : '-'} />
          </ObjectCard>
        ) : null}

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>参与方</Text>
          <ParticipantCard label="客户" party={client} accent="#114178" isSelf={isClient} fallback="客户" />
          <ParticipantCard label="承接方" party={provider} accent="#389e0d" isSelf={isProvider} fallback="待确认机主" />
          <ParticipantCard
            label="执行方"
            party={executor}
            accent="#d46b08"
            fallback={detail.execution_mode === 'self_execute' ? '机主自执行' : '待派单'}
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>执行状态</Text>
          <DetailRow label="当前状态" value={getObjectStatusMeta('order', detail.status).label} />
          <DetailRow label="执行模式" value={getExecutionModeLabel(detail.execution_mode)} />
          <DetailRow label="是否自执行" value={detail.execution_mode === 'self_execute' ? '是' : '否'} />
          <DetailRow label="是否需要派单" value={detail.needs_dispatch ? '需要' : '不需要'} />
          <DetailRow label="派单链路" value={getDispatchFlowLabel(detail)} />
          <DetailRow label="当前执行方" value={summarizeParty(executor, detail.execution_mode === 'self_execute' ? '机主自执行' : '待派单')} />
          <DetailRow label="历史派单数" value={String(detail.dispatch_history?.length || 0)} />
          <View style={styles.dispatchSection}>
            <Text style={styles.subsectionTitle}>当前派单</Text>
            <DispatchPreview task={detail.current_dispatch} />
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>财务状态</Text>
          <DetailRow label="订单总额" value={formatMoney(financial?.total_amount || detail.total_amount)} highlight />
          <DetailRow label="押金" value={formatMoney(financial?.deposit_amount)} />
          <DetailRow label="平台佣金" value={formatMoney(financial?.platform_commission)} />
          <DetailRow label="承接方收入" value={formatMoney(financial?.owner_amount)} />
          <DetailRow label="已支付" value={formatMoney(financial?.paid_amount)} />
          <DetailRow label="已退款" value={formatMoney(financial?.refunded_amount)} />
          <DetailRow label="支付笔数" value={String(financial?.paid_count || 0)} />
          <DetailRow label="退款笔数" value={String(financial?.refund_count || 0)} />
          {financial?.provider_reject_reason ? (
            <DetailRow label="拒绝原因" value={financial.provider_reject_reason} />
          ) : null}
        </ObjectCard>

        <TimelineSection items={detail.timeline} />
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
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  backBtn: {
    width: 64,
  },
  backText: {
    fontSize: 16,
    color: theme.primaryText,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    color: theme.text,
    fontWeight: '700',
  },
  headerRight: {
    width: 64,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSub,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    padding: 14,
    paddingBottom: 120,
  },
  hero: {
    borderRadius: 24,
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    padding: 20,
    marginBottom: 12,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroOrderNo: {
    fontSize: 12,
    color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 24,
    lineHeight: 30,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '800',
  },
  heroRoute: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  heroSummaryRow: {
    flexDirection: 'row',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? theme.primaryBorder : 'rgba(255,255,255,0.12)',
    paddingTop: 16,
  },
  heroMetric: {
    flex: 1,
  },
  heroMetricLabel: {
    fontSize: 12,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.7)',
  },
  heroMetricValue: {
    marginTop: 6,
    fontSize: 24,
    color: theme.isDark ? theme.primary : '#FFFFFF',
    fontWeight: '800',
  },
  heroMetricSecondary: {
    marginTop: 8,
    fontSize: 14,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '700',
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
  sectionHint: {
    fontSize: 13,
    color: theme.textSub,
    lineHeight: 20,
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
    fontSize: 13,
    color: theme.textSub,
    width: 88,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 20,
    color: theme.text,
    fontWeight: '600',
  },
  rowValueHighlight: {
    color: theme.danger,
    fontWeight: '800',
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantAvatarText: {
    color: theme.btnPrimaryText,
    fontSize: 15,
    fontWeight: '800',
  },
  participantContent: {
    flex: 1,
  },
  participantLabel: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '700',
  },
  participantName: {
    marginTop: 4,
    fontSize: 16,
    color: theme.text,
    fontWeight: '700',
  },
  participantMeta: {
    marginTop: 4,
    fontSize: 12,
    color: theme.textSub,
  },
  dispatchSection: {
    marginTop: 14,
  },
  subsectionTitle: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
    marginBottom: 10,
  },
  noticeBox: {
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.primaryBg,
  },
  noticeTitle: {
    fontSize: 14,
    color: theme.primaryText,
    fontWeight: '700',
  },
  noticeDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  dispatchBox: {
    borderRadius: 16,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  dispatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dispatchNo: {
    fontSize: 13,
    color: theme.textSub,
    fontWeight: '700',
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 58,
  },
  timelineAxis: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
  },
  actionSpinner: {
    marginRight: 12,
  },
  actionButton: {
    minWidth: 96,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginLeft: 10,
    marginTop: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  actionButtonDanger: {
    backgroundColor: theme.danger + '22',
    borderColor: theme.danger + '44',
  },
  actionButtonGhost: {
    backgroundColor: theme.card,
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
    color: theme.primaryText,
  },
});
