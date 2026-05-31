import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {providerService} from '../services/provider';
import {friendlyErrorMessage} from '../utils/errorMessage';
import {formatAmountYuan} from '../utils/supplyMeta';
import showToast from '../utils/toast';
import type {
  V2ApiResponse,
  V2ProviderAssignmentView,
  V2ProviderBroadcastView,
} from '../types';

const SELF_EXECUTABLE_REQUIRED_TOAST = '需要先完善设备和履约资质';

const normalizeProviderItems = <T,>(res: unknown): T[] => {
  const value = res as {items?: T[]; data?: {items?: T[]}} | null;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};

const getRemainingSeconds = (deadline?: string | null, fallback?: number | null) => {
  const deadlineMs = deadline ? Date.parse(deadline) : NaN;
  if (Number.isFinite(deadlineMs)) {
    return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  }
  return Math.max(0, Math.ceil(Number(fallback || 0)));
};

const getBroadcastAmount = (item: V2ProviderBroadcastView | V2ProviderAssignmentView) => {
  const broadcastAmount = 'estimated_total_cents' in item
    ? item.estimated_total_cents
    : item.broadcast?.estimated_total_cents;
  return Number(broadcastAmount || item.order?.total_amount || 0);
};

const getOrderIdFromPayload = (payload: unknown, fallback: number) => {
  const value = payload as V2ApiResponse<{order?: {id?: number}}> & {order?: {id?: number}} | null;
  return Number(value?.order?.id || value?.data?.order?.id || fallback || 0);
};

const formatBroadcastDistance = (km?: number | null) => {
  const value = Number(km || 0);
  if (!Number.isFinite(value) || value < 0) return '距你 --';
  if (value < 0.05) return '距你 <0.1km';
  return `距你 ${value.toFixed(value >= 10 ? 0 : 1)}km`;
};

const formatRouteDistance = (meters?: number | null) => {
  const value = Number(meters || 0);
  if (!Number.isFinite(value) || value <= 0) return '距离 --';
  return `距离 ${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}km`;
};

const formatDuration = (minutes?: number | null) => {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) return '时长 --';
  return `约 ${Math.round(value)}分钟`;
};

const formatWeight = (kg?: number | null) => {
  const value = Number(kg || 0);
  if (!Number.isFinite(value) || value <= 0) return '--kg';
  return `${Math.round(value)}kg`;
};

function isProviderNotSelfExecutableError(error: any) {
  const message = String(error?.message || error?.response?.data?.message || '');
  return (error?.statusCode === 403 || error?.response?.status === 403) &&
    message.includes('provider_not_self_executable');
}

export default function AssignmentModal({onAccepted}: {onAccepted?: (orderId: number) => void}) {
  const [assignment, setAssignment] = useState<V2ProviderAssignmentView | null>(null);
  const [responding, setResponding] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await providerService.listAssignments(5);
        const items = normalizeProviderItems<V2ProviderAssignmentView>(res)
          .filter(item => item.status === 'pending_accept')
          .sort((a, b) => b.attempt_seq - a.attempt_seq);
        if (!cancelled) {
          setAssignment(items[0] || null);
        }
      } catch {
        // 静默重试。
      }
    };
    pull();
    const timer = setInterval(pull, 3_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = assignment
    ? getRemainingSeconds(assignment.accept_deadline_at, assignment.remaining_seconds)
    : 0;

  useEffect(() => {
    if (assignment && remaining <= 0) {
      setAssignment(null);
    }
  }, [assignment, remaining, tick]);

  const order = assignment?.order || null;
  const visible = Boolean(assignment && remaining > 0);
  const amount = assignment ? getBroadcastAmount(assignment) : 0;
  const metaItems = useMemo(() => {
    if (!assignment) return [];
    return [
      formatBroadcastDistance(assignment.distance_km),
      formatWeight(order?.cargo_weight_kg || assignment.broadcast?.weight_kg),
      formatDuration(order?.estimated_duration_min),
      formatRouteDistance(order?.estimated_distance_m),
    ];
  }, [assignment, order]);

  const accept = useCallback(async () => {
    if (responding || !assignment) return;
    setResponding(true);
    try {
      const res = await providerService.acceptAssignment(assignment.id);
      const orderId = getOrderIdFromPayload(res, assignment.order_id);
      showToast('已接受');
      setAssignment(null);
      if (orderId > 0) {
        onAccepted?.(orderId);
      }
    } catch (error: any) {
      if (error?.statusCode === 409 || error?.response?.status === 409) {
        showToast('指派已失效或超时');
        setAssignment(null);
      } else if (isProviderNotSelfExecutableError(error)) {
        showToast(SELF_EXECUTABLE_REQUIRED_TOAST);
        setAssignment(null);
      } else {
        showToast(friendlyErrorMessage(error, '接受失败'));
      }
    } finally {
      setResponding(false);
    }
  }, [assignment, onAccepted, responding]);

  const decline = useCallback(() => {
    if (responding || !assignment) return;
    Alert.alert('确认拒绝指派', '拒绝后系统会指派给其他服务商', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认拒绝',
        style: 'destructive',
        onPress: async () => {
          setResponding(true);
          try {
            await providerService.declineAssignment(assignment.id, '服务商主动拒绝');
            showToast('已拒绝');
            setAssignment(null);
          } catch (error: unknown) {
            showToast(friendlyErrorMessage(error, '拒绝失败'));
          } finally {
            setResponding(false);
          }
        },
      },
    ]);
  }, [assignment, responding]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => null}>
      <View style={styles.mask}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>平台为你指派了订单 · 第 {assignment?.attempt_seq || 1} 轮</Text>
            <Text style={styles.countdown}>{remaining}s</Text>
          </View>
          <Text style={styles.countdownHint}>请在倒计时结束前确认</Text>
          <View style={styles.routeBox}>
            <Text numberOfLines={1} style={styles.routeText}>{order?.service_address || '起点待确认'}</Text>
            <Text style={styles.routeArrow}>→</Text>
            <Text numberOfLines={1} style={styles.routeText}>{order?.dest_address || '终点待确认'}</Text>
          </View>
          <View style={styles.metaRow}>
            {metaItems.map(item => (
              <Text key={item} style={styles.metaText}>{item}</Text>
            ))}
          </View>
          <Text style={styles.price}>{formatAmountYuan(amount)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.84}
              disabled={responding}
              style={[styles.actionBtn, styles.declineBtn, responding && styles.disabledBtn]}
              onPress={decline}>
              <Text style={styles.declineText}>拒绝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={responding}
              style={[styles.actionBtn, styles.acceptBtn, responding && styles.disabledBtn]}
              onPress={accept}>
              {responding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptText}>接受</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(0,18,48,0.56)',
  },
  card: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#001D54',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#061E4F',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  countdown: {
    color: '#FF4B18',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  countdownHint: {
    marginTop: 6,
    color: '#65728F',
    fontSize: 13,
    lineHeight: 19,
  },
  routeBox: {
    marginTop: 16,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#F4F8FF',
  },
  routeText: {
    color: '#061E4F',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  routeArrow: {
    marginVertical: 4,
    color: '#005BFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaText: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    color: '#4C6090',
    fontSize: 12,
    lineHeight: 16,
    backgroundColor: '#EEF4FF',
  },
  price: {
    marginTop: 14,
    color: '#FF4B18',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#F1F4F8',
  },
  acceptBtn: {
    backgroundColor: '#005BFF',
  },
  disabledBtn: {
    opacity: 0.72,
  },
  declineText: {
    color: '#4C6090',
    fontSize: 15,
    fontWeight: '800',
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
