import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { demandV2Service, DemandListParams } from '../../../services/demandV2';
import { DemandSummary } from '../../../types';
import { getDemandSceneLabel } from '../../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import { syncCustomTabBar } from '../../../utils/tabBar';
import { RootState, useAppDispatch } from '../../../store/store';
import { setHaulRoleMode } from '../../../store/slices/roleSlice';
import filterChevronIcon from '../../../assets/haul/provider-demand-list/icon_filter_chevron_down.png';
import locationPinIcon from '../../../assets/haul/provider-demand-list/icon_location_pin_blue.png';
import weightIcon from '../../../assets/haul/provider-demand-list/icon_metric_weight_blue.png';
import clockIcon from '../../../assets/haul/provider-demand-list/icon_metric_clock_orange.png';
import sceneIcon from '../../../assets/haul/provider-demand-list/icon_metric_scene_green.png';
import priceIcon from '../../../assets/haul/provider-demand-list/icon_metric_price_purple.png';
import airspaceIcon from '../../../assets/haul/provider-demand-list/icon_airspace_status_green.png';
import chevronRightIcon from '../../../assets/haul/provider-demand-list/icon_chevron_right.png';
import headerMessageIcon from '../../../assets/haul/provider-demand-list/icon_header_message_outline.png';
import messageDotIcon from '../../../assets/haul/provider-demand-list/badge_message_red_dot.png';
import './index.scss';

type FilterKey = 'region' | 'weight' | 'time' | 'scene';
type SortKey = 'distance' | 'price';

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
};

const PAGE_SIZE = 20;
const RATIO = 0.79702444;

const filterMeta: Array<{ key: FilterKey; label: string; options: string[] }> = [
  { key: 'region', label: '区域', options: ['全部区域', '龙岗区', '南山区', '宝安区', '坪山区'] },
  { key: 'weight', label: '货物重量', options: ['全部重量', '50kg以下', '50-100kg', '100-300kg', '300kg以上'] },
  { key: 'time', label: '作业时间', options: ['全部时间', '今天', '明天', '预约时间'] },
  { key: 'scene', label: '场景类型', options: ['全部场景', '施工物料吊运', '楼顶设备吊装', '应急物资转运'] },
];

const sceneQueryByLabel: Record<string, string> = {
  施工物料吊运: 'power_grid',
  楼顶设备吊装: 'other_heavy_lift',
  应急物资转运: 'emergency_relief',
};

const toRpx = (value: number) => `${Number((value * RATIO).toFixed(3))}rpx`;

const formatYuan = (amount?: number | null) =>
  `¥ ${Math.round(Number(amount || 0) / 100).toLocaleString('zh-CN')}`;

const formatYuanCompact = (amount?: number | null) =>
  `¥${Math.round(Number(amount || 0) / 100).toLocaleString('zh-CN')}`;

const formatPrice = (min?: number | null, max?: number | null) => {
  const lo = Number(min || 0);
  const hi = Number(max || 0);
  if (lo > 0 && hi > 0) return `${formatYuan(lo)}~${formatYuanCompact(hi)}`;
  if (hi > 0) return `${formatYuan(hi)}以内`;
  if (lo > 0) return `${formatYuan(lo)}起`;
  return '待报价';
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatSchedule = (start?: string | null) => {
  const date = parseDate(start);
  if (!date) return '时间待确认';
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
  if (!text) return '';
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
  if (status === 'in_range') return '可服务';
  if (status === 'out_of_range') return '超半径';
  return '待确认';
};

const arrivalLabelOf = (minutes?: number | null) => {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `约${Math.ceil(value)}分`;
};

const responseLabelOf = (seconds?: number | null) => {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value < 0) return '';
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `已响应${minutes}分`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `已响应${hours}小时`;
  return `已响应${Math.round(hours / 24)}天`;
};

const airspaceMetaOf = (value?: string | null): Pick<VisualDemand, 'airspace' | 'airspaceTone'> => {
  const status = String(value || '').toLowerCase();
  if (['approved', 'available', 'clear', 'safe'].includes(status)) {
    return { airspace: '空域可飞', airspaceTone: 'green' };
  }
  if (['rejected', 'blocked', 'no_fly', 'forbidden'].includes(status)) {
    return { airspace: '不可飞', airspaceTone: 'orange' };
  }
  return { airspace: '待确认', airspaceTone: 'orange' };
};

const suggestedPriceYuanOf = (item: DemandSummary) => {
  const myQuote = Number(item.my_quote?.price_amount || 0);
  if (myQuote > 0) return Math.round(myQuote / 100);
  const min = Number(item.budget_min || 0);
  const max = Number(item.budget_max || 0);
  if (min > 0 && max > 0) return Math.round((min + max) / 200);
  if (max > 0) return Math.round(max / 100);
  if (min > 0) return Math.round(min / 100);
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
    distance: distanceKm ? [ `${distanceKm.toFixed(1)}km`, coverageLabel, arrivalLabel ].filter(Boolean).join(' ') : '距离待计算',
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
  if (value === '50kg以下') params.max_weight_kg = 49.999;
  if (value === '50-100kg') {
    params.min_weight_kg = 50;
    params.max_weight_kg = 100;
  }
  if (value === '100-300kg') {
    params.min_weight_kg = 100;
    params.max_weight_kg = 300;
  }
  if (value === '300kg以上') params.min_weight_kg = 300;
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
  if (filters.region !== '区域') params.region = filters.region;
  if (filters.weight !== '货物重量') applyWeightFilter(params, filters.weight);
  if (filters.time !== '作业时间') applyTimeFilter(params, filters.time);
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
    if (!weight) return false;
    if (filters.weight === '50kg以下' && weight >= 50) return false;
    if (filters.weight === '50-100kg' && (weight < 50 || weight > 100)) return false;
    if (filters.weight === '100-300kg' && (weight < 100 || weight > 300)) return false;
    if (filters.weight === '300kg以上' && weight < 300) return false;
  }
  if (filters.time !== '作业时间') {
    const date = item.scheduleDate;
    if (!date) return false;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (filters.time === '今天' && !isSameDay(date, today)) return false;
    if (filters.time === '明天' && !isSameDay(date, tomorrow)) return false;
    if (filters.time === '预约时间' && (isSameDay(date, today) || isSameDay(date, tomorrow))) return false;
  }
  if (filters.scene !== '场景类型') {
    const sceneQuery = sceneQueryByLabel[filters.scene];
    if (item.scene !== filters.scene && (!sceneQuery || item.sceneKey !== sceneQuery)) return false;
  }
  return true;
};

export default function DemandListPage() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const [headerActionRight, setHeaderActionRight] = useState(toRpx(176));
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    region: '区域',
    weight: '货物重量',
    time: '作业时间',
    scene: '场景类型',
  });
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const canQuoteAsProvider = providerCapabilities.canPublishSupply;

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
    setLoading(true);
    setFetchError('');
    try {
      const res: any = await demandV2Service.listMarketplaceDemands(buildDemandQuery(nextPage, nextFilters, nextSortKey));
      const items = res?.data?.items || res?.items || [];
      const total = Number(res?.data?.total || res?.meta?.total || 0);
      setDemands(prev => (refresh || nextPage === 1 ? items : [...prev, ...items]));
      setHasMore(nextPage * PAGE_SIZE < total);
    } catch (error: any) {
      if (refresh || nextPage === 1) setDemands([]);
      setFetchError(error?.message || '真实需求加载失败，请稍后重试');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [canQuoteAsProvider, filters, isAuthenticated, sortKey]);

  useDidShow(() => {
    dispatch(setHaulRoleMode('provider'));
    syncCustomTabBar(1, 'provider');
    setPage(1);
    if (!isAuthenticated || !canQuoteAsProvider) {
      setDemands([]);
      setHasMore(false);
      setFetchError(isAuthenticated ? '服务商设备能力未开通，审核通过后才能查看可报价需求。' : '请先登录服务商账号后查看可接需求。');
      setLoading(false);
      return;
    }
    fetchDemands(1, true);
  });

  useEffect(() => {
    try {
      const menu = Taro.getMenuButtonBoundingClientRect();
      const system = Taro.getSystemInfoSync();
      const windowWidth = system.windowWidth || 375;
      const rpxRatio = 750 / windowWidth;

      if (menu?.left) {
        const capsuleRight = (windowWidth - menu.left) * rpxRatio;
        setHeaderActionRight(`${Math.max(146, Math.round(capsuleRight + 38))}rpx`);
      }
    } catch {
      setHeaderActionRight(toRpx(176));
    }
  }, []);

  const visualDemands = useMemo(() => {
    const source = demands.map(mapDemand).filter(item => matchesFilters(item, filters));
    if (sortKey === 'price') {
      return [...source].sort((a, b) => (a.priceSort ?? Number.MAX_SAFE_INTEGER) - (b.priceSort ?? Number.MAX_SAFE_INTEGER));
    }
    return [...source].sort((a, b) => (a.distanceSort ?? Number.MAX_SAFE_INTEGER) - (b.distanceSort ?? Number.MAX_SAFE_INTEGER));
  }, [demands, filters, sortKey]);

  const loadMore = () => {
    if (!hasMore || loading || !demands.length) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDemands(nextPage, false, filters, sortKey);
  };

  const openFilter = (key: FilterKey, options: string[]) => {
    Taro.showActionSheet({ itemList: options }).then((res) => {
      const value = options[res.tapIndex];
      if (!value) return;
      const meta = filterMeta.find(item => item.key === key);
      const nextValue = value.startsWith('全部') ? meta?.label || filters[key] : value;
      const nextFilters = { ...filters, [key]: nextValue };
      setFilters(nextFilters);
      setPage(1);
      fetchDemands(1, true, nextFilters, sortKey);
    }).catch(() => null);
  };

  const changeSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) return;
    setSortKey(nextSortKey);
    setPage(1);
    fetchDemands(1, true, filters, nextSortKey);
  };

  const goDetail = (item: VisualDemand) => {
    Taro.navigateTo({ url: `/pages/demand/detail/index?id=${item.id}` }).catch(() => {
      Taro.showToast({ title: '需求详情暂不可用', icon: 'none' });
    });
  };

  const goQuote = (item: VisualDemand) => {
    if (!canQuoteAsProvider) {
      Taro.showToast({ title: '设备服务能力未开通', icon: 'none' });
      return;
    }
    const priceParam = item.suggestedPriceYuan ? `&priceYuan=${item.suggestedPriceYuan}` : '';
    Taro.navigateTo({
      url: `/pages/demand/quote/index?id=${item.id}&demandTitle=${encodeURIComponent(item.title)}${priceParam}`,
    }).catch(() => Taro.showToast({ title: '报价页暂不可用', icon: 'none' }));
  };

  const openMessages = () => {
    Taro.switchTab({ url: '/pages/messages/index' }).catch(() => null);
  };

  const openQuickQuote = (item: VisualDemand) => {
    const priceParam = item.suggestedPriceYuan ? `&priceYuan=${item.suggestedPriceYuan}` : '';
    Taro.navigateTo({
      url: `/pages/demand/quote/index?id=${item.id}&quick=1&demandTitle=${encodeURIComponent(item.title)}${priceParam}`,
    }).catch(() => Taro.showToast({ title: '报价页暂不可用', icon: 'none' }));
  };

  const emptyTop = 398;
  const baseCanvasHeight = Math.max(1672, emptyTop + Math.max(visualDemands.length, 1) * 411 + 80);
  const canvasHeight = toRpx(baseCanvasHeight);

  return (
    <View className="provider-demand-page">
      <ScrollView
        scrollY
        enhanced
        showScrollbar={false}
        className="provider-demand-scroll"
        lowerThreshold={80}
        onScrollToLower={loadMore}
      >
        <View
          className="provider-demand-canvas"
          style={{ height: canvasHeight } as any}
        >
          <View className="pd-header-bg" />
          <View className="pd-content-curve" />
          <Text className="pd-nav-title">可接吊运需求</Text>
          <View
            className="pd-header-message-entry"
            style={{ right: headerActionRight }}
            onClick={openMessages}
          >
            <Image className="pd-header-message" src={headerMessageIcon} mode="aspectFit" />
            <Image className="pd-header-message-dot" src={messageDotIcon} mode="aspectFit" />
          </View>

          <View className="pd-filter-row">
            {filterMeta.map(item => (
              <View
                key={item.key}
                className={`pd-filter-chip pd-filter-${item.key}`}
                onClick={() => openFilter(item.key, item.options)}
              >
                <Text className="pd-filter-text">{filters[item.key]}</Text>
                <Image className="pd-filter-chevron" src={filterChevronIcon} mode="aspectFit" />
              </View>
            ))}
          </View>

          <View className="pd-sort-row">
            <View className={`pd-sort-chip ${sortKey === 'distance' ? 'active' : ''}`} onClick={() => changeSort('distance')}>
              <Text className={`pd-sort-text ${sortKey === 'distance' ? 'active' : ''}`}>距离最近</Text>
            </View>
            <View className="pd-sort-price" onClick={() => changeSort('price')}>
              <Text className={`pd-sort-price-text ${sortKey === 'price' ? 'active' : ''}`}>价格优先</Text>
            </View>
          </View>

          {visualDemands.map((item, index) => (
            <View
              key={`${item.id}-${index}`}
              className="pd-demand-card"
              style={{ top: toRpx(398 + index * 411) }}
              onClick={() => goDetail(item)}
            >
              <Image className="pd-route-pin" src={locationPinIcon} mode="aspectFit" />
              <Text className="pd-route-title" numberOfLines={1}>{item.route}</Text>
              <Text className="pd-distance">{item.distance}</Text>
              <View className="pd-card-line pd-card-line-top" />
              <View className="pd-card-line pd-card-line-bottom" />

              <View className="pd-metrics">
                <View className="pd-metric pd-metric-weight">
                  <Image className="pd-metric-icon pd-metric-icon-weight" src={weightIcon} mode="aspectFit" />
                  <Text className="pd-metric-label">货物重量</Text>
                  <Text className="pd-metric-value">{item.weight}</Text>
                </View>
                <View className="pd-metric pd-metric-time">
                  <Image className="pd-metric-icon pd-metric-icon-time" src={clockIcon} mode="aspectFit" />
                <Text className="pd-metric-label">{item.responseLabel || '作业时间'}</Text>
                <Text className="pd-metric-value pd-metric-time-value">{item.schedule}</Text>
                </View>
                <View className="pd-metric pd-metric-scene">
                  <Image className="pd-metric-icon pd-metric-icon-scene" src={sceneIcon} mode="aspectFit" />
                  <Text className="pd-metric-label">场景类型</Text>
                  <Text className="pd-metric-value pd-metric-scene-value">{item.scene}</Text>
                </View>
                <View className="pd-metric pd-metric-price">
                  <Image className="pd-metric-icon pd-metric-icon-price" src={priceIcon} mode="aspectFit" />
                  <Text className="pd-metric-label">平台预估价</Text>
                  <Text className="pd-metric-value pd-price-value">{item.price}</Text>
                </View>
              </View>

              <Image className="pd-airspace-icon" src={airspaceIcon} mode="aspectFit" />
              <Text className="pd-airspace-label">空域状态</Text>
              <Text className={`pd-airspace-value pd-airspace-${item.airspaceTone}`}>{item.airspace}</Text>
              <Image className="pd-card-chevron" src={chevronRightIcon} mode="aspectFit" />

              <View
                className="pd-button pd-quick-button"
                onClick={(event) => {
                  event.stopPropagation();
                  openQuickQuote(item);
                }}
              >
                <Text className="pd-quick-button-text">{item.hasQuoted ? '更新报价' : '快速报价'}</Text>
              </View>
              <View
                className="pd-button pd-view-button"
                onClick={(event) => {
                  event.stopPropagation();
                  goQuote(item);
                }}
              >
                <Text className="pd-view-button-text">查看并报价</Text>
              </View>
            </View>
          ))}

          {loading && demands.length === 0 ? (
            <View className="pd-empty-card" style={{ top: toRpx(emptyTop) }}>
              <Text className="pd-empty-title">正在同步真实需求</Text>
              <Text className="pd-empty-desc">请稍候，正在读取服务商可接需求。</Text>
            </View>
          ) : null}

          {!loading && fetchError ? (
            <View className="pd-empty-card" style={{ top: toRpx(emptyTop) }}>
              <Text className="pd-empty-title">无法加载真实需求</Text>
              <Text className="pd-empty-desc">{fetchError}</Text>
            </View>
          ) : null}

          {!loading && !fetchError && visualDemands.length === 0 ? (
            <View className="pd-empty-card" style={{ top: toRpx(emptyTop) }}>
              <Text className="pd-empty-title">{demands.length ? '暂无符合筛选的需求' : '暂无可接需求'}</Text>
              <Text className="pd-empty-desc">{demands.length ? '当前筛选条件下没有匹配项，请调整区域、重量、时间或场景。' : '后端当前没有返回真实可报价需求。'}</Text>
            </View>
          ) : null}

          {loading && demands.length > 0 ? (
            <View className="pd-loading" style={{ top: toRpx(398 + visualDemands.length * 411) }}>
              <Text className="pd-loading-text">加载中...</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

    </View>
  );
}
