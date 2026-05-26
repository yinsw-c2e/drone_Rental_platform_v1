import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  ImageStyle,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {checkAirspaceAvailability, AirspaceCheckResult} from '../../services/airspace';
import {AddressData, QuickOrderDraft} from '../../types';
import {isAirspaceHardBlocked} from '../../utils/airspaceRisk';
import {quickOrderConfirmAssets} from '../../assets/haul/quickOrderConfirm';

const DESIGN_WIDTH = 852;
const DESIGN_CONTENT_BOTTOM = 1618;
const DESIGN_TOTAL_HEIGHT = 1847;

const sceneOptions = [
  {key: 'power_grid', label: '电网建设'},
  {key: 'mountain_agriculture', label: '山区农副产品'},
  {key: 'plateau_supply', label: '高原给养'},
  {key: 'island_supply', label: '海岛补给'},
  {key: 'emergency', label: '应急救援'},
];

type ServicePlanKey = 'standard' | 'urgent' | 'survey';

type DesignTextProps = React.PropsWithChildren<{
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>;

const servicePlans: Array<{
  key: ServicePlanKey;
  title: string;
  subtitle: string;
  price: string;
  prefix?: string;
  suffix?: string;
  recommended?: boolean;
}> = [
  {
    key: 'standard',
    title: '标准吊运',
    subtitle: '服务商确认后生效',
    prefix: '预计',
    price: '￥680',
    suffix: '起',
    recommended: true,
  },
  {
    key: 'urgent',
    title: '加急吊运',
    subtitle: '优先匹配服务商',
    prefix: '预计',
    price: '￥860',
    suffix: '起',
  },
  {
    key: 'survey',
    title: '现场勘查',
    subtitle: '勘查费用可抵扣服务费',
    price: '￥99',
  },
];

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function buildDefaultStartDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function buildDefaultEndDate(startDate: Date): Date {
  const date = new Date(startDate.getTime());
  date.setHours(date.getHours() + 2);
  return date;
}

function parseDraftDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const normalizeScene = (scene?: string) =>
  sceneOptions.some(item => item.key === scene) ? String(scene) : sceneOptions[0].key;

const formatAddress = (addr?: AddressData | null) =>
  addr?.address || addr?.name || '';

const compactAddress = (addr?: AddressData | null, placeholder = '请选择作业地点') =>
  formatAddress(addr) || placeholder;

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

const DesignText = ({style, numberOfLines, children}: DesignTextProps) => (
  <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
    {children}
  </Text>
);

export default function QuickOrderEntryScreen({navigation, route}: any) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const screenWidth = width || DESIGN_WIDTH;
  const scale = screenWidth / DESIGN_WIDTH;
  const homeDraft = route?.params?.quickOrderDraft as QuickOrderDraft | undefined;
  const defaultStartDate = useMemo(
    () => parseDraftDate(homeDraft?.scheduled_start_at) || buildDefaultStartDate(),
    [homeDraft?.scheduled_start_at],
  );
  const defaultEndDate = useMemo(
    () => parseDraftDate(homeDraft?.scheduled_end_at) || buildDefaultEndDate(defaultStartDate),
    [defaultStartDate, homeDraft?.scheduled_end_at],
  );

  const [cargoScene] = useState(normalizeScene(homeDraft?.cargo_scene));
  const [cargoWeight] = useState(homeDraft?.cargo_weight_kg ? String(homeDraft.cargo_weight_kg) : '');
  const [cargoType] = useState(homeDraft?.cargo_type || '重载物资');
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(homeDraft?.departure_address || null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(homeDraft?.destination_address || null);
  const [extraWorkPoint, setExtraWorkPoint] = useState<AddressData | null>(null);
  const [startDate] = useState(defaultStartDate);
  const [endDate] = useState(defaultEndDate);
  const [pickupAirspace, setPickupAirspace] = useState<AirspaceCheckResult | null>(null);
  const [deliveryAirspace, setDeliveryAirspace] = useState<AirspaceCheckResult | null>(null);
  const [checkingPickupAirspace, setCheckingPickupAirspace] = useState(false);
  const [checkingDeliveryAirspace, setCheckingDeliveryAirspace] = useState(false);
  const [airspaceError, setAirspaceError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ServicePlanKey>('standard');

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
  const cardShadow = (opacity = 0.08): ViewStyle => ({
    shadowColor: '#061E5E',
    shadowOpacity: opacity,
    shadowRadius: dp(14),
    shadowOffset: {width: 0, height: dp(6)},
    elevation: 5,
  });

  useEffect(() => {
    let cancelled = false;
    if (!pickupAddress?.latitude || !pickupAddress?.longitude) {
      setPickupAirspace(null);
      setCheckingPickupAirspace(false);
      return () => {
        cancelled = true;
      };
    }
    setCheckingPickupAirspace(true);
    setAirspaceError(false);
    checkAirspaceAvailability(pickupAddress.latitude, pickupAddress.longitude, 120)
      .then(result => {
        if (!cancelled) {
          setPickupAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPickupAirspace(null);
          setAirspaceError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingPickupAirspace(false);
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
      setCheckingDeliveryAirspace(false);
      return () => {
        cancelled = true;
      };
    }
    setCheckingDeliveryAirspace(true);
    setAirspaceError(false);
    checkAirspaceAvailability(deliveryAddress.latitude, deliveryAddress.longitude, 120)
      .then(result => {
        if (!cancelled) {
          setDeliveryAirspace(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryAirspace(null);
          setAirspaceError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingDeliveryAirspace(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryAddress?.latitude, deliveryAddress?.longitude]);

  const hasAirspaceHardBlock =
    isAirspaceHardBlocked(pickupAirspace) || isAirspaceHardBlocked(deliveryAirspace);
  const checkingAirspace = checkingPickupAirspace || checkingDeliveryAirspace;
  const routeDistance = useMemo(
    () => distanceKm(pickupAddress, deliveryAddress),
    [pickupAddress, deliveryAddress],
  );
  const durationMinutes = routeDistance > 0
    ? Math.max(30, Math.round(25 + routeDistance * 2.3))
    : 45;
  const airspaceStatus = useMemo(() => {
    if (checkingAirspace) return {label: '检测中', tone: 'checking' as const};
    if (airspaceError) return {label: '重试', tone: 'warning' as const};
    if (hasAirspaceHardBlock) return {label: '受限', tone: 'danger' as const};
    if (pickupAddress && deliveryAddress) return {label: '可飞', tone: 'ok' as const};
    return {label: '待检测', tone: 'pending' as const};
  }, [airspaceError, checkingAirspace, deliveryAddress, hasAirspaceHardBlock, pickupAddress]);

  const openAddressPicker = (target: 'pickup' | 'delivery' | 'extra') => {
    navigation.navigate('AddressPicker', {
      onSelect: (address: AddressData) => {
        if (target === 'pickup') {
          setPickupAddress(address);
        } else if (target === 'delivery') {
          setDeliveryAddress(address);
        } else {
          setExtraWorkPoint(address);
        }
      },
      selectionReturnDepth: 1,
    });
  };

  const handleEditLocation = () => {
    Alert.alert('编辑作业地点', undefined, [
      {text: '起吊点', onPress: () => openAddressPicker('pickup')},
      {text: '落放点', onPress: () => openAddressPicker('delivery')},
      {text: '取消', style: 'cancel'},
    ]);
  };

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', {screen: 'Home'});
  };

  const buildDraft = (): QuickOrderDraft => {
    const extraText = extraWorkPoint ? `，途经作业点：${formatAddress(extraWorkPoint)}` : '';
    return {
      cargo_scene: cargoScene,
      cargo_type: cargoType.trim() || '重载物资',
      cargo_weight_kg: Number(cargoWeight) || undefined,
      departure_address: pickupAddress,
      destination_address: deliveryAddress,
      scheduled_start_at: startDate.toISOString(),
      scheduled_end_at: endDate.toISOString(),
      description: `${planTitle(selectedPlan)}：${compactAddress(pickupAddress)} 到 ${compactAddress(deliveryAddress)}吊运${extraText}`,
      special_requirements: `服务方案：${planTitle(selectedPlan)}；预计开始：${formatDateTime(startDate)}`,
      match_region: homeDraft?.match_region,
    };
  };

  const handleSubmit = () => {
    if (!pickupAddress || !deliveryAddress) {
      Alert.alert('提示', '请先确认起吊点和落放点。');
      return;
    }
    if (!cargoWeight || Number(cargoWeight) <= 0) {
      Alert.alert('提示', '请返回首页选择有效的货物重量。');
      return;
    }
    if (checkingAirspace) {
      Alert.alert('提示', '空域检测中，请稍候。');
      return;
    }
    if (airspaceError) {
      Alert.alert('提示', '空域检测失败，请重新选择作业地点。');
      return;
    }
    if (hasAirspaceHardBlock) {
      Alert.alert('当前位置受限', '起吊点或落放点命中禁飞区，请先调整地址。');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('提示', '结束时间需要晚于开始时间。');
      return;
    }
    navigation.navigate('OfferList', {
      quickOrderDraft: buildDraft(),
      selectedServicePlan: selectedPlan,
      from: 'quickOrderConfirm',
    });
  };

  const renderImage = (
    source: ImageSourcePropType,
    x: number,
    y: number,
    w: number,
    h: number,
    extraStyle?: StyleProp<ImageStyle>,
  ) => (
    <Image source={source} style={[imageFrame(x, y, w, h), extraStyle]} resizeMode="contain" />
  );

  const renderPlan = (plan: typeof servicePlans[number], index: number) => {
    const active = selectedPlan === plan.key;
    const y = [1268, 1377, 1486][index];
    return (
      <React.Fragment key={plan.key}>
        {renderImage(active ? quickOrderConfirmAssets.radioSelected : quickOrderConfirmAssets.radioUnselected, 91, y + 33, 38, 39)}
        <DesignText style={[frame(167, y + 20, 130, 32), type(28, 34, '700', '#061E5B')]}>
          {plan.title}
        </DesignText>
        {plan.recommended ? (
          <View style={[frame(302, y + 19, 66, 37), styles.recommendBadge, {borderRadius: dp(7)}]}>
            <DesignText style={[type(22, 27, '600', '#FFFFFF'), styles.centerText]}>推荐</DesignText>
          </View>
        ) : null}
        <DesignText style={[frame(167, y + 59, 200, 29), type(24, 30, '400', '#56668C')]}>
          {plan.subtitle}
        </DesignText>
        <View style={[frame(plan.key === 'survey' ? 704 : 605, y + 20, plan.key === 'survey' ? 79 : 179, 42), styles.priceWrap]}>
          {plan.prefix ? <DesignText style={type(24, 30, '400', '#FF5A0A')}>{plan.prefix}</DesignText> : null}
          <DesignText style={type(plan.key === 'survey' ? 40 : 39, 44, '800', '#FF5A0A')}>{plan.price}</DesignText>
          {plan.suffix ? <DesignText style={type(22, 28, '500', '#FF5A0A')}>{plan.suffix}</DesignText> : null}
        </View>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setSelectedPlan(plan.key)}
          style={frame(51, y, 752, 109)}
        />
      </React.Fragment>
    );
  };

  const bottomBarHeight = dp(DESIGN_TOTAL_HEIGHT - DESIGN_CONTENT_BOTTOM) + insets.bottom;
  const canvasHeight = dp(DESIGN_CONTENT_BOTTOM) + bottomBarHeight;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={['#00518B', '#00356F', '#00275C']}
        start={{x: 0.25, y: 0}}
        end={{x: 0.88, y: 1}}
        style={[styles.topBlue, {width: screenWidth, height: dp(482)}]}
      />
      <View style={[styles.navLayer, {width: screenWidth, height: dp(218)}]}>
        {renderImage(quickOrderConfirmAssets.navBack, 31, 134, 26, 40)}
        <DesignText style={[frame(312, 132, 228, 44), type(38, 48, '700', '#FFFFFF'), styles.centerText]}>
          确认吊运信息
        </DesignText>
        {renderImage(quickOrderConfirmAssets.navChat, 712, 135, 42, 37)}
        <DesignText style={[frame(765, 139, 56, 33), type(28, 34, '500', '#FFFFFF')]}>客服</DesignText>
        <TouchableOpacity activeOpacity={0.82} onPress={handleBack} style={frame(20, 112, 64, 70)} />
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => navigation.navigate('MainTabs', {screen: 'Messages'})}
          style={frame(704, 122, 130, 66)}
        />
      </View>

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{height: canvasHeight}}>
        <View style={[styles.canvas, {width: screenWidth, height: canvasHeight}]}>
          <View style={[frame(21, 218, 810, 441), styles.card, {borderRadius: dp(24)}, cardShadow(0.08)]} />
          {renderImage(quickOrderConfirmAssets.sectionLocationPin, 58, 255, 48, 50)}
          <DesignText style={[frame(126, 264, 129, 42), type(34, 42, '700', '#061E5B')]}>作业地点</DesignText>
          <TouchableOpacity activeOpacity={0.82} onPress={handleEditLocation} style={frame(720, 250, 90, 70)}>
            <DesignText style={[frame(741, 267, 54, 33), type(28, 34, '500', '#005BFF')]}>编辑</DesignText>
          </TouchableOpacity>
          <View style={[frame(50, 328, 753, 296), styles.innerBox, {borderRadius: dp(16)}]} />
          {renderImage(quickOrderConfirmAssets.routeStartPin, 73, 358, 39, 45)}
          <View style={[frame(90, 400, 1, 66), styles.routeDash]} />
          {renderImage(quickOrderConfirmAssets.routeEndPin, 73, 466, 39, 45)}
          <DesignText style={[frame(130, 367, 83, 32), type(28, 34, '700', '#061E5B')]}>起吊点</DesignText>
          <DesignText numberOfLines={1} style={[frame(329, 368, 321, 31), type(27, 34, '400', pickupAddress ? '#58688E' : '#8B97B0')]}>
            {compactAddress(pickupAddress, '请选择货物起吊位置')}
          </DesignText>
          {renderImage(quickOrderConfirmAssets.chevronRight, 754, 367, 19, 31)}
          <TouchableOpacity activeOpacity={0.82} onPress={() => openAddressPicker('pickup')} style={frame(50, 328, 753, 108)} />
          <View style={[frame(113, 432, 662, 1), styles.line]} />
          <DesignText style={[frame(130, 474, 83, 32), type(28, 34, '700', '#061E5B')]}>落放点</DesignText>
          <DesignText numberOfLines={1} style={[frame(329, 475, 265, 31), type(27, 34, '400', deliveryAddress ? '#58688E' : '#8B97B0')]}>
            {compactAddress(deliveryAddress, '请选择货物落放位置')}
          </DesignText>
          {renderImage(quickOrderConfirmAssets.chevronRight, 754, 474, 19, 31)}
          <TouchableOpacity activeOpacity={0.82} onPress={() => openAddressPicker('delivery')} style={frame(50, 436, 753, 108)} />
          <View style={[frame(78, 542, 697, 1), styles.line]} />
          {renderImage(quickOrderConfirmAssets.addWorkPointPlus, 337, 568, 28, 28)}
          <DesignText style={[frame(379, 568, 160, 30), type(26, 32, '500', '#0052D9')]}>
            {extraWorkPoint ? '已添加作业点' : '添加作业点'}
          </DesignText>
          <TouchableOpacity activeOpacity={0.82} onPress={() => openAddressPicker('extra')} style={[frame(260, 552, 310, 62), styles.addPointHit]} />

          <View style={[frame(21, 680, 810, 466), styles.card, {borderRadius: dp(24)}, cardShadow(0.07)]} />
          {renderImage(quickOrderConfirmAssets.sectionDetectionShield, 59, 712, 44, 51)}
          <DesignText style={[frame(126, 721, 224, 42), type(34, 42, '700', '#061E5B')]}>智能检测结果</DesignText>
          <View style={[frame(50, 784, 753, 273), styles.innerBox, {borderRadius: dp(16)}]} />
          <View style={[frame(424, 784, 1, 273), styles.line]} />
          <View style={[frame(50, 918, 753, 1), styles.line]} />
          {renderImage(quickOrderConfirmAssets.detectAirspace, 86, 823, 55, 56)}
          <DesignText style={[frame(166, 816, 110, 32), type(27, 34, '700', '#061E5B')]}>空域检测</DesignText>
          <View style={[frame(166, 853, 84, 37), styles.statusBadge, styles[`${airspaceStatus.tone}Badge`], {borderRadius: dp(7)}]}>
            <DesignText style={[type(22, 27, '600', '#0FA760'), styles.centerText, styles[`${airspaceStatus.tone}Text`]]}>{airspaceStatus.label}</DesignText>
          </View>
          {renderImage(quickOrderConfirmAssets.detectPayloadScale, 451, 819, 58, 58)}
          <DesignText style={[frame(531, 816, 110, 32), type(27, 34, '700', '#061E5B')]}>载重匹配</DesignText>
          <DesignText style={[frame(531, 861, 203, 30), type(25, 32, '400', '#56668C')]}>预计需 {payloadLevel(cargoWeight)} 级服务</DesignText>
          {renderImage(quickOrderConfirmAssets.detectDistancePin, 88, 956, 50, 60)}
          <DesignText style={[frame(166, 953, 110, 32), type(27, 34, '700', '#061E5B')]}>预计距离</DesignText>
          <DesignText style={[frame(166, 997, 100, 33), type(30, 36, '700', '#050B1E')]}>{routeDistance > 0 ? `${routeDistance.toFixed(1)} km` : '--'}</DesignText>
          {renderImage(quickOrderConfirmAssets.detectDurationClock, 452, 959, 53, 53)}
          <DesignText style={[frame(531, 953, 138, 32), type(27, 34, '700', '#061E5B')]}>预计作业时长</DesignText>
          <DesignText style={[frame(531, 997, 150, 33), type(30, 36, '700', '#050B1E')]}>约 {durationMinutes} 分钟</DesignText>
          {renderImage(quickOrderConfirmAssets.infoCircle, 57, 1094, 24, 24)}
          <DesignText style={[frame(94, 1091, 310, 29), type(23, 30, '400', '#6F7EA3')]}>最终费用以服务商确认方案为准</DesignText>

          <View style={[frame(21, 1169, 810, 449), styles.card, {borderRadius: dp(24)}, cardShadow(0.07)]} />
          {renderImage(quickOrderConfirmAssets.sectionPlanClipboard, 61, 1201, 38, 48)}
          <DesignText style={[frame(126, 1207, 224, 42), type(34, 42, '700', '#061E5B')]}>选择服务方案</DesignText>
          <View style={[frame(51, 1268, 752, 319), styles.innerBox, {borderRadius: dp(16)}]} />
          <View style={[frame(51, 1376, 752, 1), styles.line]} />
          <View style={[frame(51, 1485, 752, 1), styles.line]} />
          {servicePlans.map(renderPlan)}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, {height: bottomBarHeight, width: screenWidth, paddingBottom: insets.bottom}]}>
        <TouchableOpacity activeOpacity={0.82} onPress={handleBack} style={[frame(44, 30, 317, 95), styles.backButton, {borderRadius: dp(12)}]}>
          <DesignText style={[type(29, 36, '700', '#06296A'), styles.centerText]}>返回修改</DesignText>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={handleSubmit}
          disabled={hasAirspaceHardBlock}
          style={[frame(382, 30, 426, 95), styles.submitButton, hasAirspaceHardBlock && styles.disabledButton, {borderRadius: dp(12)}]}>
          <LinearGradient
            colors={['#FF680E', '#FF4B05']}
            start={{x: 0, y: 0.5}}
            end={{x: 1, y: 0.5}}
            style={styles.submitFill}>
            <DesignText style={[type(31, 38, '700', '#FFFFFF'), styles.centerText]}>提交预约</DesignText>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  topBlue: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  navLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
  canvas: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  innerBox: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DEE6F0',
  },
  line: {
    position: 'absolute',
    backgroundColor: '#E3E8F0',
  },
  routeDash: {
    position: 'absolute',
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderLeftColor: '#1F73FF',
  },
  addPointHit: {
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    backgroundColor: '#BDF4D8',
    justifyContent: 'center',
  },
  okBadge: {
    backgroundColor: '#BDF4D8',
  },
  checkingBadge: {
    backgroundColor: '#EDF3FF',
  },
  pendingBadge: {
    backgroundColor: '#EDF3FF',
  },
  warningBadge: {
    backgroundColor: '#FFF2DF',
  },
  dangerBadge: {
    backgroundColor: '#FFE6E1',
  },
  okText: {
    color: '#0FA760',
  },
  checkingText: {
    color: '#1F66F2',
  },
  pendingText: {
    color: '#1F66F2',
  },
  warningText: {
    color: '#D98200',
  },
  dangerText: {
    color: '#D64D32',
  },
  recommendBadge: {
    position: 'absolute',
    backgroundColor: '#FF5A0A',
    justifyContent: 'center',
  },
  priceWrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8EDF4',
    shadowColor: '#061E5E',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: -4},
    elevation: 10,
    zIndex: 20,
  },
  backButton: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#06296A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    position: 'absolute',
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
});
