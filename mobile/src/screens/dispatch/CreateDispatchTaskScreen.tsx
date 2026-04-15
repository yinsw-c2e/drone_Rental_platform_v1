import React, {useCallback, useEffect, useMemo, useState} from 'react';
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

import ObjectCard from '../../components/business/ObjectCard';
import SourceTag from '../../components/business/SourceTag';
import StatusBadge from '../../components/business/StatusBadge';
import {getObjectStatusMeta} from '../../components/business/visuals';
import {dispatchV2Service} from '../../services/dispatchV2';
import {orderV2Service} from '../../services/orderV2';
import {ownerService} from '../../services/owner';
import {OwnerPilotBindingSummary, V2OrderDetail} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const MODE_OPTIONS = [
  {
    key: 'bound_pilot',
    title: '合作飞手',
    desc: '优先联系你已建立长期合作的飞手，适合固定班底任务。',
    accent: '#1677ff',
  },
  {
    key: 'candidate_pool',
    title: '优先候选',
    desc: '优先从更匹配当前任务的候选执行方里继续安排。',
    accent: '#7c3aed',
  },
  {
    key: 'general_pool',
    title: '平台协调',
    desc: '由平台继续协调当前可用的执行团队，适合补位或重派。',
    accent: '#d46b08',
  },
] as const;

type DispatchMode = (typeof MODE_OPTIONS)[number]['key'];

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

const getBindingPilotName = (binding: OwnerPilotBindingSummary) => {
  if (binding.pilot?.nickname) {
    return binding.pilot.nickname;
  }
  if (binding.pilot_user_id) {
    return `飞手 #${binding.pilot_user_id}`;
  }
  return '未命名飞手';
};

const getDispatchResultId = (payload: any) => Number(payload?.dispatch_task?.id || 0);

export default function CreateDispatchTaskScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const orderId = Number(route?.params?.orderId || route?.params?.id || 0);
  const dispatchId = Number(route?.params?.dispatchId || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [bindings, setBindings] = useState<OwnerPilotBindingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedMode, setSelectedMode] = useState<DispatchMode>('candidate_pool');
  const [selectedPilotUserId, setSelectedPilotUserId] = useState<number | null>(null);

  const isReassign = dispatchId > 0;

  const loadData = useCallback(async () => {
    if (!orderId) {
      setDetail(null);
      setBindings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [orderRes, bindingRes] = await Promise.all([
        orderV2Service.get(orderId),
        ownerService.listPilotBindings({status: 'active', page: 1, page_size: 100}),
      ]);
      const orderDetail = orderRes.data || null;
      const activeBindings = bindingRes.data?.items || [];
      setDetail(orderDetail);
      setBindings(activeBindings);
    } catch (error) {
      console.error('获取正式派单上下文失败:', error);
      setDetail(null);
      setBindings([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (bindings.length > 0) {
      setSelectedMode(current => (current === 'bound_pilot' || current === 'candidate_pool' || current === 'general_pool' ? current : 'bound_pilot'));
      setSelectedPilotUserId(current => current || bindings[0].pilot_user_id);
      return;
    }
    setSelectedMode(current => (current === 'bound_pilot' ? 'candidate_pool' : current));
    setSelectedPilotUserId(null);
  }, [bindings]);

  const selectedModeMeta = useMemo(
    () => MODE_OPTIONS.find(item => item.key === selectedMode) || MODE_OPTIONS[0],
    [selectedMode],
  );

  const canSubmit = useMemo(() => {
    if (!detail) {
      return false;
    }
    if (detail.status !== 'pending_dispatch' && !isReassign) {
      return false;
    }
    if (selectedMode === 'bound_pilot') {
      return bindings.length > 0 && Number(selectedPilotUserId || 0) > 0;
    }
    return true;
  }, [bindings.length, detail, isReassign, selectedMode, selectedPilotUserId]);

  const submit = async () => {
    if (!detail || !canSubmit) {
      return;
    }

    const payload = {
      dispatch_mode: selectedMode,
      target_pilot_user_id: selectedMode === 'bound_pilot' ? Number(selectedPilotUserId || 0) : undefined,
      reason: reason.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const res = isReassign
        ? await dispatchV2Service.reassign(dispatchId, payload)
        : await orderV2Service.dispatch(detail.id, payload);
      const nextDispatchId = getDispatchResultId(res.data);
      const successTitle = isReassign ? '已发起重派' : '已发起正式派单';
      const successDesc = isReassign
        ? '系统已按新的派单来源重新生成正式派单，你可以继续查看详情。'
        : '正式派单已发出，飞手端会在待响应列表中看到这条指令。';

      Alert.alert(successTitle, successDesc, [
        nextDispatchId > 0
          ? {
              text: '查看派单详情',
              onPress: () => {
                if (typeof navigation.replace === 'function') {
                  navigation.replace('DispatchTaskDetail', {id: nextDispatchId, dispatchId: nextDispatchId});
                  return;
                }
                navigation.navigate('DispatchTaskDetail', {id: nextDispatchId, dispatchId: nextDispatchId});
              },
            }
          : {
              text: '查看订单',
              onPress: () => navigation.navigate('OrderDetail', {id: detail.id, orderId: detail.id}),
            },
        {
          text: '返回订单',
          onPress: () => navigation.navigate('OrderDetail', {id: detail.id, orderId: detail.id}),
        },
      ]);
    } catch (error: any) {
      Alert.alert('操作失败', error?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
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

  if (!detail) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>订单不存在，或当前账号无法对它发起正式派单。</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>{isReassign ? '正式派单重派' : '发起正式派单'}</Text>
          <Text style={styles.heroTitle}>{isReassign ? '切换执行来源' : '从订单发出执行指令'}</Text>
          <Text style={styles.heroDesc}>
            这里只处理正式派单。需求撮合和供给成交已经结束，现在要做的是决定从哪一层执行来源里选飞手。
          </Text>
        </View>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>订单上下文</Text>
          <View style={styles.orderHeader}>
            <View style={styles.orderTags}>
              <SourceTag source={detail.order_source === 'supply_direct' ? 'supply' : 'demand'} />
              <StatusBadge label="" meta={getObjectStatusMeta('order', detail.status)} />
            </View>
            <Text style={styles.orderNo}>{detail.order_no}</Text>
          </View>
          <Text style={styles.orderTitle}>{detail.title}</Text>
          <Text style={styles.orderRoute}>
            {detail.service_address || '未设置起点'}
            {detail.dest_address ? ` -> ${detail.dest_address}` : ''}
          </Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricText}>订单金额：{formatMoney(detail.total_amount)}</Text>
            <Text style={styles.metricText}>执行模式：{detail.execution_mode || '-'}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricText}>当前状态：{getObjectStatusMeta('order', detail.status).label}</Text>
            <Text style={styles.metricText}>计划开始：{formatDateTime(detail.start_time)}</Text>
          </View>
          {detail.current_dispatch?.dispatch_no ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>当前已有正式派单</Text>
              <Text style={styles.noticeText}>
                {detail.current_dispatch.dispatch_no} · {getObjectStatusMeta('dispatch_task', detail.current_dispatch.status).label}
              </Text>
            </View>
          ) : null}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>选择派单来源</Text>
          {MODE_OPTIONS.map(option => {
            const disabled = option.key === 'bound_pilot' && bindings.length === 0;
            const active = option.key === selectedMode;
            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.9}
                disabled={disabled}
                style={[
                  styles.modeCard,
                  active && {borderColor: option.accent, backgroundColor: `${option.accent}12`},
                  disabled && styles.modeCardDisabled,
                ]}
                onPress={() => setSelectedMode(option.key)}>
                <View style={styles.modeTopRow}>
                  <Text style={[styles.modeTitle, active && {color: option.accent}]}>{option.title}</Text>
                  <View style={[styles.modeDot, {backgroundColor: disabled ? '#d9d9d9' : option.accent}]} />
                </View>
                <Text style={styles.modeDesc}>{option.desc}</Text>
                {disabled ? <Text style={styles.modeHint}>当前还没有可用的合作飞手</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ObjectCard>

        {selectedMode === 'bound_pilot' ? (
          <ObjectCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>选择合作飞手</Text>
            {bindings.length === 0 ? (
              <Text style={styles.emptyInline}>当前还没有可直接联系的合作飞手，建议改为优先候选或平台协调。</Text>
            ) : (
              bindings.map(binding => {
                const selected = Number(selectedPilotUserId || 0) === Number(binding.pilot_user_id || 0);
                return (
                  <TouchableOpacity
                    key={binding.id}
                    style={[styles.bindingCard, selected && styles.bindingCardActive]}
                    onPress={() => setSelectedPilotUserId(binding.pilot_user_id)}>
                    <View style={styles.bindingHeader}>
                      <Text style={styles.bindingName}>{getBindingPilotName(binding)}</Text>
                      <Text style={styles.bindingMeta}>{binding.is_priority ? '优先合作' : '普通合作'}</Text>
                    </View>
                    <Text style={styles.bindingNote}>{binding.note || '长期绑定合作飞手，可优先指派。'}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ObjectCard>
        ) : null}

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>派单说明</Text>
          <Text style={styles.sectionHint}>这段说明会进入正式派单日志，便于飞手和后续售后理解本次调度原因。</Text>
          <TextInput
            style={styles.textInput}
            multiline
            value={reason}
            onChangeText={setReason}
            placeholder={selectedMode === 'bound_pilot' ? '例如：优先联系熟悉该山区吊运线路的合作飞手' : `例如：按${selectedModeMeta.title}方式继续安排执行`}
          />
        </ObjectCard>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          disabled={!canSubmit || submitting}
          onPress={submit}>
          {submitting ? <ActivityIndicator color={theme.btnPrimaryText} /> : <Text style={styles.submitBtnText}>{isReassign ? '确认重派' : '确认发起正式派单'}</Text>}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 120,
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
    fontSize: 26,
    lineHeight: 32,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.8)',
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
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTags: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNo: {
    fontSize: 12,
    color: theme.textSub,
    fontWeight: '600',
  },
  orderTitle: {
    marginTop: 12,
    fontSize: 18,
    lineHeight: 24,
    color: theme.text,
    fontWeight: '800',
  },
  orderRoute: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  metricRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  noticeBox: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: theme.success + '22',
    borderWidth: 1,
    borderColor: theme.success + '44',
    padding: 12,
  },
  noticeTitle: {
    fontSize: 13,
    color: theme.success,
    fontWeight: '700',
  },
  noticeText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: theme.success,
  },
  modeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.card,
    padding: 14,
    marginBottom: 10,
  },
  modeCardDisabled: {
    opacity: 0.6,
  },
  modeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeTitle: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '800',
  },
  modeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modeDesc: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  modeHint: {
    marginTop: 6,
    fontSize: 12,
    color: theme.danger,
    fontWeight: '600',
  },
  bindingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    padding: 14,
    marginBottom: 10,
    backgroundColor: theme.card,
  },
  bindingCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  bindingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bindingName: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '800',
  },
  bindingMeta: {
    fontSize: 12,
    color: theme.primaryText,
    fontWeight: '700',
  },
  bindingNote: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  emptyInline: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  textInput: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 14,
    color: theme.text,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  submitBtn: {
    borderRadius: 999,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitBtnDisabled: {
    backgroundColor: theme.textHint,
  },
  submitBtnText: {
    fontSize: 15,
    color: theme.btnPrimaryText,
    fontWeight: '800',
  },
});
