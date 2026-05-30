import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';

import { CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES } from '../../../constants/subscribeTemplates';
import { requestSubscribe } from '../../../services/push';
import { supplyService } from '../../../services/supply';
import { store } from '../../../store/store';
import { AddressData, AddressSnapshot, DirectOrderInput, QuickOrderDraft, SupplySummary } from '../../../types';
import { getSupplySceneLabel } from '../../../utils';
import navBackIcon from '../../../assets/haul/offer-list/icon_nav_back.png';
import navChatIcon from '../../../assets/haul/offer-list/icon_nav_chat.png';
import clockIcon from '../../../assets/haul/offer-list/icon_clock.png';
import locationPinIcon from '../../../assets/haul/offer-list/icon_location_pin.png';
import routeArrowIcon from '../../../assets/haul/offer-list/icon_route_arrow_right.png';
import tabHomeInactiveIcon from '../../../assets/haul/offer-list/tab_home_inactive.png';
import tabMessageInactiveIcon from '../../../assets/haul/offer-list/tab_message_inactive.png';
import tabOrderActiveIcon from '../../../assets/haul/offer-list/tab_order_active.png';
import tabProfileInactiveIcon from '../../../assets/haul/offer-list/tab_profile_inactive.png';
import weightIcon from '../../../assets/haul/offer-list/icon_weight_m.png';
import './index.scss';

const QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY = 'quick_order_offer_draft_v1';

type OfferPlan = {
  key: string;
  title: string;
  logoUrl?: string;
  logoInitial: string;
  statusLabel: string;
  capacityLabel: string;
  ownerName: string;
  etaTitle: string;
  etaLabel: string;
  priceYuan: number | null;
  tags: string[];
  supply: SupplySummary;
};

const emptyDraft: QuickOrderDraft = {
  cargo_scene: 'power_grid',
  cargo_type: '重载物资',
};

const parseStoredDraft = (value: unknown): QuickOrderDraft | null => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as QuickOrderDraft;
  } catch {
    return null;
  }
};

const getStoredQuickOrderDraft = () =>
  parseStoredDraft(Taro.getStorageSync(QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY)) || emptyDraft;

const normalizeSupplies = (res: any): SupplySummary[] =>
  (res?.data?.items || res?.items || []) as SupplySummary[];

const formatAddressName = (addr?: AddressData | null, fallback = '-') =>
  addr?.name || addr?.address || fallback;

const formatAddressSub = (addr?: AddressData | null, fallback = '-') => {
  if (!addr) return fallback;
  const mainName = addr.name || '';
  const text = addr.address || '';
  if (mainName && text.includes(mainName)) return text.replace(mainName, '') || text;
  return text || fallback;
};

const formatWorkTime = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const prefix = date.toDateString() === now.toDateString()
    ? '今天'
    : date.toDateString() === tomorrow.toDateString()
      ? '明天'
      : `${date.getMonth() + 1}-${date.getDate()}`;
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${prefix} ${hour}:${minute} 前`;
};

const supplyPriceYuan = (item: SupplySummary) => {
  const amount = Number(item.base_price_amount || 0);
  if (amount > 0) return Math.round(amount / 100);
  return null;
};

const firstChar = (value: string) => Array.from(value.trim())[0] || '服';

const compactKg = (value?: number | null) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(1);
};

const validCoordinate = (lat?: number | null, lng?: number | null) => {
  const nextLat = Number(lat);
  const nextLng = Number(lng);
  return Number.isFinite(nextLat) && Number.isFinite(nextLng) &&
    !(nextLat === 0 && nextLng === 0) &&
    nextLat >= -90 && nextLat <= 90 &&
    nextLng >= -180 && nextLng <= 180;
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const supplyDistanceFromDraft = (draft: QuickOrderDraft, item: SupplySummary) => {
  const start = draft.departure_address || draft.destination_address;
  const drone = item.drone;
  if (!start || !drone || !validCoordinate(start.latitude, start.longitude) || !validCoordinate(drone.latitude, drone.longitude)) {
    return null;
  }
  return haversineKm(Number(start.latitude), Number(start.longitude), Number(drone.latitude), Number(drone.longitude));
};

const supplyCoverageTag = (distanceKm: number | null, rangeKm: number) => {
  if (!distanceKm || !Number.isFinite(rangeKm) || rangeKm <= 0) return '';
  return distanceKm <= rangeKm ? '可覆盖' : '超半径';
};

const formatAverageResponse = (seconds?: number | null, samples?: number | null) => {
  const value = Number(seconds || 0);
  const sampleCount = Number(samples || 0);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(sampleCount) || sampleCount <= 0) return '';
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `平均响应 ${minutes}分`;
  const hours = Math.max(1, Math.round(minutes / 60));
  if (hours < 24) return `平均响应 ${hours}小时`;
  return `平均响应 ${Math.round(hours / 24)}天`;
};

const ratingLabel = (item: SupplySummary) => {
  const rating = Number(item.stats?.rating || 0);
  const count = Number(item.stats?.rating_count || 0);
  if (!Number.isFinite(rating) || rating <= 0 || !Number.isFinite(count) || count <= 0) return '';
  return `评分 ${rating.toFixed(1)}`;
};

const completedOrderLabel = (item: SupplySummary) => {
  const count = Number(item.stats?.completed_order_count || 0);
  if (!Number.isFinite(count) || count <= 0) return '';
  return `完成 ${count}单`;
};

const supplyRangeKm = (item: SupplySummary) => {
  const values = [item.max_range_km, item.drone?.max_distance]
    .map(value => Number(value || 0))
    .filter(value => Number.isFinite(value) && value > 0);
  if (!values.length) return 0;
  return Math.min(...values);
};

const estimateArrivalMinutes = (distanceKm: number | null, item: SupplySummary, rangeKm: number) => {
  const maxDistance = Number(item.drone?.max_distance || item.max_range_km || 0);
  const maxFlightTime = Number(item.drone?.max_flight_time || 0);
  if (!distanceKm || !Number.isFinite(maxDistance) || !Number.isFinite(maxFlightTime) || maxDistance <= 0 || maxFlightTime <= 0) {
    return null;
  }
  if (Number.isFinite(rangeKm) && rangeKm > 0 && distanceKm > rangeKm) {
    return null;
  }
  return Math.max(1, Math.ceil((distanceKm / maxDistance) * maxFlightTime));
};

const uniqueTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const text = tag.trim();
    if (!text || seen.has(text)) return false;
    seen.add(text);
    return true;
  });
};

const toOfferPlan = (item: SupplySummary, draft: QuickOrderDraft): OfferPlan => {
  const ownerName = item.owner?.nickname || '认证服务商';
  const title = item.title || item.supply_no || `${ownerName}方案`;
  const droneLabel = [item.drone?.brand, item.drone?.model].filter(Boolean).join(' ') || '机型待补';
  const payload = compactKg(item.drone?.max_payload_kg || item.max_payload_kg);
  const sceneTags = (item.cargo_scenes || []).slice(0, 2).map(scene => getSupplySceneLabel(scene));
  const rangeKm = supplyRangeKm(item);
  const city = item.drone?.city || item.service_area_snapshot?.city || item.service_area_snapshot?.region || '';
  const distanceKm = supplyDistanceFromDraft(draft, item);
  const arrivalMinutes = estimateArrivalMinutes(distanceKm, item, rangeKm);
  const ratingText = ratingLabel(item);
  const completedText = completedOrderLabel(item);

  return {
    key: `supply-${item.id}`,
    title,
    logoUrl: item.owner?.avatar_url,
    logoInitial: firstChar(ownerName || title),
    statusLabel: ratingText || (item.status === 'active' ? '可下单' : '待确认'),
    capacityLabel: completedText || (payload ? `载重 ${payload}kg` : '载重待补'),
    ownerName,
    etaTitle: arrivalMinutes ? '预估到场' : '无人机',
    etaLabel: arrivalMinutes ? `约${arrivalMinutes}分钟` : droneLabel,
    priceYuan: supplyPriceYuan(item),
    tags: uniqueTags([
      ...sceneTags.slice(0, 1),
      arrivalMinutes ? droneLabel : '',
      completedText ? (payload ? `载重 ${payload}kg` : '') : '',
      formatAverageResponse(item.stats?.average_response_seconds, item.stats?.response_sample_count),
      distanceKm ? `距起吊点 ${distanceKm.toFixed(1)}km` : '',
      supplyCoverageTag(distanceKm, rangeKm),
      city ? `${city}服务` : '',
      rangeKm > 0 ? `半径 ${rangeKm.toFixed(0)}km` : '',
      item.accepts_direct_order ? '支持直达下单' : '需先沟通',
    ]).slice(0, 5),
    supply: item,
  };
};

const toAddressSnapshot = (address: AddressData): AddressSnapshot => ({
  text: address.address || address.name || '',
  province: address.province,
  city: address.city,
  district: address.district,
  latitude: address.latitude,
  longitude: address.longitude,
});

const parseDraftDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveEndDate = (draft: QuickOrderDraft, startDate: Date) => {
  const explicitEnd = parseDraftDate(draft.scheduled_end_at);
  if (explicitEnd && explicitEnd > startDate) return explicitEnd;
  const fallbackEnd = new Date(startDate);
  fallbackEnd.setHours(startDate.getHours() + 2, startDate.getMinutes(), 0, 0);
  return fallbackEnd;
};

const buildDirectOrderPayload = (draft: QuickOrderDraft, supply: SupplySummary): DirectOrderInput => {
  if (!draft.departure_address || !draft.destination_address) {
    throw new Error('请先返回补充起吊点和落放点');
  }
  const weight = Number(draft.cargo_weight_kg || 0);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('请先返回填写有效货物重量');
  }
  if (Number(supply.max_payload_kg || 0) > 0 && weight > Number(supply.max_payload_kg)) {
    throw new Error('所选服务最大吊重不足，请选择其他方案');
  }
  const startDate = parseDraftDate(draft.scheduled_start_at);
  if (!startDate) {
    throw new Error('请先返回填写作业时间');
  }
  const endDate = resolveEndDate(draft, startDate);

  return {
    service_type: 'heavy_cargo_lift_transport',
    cargo_scene: draft.cargo_scene || supply.cargo_scenes?.[0] || 'power_grid',
    departure_address: toAddressSnapshot(draft.departure_address),
    destination_address: toAddressSnapshot(draft.destination_address),
    service_address: null,
    scheduled_start_at: startDate.toISOString(),
    scheduled_end_at: endDate.toISOString(),
    cargo_weight_kg: weight,
    cargo_volume_m3: draft.cargo_volume_m3,
    cargo_length_cm: draft.cargo_length_cm,
    cargo_width_cm: draft.cargo_width_cm,
    cargo_height_cm: draft.cargo_height_cm,
    cargo_type: draft.cargo_type || '重载物资',
    cargo_special_requirements: draft.special_requirements,
    description: draft.description,
  };
};

export default function OfferListPage() {
  const [draft, setDraft] = useState<QuickOrderDraft>(emptyDraft);
  const [supplies, setSupplies] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [submittingKey, setSubmittingKey] = useState('');

  const fetchSupplies = useCallback(async (nextDraft: QuickOrderDraft) => {
    try {
      setLoading(true);
      setFetchError('');
      if (!store.getState().auth.accessToken) {
        setSupplies([]);
        setFetchError('请先登录后查看真实服务商方案');
        return;
      }
      const res = await supplyService.list({
        page: 1,
        page_size: 10,
        region: nextDraft.match_region || nextDraft.destination_address?.city || nextDraft.departure_address?.city,
        cargo_scene: nextDraft.cargo_scene || undefined,
        min_payload_kg: nextDraft.cargo_weight_kg,
        accepts_direct_order: true,
        service_type: 'heavy_cargo_lift_transport',
      });
      setSupplies(normalizeSupplies(res));
    } catch (error) {
      console.warn('服务商方案接口暂不可用', error);
      setSupplies([]);
      setFetchError('服务商方案加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    const nextDraft = getStoredQuickOrderDraft();
    setDraft(nextDraft);
    fetchSupplies(nextDraft);
  });

  const plans = useMemo(() => supplies.slice(0, 3).map(item => toOfferPlan(item, draft)), [supplies, draft]);

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/orders/index' });
  };

  const handleService = () => Taro.switchTab({ url: '/pages/messages/index' });

  const handleSelectPlan = async (plan: OfferPlan) => {
    if (submittingKey) return;
    if (!store.getState().auth.accessToken) {
      Taro.showToast({ title: '请先登录后下单', icon: 'none' });
      return;
    }
    if (plan.supply.status !== 'active' || !plan.supply.accepts_direct_order) {
      Taro.showToast({ title: '该服务当前不可直达下单', icon: 'none' });
      return;
    }
    let payload: DirectOrderInput;
    try {
      payload = buildDirectOrderPayload(draft, plan.supply);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '下单信息不完整', icon: 'none' });
      return;
    }
    await requestSubscribe(CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES);

    const confirm = await Taro.showModal({
      title: '确认下单',
      content: `确认选择「${plan.title}」并创建真实吊运订单？`,
      confirmText: '确认下单',
      cancelText: '再看看',
    }).catch(() => null);
    if (!confirm?.confirm) return;

    setSubmittingKey(plan.key);
    Taro.showLoading({ title: '正在创建订单...' });
    try {
      const res = await supplyService.createDirectOrder(plan.supply.id, payload);
      const result = (res as any)?.data || res;
      const orderId = Number(result?.order_id || result?.order?.id || result?.id || 0);
      if (!orderId) throw new Error('订单创建成功但未返回订单ID');
      Taro.removeStorageSync(QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY);
      Taro.hideLoading();
      Taro.showToast({ title: '订单已创建', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
      }, 500);
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: error?.message || '创建订单失败', icon: 'none' });
    } finally {
      setSubmittingKey('');
    }
  };

  const renderPlan = (plan: OfferPlan, index: number) => (
    <View key={plan.key} className={`qo4-plan-card qo4-plan-card-${index + 1}`}>
      {plan.logoUrl ? (
        <Image className='qo4-provider-logo' src={plan.logoUrl} mode='aspectFill' />
      ) : (
        <View className='qo4-provider-logo qo4-provider-avatar'>
          <Text className='qo4-provider-avatar-text'>{plan.logoInitial}</Text>
        </View>
      )}
      <Text className='qo4-provider-title'>{plan.title}</Text>
      <View className='qo4-rating-row'>
        <View className='qo4-status-dot' />
        <Text className='qo4-rating-text'>{plan.statusLabel}</Text>
        <View className='qo4-rating-divider' />
        <Text className='qo4-order-count'>{plan.capacityLabel}</Text>
      </View>
      <View className='qo4-plan-divider' />
      <Image className='qo4-eta-icon' src={clockIcon} mode='aspectFit' />
      <Text className='qo4-eta-label'>{plan.etaTitle}</Text>
      <Text className='qo4-eta-value'>{plan.etaLabel}</Text>
      <View className='qo4-vertical-divider' />
      <Text className='qo4-price-label'>报价</Text>
      {plan.priceYuan !== null ? (
        <>
          <Text className='qo4-price-unit'>￥</Text>
          <Text className='qo4-price-value'>{plan.priceYuan}</Text>
        </>
      ) : (
        <Text className='qo4-price-pending'>待确认</Text>
      )}
      <View className='qo4-tags-row'>
        {plan.tags.map(tag => (
          <View className='qo4-tag' key={tag}>
            <Text className='qo4-tag-text'>{tag}</Text>
          </View>
        ))}
      </View>
      <View className={`qo4-select-btn ${submittingKey === plan.key ? 'is-submitting' : ''}`} onClick={() => handleSelectPlan(plan)}>
        <Text className='qo4-select-btn-text'>{submittingKey === plan.key ? '创建订单中...' : '选择此方案'}</Text>
      </View>
    </View>
  );

  return (
    <View className='qo4-page'>
      <View className='qo4-blue-bg' />
      <View className='qo4-navbar'>
        <View className='qo4-nav-back' onClick={handleBack}>
          <Image className='qo4-nav-back-icon' src={navBackIcon} mode='aspectFit' />
        </View>
        <Text className='qo4-nav-title'>服务商方案</Text>
        <View className='qo4-nav-service' onClick={handleService}>
          <Image className='qo4-nav-chat' src={navChatIcon} mode='aspectFit' />
          <Text className='qo4-nav-service-text'>客服</Text>
        </View>
      </View>

      <ScrollView scrollY className='qo4-scroll' enhanced showScrollbar={false}>
        <View className='qo4-canvas'>
          <View className='qo4-summary-card'>
            <View className='qo4-route-left'>
              <Image className='qo4-route-pin' src={locationPinIcon} mode='aspectFit' />
              <Text className='qo4-route-title'>{formatAddressName(draft.departure_address, '待选择起吊点')}</Text>
              <Text className='qo4-route-sub'>{formatAddressSub(draft.departure_address, '--')}</Text>
            </View>
            <Image className='qo4-route-arrow' src={routeArrowIcon} mode='aspectFit' />
            <View className='qo4-route-right'>
              <Image className='qo4-route-pin' src={locationPinIcon} mode='aspectFit' />
              <Text className='qo4-route-title'>{formatAddressName(draft.destination_address, '待选择落放点')}</Text>
              <Text className='qo4-route-sub'>{formatAddressSub(draft.destination_address, '--')}</Text>
            </View>
            <View className='qo4-summary-divider' />
            <View className='qo4-weight-block'>
              <Image className='qo4-weight-icon' src={weightIcon} mode='aspectFit' />
              <Text className='qo4-summary-label'>货物重量</Text>
              <Text className='qo4-weight-value'>{draft.cargo_weight_kg ? `${draft.cargo_weight_kg} kg` : '--'}</Text>
            </View>
            <View className='qo4-summary-vline' />
            <View className='qo4-time-block'>
              <Image className='qo4-time-icon' src={clockIcon} mode='aspectFit' />
              <Text className='qo4-summary-label'>作业时间</Text>
              <Text className='qo4-time-value'>{formatWorkTime(draft.scheduled_start_at)}</Text>
            </View>
          </View>

          <View className='qo4-list-area'>
            {plans.map(renderPlan)}
            {loading ? (
              <View className='qo4-loading'><Text className='qo4-loading-text'>正在匹配服务商方案...</Text></View>
            ) : null}
            {!loading && fetchError ? (
              <View className='qo4-empty-card'>
                <Text className='qo4-empty-title'>无法加载真实方案</Text>
                <Text className='qo4-empty-desc'>{fetchError}</Text>
              </View>
            ) : null}
            {!loading && !fetchError && plans.length === 0 ? (
              <View className='qo4-empty-card'>
                <Text className='qo4-empty-title'>暂无匹配服务商</Text>
                <Text className='qo4-empty-desc'>当前条件下没有后端返回的真实可下单服务，请调整地址、重量或时间后重试。</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View className='qo4-tabbar'>
        <View className='qo4-tab-item' onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
          <Image className='qo4-tab-icon qo4-tab-home-icon' src={tabHomeInactiveIcon} mode='aspectFit' />
          <Text className='qo4-tab-text'>首页</Text>
        </View>
        <View className='qo4-tab-item qo4-tab-item-current' onClick={() => Taro.switchTab({ url: '/pages/orders/index' })}>
          <Image className='qo4-tab-icon qo4-tab-order-icon' src={tabOrderActiveIcon} mode='aspectFit' />
          <Text className='qo4-tab-text qo4-tab-text-current'>订单</Text>
        </View>
        <View className='qo4-tab-item' onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}>
          <Image className='qo4-tab-icon qo4-tab-message-icon' src={tabMessageInactiveIcon} mode='aspectFit' />
          <Text className='qo4-tab-text'>消息</Text>
        </View>
        <View className='qo4-tab-item' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
          <Image className='qo4-tab-icon qo4-tab-profile-icon' src={tabProfileInactiveIcon} mode='aspectFit' />
          <Text className='qo4-tab-text'>我的</Text>
        </View>
      </View>
    </View>
  );
}
