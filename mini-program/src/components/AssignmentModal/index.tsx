import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useCallback, useEffect, useState } from 'react';
import { providerService } from '../../services/provider';
import { formatAmountYuan } from '../../utils';
import type {
  V2ProviderAssignmentView,
  V2ProviderBroadcastView,
} from '../../types';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import './index.scss';

const SELF_EXECUTABLE_REQUIRED_TOAST = '需要先完善设备和履约资质';

const normalizeProviderItems = <T,>(res: unknown): T[] => {
  const value = res as { items?: T[]; data?: { items?: T[] } } | null;
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
  const broadcastAmount = 'estimated_total_cents' in item ? item.estimated_total_cents : item.broadcast?.estimated_total_cents;
  return Number(broadcastAmount || item.order?.total_amount || 0);
};

const getOrderIdFromPayload = (payload: unknown, fallback: number) => {
  const value = payload as { order?: { id?: number }; data?: { order?: { id?: number } } } | null;
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
  return error?.statusCode === 403 && String(error?.message || '').includes('provider_not_self_executable');
}

export default function AssignmentModal({ onAccepted }: { onAccepted?: (orderId: number) => void }) {
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
    void tick;
    if (assignment && remaining <= 0) {
      setAssignment(null);
    }
  }, [assignment, remaining, tick]);

  const accept = useCallback(async () => {
    if (responding || !assignment) return;
    setResponding(true);
    try {
      const res = await providerService.acceptAssignment(assignment.id);
      const orderId = getOrderIdFromPayload(res, assignment.order_id);
      Taro.showToast({ title: '已接受', icon: 'success' });
      setAssignment(null);
      if (orderId > 0) {
        onAccepted?.(orderId);
      }
    } catch (error: any) {
      if (error?.statusCode === 409 || error?.errno === 409) {
        Taro.showToast({ title: '指派已失效或超时', icon: 'none' });
        setAssignment(null);
      } else if (isProviderNotSelfExecutableError(error)) {
        Taro.showToast({ title: SELF_EXECUTABLE_REQUIRED_TOAST, icon: 'none' });
        setAssignment(null);
      } else {
        Taro.showToast({ title: friendlyErrorMessage(error, '接受失败'), icon: 'none' });
      }
    } finally {
      setResponding(false);
    }
  }, [assignment, onAccepted, responding]);

  const decline = useCallback(async () => {
    if (responding || !assignment) return;
    const res = await Taro.showModal({
      title: '确认拒绝指派',
      content: '拒绝后系统会指派给其他服务商',
      confirmText: '确认拒绝',
      confirmColor: '#dc2626',
    });
    if (!res.confirm) return;
    setResponding(true);
    try {
      await providerService.declineAssignment(assignment.id, '服务商主动拒绝');
      Taro.showToast({ title: '已拒绝', icon: 'none' });
      setAssignment(null);
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '拒绝失败'), icon: 'none' });
    } finally {
      setResponding(false);
    }
  }, [assignment, responding]);

  if (!assignment || remaining <= 0) return null;

  const order = assignment.order;
  return (
    <View className='pw-assign-mask'>
      <View className='pw-assign-card'>
        <View className='pw-assign-title'>
          <Text>平台为你指派了订单 · 第 {assignment.attempt_seq} 轮</Text>
        </View>
        <Text className='pw-assign-countdown'>{remaining}s 内确认</Text>
        <View className='pw-assign-route'>
          <Text className='pw-assign-route-start'>{order?.service_address || '起点待确认'}</Text>
          <Text className='pw-assign-route-arrow'>→</Text>
          <Text className='pw-assign-route-end'>{order?.dest_address || '终点待确认'}</Text>
        </View>
        <View className='pw-assign-meta'>
          <Text>{formatBroadcastDistance(assignment.distance_km)}</Text>
          <Text>{formatWeight(order?.cargo_weight_kg || assignment.broadcast?.weight_kg)}</Text>
          <Text>{formatDuration(order?.estimated_duration_min)}</Text>
          <Text>{formatRouteDistance(order?.estimated_distance_m)}</Text>
        </View>
        <Text className='pw-assign-price'>{formatAmountYuan(getBroadcastAmount(assignment))}</Text>
        <View className='pw-assign-actions'>
          <View className={`pw-assign-decline ${responding ? 'is-loading' : ''}`} onClick={decline}>
            <Text>拒绝</Text>
          </View>
          <View className={`pw-assign-accept ${responding ? 'is-loading' : ''}`} onClick={accept}>
            <Text>{responding ? '处理中…' : '接受'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
