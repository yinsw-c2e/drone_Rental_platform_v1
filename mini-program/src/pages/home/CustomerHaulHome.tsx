import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { syncCustomTabBar } from '../../utils/tabBar';
import { addressHistoryService } from '../../services/addressHistory';
import { addressService } from '../../services/address';
import { orderV2Service } from '../../services/orderV2';
import {
  AddressData,
  V2EstimateOrderPayload,
  V2OrderSummary,
  V2PricingEstimate,
  V2ServiceClass,
} from '../../types';
import './CustomerHaulHome.scss';

type AddressTarget = 'pickup' | 'dropoff';
type TimeMode = 'now' | 'reservation';

const ADDRESS_TARGET_STORAGE_KEY = 'customer_home_address_target';
const QUICK_ORDER_PREFILL_STORAGE_KEY = 'customer_home_quick_order_prefill_v1';
const CITY_STORAGE_KEY = 'customer_home_city';
const CITY_OPTIONS = ['深圳', '广州', '东莞', '惠州', '佛山', '珠海'];
const SCHEDULE_TIME_OPTIONS = ['09:00', '10:30', '14:00', '16:00', '18:00'];

const formatMoney = (cents?: number | null) => {
  if (!cents || cents <= 0) return '--';
  return `¥${Math.round(cents / 100).toLocaleString('zh-CN')}`;
};

const formatAddressTitle = (address?: AddressData | null) =>
  String(address?.name || address?.address || '').trim();

const formatAddressDetail = (address?: AddressData | null) => {
  if (!address) return '';
  const title = formatAddressTitle(address);
  const detail = String(address.address || '').trim();
  if (detail && detail !== title) return detail;
  return [address.district, address.city].filter(Boolean).join('') || '已保存地址';
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

const normalizeAddressResponse = (response: unknown): AddressData[] => {
  const data = response as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const dedupeAddresses = (items: AddressData[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item || !(item.address || item.name)) return false;
    const key = [
      item.name || '',
      item.address || '',
      Number(item.latitude || 0).toFixed(6),
      Number(item.longitude || 0).toFixed(6),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getStoredAddressTarget = (): AddressTarget | null => {
  try {
    const target = Taro.getStorageSync(ADDRESS_TARGET_STORAGE_KEY);
    return target === 'pickup' || target === 'dropoff' ? target : null;
  } catch {
    return null;
  }
};

const padDatePart = (value: number) => String(value).padStart(2, '0');

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const formatScheduleLabel = (date: Date) =>
  `${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const buildDefaultScheduleParts = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return {
    date: formatDateKey(date),
    time: '09:00',
  };
};

const getScheduleDateOptions = () => {
  const today = new Date();
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    const prefix = index === 0 ? '今天' : index === 1 ? '明天' : weekday;
    return {
      value: formatDateKey(date),
      label: `${prefix} ${padDatePart(date.getMonth() + 1)}/${padDatePart(date.getDate())}`,
    };
  });
};

const parseScheduleDateTime = (dateValue: string, timeValue: string) => {
  const [hour = '09', minute = '00'] = timeValue.split(':');
  const date = new Date(`${dateValue.replace(/-/g, '/')} 00:00:00`);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
};

const buildServiceClassPayloadRange = (item: V2ServiceClass) => {
  const min = Math.round(item.payload_min_kg || 0);
  const max = Math.round(item.payload_max_kg || 0);
  if (max > 0) return `${min}-${max}kg`;
  return `${min}kg以上`;
};

const getDefaultWeight = (item?: V2ServiceClass | null) => {
  if (!item) return '50';
  const min = Number(item.payload_min_kg || 50);
  const max = Number(item.payload_max_kg || 0);
  if (max > 0) return String(Math.round(Math.min(max, Math.max(min, (min + max) / 2))));
  return String(Math.round(min));
};

const getRecentOrderRoute = (order?: V2OrderSummary | null) => {
  if (!order) return '暂无吊运记录';
  const start = String(order.service_address || '').trim();
  const end = String(order.dest_address || '').trim();
  if (start && end) return `${start} → ${end}`;
  return order.title || order.order_no || '最近一次吊运';
};

const getRecentOrderStatus = (order?: V2OrderSummary | null) => {
  if (!order) return '暂无';
  const status = String(order.status || '').toLowerCase();
  const statusMap: Record<string, string> = {
    pending_dispatch: '等待服务商接单',
    auto_assigning: '正在匹配服务商',
    assigned: '服务商已接单',
    preparing: '准备起飞',
    in_transit: '飞行中',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
  };
  return statusMap[status] || '进行中';
};

const getOrderListItems = (response: unknown): V2OrderSummary[] => {
  const data = response as any;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
};

export default function CustomerHaulHome() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const initialSchedule = useMemo(() => buildDefaultScheduleParts(), []);
  const [pickup, setPickup] = useState<AddressData | null>(null);
  const [dropoff, setDropoff] = useState<AddressData | null>(null);
  const [city, setCity] = useState('深圳');
  const [commonAddresses, setCommonAddresses] = useState<AddressData[]>([]);
  const [recentOrder, setRecentOrder] = useState<V2OrderSummary | null>(null);
  const [serviceClasses, setServiceClasses] = useState<V2ServiceClass[]>([]);
  const [selectedClassCode, setSelectedClassCode] = useState('');
  const [cargoWeight, setCargoWeight] = useState('50');
  const [timeMode, setTimeMode] = useState<TimeMode>('now');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledLabel, setScheduledLabel] = useState('');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [pendingScheduleDate, setPendingScheduleDate] = useState(initialSchedule.date);
  const [pendingScheduleTime, setPendingScheduleTime] = useState(initialSchedule.time);
  const [estimate, setEstimate] = useState<V2PricingEstimate | null>(null);
  const [estimateError, setEstimateError] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [creating, setCreating] = useState(false);
  const pendingAddressTargetRef = useRef<AddressTarget | null>(null);
  const estimateSeqRef = useRef(0);

  const selectedClass = useMemo(
    () => serviceClasses.find(item => item.code === selectedClassCode) || serviceClasses[0] || null,
    [selectedClassCode, serviceClasses],
  );

  const clearAddressSelection = useCallback(() => {
    pendingAddressTargetRef.current = null;
    Taro.removeStorageSync(ADDRESS_TARGET_STORAGE_KEY);
    Taro.removeStorageSync('selectedAddress');
  }, []);

  const applySelectedAddress = useCallback((target: AddressTarget, address: AddressData) => {
    if (target === 'pickup') {
      setPickup(address);
    } else {
      setDropoff(address);
    }
    if (address.city) {
      setCity(address.city);
      Taro.setStorageSync(CITY_STORAGE_KEY, address.city);
    }
    addressHistoryService.addAddressHistory(address).catch(() => null);
  }, []);

  const consumeStoredAddress = useCallback(() => {
    const target = pendingAddressTargetRef.current || getStoredAddressTarget();
    if (!target) return;
    const address = normalizeSelectedAddress(Taro.getStorageSync('selectedAddress'));
    if (!address) return;
    applySelectedAddress(target, address);
    clearAddressSelection();
  }, [applySelectedAddress, clearAddressSelection]);

  const refreshCommonAddresses = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const savedAddresses = await addressService.list().then(normalizeAddressResponse);
        setCommonAddresses(dedupeAddresses(savedAddresses).slice(0, 3));
        return;
      } catch {
        // 云端地址簿失败时保留本地最近地址作为降级。
      }
    }
    const localHistory = await addressHistoryService.loadAddressHistory().catch(() => []);
    setCommonAddresses(dedupeAddresses(localHistory).slice(0, 3));
  }, [isAuthenticated]);

  const refreshRecentOrder = useCallback(async () => {
    if (!isAuthenticated) {
      setRecentOrder(null);
      return;
    }
    try {
      const response = await orderV2Service.list({ role: 'client', page: 1, page_size: 1 });
      setRecentOrder(getOrderListItems(response)[0] || null);
    } catch {
      setRecentOrder(null);
    }
  }, [isAuthenticated]);

  const refreshServiceClasses = useCallback(async () => {
    try {
      const items = await orderV2Service.listServiceClasses();
      const list = Array.isArray(items) ? items : [];
      setServiceClasses(list);
      if (list.length > 0) {
        setSelectedClassCode(prev => prev || list[0].code);
        setCargoWeight(prev => prev || getDefaultWeight(list[0]));
      }
    } catch {
      setServiceClasses([]);
      setEstimateError('机型档加载失败，请稍后重试');
    }
  }, []);

  const refreshHomeData = useCallback(() => {
    const storedCity = Taro.getStorageSync(CITY_STORAGE_KEY);
    if (storedCity) setCity(String(storedCity));
    consumeStoredAddress();
    refreshCommonAddresses();
    refreshRecentOrder();
    refreshServiceClasses();
  }, [consumeStoredAddress, refreshCommonAddresses, refreshRecentOrder, refreshServiceClasses]);

  useDidShow(() => {
    syncCustomTabBar(0);
    refreshHomeData();
  });

  useEffect(() => {
    const handler = (address: AddressData) => {
      const target = pendingAddressTargetRef.current || getStoredAddressTarget();
      if (!target) return;
      applySelectedAddress(target, address);
      clearAddressSelection();
      refreshCommonAddresses();
    };
    Taro.eventCenter.on('addressSelected', handler);
    return () => {
      Taro.eventCenter.off('addressSelected', handler);
    };
  }, [applySelectedAddress, clearAddressSelection, refreshCommonAddresses]);

  const openAddressPicker = (target: AddressTarget) => {
    pendingAddressTargetRef.current = target;
    Taro.setStorageSync(ADDRESS_TARGET_STORAGE_KEY, target);
    Taro.navigateTo({ url: '/pages/address/index' });
  };

  const chooseCity = async () => {
    const res = await Taro.showActionSheet({ itemList: CITY_OPTIONS }).catch(() => null);
    if (!res || typeof res.tapIndex !== 'number') return;
    const nextCity = CITY_OPTIONS[res.tapIndex] || city;
    setCity(nextCity);
    Taro.setStorageSync(CITY_STORAGE_KEY, nextCity);
  };

  const selectServiceClass = (item: V2ServiceClass) => {
    setSelectedClassCode(item.code);
    setCargoWeight(getDefaultWeight(item));
  };

  const buildOrderPayload = useCallback((): V2EstimateOrderPayload | null => {
    if (!pickup || !dropoff || !selectedClass) return null;
    const weight = Number(cargoWeight);
    if (!Number.isFinite(weight) || weight <= 0) return null;
    const scheduled = scheduledStartAt || new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const pickupTitle = formatAddressTitle(pickup);
    const dropoffTitle = formatAddressTitle(dropoff);
    return {
      origin: {
        latitude: Number(pickup.latitude),
        longitude: Number(pickup.longitude),
        address: pickupTitle || formatAddressDetail(pickup),
      },
      destination: {
        latitude: Number(dropoff.latitude),
        longitude: Number(dropoff.longitude),
        address: dropoffTitle || formatAddressDetail(dropoff),
      },
      cargo_weight_kg: weight,
      scheduled_start_at: scheduled,
      service_class_code: selectedClass.code,
      cargo_scene: 'standard',
      description: `${pickupTitle || '起吊点'} → ${dropoffTitle || '落放点'}`,
      note: timeMode === 'reservation' && scheduledLabel ? `预约 ${scheduledLabel}` : '立即吊运',
    };
  }, [cargoWeight, dropoff, pickup, scheduledLabel, scheduledStartAt, selectedClass, timeMode]);

  useEffect(() => {
    const payload = buildOrderPayload();
    const seq = estimateSeqRef.current + 1;
    estimateSeqRef.current = seq;
    setEstimate(null);
    if (!payload) {
      setEstimating(false);
      setEstimateError('');
      return;
    }
    setEstimating(true);
    setEstimateError('');
    const timer = setTimeout(() => {
      orderV2Service.estimate(payload)
        .then(next => {
          if (estimateSeqRef.current !== seq) return;
          setEstimate(next);
          setEstimateError('');
        })
        .catch((error: any) => {
          if (estimateSeqRef.current !== seq) return;
          setEstimate(null);
          setEstimateError(String(error?.message || '预估价获取失败'));
        })
        .finally(() => {
          if (estimateSeqRef.current === seq) setEstimating(false);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [buildOrderPayload]);

  const openSchedulePicker = () => {
    if (!scheduledStartAt) {
      const next = buildDefaultScheduleParts();
      setPendingScheduleDate(next.date);
      setPendingScheduleTime(next.time);
    }
    setShowSchedulePicker(true);
  };

  const confirmSchedule = () => {
    const start = parseScheduleDateTime(pendingScheduleDate, pendingScheduleTime);
    if (start <= new Date()) {
      Taro.showToast({ title: '请选择未来时间', icon: 'none' });
      return;
    }
    setTimeMode('reservation');
    setScheduledStartAt(start.toISOString());
    setScheduledLabel(formatScheduleLabel(start));
    setShowSchedulePicker(false);
  };

  const switchToNow = () => {
    setTimeMode('now');
    setScheduledStartAt('');
    setScheduledLabel('');
  };

  const openComplexService = () => {
    if (pickup && dropoff) {
      Taro.setStorageSync(QUICK_ORDER_PREFILL_STORAGE_KEY, {
        pickupAddress: pickup,
        deliveryAddress: dropoff,
        cargoWeight,
        timeOption: timeMode === 'reservation' ? '预约' : '尽快',
        scheduledStartAt,
        city,
      });
    }
    Taro.navigateTo({ url: '/pages/publish/quick-order/index?from=customerHome' });
  };

  const createOrder = async () => {
    if (!isAuthenticated) {
      Taro.navigateTo({ url: '/pages/auth/login/index?roleMode=customer' });
      return;
    }
    const payload = buildOrderPayload();
    if (!payload) {
      Taro.showToast({ title: '请补齐地址、机型档和重量', icon: 'none' });
      return;
    }
    if (!estimate) {
      Taro.showToast({ title: estimateError || '请等待预估价', icon: 'none' });
      return;
    }
    try {
      setCreating(true);
      const result = timeMode === 'reservation'
        ? await orderV2Service.createReservation(payload)
        : await orderV2Service.createInstant(payload);
      const orderId = result?.order?.id;
      if (!orderId) {
        throw new Error('订单创建成功但缺少订单号');
      }
      Taro.redirectTo({ url: `/pages/orders/live/index?orderId=${orderId}` });
    } catch (error: any) {
      Taro.showToast({ title: String(error?.message || '下单失败'), icon: 'none' });
    } finally {
      setCreating(false);
    }
  };

  const applyCommonPickup = (address?: AddressData) => {
    if (!address) {
      openAddressPicker('pickup');
      return;
    }
    applySelectedAddress('pickup', address);
  };

  const openAddressBook = () => {
    Taro.navigateTo({ url: '/pages/address/book/index' });
  };

  const openRecentOrder = () => {
    if (recentOrder?.id) {
      Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${recentOrder.id}` });
      return;
    }
    Taro.switchTab({ url: '/pages/orders/index' });
  };

  const scheduleDateOptions = getScheduleDateOptions();
  const activeScheduleDate = scheduleDateOptions.find(item => item.value === pendingScheduleDate)?.label || pendingScheduleDate;
  const ctaDisabled = creating || estimating || !estimate || !pickup || !dropoff || !selectedClass;
  const ctaText = creating
    ? '下单中...'
    : estimating
      ? '预估价计算中...'
      : estimate
        ? `预估价 ${formatMoney(estimate.total_estimated_cents)}  立即下单`
        : '选择地址后立即下单';

  return (
    <View className='customer-home-page'>
      <ScrollView scrollY className='customer-home-scroll'>
        <View className='customer-home-header'>
          <View className='customer-home-city' onClick={chooseCity}>
            <Text>{city}</Text>
            <Text className='customer-home-city-arrow'>⌄</Text>
          </View>
          <Text className='customer-home-title'>立即吊运</Text>
          <View className='customer-home-help' onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}>客服</View>
        </View>

        <View className='customer-home-section customer-home-address-card'>
          <View className='address-row' onClick={() => openAddressPicker('pickup')}>
            <View className='address-dot address-dot-start'>起</View>
            <View className='address-content'>
              <Text className={`address-title ${pickup ? '' : 'is-placeholder'}`}>
                {formatAddressTitle(pickup) || '从哪里起吊'}
              </Text>
              <Text className='address-subtitle'>{formatAddressDetail(pickup) || '请选择起吊位置'}</Text>
            </View>
            <Text className='address-arrow'>›</Text>
          </View>
          <View className='address-divider' />
          <View className='address-row' onClick={() => openAddressPicker('dropoff')}>
            <View className='address-dot address-dot-end'>终</View>
            <View className='address-content'>
              <Text className={`address-title ${dropoff ? '' : 'is-placeholder'}`}>
                {formatAddressTitle(dropoff) || '送到哪里'}
              </Text>
              <Text className='address-subtitle'>{formatAddressDetail(dropoff) || '请选择落放位置'}</Text>
            </View>
            <Text className='address-arrow'>›</Text>
          </View>
        </View>

        <View className='customer-home-section'>
          <View className='section-head'>
            <Text className='section-title'>机型档</Text>
            <Text className='section-note'>按平台档位计价</Text>
          </View>
          <View className='service-class-grid'>
            {serviceClasses.map(item => (
              <View
                key={item.code}
                className={`service-class-card ${selectedClass?.code === item.code ? 'is-active' : ''}`}
                onClick={() => selectServiceClass(item)}
              >
                <Text className='service-class-name'>{item.display_name}</Text>
                <Text className='service-class-range'>载重 {buildServiceClassPayloadRange(item)}</Text>
                <Text className='service-class-min'>{item.min_charge_cents ? `${formatMoney(item.min_charge_cents)}起` : '平台估价'}</Text>
              </View>
            ))}
            {serviceClasses.length === 0 ? (
              <View className='service-class-empty'>机型档加载中</View>
            ) : null}
          </View>
        </View>

        <View className='customer-home-section customer-home-form-card'>
          <View className='form-row'>
            <Text className='form-label'>货物重量</Text>
            <View className='weight-input-wrap'>
              <Input
                className='weight-input'
                type='digit'
                value={cargoWeight}
                onInput={event => setCargoWeight(String(event.detail.value || '').replace(/[^\d.]/g, ''))}
              />
              <Text className='weight-unit'>kg</Text>
            </View>
          </View>
          <View className='form-row'>
            <Text className='form-label'>服务时间</Text>
            <View className='time-switch'>
              <View className={`time-chip ${timeMode === 'now' ? 'is-active' : ''}`} onClick={switchToNow}>
                <Text>现在</Text>
              </View>
              <View className={`time-chip ${timeMode === 'reservation' ? 'is-active' : ''}`} onClick={openSchedulePicker}>
                <Text>{scheduledLabel || '预约'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className='customer-home-section customer-home-estimate-card'>
          <View className='estimate-main'>
            <View>
              <Text className='estimate-label'>预估价</Text>
              <Text className='estimate-hint'>服务商接单后按平台规则履约</Text>
            </View>
            <Text className='estimate-price'>
              {estimating ? '计算中' : formatMoney(estimate?.total_estimated_cents)}
            </Text>
          </View>
          {estimate ? (
            <View className='estimate-meta'>
              <Text>{estimate.distance_km.toFixed(1)} km</Text>
              <Text>约 {estimate.estimated_duration_min} 分钟</Text>
              <Text>{estimate.service_class_name}</Text>
            </View>
          ) : (
            <Text className='estimate-error'>{estimateError || '选择起点和终点后自动估价'}</Text>
          )}
        </View>

        <View className='secondary-actions'>
          <View className='secondary-action' onClick={openComplexService}>复杂服务 / 议价单</View>
          <View className='secondary-action' onClick={() => Taro.switchTab({ url: '/pages/orders/index' })}>查看订单</View>
        </View>

        <View className='customer-home-section customer-home-common-card'>
          <View className='section-head'>
            <Text className='section-title'>常用起吊点</Text>
            <Text className='section-link' onClick={openAddressBook}>管理</Text>
          </View>
          {commonAddresses.length > 0 ? commonAddresses.map((item, index) => (
            <View key={`${item.id || item.address}-${index}`} className='common-row' onClick={() => applyCommonPickup(item)}>
              <View className='common-index'>{index + 1}</View>
              <View className='common-content'>
                <Text className='common-title'>{formatAddressTitle(item)}</Text>
                <Text className='common-address'>{formatAddressDetail(item)}</Text>
              </View>
            </View>
          )) : (
            <View className='empty-line'>暂无常用地址</View>
          )}
        </View>

        <View className='customer-home-section customer-home-recent-card' onClick={openRecentOrder}>
          <View className='section-head'>
            <Text className='section-title'>最近一次吊运</Text>
            <Text className='section-link'>查看</Text>
          </View>
          <Text className='recent-route'>{getRecentOrderRoute(recentOrder)}</Text>
          <Text className='recent-status'>{getRecentOrderStatus(recentOrder)}</Text>
        </View>
        <View className='customer-home-scroll-spacer' />
      </ScrollView>

      <View className='customer-home-bottom'>
        <View className={`customer-home-cta ${ctaDisabled ? 'is-disabled' : ''}`} onClick={ctaDisabled ? undefined : createOrder}>
          <Text>{ctaText}</Text>
        </View>
      </View>

      {showSchedulePicker ? (
        <View className='schedule-mask'>
          <View className='schedule-panel'>
            <View className='schedule-panel-header'>
              <Text className='schedule-panel-title'>选择服务时间</Text>
              <Text className='schedule-panel-close' onClick={() => setShowSchedulePicker(false)}>取消</Text>
            </View>
            <Text className='schedule-panel-subtitle'>日期</Text>
            <View className='schedule-date-grid'>
              {scheduleDateOptions.map(item => (
                <View
                  key={item.value}
                  className={`schedule-chip ${pendingScheduleDate === item.value ? 'is-active' : ''}`}
                  onClick={() => setPendingScheduleDate(item.value)}
                >
                  <Text>{item.label}</Text>
                </View>
              ))}
            </View>
            <Text className='schedule-panel-subtitle'>时间</Text>
            <View className='schedule-time-grid'>
              {SCHEDULE_TIME_OPTIONS.map(item => (
                <View
                  key={item}
                  className={`schedule-chip ${pendingScheduleTime === item ? 'is-active' : ''}`}
                  onClick={() => setPendingScheduleTime(item)}
                >
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
            <View className='schedule-confirm' onClick={confirmSchedule}>
              <Text>确认 {activeScheduleDate} {pendingScheduleTime}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
