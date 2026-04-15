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
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {confirmReceipt, orderV2Service} from '../../services/orderV2';
import {RootState} from '../../store/store';
import {
  OrderPartySummary,
  V2OrderDetail,
  V2OrderTimelineEvent,
  V2OrderTimelineItem,
} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type ActionButton = {
  label: string;
  tone: 'primary' | 'danger' | 'ghost';
  onPress: () => void;
};

type ProgressFocus = {
  eyebrow: string;
  title: string;
  desc: string;
  eta?: string;
  actionHint?: string;
  tone: 'primary' | 'success' | 'warning' | 'muted';
};

const ACTIVE_EXECUTION_STATUSES = [
  'assigned',
  'confirmed',
  'airspace_applying',
  'airspace_approved',
  'loading',
  'preparing',
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
    return '快速下单';
  }
  if (orderSource === 'demand_market') {
    return '任务转单';
  }
  return '订单';
};

const getSourceContextLabel = (orderSource?: string) => {
  if (orderSource === 'supply_direct') {
    return '服务直达成交';
  }
  if (orderSource === 'demand_market') {
    return '任务撮合成交';
  }
  return '订单';
};

const getExecutionModeLabel = (executionMode?: string) => {
  switch (String(executionMode || '').toLowerCase()) {
    case 'self_execute':
      return '机主直接执行';
    case 'dispatch_bound_pilot':
      return '合作飞手执行';
    case 'dispatch_candidate_pool':
      return '优先安排执行方';
    case 'dispatch_pool':
      return '平台协调执行';
    default:
      return '待系统确认';
  }
};

const getDispatchSourceLabel = (source?: string) => {
  switch (String(source || '').toLowerCase()) {
    case 'bound_pilot':
      return '合作飞手';
    case 'candidate_pool':
      return '优先候选';
    case 'general_pool':
      return '平台协调';
    case 'self_execute':
      return '机主自执行';
    default:
      return source || '系统安排';
  }
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
  return snapshots?.demand?.title || snapshots?.supply?.title || snapshots?.client?.title || '-';
};

const buildFallbackTimeline = (items?: V2OrderTimelineItem[]): V2OrderTimelineEvent[] =>
  (items || []).map(item => ({
    event_id: `legacy-${item.id}`,
    source_type: 'order_timeline',
    source_id: item.id,
    event_type: 'order_status_changed',
    title: item.note || getObjectStatusMeta('order', item.status).label,
    description: item.status,
    status: item.status,
    occurred_at: item.created_at,
    operator_id: item.operator_id,
    operator_type: item.operator_type,
    payload: {
      id: item.id,
      note: item.note,
      status: item.status,
    },
  }));

const getTimelineTitle = (item: V2OrderTimelineEvent, isClient: boolean) => {
  if (item.source_type === 'dispatch_task' && isClient) {
    switch (item.event_type) {
      case 'dispatch_sent':
        return '平台正在安排执行方';
      case 'dispatch_accepted':
        return '执行方已确认';
      case 'dispatch_rejected':
        return '执行方重新安排中';
      case 'dispatch_expired':
        return '执行安排超时，正在重试';
      case 'dispatch_cancelled':
        return '执行安排已调整';
      default:
        return '执行安排已更新';
    }
  }
  return item.title;
};

const getTimelineDescription = (item: V2OrderTimelineEvent, isClient: boolean) => {
  const payload = item.payload || {};
  if (item.source_type === 'payment') {
    const amount = typeof payload.amount === 'number' ? formatMoney(payload.amount) : '';
    const method = payload.payment_method ? `通过 ${payload.payment_method}` : '支付单';
    if (item.event_type === 'payment_paid') {
      return `${method} 已完成${amount ? `，金额 ${amount}` : ''}`;
    }
    return `${method}${amount ? `，金额 ${amount}` : ''}`;
  }
  if (item.source_type === 'refund') {
    const amount = typeof payload.amount === 'number' ? formatMoney(payload.amount) : '';
    const reason = payload.reason || item.description;
    return [amount ? `退款金额 ${amount}` : '', reason].filter(Boolean).join(' · ') || '退款状态已更新';
  }
  if (item.source_type === 'dispatch_task') {
    const targetPilot = summarizeParty(payload.target_pilot, '待确认飞手');
    const dispatchSource = getDispatchSourceLabel(payload.dispatch_source);
    if (isClient) {
      if (item.event_type === 'dispatch_sent') {
        return `系统已开始联系执行团队，当前安排方式：${dispatchSource}`;
      }
      if (item.event_type === 'dispatch_accepted') {
        return `${targetPilot} 已确认接单，后续会继续推进准备与飞行。`;
      }
      if (item.event_type === 'dispatch_rejected') {
        return `${targetPilot} 未接受本次安排，系统会继续寻找合适执行方。`;
      }
      return item.description || '执行安排状态已更新';
    }
    return [dispatchSource, targetPilot, item.description].filter(Boolean).join(' · ');
  }
  if (item.source_type === 'flight_record') {
    return item.description || '飞行节点已更新';
  }
  if (item.source_type === 'order_timeline') {
    return item.description && item.description !== item.status ? item.description : '';
  }
  return item.description || '';
};

const getDispatchArrangementSummary = (detail?: V2OrderDetail | null) => {
  if (!detail) {
    return '-';
  }
  if (detail.execution_mode === 'self_execute' || detail.needs_dispatch === false) {
    return '机主直接执行';
  }
  const task = detail.current_dispatch;
  if (!task) {
    if ((detail.dispatch_history?.length || 0) > 0) {
      return '执行安排调整中';
    }
    return '待系统安排执行方';
  }
  switch (String(task.status || '').toLowerCase()) {
    case 'accepted':
      return '执行团队已确定';
    case 'pending_response':
      return '等待飞手确认';
    case 'rejected':
    case 'expired':
    case 'cancelled':
    case 'exception':
      return '重新安排执行方';
    default:
      return '执行安排处理中';
  }
};

const getProgressFocus = (
  detail: V2OrderDetail,
  options: {isClient: boolean; isProvider: boolean; isExecutor: boolean; isDispatchTargetPilot: boolean},
): ProgressFocus => {
  const status = String(detail.status || '').toLowerCase();
  const executorName = summarizeParty(
    detail.participants?.executor || detail.executor,
    detail.execution_mode === 'self_execute' ? '机主' : '执行团队',
  );

  switch (status) {
    case 'pending_provider_confirmation':
      return options.isProvider
        ? {
            eyebrow: '当前在等你',
            title: '请确认是否承接这笔订单',
            desc: '确认承接后，订单会进入待支付阶段；若不合适，可直接拒绝并说明原因。',
            eta: '建议 2 小时内处理',
            actionHint: '确认承接',
            tone: 'warning',
          }
        : {
            eyebrow: '当前在等机主',
            title: '机主正在确认是否承接',
            desc: '机主确认后你就能继续支付，若不承接会在这里直接看到结果。',
            eta: '通常 2 小时内回复',
            actionHint: '查看合同',
            tone: 'warning',
          };
    case 'pending_payment':
      return options.isClient
        ? {
            eyebrow: '下一步是支付',
            title: '支付完成后才会继续安排执行',
            desc: '这笔订单已经确认成交，完成支付后平台会继续推进执行安排。',
            eta: '支付成功后立即推进',
            actionHint: '去支付',
            tone: 'primary',
          }
        : {
            eyebrow: '当前在等客户',
            title: '等待客户完成支付',
            desc: '支付成功后，订单会自动进入下一步执行安排。',
            eta: '通常会尽快完成',
            actionHint: '查看合同',
            tone: 'muted',
          };
    case 'pending_dispatch':
      if (options.isDispatchTargetPilot) {
        return {
          eyebrow: '当前在等你',
          title: '请确认是否执行这笔订单',
          desc: '这笔任务已经正式发到你名下。确认后就能继续进入准备、飞行和签收流程。',
          eta: '建议 15 分钟内响应',
          actionHint: '去响应派单',
          tone: 'warning',
        };
      }
      return options.isProvider
        ? {
            eyebrow: '当前在等你',
            title: '请尽快安排执行方',
            desc: '确认飞手或让系统匹配后，客户就能在订单页看到明确的执行安排。',
            eta: '建议 1 小时内完成安排',
            actionHint: '安排执行',
            tone: 'primary',
          }
        : {
            eyebrow: '当前在等平台',
            title: '平台正在安排执行团队',
            desc: '你无需理解派单过程，只要关注订单进度即可，安排完成后会自动通知你。',
            eta: '通常 1 小时内完成安排',
            actionHint: '查看订单时间线',
            tone: 'muted',
          };
    case 'assigned':
      return options.isExecutor || options.isDispatchTargetPilot
        ? {
            eyebrow: '当前在等你',
            title: '请开始执行准备',
            desc: '确认设备、路线和现场条件后，进入准备阶段，订单页会同步更新给客户。',
            eta: '建议 30 分钟内推进',
            actionHint: '开始准备',
            tone: 'primary',
          }
        : {
            eyebrow: '执行团队已就位',
            title: `${executorName} 已准备接单`,
            desc: '执行方已经确认，本单将很快进入准备阶段。',
            eta: '通常 30 分钟内有新进展',
            actionHint: '查看订单时间线',
            tone: 'success',
          };
    case 'preparing':
    case 'loading':
    case 'airspace_applying':
    case 'airspace_approved':
      return {
        eyebrow: '执行准备中',
        title: '现场与设备正在准备',
        desc: '当前会继续处理装载、空域报备和起飞前检查，完成后会自动进入飞行阶段。',
        eta: '通常 30 分钟内更新',
        actionHint: '查看飞行监控',
        tone: 'warning',
      };
    case 'in_transit':
      return {
        eyebrow: '运输执行中',
        title: '无人机正在执行运输',
        desc: '当前订单已经进入飞行或运输阶段，后续会在抵达后更新投送结果。',
        eta: '请按计划到达时间留意消息',
        actionHint: '查看飞行监控',
        tone: 'primary',
      };
    case 'delivered':
      return options.isClient
        ? {
            eyebrow: '当前在等你',
            title: '请确认签收',
            desc: '确认收到货物后，订单会完成并进入结算。若暂时无法操作，系统会在 24 小时后自动确认。',
            eta: '24 小时内自动确认',
            actionHint: '确认签收',
            tone: 'success',
          }
        : {
            eyebrow: '当前在等客户',
            title: '等待客户确认签收',
            desc: '客户签收后，订单会自动完成并进入后续结算流程。',
            eta: '通常 24 小时内完成',
            actionHint: '查看售后',
            tone: 'muted',
          };
    case 'completed':
      return {
        eyebrow: '订单已完成',
        title: '本次运输已经闭环完成',
        desc: '合同、支付、执行留痕和评价都会继续保留在当前订单里，后续无需再切换对象查看。',
        eta: '可随时查看归档记录',
        actionHint: '订单评价',
        tone: 'success',
      };
    case 'cancelled': {
      const hasRefund = (detail.financial_summary?.refunded_amount || 0) > 0 || (detail.refunds?.length || 0) > 0;
      return {
        eyebrow: '订单已取消',
        title: hasRefund ? '退款记录正在处理中' : '本单已结束，不会继续推进',
        desc: hasRefund
          ? '若已发生支付，退款记录已经生成，你可以在本页查看退款状态和金额。'
          : '当前没有执行中的后续动作，保留记录仅用于追踪本次取消原因。',
        eta: hasRefund ? '预计 1-3 个工作日原路退回' : '无需额外操作',
        actionHint: '查看退款状态',
        tone: 'muted',
      };
    }
    default:
      return {
        eyebrow: '订单进度',
        title: getObjectStatusMeta('order', detail.status).label,
        desc: '当前订单正在推进中，后续重要动作都会汇总在下方时间线里。',
        eta: '请留意下一次状态更新',
        actionHint: '查看订单时间线',
        tone: 'muted',
      };
  }
};

const getCancelByLabel = (value?: string) => {
  switch (String(value || '').toLowerCase()) {
    case 'client':
      return '客户';
    case 'owner':
      return '机主';
    case 'pilot':
      return '飞手';
    default:
      return value || '-';
  }
};

function DetailRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) {
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

function ProgressFocusCard({focus}: {focus: ProgressFocus}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const accent =
    focus.tone === 'success'
      ? theme.success
      : focus.tone === 'warning'
        ? theme.warning
        : focus.tone === 'primary'
          ? theme.primary
          : theme.textSub;

  return (
    <View style={[styles.progressFocusContainer, {backgroundColor: theme.card, borderColor: `${accent}40`}]}>
      <View style={styles.progressFocusHeader}>
        <View style={[styles.focusIndicator, {backgroundColor: accent}]} />
        <Text style={[styles.focusEyebrow, {color: accent}]}>{focus.eyebrow}</Text>
        {focus.eta ? (
          <View style={[styles.focusEtaPill, {backgroundColor: `${accent}15`}]}>
            <Text style={[styles.focusEtaText, {color: accent}]}>{focus.eta}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.focusTitle}>{focus.title}</Text>
      <Text style={styles.focusDesc}>{focus.desc}</Text>

      {focus.actionHint ? (
        <View style={styles.focusActionHintRow}>
          <Text style={styles.focusActionHintLabel}>下一步指引：</Text>
          <Text style={[styles.focusActionHintValue, {color: theme.primaryText}]}>{focus.actionHint}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ExecutionArrangementCard({
  detail,
  isClient,
}: {
  detail?: V2OrderDetail | null;
  isClient: boolean;
}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  if (!detail) {
    return null;
  }

  if (detail.execution_mode === 'self_execute' || detail.needs_dispatch === false) {
    return (
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>🛡️ 机主直接承运保证</Text>
        <Text style={styles.noticeDesc}>
          本单由机主团队直接执行。平台已核实机主具备合法飞行资质，且已签署设备安全操作责任书。
        </Text>
      </View>
    );
  }

  const task = detail.current_dispatch;
  if (!task) {
    return (
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>执行团队匹配中</Text>
        <Text style={styles.noticeDesc}>
          {isClient
            ? '系统正在从合格飞手库中筛选最佳执行方。所有备选飞手均已通过民航资质认证与实名核验。'
            : '当前还没有生效的正式执行安排。您可以从下方主动作继续安排飞手，或者等待新的响应。'}
        </Text>
      </View>
    );
  }

  const pilotLabel = summarizeParty(task.target_pilot, '待确认飞手');
  const taskStatus = getObjectStatusMeta('dispatch_task', task.status);

  return (
    <View style={styles.dispatchBox}>
      <View style={styles.dispatchHeader}>
        <Text style={styles.dispatchNo}>{isClient ? '当前执行团队' : task.dispatch_no}</Text>
        <StatusBadge label="" meta={taskStatus} />
      </View>
      <View style={styles.trustRow}>
        <Text style={styles.trustIcon}>✅</Text>
        <Text style={styles.trustText}>飞手资质已核验 (民航执照)</Text>
      </View>
      <View style={styles.trustRow}>
        <Text style={styles.trustIcon}>✅</Text>
        <Text style={styles.trustText}>责任声明已签署 (设备操作权)</Text>
      </View>
      <View style={styles.dispatchDivider} />
      <DetailRow label="当前执行方" value={pilotLabel} />
      <DetailRow label="安排方式" value={getDispatchSourceLabel(task.dispatch_source)} />
      {task.reason ? <DetailRow label="执行说明" value={task.reason} /> : null}
    </View>
  );
}

function TimelineSection({items, isClient}: {items?: V2OrderTimelineEvent[]; isClient: boolean}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  if (!items || items.length === 0) {
    return (
      <ObjectCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>订单动态汇总</Text>
        <Text style={styles.sectionHint}>当前还没有可展示的时间线记录。</Text>
      </ObjectCard>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'payment': return '💰';
      case 'refund': return '💸';
      case 'dispatch_task': return '📋';
      case 'flight_record': return '🚁';
      default: return '📍';
    }
  };

  return (
    <ObjectCard style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>订单动态汇总</Text>
        <Text style={styles.sectionSubtitle}>{items.length} 条记录</Text>
      </View>
      <Text style={styles.sectionHint}>支付、执行安排、飞行和退款都会按时间汇总到这里。</Text>
      <View style={styles.timelineList}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const description = getTimelineDescription(item, isClient);
          return (
            <View key={`${item.event_id}-${index}`} style={styles.timelineItem}>
              <View style={styles.timelineAxis}>
                <View style={styles.timelineIconBg}>
                  <Text style={styles.timelineIconText}>{getEventIcon(item.source_type)}</Text>
                </View>
                {!isLast ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeaderRow}>
                  <Text style={styles.timelineTitle}>{getTimelineTitle(item, isClient)}</Text>
                  <Text style={styles.timelineTime}>{formatDateTime(item.occurred_at)}</Text>
                </View>
                {description ? <Text style={styles.timelineDesc}>{description}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </ObjectCard>
  );
}

export default function OrderDetailScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const orderId = Number(route?.params?.orderId || route?.params?.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [timelineItems, setTimelineItems] = useState<V2OrderTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setTimelineItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [detailRes, timelineRes] = await Promise.all([
        orderV2Service.get(orderId),
        orderV2Service.getTimeline(orderId).catch(() => null),
      ]);
      const nextDetail = detailRes.data || null;
      setDetail(nextDetail);
      setTimelineItems(
        timelineRes?.data?.items?.length
          ? timelineRes.data.items
          : buildFallbackTimeline(nextDetail?.timeline),
      );
    } catch (error) {
      console.error('获取订单详情失败:', error);
      setDetail(null);
      setTimelineItems([]);
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
  const isDispatchTargetPilot =
    currentUserId > 0 && currentUserId === Number(detail?.current_dispatch?.target_pilot_user_id || 0);
  const canOpenFlightMonitor = ACTIVE_EXECUTION_STATUSES.includes(String(detail?.status || '').toLowerCase());
  const canOpenReview =
    String(detail?.status || '').toLowerCase() === 'completed' && (isClient || isProvider || isExecutor);
  const canOpenAfterSale =
    !!detail &&
    ((detail.refunds?.length || 0) > 0 ||
      (detail.disputes?.length || 0) > 0 ||
      !['pending_provider_confirmation', 'provider_rejected', 'pending_payment'].includes(
        String(detail.status || '').toLowerCase(),
      ));
  const canCancelOrder = Boolean(
    detail &&
      (isClient || isProvider) &&
      !['completed', 'cancelled', 'provider_rejected', 'in_transit', 'delivered'].includes(
        String(detail.status || '').toLowerCase(),
      ),
  );
  const canOpenDispatchDetail = Boolean(detail?.current_dispatch?.id && (isProvider || isExecutor || isDispatchTargetPilot));
  const canRespondCurrentDispatch = Boolean(
    detail?.current_dispatch?.id &&
      isDispatchTargetPilot &&
      String(detail.current_dispatch?.status || '').toLowerCase() === 'pending_response',
  );
  const canEnterExecutionWorkspace = Boolean(
    detail?.current_dispatch?.id &&
      (isExecutor || isDispatchTargetPilot) &&
      String(detail.current_dispatch?.status || '').toLowerCase() === 'accepted' &&
      !['cancelled'].includes(String(detail?.status || '').toLowerCase()),
  );
  const latestTimelineTitle = timelineItems[0]?.title;

  const progressFocus = useMemo(
    () =>
      detail
        ? getProgressFocus(detail, {
            isClient,
            isProvider,
            isExecutor,
            isDispatchTargetPilot,
          })
        : null,
    [detail, isClient, isDispatchTargetPilot, isExecutor, isProvider],
  );

  const actionButtons = useMemo<ActionButton[]>(() => {
    if (!detail || actionLoading) {
      return [];
    }

    const buttons: ActionButton[] = [];

    if (canRespondCurrentDispatch) {
      buttons.push({
        label: '去响应派单',
        tone: 'primary',
        onPress: () =>
          navigation.navigate('DispatchTaskDetail', {
            id: detail.current_dispatch?.id,
            dispatchId: detail.current_dispatch?.id,
          }),
      });
    }

    if (canEnterExecutionWorkspace) {
      buttons.push({
        label: '进入执行工作台',
        tone: 'primary',
        onPress: () =>
          navigation.navigate('PilotOrderExecution', {
            taskId: detail.current_dispatch?.id,
          }),
      });
    }

    if (detail.status === 'pending_provider_confirmation' && isProvider) {
      buttons.push({
        label: '确认承接',
        tone: 'primary',
        onPress: () => {
          Alert.alert('确认承接', '确认承接这笔订单吗？', [
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
                  await orderV2Service.providerReject(detail.id, '机主拒绝订单');
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

    if (detail.status === 'pending_dispatch' && isProvider && !detail.current_dispatch?.id) {
      buttons.push({
        label: '安排执行',
        tone: 'primary',
        onPress: () =>
          navigation.navigate('CreateDispatchTask', {
            orderId: detail.id,
            id: detail.id,
          }),
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
                  Alert.alert('签收成功', '订单已完成，感谢你的使用。');
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

    if (canCancelOrder) {
      buttons.push({
        label: '取消订单',
        tone: 'danger',
        onPress: () => {
          const paidAmount = detail.financial_summary?.paid_amount || 0;
          const refundNotice =
            paidAmount > 0
              ? '系统会自动创建退款记录，预计 1-3 个工作日内原路退回。'
              : '当前尚未产生扣款，取消后不会发生退款。';
          Alert.alert(
            '确认取消订单',
            `${paidAmount > 0 ? '取消后不会继续执行本单。' : '这笔订单会立刻结束。'}${refundNotice}`,
            [
              {text: '再想想', style: 'cancel'},
              {
                text: '确认取消',
                style: 'destructive',
                onPress: async () => {
                  setActionLoading(true);
                  try {
                    await orderV2Service.cancel(
                      detail.id,
                      `${isClient ? '客户' : '机主'}主动取消订单`,
                    );
                    await fetchDetail();
                    Alert.alert(
                      '订单已取消',
                      paidAmount > 0
                        ? '订单和退款记录都已生成，可在本页继续查看退款进度。'
                        : '订单已取消，不会再继续推进执行流程。',
                    );
                  } catch (error: any) {
                    Alert.alert('取消失败', error?.response?.data?.message || '请稍后重试');
                  } finally {
                    setActionLoading(false);
                  }
                },
              },
            ],
          );
        },
      });
    }

    if (canOpenDispatchDetail) {
      buttons.push({
        label: '查看执行安排',
        tone: 'ghost',
        onPress: () =>
          navigation.navigate('DispatchTaskDetail', {
            id: detail.current_dispatch?.id,
            dispatchId: detail.current_dispatch?.id,
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

    buttons.push({
      label: '查看合同',
      tone: 'ghost',
      onPress: () => navigation.navigate('Contract', {orderId: detail.id}),
    });

    return buttons;
  }, [
    actionLoading,
    canCancelOrder,
    canOpenAfterSale,
    canOpenDispatchDetail,
    canEnterExecutionWorkspace,
    canOpenFlightMonitor,
    canOpenReview,
    canRespondCurrentDispatch,
    detail,
    fetchDetail,
    isClient,
    isProvider,
    navigation,
  ]);

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
  const currentExecutorLabel = summarizeParty(
    executor,
    detail.execution_mode === 'self_execute' ? '机主直接执行' : '安排中',
  );

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
              <Text style={styles.heroMetricLabel}>当前路径</Text>
              <Text style={styles.heroMetricSecondary}>{getSourceLabel(detail.order_source)}</Text>
            </View>
          </View>
        </View>

        {progressFocus ? <ProgressFocusCard focus={progressFocus} /> : null}

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>任务信息</Text>
          <DetailRow label="成单方式" value={getSourceContextLabel(detail.order_source)} />
          <DetailRow label="来源标题" value={sourceTitle} />
          <DetailRow label="计划开始" value={formatDateTime(detail.start_time)} />
          <DetailRow label="计划结束" value={formatDateTime(detail.end_time)} />
          <DetailRow label="起始地址" value={detail.service_address || '-'} />
          <DetailRow label="目的地址" value={detail.dest_address || '-'} />
        </ObjectCard>

        {detail.drone ? (
          <ObjectCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>执行设备</Text>
            <DetailRow label="品牌型号" value={`${detail.drone.brand} ${detail.drone.model}`} />
            <DetailRow label="起飞重量" value={detail.drone.mtow_kg != null ? `${detail.drone.mtow_kg} kg` : '-'} />
            <DetailRow label="最大载重" value={detail.drone.max_payload_kg != null ? `${detail.drone.max_payload_kg} kg` : '-'} />
          </ObjectCard>
        ) : null}

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>参与方</Text>
          <ParticipantCard label="客户" party={client} accent="#114178" isSelf={isClient} fallback="客户" />
          <ParticipantCard label="承接方" party={provider} accent="#389e0d" isSelf={isProvider} fallback="待确认机主" />
          <ParticipantCard label="执行方" party={executor} accent="#d46b08" fallback={currentExecutorLabel} />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>执行进度</Text>
          <DetailRow label="执行安排" value={getDispatchArrangementSummary(detail)} />
          <DetailRow label="执行模式" value={getExecutionModeLabel(detail.execution_mode)} />
          {latestTimelineTitle ? <DetailRow label="最近进展" value={latestTimelineTitle} /> : null}
          <View style={styles.dispatchSection}>
            <Text style={styles.subsectionTitle}>{isClient ? '当前执行安排' : isDispatchTargetPilot || isExecutor ? '我的执行安排' : '执行安排详情'}</Text>
            <ExecutionArrangementCard detail={detail} isClient={isClient} />
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>费用与结算明细</Text>
          <View style={styles.costGrid}>
            <View style={styles.costItem}>
              <Text style={styles.costLabel}>运输服务费</Text>
              <Text style={styles.costValue}>{formatMoney(detail.total_amount)}</Text>
            </View>
            <View style={styles.costItem}>
              <Text style={styles.costLabel}>履约保证金</Text>
              <Text style={styles.costValue}>{formatMoney(detail.financial_summary?.deposit_amount || 0)}</Text>
            </View>
            <View style={styles.costDivider} />
            <View style={[styles.costItem, {marginTop: 4}]}>
              <Text style={styles.costLabelTotal}>总计金额</Text>
              <Text style={styles.costValueTotal}>{formatMoney(Number(detail.total_amount || 0) + Number(detail.financial_summary?.deposit_amount || 0))}</Text>
            </View>
          </View>
          <View style={styles.paymentStatusRow}>
            <DetailRow label="已支付总额" value={formatMoney(financial?.paid_amount)} highlight />
            <DetailRow label="已退款金额" value={formatMoney(financial?.refunded_amount)} />
          </View>
          {financial?.provider_reject_reason ? <DetailRow label="拒绝原因" value={financial.provider_reject_reason} /> : null}
        </ObjectCard>

        {String(detail.status || '').toLowerCase() === 'cancelled' ? (
          <ObjectCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>取消与退款</Text>
            <DetailRow label="取消发起方" value={getCancelByLabel(detail.cancel_by)} />
            <DetailRow label="取消原因" value={detail.cancel_reason || '未填写'} />
            <DetailRow label="退款状态" value={(detail.refunds?.length || 0) > 0 ? '已生成退款记录' : '未产生退款'} />
            <DetailRow label="预计到账" value={(detail.refunds?.length || 0) > 0 ? '预计 1-3 个工作日原路退回' : '无需退款'} />
          </ObjectCard>
        ) : null}

        <TimelineSection items={timelineItems} isClient={isClient} />
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

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
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
    progressFocusContainer: {
      marginBottom: 16,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    progressFocusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    focusIndicator: {
      width: 4,
      height: 14,
      borderRadius: 2,
      marginRight: 8,
    },
    focusEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      flex: 1,
    },
    focusEtaPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    focusEtaText: {
      fontSize: 11,
      fontWeight: '700',
    },
    focusTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      lineHeight: 26,
    },
    focusDesc: {
      fontSize: 13,
      color: theme.textSub,
      marginTop: 8,
      lineHeight: 20,
    },
    focusActionHintRow: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
      flexDirection: 'row',
      alignItems: 'center',
    },
    focusActionHintLabel: {
      fontSize: 12,
      color: theme.textHint,
      fontWeight: '600',
    },
    focusActionHintValue: {
      fontSize: 13,
      fontWeight: '700',
    },
    sectionCard: {
      marginBottom: 12,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      color: theme.text,
      fontWeight: '800',
    },
    sectionSubtitle: {
      fontSize: 12,
      color: theme.textHint,
      fontWeight: '600',
    },
    sectionHint: {
      fontSize: 13,
      color: theme.textSub,
      lineHeight: 20,
      marginBottom: 16,
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
      color: '#FFFFFF',
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
      marginBottom: 12,
    },
    trustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    trustIcon: {
      fontSize: 12,
    },
    trustText: {
      fontSize: 12,
      color: theme.success,
      fontWeight: '600',
    },
    dispatchDivider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 12,
    },
    dispatchNo: {
      fontSize: 13,
      color: theme.textSub,
      fontWeight: '700',
    },
    costGrid: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    costItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    costLabel: {
      fontSize: 12,
      color: theme.textHint,
    },
    costValue: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '600',
    },
    costDivider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 8,
    },
    costLabelTotal: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
    },
    costValueTotal: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.primaryText,
    },
    paymentStatusRow: {
      marginTop: 4,
    },
    timelineList: {
      marginTop: 4,
    },
    timelineItem: {
      flexDirection: 'row',
      minHeight: 58,
    },
    timelineAxis: {
      width: 32,
      alignItems: 'center',
    },
    timelineIconBg: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      marginTop: 4,
    },
    timelineIconText: {
      fontSize: 12,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: theme.divider,
      marginVertical: 4,
    },
    timelineContent: {
      flex: 1,
      paddingLeft: 10,
      paddingBottom: 24,
    },
    timelineHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    timelineTitle: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      fontWeight: '700',
    },
    timelineTime: {
      fontSize: 11,
      color: theme.textHint,
      fontWeight: '600',
    },
    timelineDesc: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 20,
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
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
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
      color: '#FFFFFF',
    },
    actionButtonTextDanger: {
      color: theme.danger,
    },
    actionButtonTextGhost: {
      color: theme.primaryText,
    },
  });
