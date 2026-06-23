import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, Input, ScrollView, Text, View } from '@tarojs/components';

import { demandV2Service, DemandUpsertPayload } from '../../../services/demandV2';
import { providerRecommendationService } from '../../../services/providerRecommendation';
import { store } from '../../../store/store';
import {
  AddressData,
  AddressSnapshot,
  ProviderRecommendationSummary,
  QuickOrderDraft,
} from '../../../types';
import { getSupplySceneLabel } from '../../../utils';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
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
import {
  readQuickOrderOfferDraft,
  saveQuickOrderOfferDraft,
} from '../../../utils/quickOrderOfferDraft';
import { switchToOrdersTab } from '../../../utils/ordersEntry';
import './index.scss';

type ProviderPlan = {
  key: string;
  title: string;
  logoUrl?: string;
  logoInitial: string;
  ratingLabel: string;
  orderLabel: string;
  trustLabels: string[];
  distanceLabel: string;
  capacityLabel: string;
  tags: string[];
  item: ProviderRecommendationSummary;
};

const emptyDraft: QuickOrderDraft = {
  cargo_scene: 'power_grid',
  cargo_type: '重载物资',
};

const PROVIDER_CARD_TOP_RPX = 584;
const PROVIDER_CARD_STEP_RPX = 456;

const getStoredQuickOrderDraft = () =>
  readQuickOrderOfferDraft() || emptyDraft;

const normalizeRecommendations = (res: any): ProviderRecommendationSummary[] =>
  (res?.data?.items || res?.items || []) as ProviderRecommendationSummary[];

const formatAddress = (addr?: AddressData | null) =>
  addr?.address || addr?.name || '';

const shortAddress = (addr?: AddressData | null, placeholder = '作业点') =>
  addr?.name || addr?.district || addr?.address || placeholder;

const toAddressSnapshot = (addr: AddressData): AddressSnapshot => ({
  text: formatAddress(addr),
  province: addr.province,
  city: addr.city,
  district: addr.district,
  latitude: addr.latitude,
  longitude: addr.longitude,
});

const formatAddressName = (addr?: AddressData | null, fallback = '-') =>
  addr?.name || addr?.address || fallback;

const formatAddressSub = (addr?: AddressData | null, fallback = '-') => {
  if (!addr) return fallback;
  const mainName = addr.name || '';
  const text = addr.address || '';
  if (mainName && text.includes(mainName)) return text.replace(mainName, '') || text;
  return text || fallback;
};

const parseIsoDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveDraftEndDate = (draft: QuickOrderDraft, startDate: Date) => {
  const endDate = parseIsoDate(draft.scheduled_end_at);
  if (endDate && endDate > startDate) return endDate;
  const fallback = new Date(startDate);
  fallback.setHours(startDate.getHours() + 2, startDate.getMinutes(), 0, 0);
  return fallback;
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

const firstChar = (value: string) => Array.from(value.trim())[0] || '服';

const compactNumber = (value?: number | null, digits = 0) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(digits);
};

const validCoordinate = (lat?: number | null, lng?: number | null) => {
  const nextLat = Number(lat);
  const nextLng = Number(lng);
  return Number.isFinite(nextLat) && Number.isFinite(nextLng) &&
    !(nextLat === 0 && nextLng === 0) &&
    nextLat >= -90 && nextLat <= 90 &&
    nextLng >= -180 && nextLng <= 180;
};

const roundToHundred = (value: number) => Math.round(value / 100) * 100;

const estimateBudgetCents = (weightKg: number) => {
  const safeWeight = Math.max(Number(weightKg || 0), 1);
  const estimated = 36000 + safeWeight * 420;
  const min = Math.max(30000, roundToHundred(estimated * 0.85));
  const max = Math.max(min + 10000, roundToHundred(estimated * 1.2));
  return { min, max };
};

const buildDemandPayload = (draft: QuickOrderDraft): DemandUpsertPayload => {
  if (!draft.departure_address || !draft.destination_address) {
    throw new Error('请先补充起吊点和落放点');
  }
  const startDate = parseIsoDate(draft.scheduled_start_at);
  if (!startDate) {
    throw new Error('请先填写作业时间');
  }
  const weight = Number(draft.cargo_weight_kg || 0);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('请填写有效货物重量');
  }
  const budget = estimateBudgetCents(weight);
  return {
    title: `${shortAddress(draft.departure_address, '起吊点')} → ${shortAddress(draft.destination_address, '落放点')}`,
    service_type: 'heavy_cargo_lift_transport',
    cargo_scene: draft.cargo_scene || 'power_grid',
    description: draft.description || undefined,
    departure_address: toAddressSnapshot(draft.departure_address),
    destination_address: toAddressSnapshot(draft.destination_address),
    service_address: toAddressSnapshot(draft.departure_address),
    scheduled_start_at: startDate.toISOString(),
    scheduled_end_at: resolveDraftEndDate(draft, startDate).toISOString(),
    cargo_weight_kg: weight,
    cargo_volume_m3: draft.cargo_volume_m3,
    cargo_length_cm: draft.cargo_length_cm,
    cargo_width_cm: draft.cargo_width_cm,
    cargo_height_cm: draft.cargo_height_cm,
    cargo_type: draft.cargo_type || '重载物资',
    cargo_special_requirements: draft.special_requirements,
    estimated_trip_count: 1,
    budget_min: budget.min,
    budget_max: budget.max,
    allows_pilot_candidate: false,
  };
};

const formatRating = (item: ProviderRecommendationSummary) => {
  const rating = Number(item.rating || 0);
  const count = Number(item.rating_count || 0);
  if (!Number.isFinite(rating) || rating <= 0 || !Number.isFinite(count) || count <= 0) {
    return '暂无评分';
  }
  return `${rating.toFixed(1)} · ${count}评`;
};

const formatTrustRating = (item: ProviderRecommendationSummary) => {
  const label = formatRating(item);
  return label === '暂无评分' ? label : `评分 ${label}`;
};

const formatCompletedOrders = (item: ProviderRecommendationSummary) => {
  const count = Number(item.completed_orders_30d || 0);
  if (!Number.isFinite(count) || count <= 0) return '0单';
  return `${count}单`;
};

const formatTrustCompletedOrders = (item: ProviderRecommendationSummary) =>
  `30天 ${formatCompletedOrders(item)}`;

const formatStatusLabel = (invited: boolean) =>
  invited ? '已邀请' : '可报价';

const formatStatusClass = (invited: boolean) =>
  invited ? 'is-invited' : '';

const formatDistance = (value?: number | null) => {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance < 0) return '距离待算';
  if (distance < 0.1) return '起吊点附近';
  return `${distance.toFixed(1)}km`;
};

const formatResponse = (seconds?: number | null) => {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return '响应待参考';
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `响应 ${minutes}分`;
  const hours = Math.max(1, Math.round(minutes / 60));
  return `响应 ${hours}小时`;
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

const ACTIVE_INVITATION_STATUSES = new Set(['pending_quote', 'quoted', 'selected']);

const hasActiveInvitation = (status?: string) =>
  ACTIVE_INVITATION_STATUSES.has(String(status || '').trim());

const isProviderInvited = (plan: ProviderPlan, invitedProviderIds: Set<number>) => {
  const providerUserId = Number(plan.item.provider_user_id || 0);
  return invitedProviderIds.has(providerUserId) || hasActiveInvitation(plan.item.invitation_status);
};

const inviteButtonLabel = (plan: ProviderPlan, isInviting: boolean, isInvited: boolean) => {
  if (isInviting) return '邀请中...';
  if (plan.item.invitation_status === 'quoted') return '已报价';
  if (plan.item.invitation_status === 'selected') return '已选定';
  if (isInvited) return '已邀请报价';
  return '邀请报价';
};

const toProviderPlan = (item: ProviderRecommendationSummary): ProviderPlan => {
  const providerName = item.provider_name || `服务商 #${item.provider_user_id}`;
  const payload = compactNumber(item.max_payload_kg, 1);
  const radius = compactNumber(item.service_radius_km, 0);
  const sceneTags = (item.matched_scenes || []).slice(0, 2).map(scene => getSupplySceneLabel(scene));
  const capacityLabel = payload ? `载重 ${payload}kg` : '载重待确认';
  const distanceLabel = formatDistance(item.distance_km);
  const responseLabel = formatResponse(item.average_response_seconds);

  return {
    key: `provider-${item.provider_user_id}`,
    title: providerName,
    logoUrl: item.avatar_url,
    logoInitial: firstChar(providerName),
    ratingLabel: formatRating(item),
    orderLabel: formatCompletedOrders(item),
    trustLabels: [
      formatTrustRating(item),
      formatTrustCompletedOrders(item),
      responseLabel,
    ],
    distanceLabel,
    capacityLabel,
    tags: uniqueTags([
      ...sceneTags,
      radius ? `半径 ${radius}km` : '',
      item.drone_label || '',
      responseLabel,
      item.service_city ? `${item.service_city}服务` : '',
      item.has_previous_cooperation ? '曾合作' : '',
    ]).slice(0, 5),
    item,
  };
};

export default function OfferListPage() {
  const [draft, setDraft] = useState<QuickOrderDraft>(emptyDraft);
  const [keyword, setKeyword] = useState('');
  const [recommendations, setRecommendations] = useState<ProviderRecommendationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [viewingPlan, setViewingPlan] = useState<ProviderPlan | null>(null);
  const [invitingProviderId, setInvitingProviderId] = useState(0);
  const [invitedProviderIds, setInvitedProviderIds] = useState<Set<number>>(() => new Set());

  const fetchRecommendations = useCallback(async (nextDraft: QuickOrderDraft, nextKeyword = '') => {
    const normalizedKeyword = nextKeyword.trim();
    try {
      setLoading(true);
      setFetchError('');
      setActiveKeyword(normalizedKeyword);
      if (!store.getState().auth.accessToken) {
        setRecommendations([]);
        setFetchError('请先登录后查看候选服务商');
        return;
      }
      const originAddress = nextDraft.departure_address || nextDraft.destination_address;
      const hasOriginCoordinate = validCoordinate(originAddress?.latitude, originAddress?.longitude);
      const res = await providerRecommendationService.list({
        page: 1,
        page_size: 10,
        demand_id: Number(nextDraft.demand_id || 0) || undefined,
        cargo_scene: nextDraft.cargo_scene || undefined,
        cargo_weight_kg: nextDraft.cargo_weight_kg,
        origin_latitude: hasOriginCoordinate ? Number(originAddress?.latitude) : undefined,
        origin_longitude: hasOriginCoordinate ? Number(originAddress?.longitude) : undefined,
        keyword: normalizedKeyword || undefined,
      });
      setRecommendations(normalizeRecommendations(res));
    } catch (error) {
      console.warn('候选服务商接口暂不可用', error);
      setRecommendations([]);
      setFetchError(friendlyErrorMessage(error, '候选服务商加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    const nextDraft = getStoredQuickOrderDraft();
    setDraft(nextDraft);
    fetchRecommendations(nextDraft, keyword);
  });

  const plans = useMemo(
    () => recommendations.map(item => toProviderPlan(item)),
    [recommendations],
  );

  const canvasHeight = Math.max(1780, PROVIDER_CARD_TOP_RPX + plans.length * PROVIDER_CARD_STEP_RPX + 220);

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    switchToOrdersTab('customer');
  };

  const handleService = () => Taro.switchTab({ url: '/pages/messages/index' });

  const handleSearch = () => {
    const normalizedKeyword = keyword.trim();
    setKeyword(normalizedKeyword);
    fetchRecommendations(draft, normalizedKeyword);
  };

  const handleViewProvider = (plan: ProviderPlan) => {
    setViewingPlan(plan);
  };

  const handleCloseProvider = () => setViewingPlan(null);

  const ensureDemandId = async (currentDraft: QuickOrderDraft) => {
    const existingDemandId = Number(currentDraft.demand_id || 0);
    if (existingDemandId > 0) return existingDemandId;

    const created = await demandV2Service.create(buildDemandPayload(currentDraft));
    const demandId = Number((created as any)?.id || (created as any)?.data?.id || 0);
    if (!demandId) throw new Error('需求已创建，请稍后在任务列表查看');
    await demandV2Service.publish(demandId);

    const nextDraft = { ...currentDraft, demand_id: demandId };
    saveQuickOrderOfferDraft(nextDraft);
    setDraft(nextDraft);
    return demandId;
  };

  const handleInviteProvider = async (plan: ProviderPlan) => {
    const providerUserId = Number(plan.item.provider_user_id || 0);
    if (!providerUserId || invitingProviderId) return;
    if (isProviderInvited(plan, invitedProviderIds)) {
      Taro.showToast({ title: '已邀请该服务商', icon: 'none' });
      return;
    }
    try {
      setInvitingProviderId(providerUserId);
      Taro.showLoading({ title: draft.demand_id ? '正在发送邀请...' : '正在发布需求...' });
      const demandId = await ensureDemandId(draft);
      await providerRecommendationService.invite(demandId, {
        provider_user_id: providerUserId,
        message: '希望你看一下这单，合适的话请报价',
      });
      setInvitedProviderIds(prev => new Set(prev).add(providerUserId));
      Taro.hideLoading();
      Taro.showToast({ title: '已邀请报价', icon: 'success' });
    } catch (error) {
      Taro.hideLoading();
      Taro.showToast({ title: friendlyErrorMessage(error, '邀请失败，请稍后重试'), icon: 'none' });
    } finally {
      setInvitingProviderId(0);
    }
  };

  const renderProviderModal = () => {
    if (!viewingPlan) return null;
    const plan = viewingPlan;
    const providerUserId = Number(plan.item.provider_user_id || 0);
    const isInvited = isProviderInvited(plan, invitedProviderIds);
    const isInviting = invitingProviderId === providerUserId;
    const inviteDisabled = isInvited || isInviting;
    const intro = plan.item.intro || '该服务商已完成平台资质审核，平台将根据实际报价与履约情况持续更新画像。';
    const reasons = (plan.item.score_reasons || []).slice(0, 4);
    return (
      <View className='qo4-provider-modal'>
        <View className='qo4-provider-mask' onClick={handleCloseProvider} />
        <View className='qo4-provider-sheet'>
          <View className='qo4-provider-sheet-header'>
            {plan.logoUrl ? (
              <Image className='qo4-provider-sheet-logo' src={plan.logoUrl} mode='aspectFill' />
            ) : (
              <View className='qo4-provider-sheet-logo qo4-provider-sheet-avatar'>
                <Text className='qo4-provider-sheet-avatar-text'>{plan.logoInitial}</Text>
              </View>
            )}
            <View className='qo4-provider-sheet-title-block'>
              <Text className='qo4-provider-sheet-title' numberOfLines={1}>{plan.title}</Text>
              <Text className='qo4-provider-sheet-sub' numberOfLines={1}>
                {plan.item.service_city ? `${plan.item.service_city}服务商 · 已通过平台资质` : '已通过平台资质'}
              </Text>
            </View>
            <View className='qo4-provider-sheet-close' onClick={handleCloseProvider}>
              <Text className='qo4-provider-sheet-close-text'>关闭</Text>
            </View>
          </View>

          <ScrollView scrollY className='qo4-provider-sheet-body' enhanced showScrollbar={false}>
            <View className='qo4-provider-stat-grid'>
              <View className='qo4-provider-stat'>
                <Text className='qo4-provider-stat-label'>评分</Text>
                <Text className='qo4-provider-stat-value' numberOfLines={1}>{plan.ratingLabel}</Text>
              </View>
              <View className='qo4-provider-stat'>
                <Text className='qo4-provider-stat-label'>近30天</Text>
                <Text className='qo4-provider-stat-value' numberOfLines={1}>{plan.orderLabel}</Text>
              </View>
              <View className='qo4-provider-stat'>
                <Text className='qo4-provider-stat-label'>距起吊点</Text>
                <Text className='qo4-provider-stat-value' numberOfLines={1}>{plan.distanceLabel}</Text>
              </View>
              <View className='qo4-provider-stat'>
                <Text className='qo4-provider-stat-label'>服务能力</Text>
                <Text className='qo4-provider-stat-value' numberOfLines={1}>{plan.capacityLabel}</Text>
              </View>
            </View>

            <View className='qo4-provider-detail-section'>
              <Text className='qo4-provider-section-title'>服务标签</Text>
              <View className='qo4-provider-detail-tags'>
                {plan.tags.map(tag => (
                  <View className='qo4-provider-detail-tag' key={tag}>
                    <Text className='qo4-provider-detail-tag-text' numberOfLines={1}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className='qo4-provider-detail-section'>
              <Text className='qo4-provider-section-title'>服务商简介</Text>
              <Text className='qo4-provider-intro'>{intro}</Text>
            </View>

            {reasons.length > 0 ? (
              <View className='qo4-provider-detail-section'>
                <Text className='qo4-provider-section-title'>推荐理由</Text>
                {reasons.map(reason => (
                  <View className='qo4-provider-reason' key={reason}>
                    <View className='qo4-provider-reason-dot' />
                    <Text className='qo4-provider-reason-text'>{reason}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View className='qo4-provider-sheet-actions'>
            <View className='qo4-provider-secondary-btn' onClick={handleCloseProvider}>
              <Text className='qo4-provider-secondary-text'>稍后再看</Text>
            </View>
            <View
              className={`qo4-provider-primary-btn ${isInvited ? 'is-invited' : ''} ${isInviting ? 'is-submitting' : ''} ${inviteDisabled ? 'is-disabled' : ''}`}
              onClick={inviteDisabled ? undefined : () => handleInviteProvider(plan)}
            >
              <Text className='qo4-provider-primary-text'>{inviteButtonLabel(plan, isInviting, isInvited)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPlan = (plan: ProviderPlan, index: number) => {
    const providerUserId = Number(plan.item.provider_user_id || 0);
    const isInvited = isProviderInvited(plan, invitedProviderIds);
    const isInviting = invitingProviderId === providerUserId;
    const inviteDisabled = isInvited || isInviting;
    const statusClass = formatStatusClass(isInvited);
    return (
      <View
        key={plan.key}
        className='qo4-plan-card'
        style={{ top: `${PROVIDER_CARD_TOP_RPX + index * PROVIDER_CARD_STEP_RPX}rpx` }}
      >
        {plan.logoUrl ? (
          <Image className='qo4-provider-logo' src={plan.logoUrl} mode='aspectFill' />
        ) : (
          <View className='qo4-provider-logo qo4-provider-avatar'>
            <Text className='qo4-provider-avatar-text'>{plan.logoInitial}</Text>
          </View>
        )}
        <Text className='qo4-provider-title' numberOfLines={1}>{plan.title}</Text>
        <View className={`qo4-status-row ${statusClass}`}>
          <View className='qo4-status-dot' />
          <Text className='qo4-status-text'>{formatStatusLabel(isInvited)}</Text>
        </View>
        <View className='qo4-trust-strip'>
          {plan.trustLabels.map((label, trustIndex) => (
            <Text
              className={`qo4-trust-item qo4-trust-item-${trustIndex + 1}`}
              key={label}
            >
              {label}
            </Text>
          ))}
        </View>
        <View className='qo4-plan-divider' />
        <Image className='qo4-eta-icon' src={clockIcon} mode='aspectFit' />
        <Text className='qo4-eta-label'>距起吊点</Text>
        <Text className='qo4-eta-value' numberOfLines={1}>{plan.distanceLabel}</Text>
        <View className='qo4-vertical-divider' />
        <Text className='qo4-capability-label'>服务能力</Text>
        <Text className='qo4-capability-value' numberOfLines={1}>{plan.capacityLabel}</Text>
        <View className='qo4-tags-row'>
          {plan.tags.map(tag => (
            <View className='qo4-tag' key={tag}>
              <Text className='qo4-tag-text' numberOfLines={1}>{tag}</Text>
            </View>
          ))}
        </View>
        <View className='qo4-action-row'>
          <View className='qo4-detail-btn' onClick={() => handleViewProvider(plan)}>
            <Text className='qo4-detail-btn-text'>查看服务商</Text>
          </View>
          <View
            className={`qo4-select-btn ${isInvited ? 'is-invited' : ''} ${isInviting ? 'is-submitting' : ''} ${inviteDisabled ? 'is-disabled' : ''}`}
            onClick={inviteDisabled ? undefined : () => handleInviteProvider(plan)}
          >
            <Text className='qo4-select-btn-text'>{inviteButtonLabel(plan, isInviting, isInvited)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className='qo4-page'>
      <View className='qo4-blue-bg' />
      <View className='qo4-navbar'>
        <View className='qo4-nav-back' onClick={handleBack}>
          <Image className='qo4-nav-back-icon' src={navBackIcon} mode='aspectFit' />
        </View>
        <Text className='qo4-nav-title'>挑选服务商</Text>
        <View className='qo4-nav-service' onClick={handleService}>
          <Image className='qo4-nav-chat' src={navChatIcon} mode='aspectFit' />
          <Text className='qo4-nav-service-text'>客服</Text>
        </View>
      </View>

      <ScrollView scrollY className='qo4-scroll' enhanced showScrollbar={false}>
        <View className='qo4-canvas' style={{ height: `${canvasHeight}rpx` }}>
          <View className='qo4-summary-card'>
            <View className='qo4-route-left'>
              <Image className='qo4-route-pin' src={locationPinIcon} mode='aspectFit' />
              <Text className='qo4-route-title' numberOfLines={1}>{formatAddressName(draft.departure_address, '待选择起吊点')}</Text>
              <Text className='qo4-route-sub' numberOfLines={1}>{formatAddressSub(draft.departure_address, '--')}</Text>
            </View>
            <Image className='qo4-route-arrow' src={routeArrowIcon} mode='aspectFit' />
            <View className='qo4-route-right'>
              <Image className='qo4-route-pin' src={locationPinIcon} mode='aspectFit' />
              <Text className='qo4-route-title' numberOfLines={1}>{formatAddressName(draft.destination_address, '待选择落放点')}</Text>
              <Text className='qo4-route-sub' numberOfLines={1}>{formatAddressSub(draft.destination_address, '--')}</Text>
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

          <View className='qo4-search-card'>
            <Input
              className='qo4-search-input'
              value={keyword}
              confirmType='search'
              placeholder='搜索服务商名称'
              onInput={event => setKeyword(event.detail.value)}
              onConfirm={handleSearch}
            />
            <View className='qo4-search-btn' onClick={handleSearch}>
              <Text className='qo4-search-btn-text'>搜索</Text>
            </View>
          </View>

          <View className='qo4-list-area'>
            {plans.map(renderPlan)}
            {loading && plans.length === 0 ? (
              <View className='qo4-loading'><Text className='qo4-loading-text'>正在匹配候选服务商...</Text></View>
            ) : null}
            {!loading && fetchError ? (
              <View className='qo4-empty-card'>
                <Text className='qo4-empty-title'>无法加载服务商</Text>
                <Text className='qo4-empty-desc'>{fetchError}</Text>
              </View>
            ) : null}
            {!loading && !fetchError && plans.length === 0 ? (
              <View className='qo4-empty-card'>
                <Text className='qo4-empty-title'>{activeKeyword ? `未找到“${activeKeyword}”` : '暂无匹配服务商'}</Text>
                <Text className='qo4-empty-desc'>
                  {activeKeyword ? '没有匹配到该服务商名称或手机号，请换个关键词再试' : '当前条件下暂无候选服务商，请调整地址、重量或搜索关键词后重试'}
                </Text>
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
        <View className='qo4-tab-item qo4-tab-item-current' onClick={() => switchToOrdersTab('customer')}>
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

      {renderProviderModal()}
    </View>
  );
}
