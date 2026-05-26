import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Image,
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
import {useFocusEffect} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {demandV2Service, DemandListParams} from '../../services/demandV2';
import {DemandSummary} from '../../types';
import {getDemandSceneLabel} from '../../utils/demandMeta';
import {RootState} from '../../store/store';
import {setHaulRoleMode} from '../../store/slices/roleSlice';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';
import {providerDemandListAssets} from '../../assets/haul/providerDemandList';

type FilterKey = 'region' | 'weight' | 'time' | 'scene';
type SortKey = 'distance' | 'price';

type DesignTextProps = React.PropsWithChildren<{
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>;

type VisualDemand = {
  id: number;
  title: string;
  route: string;
  distance: string;
  distanceSort: number | null;
  coverageLabel: string;
  arrivalLabel: string;
  responseLabel: string;
  weight: string;
  weightKg: number | null;
  schedule: string;
  scheduleDate: Date | null;
  scene: string;
  sceneKey: string;
  price: string;
  priceSort: number | null;
  airspace: string;
  airspaceTone: 'green' | 'orange';
  hasQuoted: boolean;
  suggestedPriceYuan: number | null;
  existingQuote?: DemandSummary['my_quote'];
};

const PAGE_SIZE = 20;
const DESIGN_WIDTH = 941;
const DESIGN_CONTENT_BOTTOM = 1630;

const filterMeta: Array<{key: FilterKey; label: string; options: string[]}> = [
  {key: 'region', label: '区域', options: ['全部区域', '龙岗区', '南山区', '宝安区', '坪山区']},
  {key: 'weight', label: '货物重量', options: ['全部重量', '50kg以下', '50-100kg', '100-300kg', '300kg以上']},
  {key: 'time', label: '作业时间', options: ['全部时间', '今天', '明天', '预约时间']},
  {key: 'scene', label: '场景类型', options: ['全部场景', '施工物料吊运', '楼顶设备吊装', '应急物资转运']},
];

const sceneQueryByLabel: Record<string, string> = {
  施工物料吊运: 'power_grid',
  楼顶设备吊装: 'other_heavy_lift',
  应急物资转运: 'emergency_relief',
};

function DesignText({children, style, numberOfLines}: DesignTextProps) {
  return (
    <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );
}

const formatYuan = (amount?: number | null) =>
  `¥ ${Math.round(Number(amount || 0) / 100).toLocaleString('zh-CN')}`;

const formatYuanCompact = (amount?: number | null) =>
  `¥${Math.round(Number(amount || 0) / 100).toLocaleString('zh-CN')}`;

const formatPrice = (min?: number | null, max?: number | null) => {
  const lo = Number(min || 0);
  const hi = Number(max || 0);
  if (lo > 0 && hi > 0) {
    return `${formatYuan(lo)}~${formatYuanCompact(hi)}`;
  }
  if (hi > 0) {
    return `${formatYuan(hi)}以内`;
  }
  if (lo > 0) {
    return `${formatYuan(lo)}起`;
  }
  return '待报价';
};

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatSchedule = (start?: string | null) => {
  const date = parseDate(start);
  if (!date) {
    return '时间待确认';
  }
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const sameDay = date.toDateString() === now.toDateString();
  const nextDay = date.toDateString() === tomorrow.toDateString();
  const dayLabel = sameDay ? '今天' : nextDay ? '明天' : `${date.getMonth() + 1}-${date.getDate()}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${dayLabel} ${time}`;
};

const compactAddress = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  return text.replace(/^深圳市/, '').replace(/街道.*/, '街道').slice(0, 9);
};

const snapshotAddressText = (value: any) =>
  value?.name || value?.address || value?.text || '';

const positiveNumber = (value: unknown) => {
  const next = Number(value || 0);
  return Number.isFinite(next) && next > 0 ? next : null;
};

const coverageLabelOf = (value?: string | null) => {
  const status = String(value || '').toLowerCase();
  if (status === 'in_range') {
    return '可服务';
  }
  if (status === 'out_of_range') {
    return '超半径';
  }
  return '待确认';
};

const arrivalLabelOf = (minutes?: number | null) => {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  return `约${Math.ceil(value)}分`;
};

const responseLabelOf = (seconds?: number | null) => {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value < 0) {
    return '';
  }
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) {
    return `已响应${minutes}分`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `已响应${hours}小时`;
  }
  return `已响应${Math.round(hours / 24)}天`;
};

const airspaceMetaOf = (value?: string | null): Pick<VisualDemand, 'airspace' | 'airspaceTone'> => {
  const status = String(value || '').toLowerCase();
  if (['approved', 'available', 'clear', 'safe'].includes(status)) {
    return {airspace: '空域可飞', airspaceTone: 'green'};
  }
  if (['rejected', 'blocked', 'no_fly', 'forbidden'].includes(status)) {
    return {airspace: '不可飞', airspaceTone: 'orange'};
  }
  return {airspace: '待确认', airspaceTone: 'orange'};
};

const suggestedPriceYuanOf = (item: DemandSummary) => {
  const myQuote = Number(item.my_quote?.price_amount || 0);
  if (myQuote > 0) {
    return Math.round(myQuote / 100);
  }
  const min = Number(item.budget_min || 0);
  const max = Number(item.budget_max || 0);
  if (min > 0 && max > 0) {
    return Math.round((min + max) / 200);
  }
  if (max > 0) {
    return Math.round(max / 100);
  }
  if (min > 0) {
    return Math.round(min / 100);
  }
  return null;
};

const mapDemand = (item: DemandSummary): VisualDemand => {
  const anyItem = item as any;
  const start = compactAddress(snapshotAddressText(anyItem.departure_address) || anyItem.service_address_text);
  const end = compactAddress(snapshotAddressText(anyItem.destination_address) || snapshotAddressText(anyItem.service_address));
  const route = start && end ? `${start} → ${end}` : item.title || anyItem.service_address_text || item.demand_no || '未命名需求';
  const weightKg = positiveNumber(anyItem.cargo_weight_kg);
  const distanceKm = positiveNumber(anyItem.distance_km);
  const coverageLabel = distanceKm ? coverageLabelOf(anyItem.service_coverage_status) : '';
  const arrivalLabel = arrivalLabelOf(anyItem.estimated_arrival_minutes);
  const responseLabel = responseLabelOf(anyItem.quote_response_seconds);
  const scheduleDate = parseDate(item.scheduled_start_at);
  const priceSort = positiveNumber(item.budget_min) || positiveNumber(item.budget_max);
  const airspace = airspaceMetaOf(anyItem.airspace_status);

  return {
    id: item.id,
    title: item.title || item.demand_no || '未命名需求',
    route,
    distance: distanceKm ? [`${distanceKm.toFixed(1)}km`, coverageLabel, arrivalLabel].filter(Boolean).join(' ') : '距离待计算',
    distanceSort: distanceKm,
    coverageLabel,
    arrivalLabel,
    responseLabel,
    weight: weightKg ? `${weightKg} kg` : '重量待补',
    weightKg,
    schedule: formatSchedule(item.scheduled_start_at),
    scheduleDate,
    scene: item.cargo_scene ? getDemandSceneLabel(item.cargo_scene) : '场景待补',
    sceneKey: item.cargo_scene || '',
    price: formatPrice(item.budget_min, item.budget_max),
    priceSort,
    ...airspace,
    hasQuoted: Boolean(item.my_quote?.id),
    suggestedPriceYuan: suggestedPriceYuanOf(item),
    existingQuote: item.my_quote,
  };
};

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const startOfLocalDay = (offsetDays = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
};

const applyWeightFilter = (params: DemandListParams, value: string) => {
  if (value === '50kg以下') {
    params.max_weight_kg = 49.999;
  }
  if (value === '50-100kg') {
    params.min_weight_kg = 50;
    params.max_weight_kg = 100;
  }
  if (value === '100-300kg') {
    params.min_weight_kg = 100;
    params.max_weight_kg = 300;
  }
  if (value === '300kg以上') {
    params.min_weight_kg = 300;
  }
};

const applyTimeFilter = (params: DemandListParams, value: string) => {
  if (value === '今天') {
    params.start_from = startOfLocalDay(0).toISOString();
    params.start_to = startOfLocalDay(1).toISOString();
  }
  if (value === '明天') {
    params.start_from = startOfLocalDay(1).toISOString();
    params.start_to = startOfLocalDay(2).toISOString();
  }
  if (value === '预约时间') {
    params.start_from = startOfLocalDay(2).toISOString();
  }
};

const buildDemandQuery = (
  page: number,
  filters: Record<FilterKey, string>,
  sortKey: SortKey,
): DemandListParams => {
  const params: DemandListParams = {
    page,
    page_size: PAGE_SIZE,
    service_type: 'heavy_cargo_lift_transport',
  };
  if (filters.region !== '区域') {
    params.region = filters.region;
  }
  if (filters.weight !== '货物重量') {
    applyWeightFilter(params, filters.weight);
  }
  if (filters.time !== '作业时间') {
    applyTimeFilter(params, filters.time);
  }
  if (filters.scene !== '场景类型') {
    params.cargo_scene = sceneQueryByLabel[filters.scene] || filters.scene;
  }
  params.sort = sortKey === 'price' ? 'price' : 'distance';
  return params;
};

const matchesFilters = (item: VisualDemand, filters: Record<FilterKey, string>) => {
  if (filters.region !== '区域' && !item.route.includes(filters.region) && !item.title.includes(filters.region)) {
    return false;
  }
  if (filters.weight !== '货物重量') {
    const weight = item.weightKg || 0;
    if (!weight) {
      return false;
    }
    if (filters.weight === '50kg以下' && weight >= 50) {
      return false;
    }
    if (filters.weight === '50-100kg' && (weight < 50 || weight > 100)) {
      return false;
    }
    if (filters.weight === '100-300kg' && (weight < 100 || weight > 300)) {
      return false;
    }
    if (filters.weight === '300kg以上' && weight < 300) {
      return false;
    }
  }
  if (filters.time !== '作业时间') {
    const date = item.scheduleDate;
    if (!date) {
      return false;
    }
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (filters.time === '今天' && !isSameDay(date, today)) {
      return false;
    }
    if (filters.time === '明天' && !isSameDay(date, tomorrow)) {
      return false;
    }
    if (filters.time === '预约时间' && (isSameDay(date, today) || isSameDay(date, tomorrow))) {
      return false;
    }
  }
  if (filters.scene !== '场景类型') {
    const sceneQuery = sceneQueryByLabel[filters.scene];
    if (item.scene !== filters.scene && (!sceneQuery || item.sceneKey !== sceneQuery)) {
      return false;
    }
  }
  return true;
};

export default function DemandListScreen({navigation}: any) {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const {width} = useWindowDimensions();
  const screenWidth = width || 390;
  const scale = screenWidth / DESIGN_WIDTH;
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    region: '区域',
    weight: '货物重量',
    time: '作业时间',
    scene: '场景类型',
  });
  const [quickQuote, setQuickQuote] = useState<VisualDemand | null>(null);
  const [quickAmount, setQuickAmount] = useState('680');
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const canQuoteAsProvider = providerCapabilities.canPublishSupply;

  const dp = (value: number) => Number((value * scale).toFixed(2));
  const dpy = (value: number) => Number((value * scale).toFixed(2));
  const frame = (x: number, y: number, w: number, h: number): ViewStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dpy(y),
    width: dp(w),
    height: dpy(h),
  });
  const imageFrame = (x: number, y: number, w: number, h: number): ImageStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dpy(y),
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

  const fetchDemands = useCallback(async (
    nextPage = 1,
    refresh = false,
    nextFilters = filters,
    nextSortKey = sortKey,
  ) => {
    if (!isAuthenticated || !canQuoteAsProvider) {
      setDemands([]);
      setHasMore(false);
      setFetchError(isAuthenticated ? '服务商设备能力未开通，审核通过后才能查看可报价需求。' : '请先登录服务商账号后查看可接需求。');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setFetchError('');
      const res: any = await demandV2Service.listMarketplaceDemands(buildDemandQuery(nextPage, nextFilters, nextSortKey));
      const items = res?.data?.items || res?.items || [];
      const total = Number(res?.data?.total || res?.meta?.total || 0);
      setDemands(prev => (refresh || nextPage === 1 ? items : [...prev, ...items]));
      setHasMore(nextPage * PAGE_SIZE < total);
    } catch (error: any) {
      if (refresh || nextPage === 1) {
        setDemands([]);
      }
      setFetchError(error?.message || '真实需求加载失败，请稍后重试');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [canQuoteAsProvider, filters, isAuthenticated, sortKey]);

  useFocusEffect(
    useCallback(() => {
      dispatch(setHaulRoleMode('provider'));
      setPage(1);
      if (!isAuthenticated || !canQuoteAsProvider) {
        setDemands([]);
        setHasMore(false);
        setFetchError(isAuthenticated ? '服务商设备能力未开通，审核通过后才能查看可报价需求。' : '请先登录服务商账号后查看可接需求。');
        setLoading(false);
        return;
      }
      fetchDemands(1, true);
    }, [canQuoteAsProvider, dispatch, fetchDemands, isAuthenticated]),
  );

  const visualDemands = useMemo(() => {
    const source = demands.map(mapDemand).filter(item => matchesFilters(item, filters));
    if (sortKey === 'price') {
      return [...source].sort((a, b) => (a.priceSort ?? Number.MAX_SAFE_INTEGER) - (b.priceSort ?? Number.MAX_SAFE_INTEGER));
    }
    return [...source].sort((a, b) => (a.distanceSort ?? Number.MAX_SAFE_INTEGER) - (b.distanceSort ?? Number.MAX_SAFE_INTEGER));
  }, [demands, filters, sortKey]);

  const openFilter = (key: FilterKey, options: string[]) => {
    const meta = filterMeta.find(item => item.key === key);
    Alert.alert(meta?.label || '筛选', undefined, [
      ...options.map(option => ({
        text: option,
        onPress: () => {
          const nextValue = option.startsWith('全部') ? meta?.label || filters[key] : option;
          const nextFilters = {...filters, [key]: nextValue};
          setFilters(nextFilters);
          setPage(1);
          fetchDemands(1, true, nextFilters, sortKey);
        },
      })),
      {text: '取消', style: 'cancel' as const},
    ]);
  };

  const changeSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      return;
    }
    setSortKey(nextSortKey);
    setPage(1);
    fetchDemands(1, true, filters, nextSortKey);
  };

  const loadMore = () => {
    if (!hasMore || loading || !demands.length) {
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDemands(nextPage, false, filters, sortKey);
  };

  const goDetail = (item: VisualDemand) => {
    navigation.navigate('DemandDetail', {id: item.id, marketMode: 'owner'});
  };

  const goQuote = (item: VisualDemand) => {
    if (!canQuoteAsProvider) {
      Alert.alert('无法报价', '设备服务能力审核通过后才能报价。');
      return;
    }
    navigation.navigate('DemandQuoteCompose', {
      id: item.id,
      demandId: item.id,
      demandTitle: item.title,
      priceYuan: item.suggestedPriceYuan,
      existingQuote: item.existingQuote,
    });
  };

  const openQuickQuote = (item: VisualDemand) => {
    if (!canQuoteAsProvider) {
      Alert.alert('无法报价', '设备服务能力审核通过后才能报价。');
      return;
    }
    setQuickQuote(item);
    setQuickAmount(String(item.suggestedPriceYuan || 680));
  };

  const submitQuickQuote = () => {
    if (!quickQuote) {
      return;
    }
    const item = quickQuote;
    setQuickQuote(null);
    navigation.navigate('DemandQuoteCompose', {
      id: item.id,
      demandId: item.id,
      demandTitle: item.title,
      quick: true,
      priceYuan: Number(quickAmount),
      existingQuote: item.existingQuote,
    });
  };

  const quickQuoteOptions = useMemo(() => {
    const base = Math.max(1, Number(quickQuote?.suggestedPriceYuan || quickAmount || 680));
    const candidates = [base, Math.round(base * 1.06), Math.round(base * 1.18)];
    return Array.from(new Set(candidates.map(value => String(value))));
  }, [quickAmount, quickQuote?.suggestedPriceYuan]);

  const canvasHeight = dpy(Math.max(DESIGN_CONTENT_BOTTOM, 398 + visualDemands.length * 411 + 86));

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={({nativeEvent}) => {
          const distanceFromBottom = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
          if (distanceFromBottom < dp(120)) {
            loadMore();
          }
        }}
        contentContainerStyle={[styles.scrollContent, {height: canvasHeight}]}>
        <View style={[styles.canvas, {width: screenWidth, height: canvasHeight}]}>
          <LinearGradient
            colors={['#0058D8', '#003C9F']}
            start={{x: 0.04, y: 0}}
            end={{x: 0.92, y: 1}}
            style={frame(0, 0, 941, 210)}
          />
          <View
            style={[
              frame(0, 180, 941, 110),
              styles.contentCurve,
              {borderTopLeftRadius: dp(24), borderTopRightRadius: dp(24)},
            ]}
          />
          <DesignText style={[frame(355, 94, 260, 51), type(32, 51, '700', '#FFFFFF'), styles.centerText]}>
            可接吊运需求
          </DesignText>
          <TouchableOpacity activeOpacity={0.84} onPress={() => navigation.navigate('Messages')} style={frame(828, 72, 82, 82)}>
            <Image source={providerDemandListAssets.headerMessage} style={imageFrame(4, 9, 58, 65)} resizeMode="contain" />
            <Image source={providerDemandListAssets.messageDot} style={imageFrame(51, 0, 27, 26)} resizeMode="contain" />
          </TouchableOpacity>

          {filterMeta.map((item, index) => {
            const left = [34, 244, 487, 721][index];
            const widthValues = [183, 212, 208, 213];
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.84}
                onPress={() => openFilter(item.key, item.options)}
                style={[
                  frame(left, 206, widthValues[index], 62),
                  styles.filterChip,
                  {borderRadius: dp(18), borderWidth: StyleSheet.hairlineWidth},
                ]}>
                <DesignText numberOfLines={1} style={[type(28, 36, '500', '#0A1F63'), {maxWidth: dp(widthValues[index] - 62)}]}>
                  {filters[item.key]}
                </DesignText>
                <Image
                  source={providerDemandListAssets.filterChevron}
                  style={{width: dp(22), height: dp(18), marginLeft: dp(11)}}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() => changeSort('distance')}
            style={[
              frame(35, 304, 142, 58),
              styles.sortChip,
              sortKey === 'distance' && styles.sortChipActive,
              {borderRadius: dp(16), borderWidth: StyleSheet.hairlineWidth},
            ]}>
            <DesignText style={type(28, 38, sortKey === 'distance' ? '700' : '500', sortKey === 'distance' ? '#005BFF' : '#0A1F63')}>
              距离最近
            </DesignText>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.84} onPress={() => changeSort('price')} style={frame(198, 315, 128, 38)}>
            <DesignText style={type(28, 38, sortKey === 'price' ? '700' : '500', sortKey === 'price' ? '#005BFF' : '#0A1F63')}>
              价格优先
            </DesignText>
          </TouchableOpacity>

          {visualDemands.map((item, index) => (
            <DemandCard
              key={`${item.id}-${index}`}
              item={item}
              top={398 + index * 411}
              dp={dp}
              frame={frame}
              imageFrame={imageFrame}
              type={type}
              onPress={() => goDetail(item)}
              onQuickQuote={() => openQuickQuote(item)}
              onQuote={() => goQuote(item)}
            />
          ))}

          {loading && demands.length === 0 ? (
            <EmptyDemandCard
              top={398}
              frame={frame}
              type={type}
              title="正在同步真实需求"
              desc="请稍候，正在读取服务商可接需求。"
            />
          ) : null}

          {!loading && fetchError ? (
            <EmptyDemandCard
              top={398}
              frame={frame}
              type={type}
              title="无法加载真实需求"
              desc={fetchError}
            />
          ) : null}

          {!loading && !fetchError && visualDemands.length === 0 ? (
            <EmptyDemandCard
              top={398}
              frame={frame}
              type={type}
              title={demands.length ? '暂无符合筛选的需求' : '暂无可接需求'}
              desc={demands.length ? '当前筛选条件下没有匹配项，请调整区域、重量、时间或场景。' : '后端当前没有返回真实可报价需求。'}
            />
          ) : null}

          {loading && demands.length > 0 ? (
            <DesignText style={[frame(35, 398 + visualDemands.length * 411, 872, 48), type(24, 32, '500', '#66779B'), styles.centerText]}>
              加载中...
            </DesignText>
          ) : null}
        </View>
      </ScrollView>

      <Modal transparent visible={!!quickQuote} animationType="fade" onRequestClose={() => setQuickQuote(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setQuickQuote(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => undefined} style={[styles.quickSheet, {padding: dp(28), borderTopLeftRadius: dp(28), borderTopRightRadius: dp(28)}]}>
            <DesignText style={type(32, 42, '700', '#0A1F63')}>快速报价</DesignText>
            <DesignText numberOfLines={1} style={[type(24, 32, '400', '#66779B'), {marginTop: dp(8)}]}>
              {quickQuote?.route || ''}
            </DesignText>
            <View style={[styles.quickOptionRow, {gap: dp(18), marginTop: dp(24)}]}>
              {quickQuoteOptions.map(value => {
                const active = quickAmount === value;
                return (
                  <TouchableOpacity
                    key={value}
                    activeOpacity={0.84}
                    onPress={() => setQuickAmount(value)}
	                    style={[
	                      styles.quickOption,
                        active ? styles.quickOptionActive : styles.quickOptionInactive,
	                      {
	                        width: dp(150),
	                        height: dp(64),
	                        borderRadius: dp(12),
	                        borderWidth: StyleSheet.hairlineWidth,
	                      },
	                    ]}>
                    <DesignText style={type(28, 36, '600', active ? '#FF5A2A' : '#0A1F63')}>¥{value}</DesignText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.quickActionRow, {gap: dp(20), marginTop: dp(28)}]}>
              <TouchableOpacity
	                activeOpacity={0.84}
	                onPress={() => setQuickQuote(null)}
	                style={[styles.quickActionButton, styles.quickActionCancel, {height: dp(72), borderRadius: dp(12), borderWidth: StyleSheet.hairlineWidth}]}>
	                <DesignText style={type(28, 36, '700', '#0A3A98')}>取消</DesignText>
	              </TouchableOpacity>
	              <TouchableOpacity activeOpacity={0.84} onPress={submitQuickQuote} style={[styles.quickActionButton, styles.quickActionPrimary, {height: dp(72), borderRadius: dp(12)}]}>
                <LinearGradient colors={['#FF6A1A', '#FF4B0A']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.fullFill}>
                  <DesignText style={type(28, 36, '700', '#FFFFFF')}>进入报价</DesignText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function EmptyDemandCard({
  top,
  frame,
  type,
  title,
  desc,
}: {
  top: number;
  frame: (x: number, y: number, w: number, h: number) => ViewStyle;
  type: (fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight'], color: string) => TextStyle;
  title: string;
  desc: string;
}) {
  return (
    <View style={[frame(35, top, 872, 210), styles.emptyCard]}>
      <DesignText style={[frame(36, 42, 800, 42), type(30, 42, '700', '#0A1F63'), styles.centerText]}>
        {title}
      </DesignText>
      <DesignText style={[frame(70, 104, 732, 64), type(24, 32, '400', '#66779B'), styles.centerText]}>
        {desc}
      </DesignText>
    </View>
  );
}

function DemandCard({
  item,
  top,
  dp,
  frame,
  imageFrame,
  type,
  onPress,
  onQuickQuote,
  onQuote,
}: {
  item: VisualDemand;
  top: number;
  dp: (value: number) => number;
  frame: (x: number, y: number, w: number, h: number) => ViewStyle;
  imageFrame: (x: number, y: number, w: number, h: number) => ImageStyle;
  type: (fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight'], color: string) => TextStyle;
  onPress: () => void;
  onQuickQuote: () => void;
  onQuote: () => void;
}) {
  const cardFrame = frame(35, top, 872, 383);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        cardFrame,
        styles.card,
        {
          borderRadius: dp(24),
          shadowRadius: dp(24),
          shadowOffset: {width: 0, height: dp(8)},
        },
      ]}>
      <Image source={providerDemandListAssets.locationPin} style={imageFrame(24, 15, 39, 49)} resizeMode="contain" />
      <DesignText numberOfLines={1} style={[frame(86, 20, 600, 43), type(31, 43, '700', '#0A1F63')]}>
        {item.route}
      </DesignText>
      <DesignText style={[frame(700, 25, 142, 32), type(24, 32, '500', '#66779B'), styles.rightText]}>
        {item.distance}
      </DesignText>
      <View style={[frame(27, 89, 815, 1), styles.divider]} />
      <View style={[frame(27, 229, 815, 1), styles.divider]} />

      <MetricColumn
        left={27}
        icon={providerDemandListAssets.metricWeight}
        iconWidth={48}
        iconHeight={48}
        label="货物重量"
        value={item.weight}
        dp={dp}
        frame={frame}
        type={type}
      />
      <MetricColumn
        left={231}
        icon={providerDemandListAssets.metricClock}
        iconWidth={48}
        iconHeight={48}
        label="作业时间"
        value={item.schedule}
        compact
        dp={dp}
        frame={frame}
        type={type}
      />
      <MetricColumn
        left={443}
        icon={providerDemandListAssets.metricScene}
        iconWidth={48}
        iconHeight={48}
        label="场景类型"
        value={item.scene}
        compact
        dp={dp}
        frame={frame}
        type={type}
      />
      <MetricColumn
        left={647}
        icon={providerDemandListAssets.metricPrice}
        iconWidth={48}
        iconHeight={48}
        label="平台预估价"
        value={item.price}
        price
        dp={dp}
        frame={frame}
        type={type}
      />

      <Image source={providerDemandListAssets.airspaceStatus} style={imageFrame(28, 259, 57, 56)} resizeMode="contain" />
      <DesignText style={[frame(113, 250, 118, 31), type(23, 31, '500', '#64759B')]}>空域状态</DesignText>
      <DesignText style={[frame(113, 286, 148, 41), type(30, 41, '700', item.airspaceTone === 'green' ? '#13BA51' : '#FF5A2A')]}>
        {item.airspace}
      </DesignText>
      <Image source={providerDemandListAssets.chevronRight} style={imageFrame(815, 252, 23, 31)} resizeMode="contain" />

      <TouchableOpacity
        activeOpacity={0.84}
        onPress={onQuickQuote}
        style={[
          frame(360, 295, 238, 64),
          styles.outlineButton,
          {borderRadius: dp(12), borderWidth: dp(2)},
      ]}>
        <DesignText style={type(28, 36, '600', '#1758F8')}>{item.hasQuoted ? '更新报价' : '快速报价'}</DesignText>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.84} onPress={onQuote} style={[frame(620, 295, 250, 64), styles.primaryButton, {borderRadius: dp(12)}]}>
        <DesignText style={type(28, 36, '600', '#FFFFFF')}>查看并报价</DesignText>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function MetricColumn({
  left,
  icon,
  iconWidth,
  iconHeight,
  label,
  value,
  compact,
  price,
  dp,
  frame,
  type,
}: {
  left: number;
  icon: any;
  iconWidth: number;
  iconHeight: number;
  label: string;
  value: string;
  compact?: boolean;
  price?: boolean;
  dp: (value: number) => number;
  frame: (x: number, y: number, w: number, h: number) => ViewStyle;
  type: (fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight'], color: string) => TextStyle;
}) {
  return (
    <View style={frame(left, 107, price ? 195 : 184, 112)}>
      {!price ? <View style={[styles.localDivider, {left: dp(184), height: dp(112)}]} /> : null}
      <Image
        source={icon}
        style={[styles.metricIcon, {
          top: dp(4),
          width: dp(iconWidth),
          height: dp(iconHeight),
        }]}
        resizeMode="contain"
      />
      <DesignText style={[styles.metricLabel, {left: dp(62), top: dp(13), width: dp(118), height: dp(30)}, type(22, 30, '500', '#66779B')]}>
        {label}
      </DesignText>
      <DesignText
        numberOfLines={1}
        style={[
          styles.metricValue,
          {
            left: dp(price ? 0 : compact ? 4 : 13),
            top: dp(60),
            width: dp(price ? 186 : 175),
            height: dp(42),
          },
          type(price ? 30 : compact ? 26 : 31, 42, '700', price ? '#6D35FF' : '#0A1F63'),
        ]}>
        {value}
      </DesignText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },
  scrollContent: {
    backgroundColor: '#F6F8FC',
  },
  canvas: {
    position: 'relative',
    backgroundColor: '#F6F8FC',
    overflow: 'hidden',
  },
  contentCurve: {
    position: 'absolute',
    backgroundColor: '#F6F8FC',
  },
  centerText: {
    textAlign: 'center',
  },
  rightText: {
    textAlign: 'right',
  },
  filterChip: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE4F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#0C255C',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 1,
  },
  sortChip: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderColor: '#E0E7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8E5F8',
    shadowColor: '#144FA4',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 5},
    elevation: 2,
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0C255C',
    shadowOpacity: 0.06,
    elevation: 3,
    overflow: 'hidden',
  },
  emptyCard: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#0C255C',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 8},
    elevation: 3,
  },
  divider: {
    position: 'absolute',
    backgroundColor: '#DDE4F0',
  },
  localDivider: {
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#DDE4F0',
  },
  metricLabel: {
    position: 'absolute',
  },
  metricValue: {
    position: 'absolute',
  },
  metricIcon: {
    position: 'absolute',
    left: 0,
  },
  outlineButton: {
    position: 'absolute',
    borderColor: '#1758F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    position: 'absolute',
    backgroundColor: '#075CFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 28, 72, 0.36)',
    justifyContent: 'flex-end',
  },
  quickSheet: {
    backgroundColor: '#FFFFFF',
  },
  quickOptionRow: {
    flexDirection: 'row',
  },
  quickOption: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickOptionActive: {
    borderColor: '#FF5A2A',
    backgroundColor: '#FFF5EF',
  },
  quickOptionInactive: {
    borderColor: '#DDE4F0',
    backgroundColor: '#FFFFFF',
  },
  quickActionRow: {
    flexDirection: 'row',
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  quickActionCancel: {
    borderColor: '#0A3A98',
  },
  quickActionPrimary: {
    overflow: 'hidden',
  },
  fullFill: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
