import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { syncCustomTabBar } from '../../utils/tabBar';
import { addressHistoryService } from '../../services/addressHistory';
import { locationService } from '../../services/location';
import { orderV2Service } from '../../services/orderV2';
import { AddressData, V2OrderSummary } from '../../types';
import bookingClipboardIcon from '../../assets/haul/customer-home/icon_booking_clipboard.png';
import chevronRightIcon from '../../assets/haul/customer-home/icon_chevron_right.png';
import clockIcon from '../../assets/haul/customer-home/icon_clock.png';
import locationEndIcon from '../../assets/haul/customer-home/icon_location_end.png';
import locationPinIcon from '../../assets/haul/customer-home/icon_location_pin.png';
import locationStartIcon from '../../assets/haul/customer-home/icon_location_start.png';
import navChatIcon from '../../assets/haul/customer-home/icon_nav_chat.png';
import navChevronDownIcon from '../../assets/haul/customer-home/icon_nav_chevron_down.png';
import starFilledIcon from '../../assets/haul/customer-home/icon_star_filled.png';
import starOutlineIcon from '../../assets/haul/customer-home/icon_star_outline.png';
import trustAirspaceIcon from '../../assets/haul/customer-home/icon_trust_airspace.png';
import trustInsuranceIcon from '../../assets/haul/customer-home/icon_trust_insurance.png';
import trustProviderIcon from '../../assets/haul/customer-home/icon_trust_provider.png';
import weightKgIcon from '../../assets/haul/customer-home/icon_weight_kg.png';
import './CustomerHaulHome.scss';

type WeightOption = '50kg以下' | '50-100kg' | '100-300kg' | '300kg以上';
type TimeOption = '尽快' | '今天' | '明天' | '预约';
type AddressTarget = 'pickup' | 'dropoff';

type SegmentOption<T extends string> = {
  label: T;
  x: string;
  w: string;
};

const weightOptions: SegmentOption<WeightOption>[] = [
  { label: '50kg以下', x: '70.4', w: '140.0' },
  { label: '50-100kg', x: '228.0', w: '138.2' },
  { label: '100-300kg', x: '385.6', w: '138.2' },
  { label: '300kg以上', x: '542.3', w: '138.2' },
];

const timeOptions: SegmentOption<TimeOption>[] = [
  { label: '尽快', x: '70.4', w: '140.0' },
  { label: '今天', x: '228.0', w: '138.2' },
  { label: '明天', x: '385.6', w: '138.2' },
  { label: '预约', x: '542.3', w: '138.2' },
];

const trustItems = [
  {
    icon: trustAirspaceIcon,
    iconClass: 'trust-icon-1',
    titleClass: 'trust-title-1',
    descClass: 'trust-desc-1',
    title: '空域自动检测',
    desc: '合规飞行更安全',
  },
  {
    icon: trustProviderIcon,
    iconClass: 'trust-icon-2',
    titleClass: 'trust-title-2',
    descClass: 'trust-desc-2',
    title: '资质服务商',
    desc: '平台严选更可靠',
  },
  {
    icon: trustInsuranceIcon,
    iconClass: 'trust-icon-3',
    titleClass: 'trust-title-3',
    descClass: 'trust-desc-3',
    title: '保险保障',
    desc: '货物保障更安心',
  },
];

const ADDRESS_TARGET_STORAGE_KEY = 'customer_home_address_target';
const QUICK_ORDER_PREFILL_STORAGE_KEY = 'customer_home_quick_order_prefill_v1';
const CITY_STORAGE_KEY = 'customer_home_city';
const CITY_OPTIONS = ['深圳', '广州', '东莞', '惠州', '佛山', '珠海'];
const SCHEDULE_TIME_OPTIONS = ['09:00', '10:30', '14:00', '16:00', '18:00'];

const weightDraftValueMap: Record<WeightOption, string> = {
  '50kg以下': '50',
  '50-100kg': '80',
  '100-300kg': '200',
  '300kg以上': '300',
};

const formatAddressTitle = (address?: AddressData | null) =>
  String(address?.name || address?.address || '').trim();

const formatAddressDetail = (address?: AddressData | null) => {
  if (!address) return '';
  const detail = String(address.address || '').trim();
  const title = formatAddressTitle(address);
  if (detail && detail !== title) return detail;
  return [address.district, address.city].filter(Boolean).join('') || '已保存地址';
};

const getStoredAddressTarget = (): AddressTarget | null => {
  try {
    const target = Taro.getStorageSync(ADDRESS_TARGET_STORAGE_KEY);
    return target === 'pickup' || target === 'dropoff' ? target : null;
  } catch {
    return null;
  }
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

const normalizeAddressResponse = (response: unknown): AddressData[] => {
  const data = response as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const formatOrderDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${mi}`;
};

const padDatePart = (value: number) => String(value).padStart(2, '0');

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const formatScheduleLabel = (date: Date) =>
  `${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

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

const buildDefaultScheduleParts = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return {
    date: formatDateKey(date),
    time: '09:00',
  };
};

const parseScheduleDateTime = (dateValue: string, timeValue: string) => {
  const [hour = '09', minute = '00'] = timeValue.split(':');
  const date = new Date(`${dateValue.replace(/-/g, '/')} 00:00:00`);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
};

const getRecentOrderRoute = (order?: V2OrderSummary | null) => {
  if (!order) return '暂无吊运记录';
  const start = String(order.service_address || '').trim();
  const end = String(order.dest_address || '').trim();
  if (start && end) return `${start} → ${end}`;
  return order.title || order.order_no || '最近一次吊运';
};

const getRecentOrderWeight = (order?: V2OrderSummary | null) => {
  const raw = (order as any)?.cargo_weight_kg || (order as any)?.cargo_weight || (order as any)?.demand?.cargo_weight_kg;
  return raw ? `${raw}kg` : '--';
};

const getRecentOrderStatus = (order?: V2OrderSummary | null) => {
  if (!order) return '暂无';
  const status = String(order.status || '').toLowerCase();
  const statusMap: Record<string, string> = {
    completed: '已完成',
    delivered: '待签收',
    in_transit: '运输中',
    loading: '装货中',
    preparing: '准备中',
    assigned: '服务商已接单',
    pending_dispatch: '待开始履约',
    pending_payment: '待付款',
    pending_provider_confirmation: '待确认',
    cancelled: '已取消',
  };
  return statusMap[status] || '进行中';
};

export default function CustomerHaulHome() {
  const initialSchedule = buildDefaultScheduleParts();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [weight, setWeight] = useState<WeightOption>('50kg以下');
  const [time, setTime] = useState<TimeOption>('尽快');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledLabel, setScheduledLabel] = useState('');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [pendingScheduleDate, setPendingScheduleDate] = useState(initialSchedule.date);
  const [pendingScheduleTime, setPendingScheduleTime] = useState(initialSchedule.time);
  const [pickup, setPickup] = useState<AddressData | null>(null);
  const [dropoff, setDropoff] = useState<AddressData | null>(null);
  const [city, setCity] = useState('深圳');
  const [commonAddresses, setCommonAddresses] = useState<AddressData[]>([]);
  const [recentOrder, setRecentOrder] = useState<V2OrderSummary | null>(null);
  const [navShift, setNavShift] = useState(0);
  const [serviceLeft, setServiceLeft] = useState(632.9);
  const [showService, setShowService] = useState(true);
  const pendingAddressTargetRef = useRef<AddressTarget | null>(null);

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
    const localHistory = await addressHistoryService.loadAddressHistory().catch(() => []);
    let savedAddresses: AddressData[] = [];
    if (isAuthenticated) {
      savedAddresses = await locationService.getAddressList()
        .then(normalizeAddressResponse)
        .catch(() => []);
    }
    setCommonAddresses(dedupeAddresses([...savedAddresses, ...localHistory]).slice(0, 2));
  }, [isAuthenticated]);

  const refreshRecentOrder = useCallback(async () => {
    if (!isAuthenticated) {
      setRecentOrder(null);
      return;
    }
    try {
      const response = await orderV2Service.list({ role: 'client', page: 1, page_size: 1 });
      const latest = ((response as any).items || [])[0] as V2OrderSummary | undefined;
      setRecentOrder(latest || null);
    } catch {
      setRecentOrder(null);
    }
  }, [isAuthenticated]);

  const refreshHomeData = useCallback(() => {
    const storedCity = Taro.getStorageSync(CITY_STORAGE_KEY);
    if (storedCity) setCity(String(storedCity));
    consumeStoredAddress();
    refreshCommonAddresses();
    refreshRecentOrder();
  }, [consumeStoredAddress, refreshCommonAddresses, refreshRecentOrder]);

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

  useEffect(() => {
    try {
      const menu = Taro.getMenuButtonBoundingClientRect();
      const system = Taro.getSystemInfoSync();
      const rpxRatio = 750 / system.windowWidth;
      const menuTopRpx = menu.top * rpxRatio;
      const menuLeftRpx = menu.left * rpxRatio;
      const shift = Math.max(0, menuTopRpx - 95.1);
      const maxServiceRight = menuLeftRpx - 16;
      const nextServiceLeft = Math.min(632.9, Math.max(488, maxServiceRight - 88));
      setNavShift(Number(shift.toFixed(1)));
      setServiceLeft(Number(nextServiceLeft.toFixed(1)));
      setShowService(maxServiceRight >= 700);
    } catch (error) {
      setNavShift(0);
      setServiceLeft(632.9);
      setShowService(true);
    }
  }, []);

  const canvasStyle = {
    '--nav-shift': `${navShift}rpx`,
  } as React.CSSProperties;

  const serviceStyle = {
    left: `${serviceLeft}rpx`,
  } as React.CSSProperties;

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

  const openSchedulePicker = () => {
    if (!scheduledStartAt) {
      const next = buildDefaultScheduleParts();
      setPendingScheduleDate(next.date);
      setPendingScheduleTime(next.time);
    }
    setShowSchedulePicker(true);
  };

  const selectTimeOption = (option: TimeOption) => {
    if (option === '预约') {
      openSchedulePicker();
      return;
    }
    setTime(option);
    setScheduledStartAt('');
    setScheduledLabel('');
  };

  const confirmSchedule = () => {
    const start = parseScheduleDateTime(pendingScheduleDate, pendingScheduleTime);
    if (start <= new Date()) {
      Taro.showToast({ title: '请选择未来作业时间', icon: 'none' });
      return;
    }
    setTime('预约');
    setScheduledStartAt(start.toISOString());
    setScheduledLabel(formatScheduleLabel(start));
    setShowSchedulePicker(false);
  };

  const requestPlan = () => {
    if (!pickup || !dropoff) {
      Taro.showToast({ title: '请先选择起吊点和落放点', icon: 'none' });
      return;
    }
    Taro.setStorageSync(QUICK_ORDER_PREFILL_STORAGE_KEY, {
      pickupAddress: pickup,
      deliveryAddress: dropoff,
      cargoWeight: weightDraftValueMap[weight],
      timeOption: time,
      scheduledStartAt,
      city,
    });
    Taro.navigateTo({ url: '/pages/publish/quick-order/index?from=customerHome' });
  };

  const applyCommonPickup = (address?: AddressData) => {
    if (!address) {
      openAddressPicker('pickup');
      return;
    }
    applySelectedAddress('pickup', address);
    addressHistoryService.addAddressHistory(address)
      .then(next => setCommonAddresses(dedupeAddresses(next).slice(0, 2)))
      .catch(() => null);
  };

  const openRecentOrder = () => {
    if (recentOrder?.id) {
      Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${recentOrder.id}` });
      return;
    }
    Taro.switchTab({ url: '/pages/orders/index' });
  };

  const renderSegment = <T extends string>(
    option: SegmentOption<T>,
    y: string,
    active: boolean,
    onClick: () => void,
  ) => (
    <View
      key={option.label}
      className={`customer-home-segment ${active ? 'is-active' : ''}`}
      style={{ left: `${option.x}rpx`, top: `${y}rpx`, width: `${option.w}rpx` }}
      onClick={onClick}
    >
      <Text className={`customer-home-segment-text ${active ? 'is-active' : ''}`}>
        {option.label}
      </Text>
    </View>
  );

  const scheduleDateOptions = getScheduleDateOptions();
  const activeScheduleDate = scheduleDateOptions.find(item => item.value === pendingScheduleDate)?.label || pendingScheduleDate;

  return (
    <View className='customer-home-page'>
      <ScrollView scrollY className='customer-home-scroll'>
        <View className='customer-home-canvas' style={canvasStyle}>
          <View className='customer-home-blue' />
          <View className='customer-home-blue-curve' />

          <View className='nav-city-hit' onClick={chooseCity} />
          <Text className='nav-city'>{city}</Text>
          <Image className='nav-chevron' src={navChevronDownIcon} mode='aspectFit' />
          <Text className='nav-title'>预约无人机吊运</Text>
          {showService && (
            <View className='nav-service' style={serviceStyle}>
              <Image className='nav-service-icon' src={navChatIcon} mode='aspectFit' />
              <Text className='nav-service-text'>客服</Text>
            </View>
          )}

          <View className='main-card' />
          <Image className='main-title-icon' src={bookingClipboardIcon} mode='aspectFit' />
          <Text className='main-title'>预约吊运</Text>
          <View className='form-box' />

          <View className='location-hit hit-start' onClick={() => openAddressPicker('pickup')} />
          <Image className='start-icon' src={locationStartIcon} mode='aspectFit' />
          <Text className='start-label'>起吊点</Text>
          <Text className={`start-value ${pickup ? '' : 'is-placeholder'}`}>
            {formatAddressTitle(pickup) || '请选择货物起吊位置'}
          </Text>
          <Image className='start-arrow' src={chevronRightIcon} mode='aspectFit' />
          <View className='divider divider-start' />

          <View className='location-hit hit-end' onClick={() => openAddressPicker('dropoff')} />
          <Image className='end-icon' src={locationEndIcon} mode='aspectFit' />
          <Text className='end-label'>落放点</Text>
          <Text className={`end-value ${dropoff ? '' : 'is-placeholder'}`}>
            {formatAddressTitle(dropoff) || '请选择货物落放位置'}
          </Text>
          <Image className='end-arrow' src={chevronRightIcon} mode='aspectFit' />
          <View className='divider divider-end' />

          <Image className='weight-icon' src={weightKgIcon} mode='aspectFit' />
          <Text className='weight-title'>货物重量</Text>
          {weightOptions.map(option =>
            renderSegment(option, '578.3', weight === option.label, () => setWeight(option.label)),
          )}
          <View className='divider divider-weight' />

          <Image className='time-icon' src={clockIcon} mode='aspectFit' />
          <Text className='time-title'>作业时间</Text>
          {timeOptions.map(option =>
            renderSegment(option, '755.3', time === option.label, () => selectTimeOption(option.label)),
          )}
          {time === '预约' && scheduledLabel ? (
            <Text className='schedule-selected-text'>已约 {scheduledLabel}</Text>
          ) : null}

          <View className='plan-button' onClick={requestPlan}>
            <Text className='plan-button-text'>获取吊运方案</Text>
          </View>

          <View className='trust-card' />
          {trustItems.map(item => (
            <React.Fragment key={item.title}>
              <Image className={`trust-icon ${item.iconClass}`} src={item.icon} mode='aspectFit' />
              <Text className={`trust-title ${item.titleClass}`}>{item.title}</Text>
              <Text className={`trust-desc ${item.descClass}`}>{item.desc}</Text>
            </React.Fragment>
          ))}
          <View className='trust-vline trust-vline-1' />
          <View className='trust-vline trust-vline-2' />

          <View className='common-card' />
          <Text className='common-title'>常用起吊点</Text>
          <View className='common-action-hit' onClick={() => openAddressPicker('pickup')} />
          <Text className='common-action'>查看全部</Text>
          <Image className='common-action-arrow' src={chevronRightIcon} mode='aspectFit' />
          <View className='common-row-hit common-row-hit-1' onClick={() => applyCommonPickup(commonAddresses[0])} />
          <Image className='common-pin common-pin-1' src={locationPinIcon} mode='aspectFit' />
          <Text className={`common-name common-name-1 ${commonAddresses[0] ? '' : 'is-placeholder'}`}>
            {formatAddressTitle(commonAddresses[0]) || '暂无常用起吊点'}
          </Text>
          <Text className='common-address common-address-1'>
            {formatAddressDetail(commonAddresses[0]) || '选点后自动记录'}
          </Text>
          {commonAddresses[0] && <Image className='common-star common-star-1' src={starFilledIcon} mode='aspectFit' />}
          <View className='divider common-divider' />
          <View className='common-row-hit common-row-hit-2' onClick={() => applyCommonPickup(commonAddresses[1])} />
          <Image className='common-pin common-pin-2' src={locationPinIcon} mode='aspectFit' />
          <Text className={`common-name common-name-2 ${commonAddresses[1] ? '' : 'is-placeholder'}`}>
            {formatAddressTitle(commonAddresses[1]) || '地图选点'}
          </Text>
          <Text className='common-address common-address-2'>
            {formatAddressDetail(commonAddresses[1]) || '保存为最近起吊点'}
          </Text>
          {commonAddresses[1] && <Image className='common-star common-star-2' src={starOutlineIcon} mode='aspectFit' />}

          <View className='recent-card' />
          <Text className='recent-title'>最近一次吊运</Text>
          <View className='recent-action-hit' onClick={openRecentOrder} />
          <Text className='recent-action'>查看详情</Text>
          <Image className='recent-action-arrow' src={chevronRightIcon} mode='aspectFit' />
          <View className='recent-card-hit' onClick={openRecentOrder} />
          <View className='recent-inner' />
          <View className={`done-badge ${recentOrder ? '' : 'is-empty'}`}>
            <Text className={`done-badge-text ${recentOrder ? '' : 'is-empty'}`}>
              {getRecentOrderStatus(recentOrder)}
            </Text>
          </View>
          <Text className={`recent-route ${recentOrder ? '' : 'is-placeholder'}`}>
            {getRecentOrderRoute(recentOrder)}
          </Text>
          <Text className='recent-label weight-label'>货物重量</Text>
          <Text className='recent-value weight-value'>{getRecentOrderWeight(recentOrder)}</Text>
          <Text className='recent-label time-label'>作业时间</Text>
          <Text className='recent-value time-value'>{formatOrderDate(recentOrder?.start_time)}</Text>
          <Text className='recent-label order-label'>订单号</Text>
          <Text className='recent-order-value'>{recentOrder?.order_no || '--'}</Text>
        </View>
        <View className='customer-home-scroll-spacer' />
      </ScrollView>
      {showSchedulePicker ? (
        <View className='schedule-mask'>
          <View className='schedule-panel'>
            <View className='schedule-panel-header'>
              <Text className='schedule-panel-title'>选择作业时间</Text>
              <Text className='schedule-panel-close' onClick={() => setShowSchedulePicker(false)}>取消</Text>
            </View>
            <Text className='schedule-panel-subtitle'>日期</Text>
            <View className='schedule-date-grid'>
              {scheduleDateOptions.map(item => (
                <View
                  key={item.value}
                  className={`schedule-chip schedule-date-chip ${pendingScheduleDate === item.value ? 'is-active' : ''}`}
                  onClick={() => setPendingScheduleDate(item.value)}
                >
                  <Text className={`schedule-chip-text ${pendingScheduleDate === item.value ? 'is-active' : ''}`}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text className='schedule-panel-subtitle schedule-time-subtitle'>时间</Text>
            <View className='schedule-time-grid'>
              {SCHEDULE_TIME_OPTIONS.map(item => (
                <View
                  key={item}
                  className={`schedule-chip schedule-time-chip ${pendingScheduleTime === item ? 'is-active' : ''}`}
                  onClick={() => setPendingScheduleTime(item)}
                >
                  <Text className={`schedule-chip-text ${pendingScheduleTime === item ? 'is-active' : ''}`}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
            <View className='schedule-confirm' onClick={confirmSchedule}>
              <Text className='schedule-confirm-text'>确认 {activeScheduleDate} {pendingScheduleTime}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
