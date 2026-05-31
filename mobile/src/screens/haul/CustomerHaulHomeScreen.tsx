import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  ImageStyle,
  Modal,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {StackActions, useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useSelector} from 'react-redux';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {customerHomeAssets} from '../../assets/haul/customerHome';
import {addressHistoryService} from '../../services/addressHistory';
import {locationService} from '../../services/location';
import {orderV2Service} from '../../services/orderV2';
import {AddressData, QuickOrderDraft, V2OrderSummary} from '../../types';
import {RootState} from '../../store/store';

type WeightOption = '50kg以下' | '50-100kg' | '100-300kg' | '300kg以上';
type TimeOption = '尽快' | '今天' | '明天' | '预约';

type OptionButton<T extends string> = {
  label: T;
  x: number;
  w: number;
};

type DesignTextProps = React.PropsWithChildren<{
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>;

const DESIGN_WIDTH = 852;
const DESIGN_CONTENT_BOTTOM = 1651;

const weightOptions: OptionButton<WeightOption>[] = [
  {label: '50kg以下', x: 80, w: 159},
  {label: '50-100kg', x: 259, w: 157},
  {label: '100-300kg', x: 438, w: 157},
  {label: '300kg以上', x: 616, w: 157},
];

const timeOptions: OptionButton<TimeOption>[] = [
  {label: '尽快', x: 80, w: 159},
  {label: '今天', x: 259, w: 157},
  {label: '明天', x: 438, w: 157},
  {label: '预约', x: 616, w: 157},
];

const trustItems = [
  {
    icon: customerHomeAssets.trustAirspace,
    iconX: 53,
    textX: 124,
    title: '空域自动检测',
    desc: '合规飞行更安全',
  },
  {
    icon: customerHomeAssets.trustProvider,
    iconX: 326,
    textX: 395,
    title: '资质服务商',
    desc: '平台严选更可靠',
  },
  {
    icon: customerHomeAssets.trustInsurance,
    iconX: 595,
    textX: 665,
    title: '保险保障',
    desc: '货物保障更安心',
  },
];

type AddressTarget = 'pickup' | 'dropoff';

const CITY_STORAGE_KEY = 'customer_home_city';
const DEFAULT_CITY_OPTIONS = ['深圳', '广州', '佛山', '东莞', '惠州', '珠海'];
const CITY_MAP_PICKER_OPTION = '从地图选择城市';
const SCHEDULE_TIME_OPTIONS = ['09:00', '10:30', '14:00', '16:00', '18:00'];

const weightDraftValueMap: Record<WeightOption, number> = {
  '50kg以下': 50,
  '50-100kg': 80,
  '100-300kg': 200,
  '300kg以上': 300,
};

const padDatePart = (value: number) => String(value).padStart(2, '0');

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const formatScheduleLabel = (date: Date) =>
  `${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const formatDateTime = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const buildScheduleChoices = () => {
  const today = new Date();
  const items: {label: string; value: Date}[] = [];
  for (let dayOffset = 0; dayOffset < 4; dayOffset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    const prefix = dayOffset === 0 ? '今天' : dayOffset === 1 ? '明天' : weekday;
    SCHEDULE_TIME_OPTIONS.forEach(time => {
      const [hour, minute] = time.split(':').map(Number);
      const slot = new Date(date);
      slot.setHours(hour, minute, 0, 0);
      if (slot > today) {
        items.push({
          label: `${prefix} ${padDatePart(slot.getMonth() + 1)}/${padDatePart(slot.getDate())} ${time}`,
          value: slot,
        });
      }
    });
  }
  return items.slice(0, 8);
};

const buildScheduleFromTimeOption = (option: TimeOption, scheduledDate?: Date | null) => {
  const start = scheduledDate ? new Date(scheduledDate) : new Date();
  if (!scheduledDate) {
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
  }
  const end = new Date(start);
  end.setHours(start.getHours() + 2, 0, 0, 0);
  return {start, end};
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

const normalizeCityLabel = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/市$/, '');
};

const inferCityFromText = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/([\u4e00-\u9fa5]{2,})市/);
  return normalizeCityLabel(match?.[1] || '');
};

const cityFromAddress = (address?: AddressData | null) =>
  normalizeCityLabel(address?.city) || inferCityFromText(address?.address) || inferCityFromText(address?.name);

const uniqueTextList = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach(item => {
    const text = String(item || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
};

const formatOrderDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : formatDateTime(date);
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
    assigned: '已安排履约',
    pending_dispatch: '等待服务商',
    pending_payment: '待付款',
    pending_provider_confirmation: '待确认',
    cancelled: '已取消',
  };
  return statusMap[status] || '进行中';
};

function DesignText({children, style, numberOfLines}: DesignTextProps) {
  return (
    <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );
}

export default function CustomerHaulHomeScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const screenWidth = width || DESIGN_WIDTH;
  const scale = screenWidth / DESIGN_WIDTH;
  const [weight, setWeight] = useState<WeightOption>('50kg以下');
  const [time, setTime] = useState<TimeOption>('尽快');
  const [pickup, setPickup] = useState<AddressData | null>(null);
  const [dropoff, setDropoff] = useState<AddressData | null>(null);
  const [city, setCity] = useState('深圳');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [commonAddresses, setCommonAddresses] = useState<AddressData[]>([]);
  const [recentOrder, setRecentOrder] = useState<V2OrderSummary | null>(null);

  const dp = (value: number) => Number((value * scale).toFixed(2));
  const frame = (x: number, y: number, w: number, h: number): ViewStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dp(y),
    width: dp(w),
    height: dp(h),
  });
  const type = (
    fontSize: number,
    lineHeight: number,
    fontWeight: TextStyle['fontWeight'],
    color: string,
  ): TextStyle => ({
    color,
    fontSize: dp(fontSize),
    lineHeight: dp(lineHeight),
    fontWeight,
  });
  const imageFrame = (x: number, y: number, w: number, h: number): ImageStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dp(y),
    width: dp(w),
    height: dp(h),
  });
  const cardShadow = (
    opacity: number,
    radius: number,
    offsetY: number,
    elevation: number,
  ): ViewStyle => ({
    shadowColor: '#00275B',
    shadowOpacity: opacity,
    shadowRadius: dp(radius),
    shadowOffset: {width: 0, height: dp(offsetY)},
    elevation,
  });

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

  const refreshStoredCity = useCallback(async () => {
    const storedCity = await AsyncStorage.getItem(CITY_STORAGE_KEY).catch(() => null);
    if (storedCity) {
      setCity(storedCity);
    }
  }, []);

  const refreshRecentOrder = useCallback(async () => {
    if (!isAuthenticated) {
      setRecentOrder(null);
      return;
    }
    try {
      const response = await orderV2Service.list({role: 'client', page: 1, page_size: 1});
      const latest = ((response as any).data?.items || (response as any).items || [])[0] as V2OrderSummary | undefined;
      setRecentOrder(latest || null);
    } catch {
      setRecentOrder(null);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      refreshStoredCity();
      refreshCommonAddresses();
      refreshRecentOrder();
    }, [refreshCommonAddresses, refreshRecentOrder, refreshStoredCity]),
  );

  const applySelectedAddress = (target: AddressTarget, address: AddressData) => {
    if (target === 'pickup') {
      setPickup(address);
    } else {
      setDropoff(address);
    }
    const nextCity = cityFromAddress(address);
    if (nextCity) {
      setCity(nextCity);
      AsyncStorage.setItem(CITY_STORAGE_KEY, nextCity).catch(() => null);
    }
  };

  const openAddressPicker = (target: AddressTarget) => {
    navigation.navigate('AddressPicker', {
      onSelect: (address: AddressData) => {
        applySelectedAddress(target, address);
        addressHistoryService.addAddressHistory(address)
          .then(next => setCommonAddresses(dedupeAddresses(next).slice(0, 2)))
          .catch(() => null);
      },
      selectionReturnDepth: 1,
    });
  };

  const chooseCity = () => {
    setShowCityPicker(true);
  };

  const selectCity = (selectedCity: string) => {
    setCity(selectedCity);
    AsyncStorage.setItem(CITY_STORAGE_KEY, selectedCity).catch(() => null);
    setShowCityPicker(false);
  };

  const pickCityFromMap = () => {
    setShowCityPicker(false);
    navigation.navigate('MapPicker', {
      onSelect: (address: AddressData) => {
        const nextCity = cityFromAddress(address);
        if (!nextCity) {
          Alert.alert('提示', '未识别到城市，请手动选择。');
          return;
        }
        selectCity(nextCity);
      },
      returnSteps: 1,
    });
  };

  const selectTimeOption = (option: TimeOption) => {
    if (option !== '预约') {
      setTime(option);
      setScheduledDate(null);
      return;
    }
    setShowSchedulePicker(true);
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
      const params = {id: recentOrder.id, orderId: recentOrder.id};
      const rootNavigation = navigation.getParent?.();
      if (rootNavigation) {
        rootNavigation.dispatch(StackActions.replace('OrderLive', params));
        return;
      }
      if (navigation.replace) {
        navigation.replace('OrderLive', params);
        return;
      }
      navigation.navigate('OrderLive', params);
      return;
    }
    navigation.navigate('Orders');
  };

  const requestPlan = () => {
    if (!pickup || !dropoff) {
      Alert.alert('提示', '请先选择起吊点和落放点。');
      return;
    }
    const schedule = buildScheduleFromTimeOption(time, scheduledDate);
    const quickOrderDraft: QuickOrderDraft = {
      cargo_scene: 'power_grid',
      cargo_type: '重载物资',
      cargo_weight_kg: weightDraftValueMap[weight],
      departure_address: pickup,
      destination_address: dropoff,
      scheduled_start_at: schedule.start.toISOString(),
      scheduled_end_at: schedule.end.toISOString(),
      match_region: city,
    };
    navigation.navigate('QuickOrderEntry', {quickOrderDraft, from: 'customerHome'});
  };

  const renderOption = <T extends string>(
    option: OptionButton<T>,
    y: number,
    selected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={option.label}
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        frame(option.x, y, option.w, 66),
        styles.optionButton,
        {
          borderRadius: dp(9),
          borderWidth: selected ? Math.max(1, dp(2)) : StyleSheet.hairlineWidth,
        },
        selected && styles.optionButtonActive,
      ]}>
      <DesignText
        style={[
          type(26, 32, '500', selected ? '#FF5510' : '#0B1D43'),
          styles.centerText,
        ]}>
        {option.label}
      </DesignText>
    </TouchableOpacity>
  );

  const renderImage = (
    source: ImageSourcePropType,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => (
    <Image source={source} style={imageFrame(x, y, w, h)} resizeMode="contain" />
  );

  const canvasHeight = dp(DESIGN_CONTENT_BOTTOM);
  const scheduleChoices = buildScheduleChoices();
  const cityOptions = useMemo(
    () => uniqueTextList([
      city,
      cityFromAddress(pickup),
      cityFromAddress(dropoff),
      ...commonAddresses.map(cityFromAddress),
      ...DEFAULT_CITY_OPTIONS,
    ]),
    [city, commonAddresses, dropoff, pickup],
  );

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {height: canvasHeight + Math.max(0, insets.bottom - 12)},
        ]}>
        <View style={[styles.canvas, {width: screenWidth, height: canvasHeight}]}>
          <LinearGradient
            colors={['#00386C', '#034A88']}
            start={{x: 0.1, y: 0}}
            end={{x: 0.92, y: 1}}
            style={[styles.topBlue, {height: dp(492)}]}
          />
          <View
            style={[
              styles.topCurve,
              {
                top: dp(463),
                left: dp(-96),
                width: screenWidth + dp(192),
                height: dp(82),
                borderTopLeftRadius: dp(520),
                borderTopRightRadius: dp(520),
              },
            ]}
          />

          <DesignText style={[frame(34, 135, 68, 40), type(32, 40, '700', '#FFFFFF')]}>
            {city}
          </DesignText>
          {renderImage(customerHomeAssets.navChevronDown, 116, 150, 18, 12)}
          <DesignText
            style={[
              frame(284, 126, 284, 48),
              type(38, 48, '700', '#FFFFFF'),
              styles.centerText,
            ]}>
            预约无人机吊运
          </DesignText>
          {renderImage(customerHomeAssets.navChat, 719, 132, 40, 38)}
          <DesignText style={[frame(766, 135, 52, 36), type(27, 36, '500', '#FFFFFF')]}>
            客服
          </DesignText>
          <TouchableOpacity activeOpacity={1} onPress={chooseCity} style={[frame(28, 118, 118, 64), styles.touchOverlay]} />
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => navigation.navigate('MainTabs', {screen: 'Messages'})}
            style={[frame(704, 116, 130, 68), styles.touchOverlay]}
          />

          <View
            style={[
              frame(20, 211, 812, 902),
              styles.whiteCard,
              {borderRadius: dp(24)},
              cardShadow(0.1, 18, 8, 6),
            ]}
          />
          {renderImage(customerHomeAssets.bookingClipboard, 61, 247, 42, 48)}
          <DesignText style={[frame(128, 251, 151, 46), type(35, 46, '700', '#061E4F')]}>
            预约吊运
          </DesignText>
          <View
            style={[
              frame(49, 319, 754, 765),
              styles.formInner,
              {borderRadius: dp(18)},
            ]}
          />

          {renderImage(customerHomeAssets.locationStart, 78, 360, 38, 44)}
          <DesignText style={[frame(132, 367, 74, 32), type(26, 32, '700', '#061E4F')]}>
            起吊点
          </DesignText>
          <DesignText
            numberOfLines={1}
            style={[
              frame(350, 367, 280, 32),
              type(26, 32, '400', pickup ? '#061E4F' : '#7180A0'),
            ]}>
            {formatAddressTitle(pickup) || '请选择货物起吊位置'}
          </DesignText>
          {renderImage(customerHomeAssets.chevronRight, 756, 368, 22, 34)}
          <View style={[frame(80, 438, 688, 1), styles.divider]} />

          {renderImage(customerHomeAssets.locationEnd, 78, 475, 38, 44)}
          <DesignText style={[frame(132, 485, 74, 32), type(26, 32, '700', '#061E4F')]}>
            落放点
          </DesignText>
          <DesignText
            numberOfLines={1}
            style={[
              frame(350, 485, 280, 32),
              type(26, 32, '400', dropoff ? '#061E4F' : '#7180A0'),
            ]}>
            {formatAddressTitle(dropoff) || '请选择货物落放位置'}
          </DesignText>
          {renderImage(customerHomeAssets.chevronRight, 756, 483, 22, 34)}
          <View style={[frame(80, 553, 688, 1), styles.divider]} />
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => openAddressPicker('pickup')}
            style={[frame(49, 319, 754, 111), styles.touchOverlay]}
          />
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => openAddressPicker('dropoff')}
            style={[frame(49, 439, 754, 112), styles.touchOverlay]}
          />

          {renderImage(customerHomeAssets.weightKg, 78, 590, 36, 42)}
          <DesignText style={[frame(132, 595, 104, 36), type(28, 36, '700', '#061E4F')]}>
            货物重量
          </DesignText>
          {weightOptions.map(option =>
            renderOption(option, 657, weight === option.label, () => setWeight(option.label)),
          )}
          <View style={[frame(80, 755, 688, 1), styles.divider]} />

          {renderImage(customerHomeAssets.clock, 78, 790, 38, 38)}
          <DesignText style={[frame(132, 798, 104, 36), type(28, 36, '700', '#061E4F')]}>
            作业时间
          </DesignText>
          {timeOptions.map(option =>
            renderOption(option, 858, time === option.label, () => selectTimeOption(option.label)),
          )}
          {time === '预约' && scheduledDate ? (
            <DesignText
              numberOfLines={1}
              style={[frame(285, 924, 300, 28), type(21, 28, '500', '#FF5510'), styles.centerText]}>
              已约 {formatScheduleLabel(scheduledDate)}
            </DesignText>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={requestPlan}
            style={[frame(68, 962, 715, 99), styles.planButtonClip, {borderRadius: dp(15)}]}>
            <LinearGradient
              colors={['#FF5B04', '#FF4A00']}
              start={{x: 0, y: 0.5}}
              end={{x: 1, y: 0.5}}
              style={styles.fillCenter}>
              <DesignText style={[type(34, 42, '700', '#FFFFFF'), styles.centerText]}>
                获取吊运方案
              </DesignText>
            </LinearGradient>
          </TouchableOpacity>

          <View
            style={[
              frame(20, 1138, 812, 130),
              styles.whiteCard,
              {borderRadius: dp(20)},
              cardShadow(0.08, 14, 6, 4),
            ]}
          />
          {trustItems.map(item => (
            <React.Fragment key={item.title}>
              {renderImage(item.icon, item.iconX, 1168, 58, 58)}
              <DesignText
                style={[
                  frame(item.textX, 1168, item.title.length > 4 ? 142 : 118, 30),
                  type(22, 30, '700', '#061E4F'),
                ]}
                numberOfLines={1}>
                {item.title}
              </DesignText>
              <DesignText
                style={[frame(item.textX, 1203, 132, 28), type(21, 28, '400', '#617193')]}
                numberOfLines={1}>
                {item.desc}
              </DesignText>
            </React.Fragment>
          ))}
          <View style={[frame(269, 1168, 1, 70), styles.verticalDivider]} />
          <View style={[frame(568, 1168, 1, 70), styles.verticalDivider]} />
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => navigation.navigate('ServiceHub')}
            style={[frame(286, 1138, 270, 130), styles.touchOverlay]}
          />

          <View
            style={[
              frame(20, 1297, 388, 354),
              styles.whiteCard,
              {borderRadius: dp(20)},
              cardShadow(0.08, 14, 6, 4),
            ]}
          />
          <DesignText style={[frame(52, 1331, 151, 34), type(26, 34, '700', '#061E4F')]}>
            常用起吊点
          </DesignText>
          <DesignText
            numberOfLines={1}
            style={[frame(276, 1334, 88, 28), type(21, 28, '400', '#65728F')]}>
            查看全部
          </DesignText>
          {renderImage(customerHomeAssets.chevronRight, 366, 1335, 11, 18)}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => openAddressPicker('pickup')}
            style={[frame(260, 1318, 126, 54), styles.touchOverlay]}
          />
          {renderImage(customerHomeAssets.locationPin, 52, 1394, 32, 38)}
          <DesignText
            numberOfLines={1}
            style={[frame(96, 1395, 206, 30), type(23, 30, '700', commonAddresses[0] ? '#061E4F' : '#7180A0')]}>
            {formatAddressTitle(commonAddresses[0]) || '暂无常用起吊点'}
          </DesignText>
          <DesignText style={[frame(96, 1434, 160, 28), type(22, 28, '400', '#6A7896')]}>
            {formatAddressDetail(commonAddresses[0]) || '选点后自动记录'}
          </DesignText>
          {commonAddresses[0] ? renderImage(customerHomeAssets.starFilled, 355, 1397, 34, 34) : null}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => applyCommonPickup(commonAddresses[0])}
            style={[frame(34, 1378, 360, 84), styles.touchOverlay]}
          />
          <View style={[frame(50, 1486, 326, 1), styles.divider]} />
          {renderImage(customerHomeAssets.locationPin, 52, 1513, 32, 38)}
          <DesignText
            numberOfLines={1}
            style={[frame(96, 1514, 170, 30), type(23, 30, '700', commonAddresses[1] ? '#061E4F' : '#7180A0')]}>
            {formatAddressTitle(commonAddresses[1]) || '地图选点'}
          </DesignText>
          <DesignText style={[frame(96, 1552, 130, 28), type(22, 28, '400', '#6A7896')]}>
            {formatAddressDetail(commonAddresses[1]) || '保存为最近起吊点'}
          </DesignText>
          {commonAddresses[1] ? renderImage(customerHomeAssets.starOutline, 355, 1516, 34, 34) : null}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => applyCommonPickup(commonAddresses[1])}
            style={[frame(34, 1496, 360, 84), styles.touchOverlay]}
          />

          <View
            style={[
              frame(431, 1297, 401, 354),
              styles.whiteCard,
              {borderRadius: dp(20)},
              cardShadow(0.08, 14, 6, 4),
            ]}
          />
          <DesignText style={[frame(461, 1331, 169, 34), type(26, 34, '700', '#061E4F')]}>
            最近一次吊运
          </DesignText>
          <DesignText
            numberOfLines={1}
            style={[frame(704, 1334, 88, 28), type(21, 28, '400', '#65728F')]}>
            查看详情
          </DesignText>
          {renderImage(customerHomeAssets.chevronRight, 800, 1335, 11, 18)}
          <TouchableOpacity
            activeOpacity={1}
            onPress={openRecentOrder}
            style={[frame(688, 1318, 126, 54), styles.touchOverlay]}
          />
          <View style={[frame(455, 1376, 349, 260), styles.recentInner, {borderRadius: dp(14)}]} />
          <TouchableOpacity
            activeOpacity={1}
            onPress={openRecentOrder}
            style={[frame(455, 1376, 349, 260), styles.touchOverlay]}
          />
          <View style={[frame(474, 1395, 72, 34), styles.doneBadge, !recentOrder && styles.emptyBadge, {borderRadius: dp(8)}]}>
            <DesignText style={[type(20, 26, '600', recentOrder ? '#13A154' : '#65728F'), styles.centerText]}>
              {getRecentOrderStatus(recentOrder)}
            </DesignText>
          </View>
          <DesignText
            numberOfLines={1}
            style={[frame(474, 1445, 284, 30), type(22, 30, '700', recentOrder ? '#061E4F' : '#7180A0')]}>
            {getRecentOrderRoute(recentOrder)}
          </DesignText>
          <DesignText style={[frame(474, 1501, 90, 28), type(21, 28, '400', '#6A7896')]}>
            货物重量
          </DesignText>
          <DesignText style={[frame(742, 1501, 43, 28), type(21, 28, '500', '#061E4F')]}>
            {getRecentOrderWeight(recentOrder)}
          </DesignText>
          <DesignText style={[frame(474, 1553, 90, 28), type(21, 28, '400', '#6A7896')]}>
            作业时间
          </DesignText>
          <DesignText
            numberOfLines={1}
            style={[
              frame(595, 1553, 190, 28),
              type(20, 28, '500', '#061E4F'),
              styles.rightText,
            ]}>
            {formatOrderDate(recentOrder?.start_time)}
          </DesignText>
          <DesignText style={[frame(474, 1604, 70, 28), type(21, 28, '400', '#6A7896')]}>
            订单号
          </DesignText>
          <DesignText
            numberOfLines={1}
            style={[
              frame(595, 1604, 190, 28),
              type(20, 28, '500', '#65728F'),
              styles.rightText,
            ]}>
            {recentOrder?.order_no || '--'}
          </DesignText>
        </View>
      </ScrollView>
      <Modal transparent visible={showCityPicker} animationType="fade" onRequestClose={() => setShowCityPicker(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalMask} onPress={() => setShowCityPicker(false)}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>选择城市</Text>
            <View style={styles.modalGrid}>
              {cityOptions.map(item => (
                <TouchableOpacity
                  key={item}
                  activeOpacity={0.82}
                  style={[styles.modalChip, city === item && styles.modalChipActive]}
                  onPress={() => selectCity(item)}>
                  <Text style={[styles.modalChipText, city === item && styles.modalChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity activeOpacity={0.84} style={styles.mapCityButton} onPress={pickCityFromMap}>
              <Text style={styles.mapCityButtonText}>{CITY_MAP_PICKER_OPTION}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal transparent visible={showSchedulePicker} animationType="fade" onRequestClose={() => setShowSchedulePicker(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalMask} onPress={() => setShowSchedulePicker(false)}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>选择作业时间</Text>
            <Text style={styles.modalHint}>系统默认按 2 小时作业窗口匹配服务。</Text>
            <View style={styles.scheduleGrid}>
              {scheduleChoices.map(item => {
                const active = scheduledDate?.getTime() === item.value.getTime();
                return (
                  <TouchableOpacity
                    key={`${formatDateKey(item.value)}-${item.value.getHours()}-${item.value.getMinutes()}`}
                    activeOpacity={0.82}
                    style={[styles.scheduleChip, active && styles.modalChipActive]}
                    onPress={() => {
                      setTime('预约');
                      setScheduledDate(item.value);
                      setShowSchedulePicker(false);
                    }}>
                    <Text style={[styles.modalChipText, active && styles.modalChipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scrollContent: {
    backgroundColor: '#F7F9FC',
  },
  canvas: {
    position: 'relative',
    backgroundColor: '#F7F9FC',
    overflow: 'hidden',
  },
  topBlue: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topCurve: {
    position: 'absolute',
    backgroundColor: '#F7F9FC',
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
  },
  formInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8E0EA',
  },
  divider: {
    backgroundColor: '#E1E6EF',
  },
  verticalDivider: {
    backgroundColor: '#E2E6EE',
  },
  optionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#CBD3DF',
    backgroundColor: '#FFFFFF',
  },
  optionButtonActive: {
    borderColor: '#FF5A16',
    backgroundColor: '#FFF7F2',
  },
  fillCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planButtonClip: {
    overflow: 'hidden',
  },
  centerText: {
    textAlign: 'center',
  },
  rightText: {
    textAlign: 'right',
  },
  touchOverlay: {
    backgroundColor: 'transparent',
    zIndex: 6,
  },
  recentInner: {
    position: 'absolute',
    backgroundColor: '#F1F7FF',
  },
  doneBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDF8E6',
  },
  emptyBadge: {
    backgroundColor: '#EDF2F7',
  },
  modalMask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 20, 50, 0.42)',
  },
  modalPanel: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    color: '#061E4F',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  modalHint: {
    marginTop: 6,
    color: '#65728F',
    fontSize: 13,
    lineHeight: 18,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  mapCityButton: {
    height: 44,
    marginTop: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
  },
  mapCityButtonText: {
    color: '#005BFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  modalChip: {
    minWidth: 86,
    height: 42,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD3DF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalChipActive: {
    borderWidth: 1,
    borderColor: '#FF5A16',
    backgroundColor: '#FFF7F2',
  },
  modalChipText: {
    color: '#0B1D43',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  modalChipTextActive: {
    color: '#FF5510',
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  scheduleChip: {
    minWidth: 140,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD3DF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
