import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
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

import {offerListAssets} from '../../assets/haul/offerList';
import {supplyService} from '../../services/supply';
import {store} from '../../store/store';
import {AddressData, QuickOrderDraft, SupplySummary} from '../../types';

const DESIGN_WIDTH = 852;
const DESIGN_TOTAL_HEIGHT = 1847;
const DESIGN_SCROLL_HEIGHT = 2020;

type DesignTextProps = React.PropsWithChildren<{
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>;

type OfferPlan = {
  key: string;
  title: string;
  logo: ImageSourcePropType;
  payloadText: string;
  priceText: string;
  tags: string[];
  supply: SupplySummary;
};

const logoByIndex = [offerListAssets.providerAnyi, offerListAssets.providerYunling, offerListAssets.providerQihang];
const providerCardTop = [539, 960, 1381];

const DesignText = ({style, numberOfLines, children}: DesignTextProps) => (
  <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
    {children}
  </Text>
);

function normalizeInitialQuickOrderDraft(params: any): QuickOrderDraft | undefined {
  if (params?.quickOrderDraft) {
    return params.quickOrderDraft as QuickOrderDraft;
  }
  if (params?.quickOrder) {
    return {
      cargo_scene: params.quickOrder.cargoScene || 'power_grid',
      cargo_weight_kg: Number(params.quickOrder.cargoWeight) || undefined,
      departure_address: params.quickOrder.pickupAddress || null,
      destination_address: params.quickOrder.deliveryAddress || null,
    };
  }
  return undefined;
}

function normalizeSupplies(res: any): SupplySummary[] {
  return (res?.data?.items || res?.items || []) as SupplySummary[];
}

function resolveMatchRegion(draft: QuickOrderDraft): string {
  return (
    draft.match_region?.trim() ||
    draft.destination_address?.city?.trim() ||
    draft.departure_address?.city?.trim() ||
    draft.destination_address?.district?.trim() ||
    draft.departure_address?.district?.trim() ||
    draft.destination_address?.address?.trim() ||
    draft.departure_address?.address?.trim() ||
    ''
  );
}

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

const formatSupplyPrice = (item: SupplySummary) => {
  const amount = Number(item.base_price_amount || 0);
  if (amount <= 0) return '待议';
  return `￥${Math.round(amount / 100)}`;
};

const formatPayloadText = (item: SupplySummary) => {
  const payload = Number(item.max_payload_kg || 0);
  return payload > 0 ? `${payload}kg` : '待确认';
};

const buildProviderTags = (item: SupplySummary) => {
  const tags = [
    item.accepts_direct_order ? '支持直达下单' : '',
    item.status === 'active' ? '服务中' : item.status ? `状态 ${item.status}` : '',
    Number(item.max_payload_kg || 0) > 0 ? `载重 ${formatPayloadText(item)}` : '',
  ].filter(Boolean);
  return tags.length > 0 ? tags : ['需服务商确认'];
};

const toOfferPlan = (item: SupplySummary, index: number): OfferPlan => ({
  key: `supply-${item.id}`,
  title: item.title || `服务商方案 #${item.id}`,
  logo: logoByIndex[index % logoByIndex.length],
  payloadText: formatPayloadText(item),
  priceText: formatSupplyPrice(item),
  tags: buildProviderTags(item),
  supply: item,
});

export default function OfferListScreen({route, navigation}: any) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const screenWidth = width || DESIGN_WIDTH;
  const scale = screenWidth / DESIGN_WIDTH;
  const routeDraft = useMemo(() => normalizeInitialQuickOrderDraft(route?.params), [route?.params]);
  const draft = routeDraft;

  const [supplies, setSupplies] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

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
  const cardShadow = (opacity = 0.09): ViewStyle => ({
    shadowColor: '#0C2550',
    shadowOpacity: opacity,
    shadowRadius: dp(16),
    shadowOffset: {width: 0, height: dp(8)},
    elevation: 6,
  });

  const fetchSupplies = useCallback(async () => {
    if (!draft) {
      setSupplies([]);
      setErrorText('缺少吊运需求信息，请从预约吊运重新进入。');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorText('');
      if (!store.getState().auth.accessToken) {
        setSupplies([]);
        setErrorText('请先登录后再选择服务商方案。');
        return;
      }
      const res = await supplyService.list({
        page: 1,
        page_size: 10,
        region: resolveMatchRegion(draft) || undefined,
        cargo_scene: draft.cargo_scene || undefined,
        min_payload_kg: draft.cargo_weight_kg,
        accepts_direct_order: true,
        service_type: 'heavy_cargo_lift_transport',
      });
      setSupplies(normalizeSupplies(res));
    } catch (error: any) {
      setSupplies([]);
      setErrorText(error?.message || '服务商方案加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [draft]);

  useEffect(() => {
    fetchSupplies();
  }, [fetchSupplies]);

  const plans = useMemo(
    () => supplies.slice(0, 3).map(toOfferPlan),
    [supplies],
  );

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', {screen: 'Orders'});
  };

  const handleService = () => navigation.navigate('MainTabs', {screen: 'Messages'});

  const handleSelectPlan = (plan: OfferPlan) => {
    navigation.navigate('OfferDetail', {
      id: plan.supply.id,
      quickOrderDraft: draft,
    });
  };

  const handleEmptyAction = () => {
    if (!draft) {
      navigation.replace('PublishCargo');
      return;
    }
    fetchSupplies();
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

  const renderProviderCard = (plan: OfferPlan, index: number) => {
    const top = providerCardTop[index] || providerCardTop[providerCardTop.length - 1];
    const cardHeight = index === 0 ? 400 : 402;
    return (
      <React.Fragment key={plan.key}>
        <View style={[frame(22, top, 806, cardHeight), styles.card, {borderRadius: dp(24)}, cardShadow()]} />
        {renderImage(plan.logo, 60, top + 26, 73, 73)}
        <DesignText style={[frame(158, top + 42, 310, 43), type(39, 47, '700', '#061736')]}>
          {plan.title}
        </DesignText>
        {renderImage(offerListAssets.starFilled, 548, top + 53, 34, 34)}
        <DesignText style={[frame(590, top + 50, 86, 35), type(31, 37, '500', '#061736')]}>真实供给</DesignText>
        <View style={[frame(699, top + 47, 1, 43), styles.metricDivider]} />
        <DesignText style={[frame(720, top + 50, 70, 35), type(31, 37, '500', '#061736')]}>#{plan.supply.id}</DesignText>
        <View style={[frame(60, top + 118, 733, 1), styles.line]} />
        {renderImage(offerListAssets.clock, 73, top + 153, 51, 51)}
        <DesignText style={[frame(132, top + 144, 105, 28), type(27, 34, '400', '#586B93')]}>最大载重</DesignText>
        <DesignText style={[frame(132, top + 179, 170, 37), type(34, 42, '600', '#061736')]}>{plan.payloadText}</DesignText>
        <View style={[frame(426, top + 118, 1, 100), styles.line]} />
        <DesignText style={[frame(452, top + 166, 51, 29), type(27, 34, '400', '#586B93')]}>报价</DesignText>
        <DesignText style={[frame(585, top + 150, 202, 64), type(58, 68, '800', '#FF5A04'), styles.rightText]}>
          {plan.priceText}
        </DesignText>
        <View style={[frame(60, top + 230, 620, 43), styles.tagRow]}>
          {plan.tags.slice(0, 3).map(tag => (
            <View key={tag} style={[styles.tag, {height: dp(43), paddingHorizontal: dp(17), marginRight: dp(18), borderRadius: dp(7)}]}>
              <DesignText style={type(26, 31, '500', '#009B45')}>{tag}</DesignText>
            </View>
          ))}
        </View>
        <TouchableOpacity activeOpacity={0.86} onPress={() => handleSelectPlan(plan)} style={[frame(60, top + 296, 733, 80), styles.selectButton, {borderRadius: dp(12)}]}>
          <LinearGradient
            colors={['#FF6505', '#FF4B00']}
            start={{x: 0, y: 0.5}}
            end={{x: 1, y: 0.5}}
            style={styles.fill}>
            <DesignText style={[type(34, 42, '700', '#FFFFFF'), styles.centerText]}>选择此方案</DesignText>
          </LinearGradient>
        </TouchableOpacity>
      </React.Fragment>
    );
  };

  const renderEmptyState = () => {
    const title = loading ? '正在匹配服务商方案...' : errorText || '暂无可直达下单的服务商方案';
    const subtitle = loading
      ? '正在根据起落点、载重和场景查询真实供给。'
      : errorText
        ? '不会展示本地兜底方案，请处理后重试。'
        : '当前筛选条件下后端没有返回真实服务商，可调整地点、载重或改为发布任务等待报价。';
    return (
      <React.Fragment>
        <View style={[frame(22, 539, 806, 336), styles.card, {borderRadius: dp(24)}, cardShadow(0.08)]} />
        <DesignText style={[frame(92, 620, 668, 42), type(34, 42, '700', '#061E4F'), styles.centerText]}>
          {title}
        </DesignText>
        <DesignText style={[frame(92, 682, 668, 70), type(27, 36, '400', '#586B93'), styles.centerText]}>
          {subtitle}
        </DesignText>
        {!loading ? (
          <TouchableOpacity activeOpacity={0.86} onPress={handleEmptyAction} style={[frame(226, 780, 400, 74), styles.emptyActionButton, {borderRadius: dp(12)}]}>
            <DesignText style={[type(30, 38, '700', '#FFFFFF'), styles.centerText]}>
              {draft ? '重新匹配' : '重新填写需求'}
            </DesignText>
          </TouchableOpacity>
        ) : null}
      </React.Fragment>
    );
  };

  const bottomBarHeight = dp(DESIGN_TOTAL_HEIGHT - 1661) + insets.bottom;
  const canvasHeight = dp(DESIGN_SCROLL_HEIGHT) + bottomBarHeight;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={['#00377B', '#004A9B', '#00306B']}
        start={{x: 0.08, y: 0}}
        end={{x: 0.92, y: 1}}
        style={[styles.topBlue, {width: screenWidth, height: dp(374)}]}
      />
      <View style={[styles.navLayer, {width: screenWidth, height: dp(211)}]}>
        {renderImage(offerListAssets.navBack, 33, 128, 26, 42)}
        <DesignText style={[frame(328, 132, 197, 46), type(40, 48, '700', '#FFFFFF'), styles.centerText]}>
          服务商方案
        </DesignText>
        {renderImage(offerListAssets.navChat, 701, 129, 43, 40)}
        <DesignText style={[frame(751, 135, 61, 30), type(28, 34, '500', '#FFFFFF')]}>客服</DesignText>
        <TouchableOpacity activeOpacity={0.82} onPress={handleBack} style={frame(18, 112, 72, 72)} />
        <TouchableOpacity activeOpacity={0.82} onPress={handleService} style={frame(690, 112, 140, 72)} />
      </View>

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{height: canvasHeight}}>
        <View style={[styles.canvas, {width: screenWidth, height: canvasHeight}]}>
          <View style={[frame(22, 211, 806, 302), styles.card, {borderRadius: dp(24)}, cardShadow(0.08)]} />
          {renderImage(offerListAssets.locationPin, 82, 256, 40, 47)}
          <DesignText numberOfLines={1} style={[frame(146, 256, 190, 41), type(36, 44, '700', '#061E4F')]}>
            {formatAddressName(draft?.departure_address, '未选择起吊点')}
          </DesignText>
          <DesignText numberOfLines={1} style={[frame(146, 316, 210, 29), type(27, 34, '400', '#586B93')]}>
            {formatAddressSub(draft?.departure_address, '--')}
          </DesignText>
          {renderImage(offerListAssets.routeArrow, 407, 284, 34, 25)}
          {renderImage(offerListAssets.locationPin, 491, 256, 40, 47)}
          <DesignText numberOfLines={1} style={[frame(546, 256, 220, 41), type(36, 44, '700', '#061E4F')]}>
            {formatAddressName(draft?.destination_address, '未选择落放点')}
          </DesignText>
          <DesignText numberOfLines={1} style={[frame(546, 316, 190, 29), type(27, 34, '400', '#586B93')]}>
            {formatAddressSub(draft?.destination_address, '--')}
          </DesignText>
          <View style={[frame(60, 368, 733, 1), styles.line]} />
          {renderImage(offerListAssets.weightM, 96, 416, 46, 53)}
          <DesignText style={[frame(174, 412, 105, 29), type(27, 34, '400', '#586B93')]}>货物重量</DesignText>
          <DesignText style={[frame(174, 457, 120, 37), type(34, 42, '600', '#061736')]}>
            {draft?.cargo_weight_kg ? `${draft.cargo_weight_kg} kg` : '--'}
          </DesignText>
          <View style={[frame(427, 411, 1, 74), styles.line]} />
          {renderImage(offerListAssets.clock, 481, 417, 51, 51)}
          <DesignText style={[frame(548, 412, 105, 29), type(27, 34, '400', '#586B93')]}>作业时间</DesignText>
          <DesignText style={[frame(548, 457, 210, 37), type(34, 42, '600', '#061736')]}>
            {formatWorkTime(draft?.scheduled_start_at)}
          </DesignText>

          {plans.length > 0 ? plans.map(renderProviderCard) : renderEmptyState()}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, {width: screenWidth, height: bottomBarHeight, paddingBottom: insets.bottom}]}>
        {renderImage(offerListAssets.tabHomeInactive, 73, 28, 50, 50)}
        <DesignText style={[frame(76, 81, 45, 28), type(25, 32, '500', '#52658C'), styles.centerText]}>首页</DesignText>
        {renderImage(offerListAssets.tabOrderActive, 292, 25, 45, 55)}
        <DesignText style={[frame(293, 81, 45, 28), type(25, 32, '600', '#034FCD'), styles.centerText]}>订单</DesignText>
        {renderImage(offerListAssets.tabMessageInactive, 505, 27, 53, 47)}
        <DesignText style={[frame(514, 81, 45, 28), type(25, 32, '500', '#52658C'), styles.centerText]}>消息</DesignText>
        {renderImage(offerListAssets.tabProfileInactive, 727, 26, 46, 51)}
        <DesignText style={[frame(730, 81, 45, 28), type(25, 32, '500', '#52658C'), styles.centerText]}>我的</DesignText>
        <TouchableOpacity activeOpacity={0.82} onPress={() => navigation.navigate('MainTabs', {screen: 'Home'})} style={frame(24, 0, 150, 126)} />
        <TouchableOpacity activeOpacity={0.82} onPress={() => navigation.navigate('MainTabs', {screen: 'Orders'})} style={frame(214, 0, 150, 126)} />
        <TouchableOpacity activeOpacity={0.82} onPress={handleService} style={frame(405, 0, 150, 126)} />
        <TouchableOpacity activeOpacity={0.82} onPress={() => navigation.navigate('MainTabs', {screen: 'Profile'})} style={frame(596, 0, 150, 126)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7FAFC',
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
    zIndex: 20,
  },
  canvas: {
    position: 'relative',
  },
  card: {
    backgroundColor: '#FFFFFF',
  },
  line: {
    backgroundColor: '#DEE6F0',
  },
  metricDivider: {
    backgroundColor: '#D4DDEB',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#E8F9EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButton: {
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionButton: {
    position: 'absolute',
    backgroundColor: '#005BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DFE6F1',
    shadowColor: '#0C2550',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: -4},
    elevation: 8,
  },
  centerText: {
    textAlign: 'center',
  },
  rightText: {
    textAlign: 'right',
  },
});
