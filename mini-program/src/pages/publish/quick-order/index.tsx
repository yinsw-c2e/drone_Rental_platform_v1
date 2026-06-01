import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components';

import {
  AirspaceCheckResult,
  airspaceService,
} from '../../../services/airspace';
import { CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES } from '../../../constants/subscribeTemplates';
import { getClientEligibility } from '../../../services/client';
import { demandV2Service, DemandUpsertPayload } from '../../../services/demandV2';
import { requestSubscribe } from '../../../services/push';
import { supplyService } from '../../../services/supply';
import { AddressData, AddressSnapshot, DirectOrderInput, QuickOrderDraft } from '../../../types';
import { isAirspaceHardBlocked } from '../../../utils/airspaceRisk';
import addWorkPointPlusIcon from '../../../assets/haul/quick-order-confirm/icon_add_work_point_plus.png';
import chevronRightIcon from '../../../assets/haul/quick-order-confirm/icon_chevron_right.png';
import detectAirspaceIcon from '../../../assets/haul/quick-order-confirm/icon_detect_airspace.png';
import detectDistancePinIcon from '../../../assets/haul/quick-order-confirm/icon_detect_distance_pin.png';
import detectDurationClockIcon from '../../../assets/haul/quick-order-confirm/icon_detect_duration_clock.png';
import detectPayloadScaleIcon from '../../../assets/haul/quick-order-confirm/icon_detect_payload_scale.png';
import infoCircleIcon from '../../../assets/haul/quick-order-confirm/icon_info_circle.png';
import navBackIcon from '../../../assets/haul/quick-order-confirm/icon_nav_back.png';
import navChatIcon from '../../../assets/haul/quick-order-confirm/icon_nav_chat.png';
import radioSelectedIcon from '../../../assets/haul/quick-order-confirm/icon_radio_selected.png';
import radioUnselectedIcon from '../../../assets/haul/quick-order-confirm/icon_radio_unselected.png';
import routeEndPinIcon from '../../../assets/haul/quick-order-confirm/icon_route_end_pin.png';
import routeStartPinIcon from '../../../assets/haul/quick-order-confirm/icon_route_start_pin.png';
import sectionDetectionShieldIcon from '../../../assets/haul/quick-order-confirm/icon_section_detection_shield.png';
import sectionLocationPinIcon from '../../../assets/haul/quick-order-confirm/icon_section_location_pin.png';
import sectionPlanClipboardIcon from '../../../assets/haul/quick-order-confirm/icon_section_plan_clipboard.png';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const SCENE_OPTIONS = [
  { key: 'power_grid', label: '电网建设' },
  { key: 'mountain_agriculture', label: '山区农副产品' },
  { key: 'plateau_supply', label: '高原给养' },
  { key: 'island_supply', label: '海岛补给' },
  { key: 'emergency', label: '应急救援' },
];

const QUICK_ORDER_PREFILL_STORAGE_KEY = 'customer_home_quick_order_prefill_v1';
const QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY = 'quick_order_offer_draft_v1';

type ServicePlanKey = 'standard' | 'urgent' | 'survey';
type AddressTarget = 'pickup' | 'delivery' | 'extra';

type HomeQuickOrderPrefill = {
  pickupAddress?: AddressData;
  deliveryAddress?: AddressData;
  cargoWeight?: string;
  timeOption?: '尽快' | '今天' | '明天' | '预约';
  scheduledStartAt?: string;
  city?: string;
};

const QUICK_ORDER_ADDRESS_TARGET_STORAGE_KEY = 'quick_order_address_target';

const servicePlans: Array<{
  key: ServicePlanKey;
  title: string;
  subtitle: string;
  price: string;
  detail: string;
  prefix?: string;
  suffix?: string;
  recommended?: boolean;
}> = [
  {
    key: 'standard',
    title: '标准吊运',
    subtitle: '服务商确认后生效',
    price: '服务商报价',
    detail: '适合作业条件清楚、时间不紧的常规吊运。服务商会按作业点、载重、距离和现场条件报价。',
    recommended: true,
  },
  {
    key: 'urgent',
    title: '加急吊运',
    subtitle: '优先匹配服务商',
    price: '服务商报价',
    detail: '适合当天或短时间内必须处理的任务。预算区间会按加急场景估算，平台优先推给在线服务商。',
  },
  {
    key: 'survey',
    title: '现场勘查',
    subtitle: '勘查费用可抵扣服务费',
    price: '提交后确认',
    detail: '适合路线、停机点或货物状态还需要确认的场景。先约服务商看现场，后续成单时勘查费用可抵扣。',
  },
];

const planHints: Record<ServicePlanKey, string> = {
  standard: '标准吊运按平台估价区间报价，适合正常匹配。',
  urgent: '加急吊运按约 25% 加急溢价估算，平台会优先推给在线服务商。',
  survey: '现场勘查适合需要先看现场的场景，勘查费用可抵扣后续服务费。',
};

const branchExamples: Record<'quote' | 'pick', string[]> = {
  quote: [
    '家里盖房子要吊建材，不确定行情价。',
    '农田要吊喷洒物资，想多家服务商比比。',
    '山路点位不确定，希望服务商先判断路线。',
  ],
  pick: [
    '之前合作过某个服务商，想继续找对方。',
    '需要特定机型，已经问过服务商有空。',
    '工期很紧，只想找熟悉现场的人议价。',
  ],
};

const cargoWeightOptions = [
  { label: '50kg以下', value: '50' },
  { label: '50-100kg', value: '80' },
  { label: '100-300kg', value: '200' },
  { label: '300kg以上', value: '300' },
];

const roundToHundred = (value: number) => Math.round(value / 100) * 100;

const estimateBudgetCents = (plan: ServicePlanKey, weightKg: number, routeDistanceKm: number) => {
  const safeWeight = Math.max(Number(weightKg || 0), 1);
  const safeDistance = Math.max(Number(routeDistanceKm || 0), 1);
  if (plan === 'survey') {
    const surveyBase = 18000 + Math.min(safeDistance, 30) * 300;
    return {
      min: roundToHundred(surveyBase * 0.9),
      max: roundToHundred(surveyBase * 1.15),
    };
  }

  const base = 36000 + safeWeight * 420 + safeDistance * 1600;
  const multiplier = plan === 'urgent' ? 1.25 : 1;
  const estimated = base * multiplier;
  const min = Math.max(30000, roundToHundred(estimated * 0.85));
  const max = Math.max(min + 10000, roundToHundred(estimated * 1.2));
  return { min, max };
};

const buildDefaultTime = (hourOffset = 0) => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(hourOffset ? 11 : 9).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:00`;
};

const formatDateTime = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${mi}`;
};

const buildScheduleFromHomeOption = (option?: HomeQuickOrderPrefill['timeOption']) => {
  const start = new Date();
  if (option === '尽快') {
    start.setHours(start.getHours() + 2, 0, 0, 0);
  } else if (option === '今天') {
    start.setHours(Math.max(start.getHours() + 2, 9), 0, 0, 0);
    if (start.getHours() >= 18) {
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0);
    }
  } else {
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start);
  end.setHours(start.getHours() + 2, 0, 0, 0);
  return {
    startTime: formatDateTime(start),
    endTime: formatDateTime(end),
  };
};

const buildScheduleFromHomeDraft = (draft: HomeQuickOrderPrefill) => {
  if (draft.scheduledStartAt) {
    const start = new Date(draft.scheduledStartAt);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setHours(start.getHours() + 2, 0, 0, 0);
      return {
        startTime: formatDateTime(start),
        endTime: formatDateTime(end),
      };
    }
  }
  return buildScheduleFromHomeOption(draft.timeOption);
};

const parseDateInput = (value: string) => {
  const date = new Date(value.trim().replace(/-/g, '/'));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAddress = (addr?: AddressData | null) =>
  addr?.address || addr?.name || '';

const compactAddress = (addr?: AddressData | null, placeholder = '请选择作业地点') =>
  formatAddress(addr) || placeholder;

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

const buildDirectOrderPayload = (draft: QuickOrderDraft): DirectOrderInput => {
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

  return {
    service_type: 'heavy_cargo_lift_transport',
    cargo_scene: draft.cargo_scene || 'power_grid',
    departure_address: toAddressSnapshot(draft.departure_address),
    destination_address: toAddressSnapshot(draft.destination_address),
    service_address: null,
    scheduled_start_at: startDate.toISOString(),
    scheduled_end_at: resolveDraftEndDate(draft, startDate).toISOString(),
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

const buildDemandPayload = (
  draft: QuickOrderDraft,
  selectedPlan: ServicePlanKey,
  routeDistance: number,
): DemandUpsertPayload => {
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
  const budget = estimateBudgetCents(selectedPlan, weight, routeDistance);
  const routeNote = routeDistance > 0 ? `预计距离：${routeDistance.toFixed(1)}km。` : '';
  const extraDescription = [draft.description, routeNote].filter(Boolean).join('\n');

  return {
    title: `${shortAddress(draft.departure_address, '起吊点')} → ${shortAddress(draft.destination_address, '落放点')}`,
    service_type: 'heavy_cargo_lift_transport',
    cargo_scene: draft.cargo_scene,
    description: extraDescription || undefined,
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
    allows_pilot_candidate: true,
  };
};

const normalizeSelectedAddress = (value: unknown): AddressData | null => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    const item = parsed as AddressData;
    if (!item.latitude || !item.longitude || !(item.address || item.name)) return null;
    return item;
  } catch {
    return null;
  }
};

const getStoredAddressTarget = (): AddressTarget | null => {
  try {
    const target = Taro.getStorageSync(QUICK_ORDER_ADDRESS_TARGET_STORAGE_KEY);
    return target === 'pickup' || target === 'delivery' || target === 'extra'
      ? target
      : null;
  } catch {
    return null;
  }
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceKm = (from?: AddressData | null, to?: AddressData | null) => {
  if (!from?.latitude || !from?.longitude || !to?.latitude || !to?.longitude) {
    return 0;
  }
  const earthRadius = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const payloadLevel = (weightValue: string) => {
  const weight = Number(weightValue || 0);
  if (!weight || weight <= 50) return '50kg';
  if (weight <= 100) return '100kg';
  if (weight <= 300) return '300kg';
  return '300kg+';
};

const planTitle = (key: ServicePlanKey) =>
  servicePlans.find(item => item.key === key)?.title || '标准吊运';

const resolveMatchRegion = (pickup?: AddressData | null, delivery?: AddressData | null) =>
  delivery?.city ||
  pickup?.city ||
  delivery?.district ||
  pickup?.district ||
  delivery?.address ||
  pickup?.address ||
  '';

export default function QuickOrderPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const directSupplyId = Number(params.supplyId || params.id || 0);
  const [cargoScene, setCargoScene] = useState(SCENE_OPTIONS[0].key);
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoType, setCargoType] = useState('重载物资');
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(null);
  const [extraWorkPoint, setExtraWorkPoint] = useState<AddressData | null>(null);
  const [startTime, setStartTime] = useState(buildDefaultTime(0));
  const [endTime, setEndTime] = useState(buildDefaultTime(2));
  const [pickupAirspace, setPickupAirspace] = useState<AirspaceCheckResult | null>(null);
  const [deliveryAirspace, setDeliveryAirspace] = useState<AirspaceCheckResult | null>(null);
  const [pickupAirspaceError, setPickupAirspaceError] = useState('');
  const [deliveryAirspaceError, setDeliveryAirspaceError] = useState('');
  const [checkingPickup, setCheckingPickup] = useState(false);
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlanKey>('standard');
  const [submitting, setSubmitting] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<'quote' | 'pick'>('quote');
  const [expandedBranchExample, setExpandedBranchExample] = useState<'quote' | 'pick' | null>(null);
  const [planInfo, setPlanInfo] = useState<typeof servicePlans[number] | null>(null);
  const pendingAddressTargetRef = useRef<AddressTarget | null>(null);

  const clearAddressSelection = useCallback(() => {
    pendingAddressTargetRef.current = null;
    Taro.removeStorageSync(QUICK_ORDER_ADDRESS_TARGET_STORAGE_KEY);
    Taro.removeStorageSync('selectedAddress');
  }, []);

  const applySelectedAddress = useCallback((target: AddressTarget, address: AddressData) => {
    if (target === 'pickup') {
      setPickupAddress(address);
    } else if (target === 'delivery') {
      setDeliveryAddress(address);
    } else {
      setExtraWorkPoint(address);
      Taro.showToast({ title: '已添加作业点', icon: 'success' });
    }
  }, []);

  const consumeStoredAddress = useCallback(() => {
    const target = pendingAddressTargetRef.current || getStoredAddressTarget();
    if (!target) return;
    const address = normalizeSelectedAddress(Taro.getStorageSync('selectedAddress'));
    if (!address) return;
    applySelectedAddress(target, address);
    clearAddressSelection();
  }, [applySelectedAddress, clearAddressSelection]);

  useDidShow(() => {
    consumeStoredAddress();
  });

  useEffect(() => {
    const handler = (address: AddressData) => {
      const target = pendingAddressTargetRef.current || getStoredAddressTarget();
      if (!target) return;
      applySelectedAddress(target, address);
      clearAddressSelection();
    };
    Taro.eventCenter.on('addressSelected', handler);
    return () => {
      Taro.eventCenter.off('addressSelected', handler);
    };
  }, [applySelectedAddress, clearAddressSelection]);

  useEffect(() => {
    try {
      const draft = Taro.getStorageSync(QUICK_ORDER_PREFILL_STORAGE_KEY) as HomeQuickOrderPrefill | '';
      if (!draft || typeof draft !== 'object') return;
      if (draft.pickupAddress) setPickupAddress(draft.pickupAddress);
      if (draft.deliveryAddress) setDeliveryAddress(draft.deliveryAddress);
      if (draft.cargoWeight) setCargoWeight(String(draft.cargoWeight));
      const schedule = buildScheduleFromHomeDraft(draft);
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      Taro.removeStorageSync(QUICK_ORDER_PREFILL_STORAGE_KEY);
    } catch {
      Taro.removeStorageSync(QUICK_ORDER_PREFILL_STORAGE_KEY);
    }
    try {
      const hint = String(Taro.getStorageSync('customer_order_redispatch_hint_v1') || '');
      if (hint) {
        Taro.removeStorageSync('customer_order_redispatch_hint_v1');
        Taro.showToast({
          title: hint === 'full'
            ? '已带入原订单的地点、重量和时间，可继续完善作业说明'
            : '已带入原订单的重量和时间，请补全起吊/落放点',
          icon: 'none',
          duration: 3000,
        });
      }
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!pickupAddress?.latitude || !pickupAddress?.longitude) {
      setPickupAirspace(null);
      setPickupAirspaceError('');
      return () => {
        cancelled = true;
      };
    }
    setCheckingPickup(true);
    setPickupAirspaceError('');
    airspaceService.checkAirspaceAvailability(pickupAddress.latitude, pickupAddress.longitude, 120)
      .then((result) => {
        if (!cancelled) {
          setPickupAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPickupAirspace(null);
          setPickupAirspaceError('空域检测失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingPickup(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pickupAddress?.latitude, pickupAddress?.longitude]);

  useEffect(() => {
    let cancelled = false;
    if (!deliveryAddress?.latitude || !deliveryAddress?.longitude) {
      setDeliveryAirspace(null);
      setDeliveryAirspaceError('');
      return () => {
        cancelled = true;
      };
    }
    setCheckingDelivery(true);
    setDeliveryAirspaceError('');
    airspaceService.checkAirspaceAvailability(deliveryAddress.latitude, deliveryAddress.longitude, 120)
      .then((result) => {
        if (!cancelled) {
          setDeliveryAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryAirspace(null);
          setDeliveryAirspaceError('空域检测失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingDelivery(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryAddress?.latitude, deliveryAddress?.longitude]);

  const routeDistance = useMemo(
    () => distanceKm(pickupAddress, deliveryAddress),
    [pickupAddress, deliveryAddress],
  );
  const hasAirspaceHardBlock =
    isAirspaceHardBlocked(pickupAirspace) || isAirspaceHardBlocked(deliveryAirspace);
  const hasAirspaceCheckError =
    Boolean(pickupAddress && pickupAirspaceError) || Boolean(deliveryAddress && deliveryAirspaceError);

  const airspaceStatus = useMemo(() => {
    if (checkingPickup || checkingDelivery) return { label: '检测中', tone: 'checking' };
    if (hasAirspaceCheckError) return { label: '重试', tone: 'warning' };
    if (hasAirspaceHardBlock) return { label: '受限', tone: 'danger' };
    if (pickupAddress && deliveryAddress) return { label: '可飞', tone: 'ok' };
    return { label: '待检测', tone: 'pending' };
  }, [checkingDelivery, checkingPickup, deliveryAddress, hasAirspaceCheckError, hasAirspaceHardBlock, pickupAddress]);

  const durationMinutes = routeDistance > 0
    ? Math.max(30, Math.round(25 + routeDistance * 2.3))
    : 45;
  const distanceLabel = routeDistance > 0 ? `${routeDistance.toFixed(1)} km` : '--';
  const durationLabel = `约 ${durationMinutes} 分钟`;
  const selectedPlanHint = planHints[selectedPlan];

  const handleChooseLocation = (type: AddressTarget) => {
    pendingAddressTargetRef.current = type;
    Taro.setStorageSync(QUICK_ORDER_ADDRESS_TARGET_STORAGE_KEY, type);
    Taro.navigateTo({ url: '/pages/address/index' });
  };

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  };

  const handleEditLocation = async () => {
    const res = await Taro.showActionSheet({ itemList: ['修改起吊点', '修改落放点'] }).catch(() => null);
    if (!res || typeof res.tapIndex !== 'number') return;
    handleChooseLocation(res.tapIndex === 0 ? 'pickup' : 'delivery');
  };

  const showEligibilityBlocker = async (
    fallbackMessage: string,
    suggestedAction?: string,
  ) => {
    if (suggestedAction === 'verify_identity') {
      const res = await Taro.showModal({
        title: '请先完成实名认证',
        content: fallbackMessage || '完成实名认证后即可继续。',
        confirmText: '去认证',
      }).catch(() => null);
      if (res?.confirm) {
        Taro.navigateTo({ url: '/pages/verification/index' });
      }
      return;
    }
    Taro.showToast({ title: fallbackMessage || '当前暂不可提交', icon: 'none' });
  };

  const ensureClientEligible = async (action: 'publish' | 'direct') => {
    const eligibility = await getClientEligibility();
    const allowed = action === 'publish'
      ? eligibility.can_publish_demand
      : eligibility.can_create_direct_order;
    if (allowed) return true;

    const blocker = eligibility.blockers?.[0];
    await showEligibilityBlocker(blocker?.message || eligibility.summary || '当前账号暂不可提交', blocker?.suggested_action);
    return false;
  };

  const createDirectOrder = async (draft: QuickOrderDraft, supplyId: number) => {
    const eligible = await ensureClientEligible('direct');
    if (!eligible) return;

    const confirm = await Taro.showModal({
      title: '确认下单',
      content: '将按当前吊运信息向该服务商创建订单。',
      confirmText: '确认下单',
      cancelText: '再修改',
    }).catch(() => null);
    if (!confirm?.confirm) return;

    Taro.showLoading({ title: '正在创建订单...' });
    try {
      const result = await supplyService.createDirectOrder(supplyId, buildDirectOrderPayload(draft));
      const orderId = Number((result as any)?.order_id || (result as any)?.order?.id || (result as any)?.id || 0);
      if (!orderId) throw new Error('订单已创建，请稍后在订单列表查看');
      Taro.removeStorageSync(QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY);
      Taro.hideLoading();
      Taro.showToast({ title: '订单已创建', icon: 'success' });
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
      }, 500);
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: friendlyErrorMessage(error, '创建订单失败'), icon: 'none' });
    }
  };

  const publishDemand = async (draft: QuickOrderDraft) => {
    const eligible = await ensureClientEligible('publish');
    if (!eligible) return;

    Taro.showLoading({ title: '正在发布需求...' });
    try {
      const created = await demandV2Service.create(buildDemandPayload(draft, selectedPlan, routeDistance));
      const demandId = Number((created as any)?.id || (created as any)?.data?.id || 0);
      if (!demandId) throw new Error('需求已创建，请稍后在需求列表查看');
      await demandV2Service.publish(demandId);
      Taro.hideLoading();
      Taro.showToast({ title: '需求已发布', icon: 'success' });
      try { Taro.setStorageSync('customer_orders_default_segment', 'demands'); } catch {}
      setTimeout(() => {
        Taro.redirectTo({ url: `/pages/demand/detail/index?id=${demandId}` });
      }, 500);
    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ title: friendlyErrorMessage(error, '发布失败'), icon: 'none' });
    }
  };

  const continueToSupplyList = (draft: QuickOrderDraft) => {
    Taro.setStorageSync(QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY, draft);
    Taro.navigateTo({ url: '/pages/supply/list/index?quickOrder=1' });
  };

  const chooseCargoWeight = async () => {
    const res = await Taro.showActionSheet({
      itemList: cargoWeightOptions.map(item => item.label),
    }).catch(() => null);
    if (!res || typeof res.tapIndex !== 'number') return false;
    const selected = cargoWeightOptions[res.tapIndex];
    if (!selected) return false;
    setCargoWeight(selected.value);
    return true;
  };

  const handleSubmit = async () => {
    if (submitting || hasAirspaceHardBlock) return;
    if (!pickupAddress || !deliveryAddress || !startTime || !endTime) {
      return Taro.showToast({ title: '请先完善作业地点和重量', icon: 'none' });
    }
    if (!cargoWeight) {
      const selected = await chooseCargoWeight();
      if (selected) {
        Taro.showToast({ title: '已选择重量，请再次提交', icon: 'none' });
      }
      return;
    }
    if (Number(cargoWeight) <= 0) {
      return Taro.showToast({ title: '请填写有效货物重量', icon: 'none' });
    }
    if (!taskDescription.trim()) {
      return Taro.showToast({ title: '请填写作业说明，让服务商知道你要做什么', icon: 'none' });
    }
    if (checkingPickup || checkingDelivery) {
      return Taro.showToast({ title: '空域检测中，请稍候', icon: 'none' });
    }
    if (hasAirspaceCheckError) {
      return Taro.showToast({ title: '空域检测失败，请重新选择地点', icon: 'none' });
    }
    if (hasAirspaceHardBlock) {
      return Taro.showToast({ title: '地址命中禁飞区，请先更换地址', icon: 'none' });
    }
    const startDate = parseDateInput(startTime);
    const endDate = parseDateInput(endTime);
    if (!startDate || !endDate || endDate <= startDate) {
      return Taro.showToast({ title: '请填写正确作业时间', icon: 'none' });
    }
    await requestSubscribe(CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES);
    setSubmitting(true);
    try {
      const weightKG = Number(cargoWeight);
      const draft: QuickOrderDraft = {
        cargo_scene: cargoScene,
        cargo_type: cargoType.trim() || '重载物资',
        cargo_weight_kg: weightKG,
        departure_address: pickupAddress,
        destination_address: deliveryAddress,
        scheduled_start_at: startDate.toISOString(),
        scheduled_end_at: endDate.toISOString(),
        description: taskDescription.trim(),
        special_requirements: `服务方案：${planTitle(selectedPlan)}${extraWorkPoint ? `；途经作业点：${formatAddress(extraWorkPoint)}` : ''}`,
        match_region: resolveMatchRegion(pickupAddress, deliveryAddress),
      };

      if (directSupplyId > 0) {
        await createDirectOrder(draft, directSupplyId);
        return;
      }

      if (selectedBranch === 'pick') {
        continueToSupplyList(draft);
        return;
      }
      await publishDemand(draft);
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '进入方案列表失败'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderPlan = (plan: typeof servicePlans[number], index: number) => {
    const active = selectedPlan === plan.key;
    return (
      <View
        key={plan.key}
        className={`qo3-plan-row qo3-plan-row-${index + 1}`}
        onClick={() => setSelectedPlan(plan.key)}
      >
        <Image className='qo3-plan-radio' src={active ? radioSelectedIcon : radioUnselectedIcon} mode='aspectFit' />
        <Text className='qo3-plan-title'>{plan.title}</Text>
        <View
          className='qo3-plan-info-button'
          onClick={(event) => {
            event.stopPropagation?.();
            setPlanInfo(plan);
          }}
        >
          <Image className='qo3-plan-info-icon' src={infoCircleIcon} mode='aspectFit' />
        </View>
        {plan.recommended ? (
          <View className='qo3-recommend-badge'>
            <Text className='qo3-recommend-text'>推荐</Text>
          </View>
        ) : null}
        <Text className='qo3-plan-subtitle'>{plan.subtitle}</Text>
        <View className='qo3-price'>
          {plan.prefix ? <Text className='qo3-price-prefix'>{plan.prefix}</Text> : null}
          <Text className='qo3-price-main'>{plan.price}</Text>
          {plan.suffix ? <Text className='qo3-price-suffix'>{plan.suffix}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <View className='qo3-page'>
      <View className='qo3-blue-bg' />
      <View className='qo3-navbar'>
        <View className='qo3-nav-back' onClick={handleBack}>
          <Image className='qo3-nav-back-icon' src={navBackIcon} mode='aspectFit' />
        </View>
        <Text className='qo3-nav-title'>确认吊运信息</Text>
        <View className='qo3-nav-service' onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}>
          <Image className='qo3-nav-chat' src={navChatIcon} mode='aspectFit' />
          <Text className='qo3-nav-service-text'>客服</Text>
        </View>
      </View>

      <ScrollView scrollY className='qo3-scroll'>
        <View className='qo3-canvas'>
          {directSupplyId > 0 ? null : (
            <View className='qo3-hero-tip'>
              <Text className='qo3-hero-tip-title'>发布吊运任务</Text>
              <Text className='qo3-hero-tip-desc'>
                价格没把握、要先看现场、想多家比价的任务都在这里发。先选一种方式：
              </Text>
            </View>
          )}

          {directSupplyId > 0 ? null : (
            <View className='qo3-card qo3-branch-card'>
              <View
                className={`qo3-branch-option ${selectedBranch === 'quote' ? 'is-active' : ''}`}
                onClick={() => setSelectedBranch('quote')}
              >
                <View className='qo3-branch-header'>
                  <Text className='qo3-branch-emoji'>📣</Text>
                  <Text className='qo3-branch-title'>让多家服务商报价</Text>
                  {selectedBranch === 'quote' ? <Text className='qo3-branch-tag'>已选</Text> : null}
                </View>
                <Text className='qo3-branch-desc'>发布需求，等几家服务商上门报价，再挑一家。适合想比价或不确定价格的任务。</Text>
                <Text
                  className='qo3-branch-examples-toggle'
                  onClick={(event) => {
                    event.stopPropagation?.();
                    setExpandedBranchExample(expandedBranchExample === 'quote' ? null : 'quote');
                  }}
                >
                  {expandedBranchExample === 'quote' ? '收起例子' : '看几个例子'}
                </Text>
                {expandedBranchExample === 'quote' ? (
                  <View className='qo3-branch-examples'>
                    {branchExamples.quote.map((item) => (
                      <Text key={item} className='qo3-branch-example'>• {item}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
              <View
                className={`qo3-branch-option ${selectedBranch === 'pick' ? 'is-active' : ''}`}
                onClick={() => setSelectedBranch('pick')}
              >
                <View className='qo3-branch-header'>
                  <Text className='qo3-branch-emoji'>🎯</Text>
                  <Text className='qo3-branch-title'>指定一家服务商议价</Text>
                  {selectedBranch === 'pick' ? <Text className='qo3-branch-tag'>已选</Text> : null}
                </View>
                <Text className='qo3-branch-desc'>从服务商列表里挑一家直接下单议价。适合已经有合作对象或想要特定机型的任务。</Text>
                <Text
                  className='qo3-branch-examples-toggle'
                  onClick={(event) => {
                    event.stopPropagation?.();
                    setExpandedBranchExample(expandedBranchExample === 'pick' ? null : 'pick');
                  }}
                >
                  {expandedBranchExample === 'pick' ? '收起例子' : '看几个例子'}
                </Text>
                {expandedBranchExample === 'pick' ? (
                  <View className='qo3-branch-examples'>
                    {branchExamples.pick.map((item) => (
                      <Text key={item} className='qo3-branch-example'>• {item}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <View className='qo3-card qo3-location-card'>
            <View className='qo3-section-head qo3-location-head'>
              <Image className='qo3-section-location-icon' src={sectionLocationPinIcon} mode='aspectFit' />
              <Text className='qo3-section-title'>作业地点</Text>
              <Text className='qo3-edit-link' onClick={handleEditLocation}>编辑</Text>
            </View>
            <View className='qo3-location-box'>
              <Image className='qo3-route-pin qo3-route-start' src={routeStartPinIcon} mode='aspectFit' />
              <View className='qo3-route-dash' />
              <Image className='qo3-route-pin qo3-route-end' src={routeEndPinIcon} mode='aspectFit' />

              <View className='qo3-location-row qo3-location-start' onClick={() => handleChooseLocation('pickup')}>
                <Text className='qo3-location-label'>起吊点</Text>
                <Text className={`qo3-location-address ${pickupAddress ? '' : 'is-placeholder'}`}>
                  {compactAddress(pickupAddress, '请选择货物起吊位置')}
                </Text>
                <Image className='qo3-chevron qo3-chevron-start' src={chevronRightIcon} mode='aspectFit' />
              </View>
              <View className='qo3-location-divider qo3-location-divider-1' />
              <View className='qo3-location-row qo3-location-end' onClick={() => handleChooseLocation('delivery')}>
                <Text className='qo3-location-label'>落放点</Text>
                <Text className={`qo3-location-address ${deliveryAddress ? '' : 'is-placeholder'}`}>
                  {compactAddress(deliveryAddress, '请选择货物落放位置')}
                </Text>
                <Image className='qo3-chevron qo3-chevron-end' src={chevronRightIcon} mode='aspectFit' />
              </View>
              <View className='qo3-location-divider qo3-location-divider-2' />
              <View className='qo3-add-point' onClick={() => handleChooseLocation('extra')}>
                <Image className='qo3-add-icon' src={addWorkPointPlusIcon} mode='aspectFit' />
                <Text className='qo3-add-text'>{extraWorkPoint ? '已添加作业点' : '添加作业点'}</Text>
              </View>
            </View>
          </View>

          <View className='qo3-card qo3-detect-card'>
            <View className='qo3-section-head qo3-detect-head'>
              <Image className='qo3-section-detect-icon' src={sectionDetectionShieldIcon} mode='aspectFit' />
              <Text className='qo3-section-title'>智能检测结果</Text>
            </View>
            <View className='qo3-detect-grid'>
              <View className='qo3-grid-vline' />
              <View className='qo3-grid-hline' />
              <View className='qo3-detect-cell qo3-detect-airspace'>
                <Image className='qo3-detect-icon qo3-airspace-icon' src={detectAirspaceIcon} mode='aspectFit' />
                <Text className='qo3-detect-title'>空域检测</Text>
                <View className={`qo3-status-badge ${airspaceStatus.tone}`}>
                  <Text className={`qo3-status-text ${airspaceStatus.tone}`}>{airspaceStatus.label}</Text>
                </View>
              </View>
              <View className='qo3-detect-cell qo3-detect-payload' onClick={chooseCargoWeight}>
                <Image className='qo3-detect-icon qo3-payload-icon' src={detectPayloadScaleIcon} mode='aspectFit' />
                <Text className='qo3-detect-title'>载重匹配</Text>
                <Text className='qo3-detect-desc'>
                  {cargoWeight ? `预计需 ${payloadLevel(cargoWeight)} 级服务` : '点击选择重量'}
                </Text>
              </View>
              <View className='qo3-detect-cell qo3-detect-distance'>
                <Image className='qo3-detect-icon qo3-distance-icon' src={detectDistancePinIcon} mode='aspectFit' />
                <Text className='qo3-detect-title'>预计距离</Text>
                <Text className='qo3-detect-value'>{distanceLabel}</Text>
              </View>
              <View className='qo3-detect-cell qo3-detect-duration'>
                <Image className='qo3-detect-icon qo3-duration-icon' src={detectDurationClockIcon} mode='aspectFit' />
                <Text className='qo3-detect-title'>预计作业时长</Text>
                <Text className='qo3-detect-value'>{durationLabel}</Text>
              </View>
            </View>
            <View className='qo3-cost-note'>
              <Image className='qo3-info-icon' src={infoCircleIcon} mode='aspectFit' />
              <Text className='qo3-cost-text'>最终费用以服务商确认方案为准</Text>
            </View>
          </View>

          <View className='qo3-card qo3-scene-card'>
            <Picker
              mode='selector'
              range={SCENE_OPTIONS.map(item => item.label)}
              value={Math.max(0, SCENE_OPTIONS.findIndex(item => item.key === cargoScene))}
              onChange={(event: any) => {
                const idx = Number(event.detail.value);
                if (!Number.isNaN(idx) && SCENE_OPTIONS[idx]) setCargoScene(SCENE_OPTIONS[idx].key);
              }}
            >
              <View className='qo3-scene-row'>
                <View className='qo3-scene-text'>
                  <Text className='qo3-scene-label'>场景类型</Text>
                  <Text className='qo3-scene-sub'>影响服务商匹配和定价</Text>
                </View>
                <View className='qo3-scene-pick'>
                  <Text className='qo3-scene-value'>
                    {SCENE_OPTIONS.find(item => item.key === cargoScene)?.label || SCENE_OPTIONS[0].label}
                  </Text>
                  <Image className='qo3-scene-chevron' src={chevronRightIcon} mode='aspectFit' />
                </View>
              </View>
            </Picker>
          </View>

          <View className='qo3-card qo3-desc-card'>
            <View className='qo3-desc-head'>
              <Text className='qo3-desc-label'>作业说明</Text>
              <Text className='qo3-desc-sub'>必填 · 服务商靠这段文字判断要不要接、怎么报</Text>
            </View>
            <Textarea
              className='qo3-desc-input'
              value={taskDescription}
              maxlength={500}
              autoHeight
              placeholder={'例如：建材吊上 5 楼楼顶，物料堆在小区门口，现场需要先看一下停机位。\n或：3 趟，每趟 60kg 农药桶送到山头 3 个点，要求当天完成。'}
              onInput={(event: any) => setTaskDescription(String(event.detail.value || ''))}
            />
          </View>

          <View className='qo3-card qo3-plan-card'>
            <View className='qo3-section-head qo3-plan-head'>
              <Image className='qo3-section-plan-icon' src={sectionPlanClipboardIcon} mode='aspectFit' />
              <Text className='qo3-section-title'>选择服务方案</Text>
            </View>
              <View className='qo3-plan-list'>
                <View className='qo3-plan-line qo3-plan-line-1' />
                <View className='qo3-plan-line qo3-plan-line-2' />
                {servicePlans.map(renderPlan)}
              </View>
              <Text className='qo3-plan-hint'>{selectedPlanHint}</Text>
            </View>
          </View>
        </ScrollView>

      <View className='qo3-bottom-bar'>
        <View className='qo3-back-button' onClick={handleBack}>
          <Text className='qo3-back-button-text'>返回修改</Text>
        </View>
        <View className={`qo3-submit-button ${(submitting || hasAirspaceHardBlock) ? 'disabled' : ''}`} onClick={handleSubmit}>
          <Text className='qo3-submit-button-text'>
            {submitting
              ? '提交中...'
              : directSupplyId > 0
                ? '确认下单'
                : selectedBranch === 'pick'
                  ? '去挑选服务商'
                  : '发布需求等报价'}
          </Text>
        </View>
      </View>

      {planInfo ? (
        <View className='qo3-plan-modal-mask' onClick={() => setPlanInfo(null)}>
          <View className='qo3-plan-modal' onClick={(event) => event.stopPropagation?.()}>
            <View className='qo3-plan-modal-head'>
              <Text className='qo3-plan-modal-title'>{planInfo.title}</Text>
              <Text className='qo3-plan-modal-close' onClick={() => setPlanInfo(null)}>×</Text>
            </View>
            <Text className='qo3-plan-modal-desc'>{planInfo.detail}</Text>
            <Text className='qo3-plan-modal-note'>{planHints[planInfo.key]}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
