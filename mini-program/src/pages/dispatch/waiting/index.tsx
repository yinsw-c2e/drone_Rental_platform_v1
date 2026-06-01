import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import { orderV2Service } from '../../../services/orderV2';
import { V2DispatchState, V2OrderDetail } from '../../../types';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import { writeQuickOrderPrefillFromOrder } from '../../../utils/orderPrefill';
import './index.scss';

const POLL_INTERVAL_MS = 5000;
const LONG_WAIT_SECONDS = 120;
const REDISPATCH_PRICE_BUMP_PERCENT = 10;
const REDISPATCH_RADIUS_BUMP_KM = 10;

const normalizedStatus = (order?: Pick<V2OrderDetail, 'status'> | null) =>
  String(order?.status || '').toLowerCase();

const formatSeconds = (value?: number | null) => {
  const seconds = Math.max(0, Math.round(Number(value || 0)));
  if (seconds < 60) return `${seconds} 秒`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min} 分 ${sec} 秒` : `${min} 分钟`;
};

const providerNameOf = (order?: V2OrderDetail | null) => {
  const direct = order?.provider?.nickname || (order?.provider as any)?.name;
  if (direct) return String(direct);
  const id = Number(order?.provider_user_id || order?.participants?.provider?.user_id || 0);
  if (id > 0) return `服务商 ${String(id).slice(-4)}`;
  return '服务商';
};

export default function DispatchWaitingPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [dispatchState, setDispatchState] = useState<V2DispatchState | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [errorText, setErrorText] = useState('');
  const [longWait, setLongWait] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const redirectingRef = useRef(false);

  const elapsedSeconds = useMemo(() => {
    if (dispatchState?.elapsed_seconds !== undefined) {
      return dispatchState.elapsed_seconds;
    }
    if (!detail?.created_at) return 0;
    const createdAt = new Date(detail.created_at).getTime();
    if (Number.isNaN(createdAt)) return 0;
    return Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  }, [detail?.created_at, dispatchState?.elapsed_seconds]);

  const loadState = useCallback(async (showLoading = false) => {
    if (!orderId) {
      setErrorText('缺少订单信息，无法查看匹配进度');
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const [orderDetail, state] = await Promise.all([
        orderV2Service.get(orderId),
        orderV2Service.getDispatchState(orderId),
      ]);
      setDetail(orderDetail);
      setDispatchState(state);
      setErrorText('');
      const status = normalizedStatus(orderDetail);
      if (['assigned', 'preparing', 'in_transit', 'delivered', 'completed'].includes(status) && !redirectingRef.current) {
        redirectingRef.current = true;
        Taro.showToast({ title: '已匹配到服务商', icon: 'success' });
        setTimeout(() => {
          Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
        }, 500);
      }
      if (status !== 'dispatch_failed' && Number(state?.elapsed_seconds || 0) >= LONG_WAIT_SECONDS) {
        setLongWait(true);
      }
    } catch (error: any) {
      setErrorText(friendlyErrorMessage(error, '匹配进度加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadState(true);
    const timer = setInterval(() => loadState(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadState]);

  const switchToNegotiated = () => {
    if (!detail) {
      Taro.showToast({ title: '订单数据未加载', icon: 'none' });
      return;
    }
    try {
      const completeness = writeQuickOrderPrefillFromOrder(detail);
      if (completeness === 'partial') {
        Taro.showToast({ title: '已带入部分订单信息', icon: 'none' });
      }
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '预填失败，请重新填写'), icon: 'none' });
    }
    Taro.navigateTo({ url: '/pages/publish/quick-order/index?fromOrder=1' });
  };

  const redispatchOrder = async (mode: 'price' | 'radius') => {
    if (!detail || actionLoading) return;
    const isPriceMode = mode === 'price';
    const res = await Taro.showModal({
      title: isPriceMode ? '确认加价重发？' : '确认扩大半径？',
      content: isPriceMode
        ? `将在当前价格基础上加价 ${REDISPATCH_PRICE_BUMP_PERCENT}% 并重新匹配服务商。`
        : `将把匹配半径扩大 ${REDISPATCH_RADIUS_BUMP_KM}km 后重新匹配服务商。`,
      cancelText: '再想想',
      confirmText: '确认重发',
    });
    if (!res.confirm) return;
    setActionLoading(true);
    try {
      await orderV2Service.redispatch(
        detail.id,
        isPriceMode ? { price_bump_percent: 0 } : { radius_bump_km: 0 },
      );
      setLongWait(false);
      Taro.showToast({ title: '已重新发起匹配', icon: 'success' });
      await loadState(false);
    } catch (error: any) {
      const code = error?.body?.code || error?.code;
      if (code === 'REDISPATCH_RATE_LIMITED') {
        Taro.showToast({ title: friendlyErrorMessage(error?.body, '操作过于频繁'), icon: 'none' });
        return;
      }
      if (code === 'REDISPATCH_CAPPED') {
        Taro.showModal({
          title: '重发次数已达上限',
          content: '建议取消当前订单后重新下单',
          showCancel: false,
        });
        return;
      }
      Taro.showToast({ title: friendlyErrorMessage(error, '重发失败'), icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  const viewDetail = () => {
    if (!orderId) return;
    Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
  };

  const status = normalizedStatus(detail);
  const failed = status === 'dispatch_failed';
  const onlineCount = Number(dispatchState?.online_providers_count || 0);
  const triedCount = Number(dispatchState?.tried_providers_count || 0);
  const waitSeconds = Number(dispatchState?.estimated_wait_seconds || 0);
  const showMainWaiting = !failed && !longWait && !errorText;

  return (
    <ScrollView scrollY className="dispatch-waiting-page">
      <View className="dispatch-waiting-content">
        <View className="dispatch-waiting-hero">
          <View className="dispatch-spinner" />
          <Text className="dispatch-title">正在为你匹配服务商</Text>
          <Text className="dispatch-subtitle">
            {detail?.order_no ? `订单 ${detail.order_no}` : '订单已创建'}
          </Text>
        </View>

        <View className="dispatch-stats">
          <View className="dispatch-stat">
            <Text className="dispatch-stat-value">{formatSeconds(elapsedSeconds)}</Text>
            <Text className="dispatch-stat-label">已通知</Text>
          </View>
          <View className="dispatch-stat">
            <Text className="dispatch-stat-value">{triedCount}</Text>
            <Text className="dispatch-stat-label">已联系服务商</Text>
          </View>
          <View className="dispatch-stat">
            <Text className="dispatch-stat-value">{onlineCount}</Text>
            <Text className="dispatch-stat-label">当前可接单</Text>
          </View>
        </View>

        {loading && !detail ? (
          <View className="dispatch-panel">
            <Text className="dispatch-panel-title">正在读取进度</Text>
            <Text className="dispatch-panel-copy">请稍候</Text>
          </View>
        ) : null}

        {errorText ? (
          <View className="dispatch-panel dispatch-panel-warning">
            <Text className="dispatch-panel-title">进度暂时不可用</Text>
            <Text className="dispatch-panel-copy">{errorText}</Text>
            <View className="dispatch-action-row">
              <View className="dispatch-button dispatch-button-primary" onClick={() => loadState(true)}>
                <Text>重试</Text>
              </View>
              <View className="dispatch-button dispatch-button-ghost" onClick={viewDetail}>
                <Text>查看订单</Text>
              </View>
            </View>
          </View>
        ) : null}

        {failed ? (
          <View className="dispatch-panel dispatch-panel-danger">
            <Text className="dispatch-panel-title">暂未匹配到合适服务商</Text>
            <Text className="dispatch-panel-copy">
              {detail?.provider_reject_reason || detail?.cancel_reason || '可以加价、扩大半径，或改成议价单让服务商主动报价。'}
            </Text>
            <View className="dispatch-action-row">
              <View className={`dispatch-button dispatch-button-primary ${actionLoading ? 'is-disabled' : ''}`} onClick={() => redispatchOrder('price')}>
                <Text>加价重发</Text>
              </View>
              <View className={`dispatch-button dispatch-button-secondary ${actionLoading ? 'is-disabled' : ''}`} onClick={() => redispatchOrder('radius')}>
                <Text>扩大半径</Text>
              </View>
            </View>
            <View className="dispatch-button dispatch-button-ghost dispatch-button-wide" onClick={switchToNegotiated}>
              <Text>改成议价单</Text>
            </View>
          </View>
        ) : null}

        {longWait && !failed && !errorText ? (
          <View className="dispatch-panel dispatch-panel-warning">
            <Text className="dispatch-panel-title">匹配耗时较长</Text>
            <Text className="dispatch-panel-copy">建议改成议价单，让服务商根据现场情况主动报价。</Text>
            <View className="dispatch-action-row">
              <View className="dispatch-button dispatch-button-primary" onClick={switchToNegotiated}>
                <Text>改成议价单</Text>
              </View>
              <View className="dispatch-button dispatch-button-ghost" onClick={viewDetail}>
                <Text>查看订单</Text>
              </View>
            </View>
          </View>
        ) : null}

        {showMainWaiting ? (
          <View className="dispatch-panel">
            <View className="dispatch-progress-line">
              <View className="dispatch-progress-dot is-active" />
              <View className="dispatch-progress-copy">
                <Text className="dispatch-progress-title">订单已创建</Text>
                <Text className="dispatch-progress-desc">已记录起吊点、落放点和货物重量</Text>
              </View>
            </View>
            <View className="dispatch-progress-line">
              <View className="dispatch-progress-dot is-active" />
              <View className="dispatch-progress-copy">
                <Text className="dispatch-progress-title">正在联系服务商</Text>
                <Text className="dispatch-progress-desc">
                  {onlineCount > 0 ? `当前有 ${onlineCount} 家可接单` : '暂未发现附近在线服务商'}
                </Text>
              </View>
            </View>
            <View className="dispatch-progress-line">
              <View className="dispatch-progress-dot" />
              <View className="dispatch-progress-copy">
                <Text className="dispatch-progress-title">等待服务商确认</Text>
                <Text className="dispatch-progress-desc">
                  {waitSeconds > 0 ? `预计还需 ${formatSeconds(waitSeconds)}` : '有结果后会自动进入订单详情'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {status === 'assigned' ? (
          <View className="dispatch-panel dispatch-panel-success">
            <Text className="dispatch-panel-title">{providerNameOf(detail)}已接单</Text>
            <Text className="dispatch-panel-copy">正在进入订单详情</Text>
          </View>
        ) : null}

        {!failed && !errorText ? (
          <View className="dispatch-bottom-actions">
            <View className="dispatch-button dispatch-button-ghost dispatch-button-wide" onClick={switchToNegotiated}>
              <Text>改成议价单</Text>
            </View>
            <View className="dispatch-link" onClick={viewDetail}>
              <Text>查看订单详情</Text>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
