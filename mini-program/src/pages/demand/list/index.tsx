import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { demandV2Service, DemandListParams } from '../../../services/demandV2';
import { DemandSummary } from '../../../types';
import { CARGO_SCENE_LABELS, getDemandSceneLabel } from '../../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import { syncCustomTabBar } from '../../../utils/tabBar';
import { RootState } from '../../../store/store';
import filterChevronIcon from '../../../assets/haul/provider-demand-list/icon_filter_chevron_down.png';
import locationPinIcon from '../../../assets/haul/provider-demand-list/icon_location_pin_blue.png';
import weightIcon from '../../../assets/haul/provider-demand-list/icon_metric_weight_blue.png';
import clockIcon from '../../../assets/haul/provider-demand-list/icon_metric_clock_orange.png';
import sceneIcon from '../../../assets/haul/provider-demand-list/icon_metric_scene_green.png';
import priceIcon from '../../../assets/haul/provider-demand-list/icon_metric_price_purple.png';
import airspaceIcon from '../../../assets/haul/provider-demand-list/icon_airspace_status_green.png';
import headerMessageIcon from '../../../assets/haul/provider-demand-list/icon_header_message_outline.png';
import messageDotIcon from '../../../assets/haul/provider-demand-list/badge_message_red_dot.png';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
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
  region: string;
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

type ProviderCapabilityCopy = {
  title: string;
  desc: string;
};

const PAGE_SIZE = 20;

const baseFilterMeta: Array<{ key: FilterKey; label: string; options: string[] }> = [
  { key: 'region', label: '区域', options: ['全部区域'] },
  { key: 'weight', label: '货物重量', options: ['全部重量', '50kg以下', '50-100kg', '100-300kg', '300kg以上'] },
  { key: 'time', label: '作业时间', options: ['全部时间', '今天', '明天', '后天及以后'] },
  { key: 'scene', label: '场景类型', options: ['全部场景'] },
];

const sceneQueryByLabel: Record<string, string> = Object.entries(CARGO_SCENE_LABELS).reduce((acc, [code, label]) => {
  acc[label] = code;
  return acc;
}, {
  施工物料吊运: 'power_grid',
  楼顶设备吊装: 'other_heavy_lift',
  应急物资转运: 'emergency_relief',
} as Record<string, string>);

const formatYuan = (amount?: number | null) =>
  `¥${Math.round(Number(amount || 0) / 100).toLocaleString('zh-CN')}`;

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

const providerCapabilityCopyOf = (canQuote: boolean, canSelfExecute: boolean): ProviderCapabilityCopy | null => {
  if (!canQuote) {
    return {
      title: '接单资质未开通',
      desc: '设备资质和履约资质全部通过后，才能查看需求并提交报价。',
    };
  }
  if (!canSelfExecute) {
    return {
      title: '接单资质未完整开通',
      desc: '设备资质和履约资质全部通过后，才能正式接单。',
    };
  }
  return null;
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

const demandRegionLabel = (item: DemandSummary) => {
  const anyItem = item as any;
  const snapshots = [
    anyItem.departure_address,
    anyItem.service_address,
    anyItem.destination_address,
  ].filter(Boolean);

  for (const snapshot of snapshots) {
    const district = String(snapshot?.district || '').trim();
    if (district) return district;
  }
  for (const snapshot of snapshots) {
    const city = String(snapshot?.city || '').trim();
    if (city) return city;
  }

  const text = [
    snapshotAddressText(anyItem.departure_address),
    anyItem.service_address_text,
    snapshotAddressText(anyItem.service_address),
    snapshotAddressText(anyItem.destination_address),
  ].filter(Boolean).join(' ');
  const matches = text.match(/[\u4e00-\u9fa5]{2,}(?:区|县|市|镇|乡|街道)/g) || [];
  return matches.find(value => /(?:区|县)$/.test(value)) || matches.find(value => /市$/.test(value)) || '';
};

const uniqueOptions = (values: string[], max = 5) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result.slice(0, max);
};

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
  const scheduleDate = parseDate(item.scheduled_start_at);
  const priceSort = positiveNumber(item.budget_min) || positiveNumber(item.budget_max);
  const airspace = airspaceMetaOf(anyItem.airspace_status);
  const region = demandRegionLabel(item);

  return {
    id: item.id,
    title: item.title || item.demand_no || '未命名需求',
    route,
    distance: distanceKm ? [ `${distanceKm.toFixed(1)}km`, coverageLabel, arrivalLabel ].filter(Boolean).join(' ') : '距离待计算',
    distanceSort: distanceKm,
    coverageLabel,
    arrivalLabel,
    region,
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
  if (value === '后天及以后') {
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
  if (filters.region !== '区域' && item.region !== filters.region && !item.route.includes(filters.region) && !item.title.includes(filters.region)) {
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
    if (filters.time === '后天及以后' && (isSameDay(date, today) || isSameDay(date, tomorrow))) return false;
  }
  if (filters.scene !== '场景类型') {
    const sceneQuery = sceneQueryByLabel[filters.scene];
    if (item.scene !== filters.scene && (!sceneQuery || item.sceneKey !== sceneQuery)) return false;
  }
  return true;
};

export default function DemandListPage({ headerExtra }: { headerExtra?: React.ReactNode } = {}) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const [headerTopRpx, setHeaderTopRpx] = useState(132);
  const [headerActionTopRpx, setHeaderActionTopRpx] = useState(132);
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    region: '区域',
    weight: '货物重量',
    time: '作业时间',
    scene: '场景类型',
  });
  // 长选项的自定义底部弹层（绕开微信 showActionSheet 6 项硬上限）
  const [filterSheet, setFilterSheet] = useState<{ key: FilterKey; options: string[] } | null>(null);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const canQuoteAsProvider = providerCapabilities.canPublishSupply;
  const canSelfExecuteAsProvider = providerCapabilities.canSelfExecute;
  const providerCapabilityCopy = useMemo(
    () => providerCapabilityCopyOf(canQuoteAsProvider, canSelfExecuteAsProvider),
    [canQuoteAsProvider, canSelfExecuteAsProvider],
  );

  const fetchDemands = useCallback(async (
    nextPage = 1,
    refresh = false,
    nextFilters = filters,
    nextSortKey = sortKey,
  ) => {
    if (!isAuthenticated || !canQuoteAsProvider) {
      setDemands([]);
      setHasMore(false);
      setFetchError(isAuthenticated ? (providerCapabilityCopy?.title || '接单资质通过后才能查看可接需求') : '请先登录服务商账号后查看可接需求。');
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
      setFetchError(friendlyErrorMessage(error, '需求加载失败，请稍后重试'));
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [canQuoteAsProvider, filters, isAuthenticated, providerCapabilityCopy?.title, sortKey]);

  useDidShow(() => {
    // 仅同步 TabBar 选中态，不强制改写全局角色身份。
    syncCustomTabBar(1);
    setPage(1);
    if (!isAuthenticated || !canQuoteAsProvider) {
      setDemands([]);
      setHasMore(false);
      setFetchError(isAuthenticated ? (providerCapabilityCopy?.title || '接单资质通过后才能查看可接需求') : '请先登录服务商账号后查看可接需求。');
      setLoading(false);
      return;
    }
    fetchDemands(1, true);
  });

  useEffect(() => {
    try {
      const sys = Taro.getSystemInfoSync();
      const ratio = 750 / (sys.windowWidth || 375);
      const statusBarRpx = Math.round(((sys.statusBarHeight || 20) + 12) * ratio);
      setHeaderTopRpx(statusBarRpx);
      const menu = Taro.getMenuButtonBoundingClientRect();
      if (menu?.top) {
        setHeaderActionTopRpx(Math.round(menu.top * ratio));
      } else {
        setHeaderActionTopRpx(statusBarRpx);
      }
    } catch {
      setHeaderTopRpx(132);
      setHeaderActionTopRpx(132);
    }
  }, []);

  const allVisualDemands = useMemo(() => demands.map(mapDemand), [demands]);

  const filterMeta = useMemo(() => baseFilterMeta.map((item) => {
    if (item.key === 'region') {
      return { ...item, options: ['全部区域', ...uniqueOptions(allVisualDemands.map(demand => demand.region))] };
    }
    if (item.key === 'scene') {
      return { ...item, options: ['全部场景', ...uniqueOptions(allVisualDemands.map(demand => demand.scene).filter(scene => scene !== '场景待补'))] };
    }
    return item;
  }), [allVisualDemands]);

  const visualDemands = useMemo(() => {
    const source = allVisualDemands.filter(item => matchesFilters(item, filters));
    if (sortKey === 'price') {
      return [...source].sort((a, b) => (a.priceSort ?? Number.MAX_SAFE_INTEGER) - (b.priceSort ?? Number.MAX_SAFE_INTEGER));
    }
    return [...source].sort((a, b) => (a.distanceSort ?? Number.MAX_SAFE_INTEGER) - (b.distanceSort ?? Number.MAX_SAFE_INTEGER));
  }, [allVisualDemands, filters, sortKey]);

  const loadMore = () => {
    if (!hasMore || loading || !demands.length) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDemands(nextPage, false, filters, sortKey);
  };

  const applyFilterChoice = (key: FilterKey, value: string) => {
    if (!value) return;
    const meta = filterMeta.find(item => item.key === key);
    const nextValue = value.startsWith('全部') ? meta?.label || filters[key] : value;
    const nextFilters = { ...filters, [key]: nextValue };
    setFilters(nextFilters);
    setPage(1);
    fetchDemands(1, true, nextFilters, sortKey);
  };

  const openFilter = (key: FilterKey, options: string[]) => {
    // 微信 showActionSheet itemList 最多 6 项，超过会直接 fail
    if (options.length > 6) {
      setFilterSheet({ key, options });
      return;
    }
    Taro.showActionSheet({ itemList: options }).then((res) => {
      applyFilterChoice(key, options[res.tapIndex]);
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

  const openMessages = () => {
    Taro.switchTab({ url: '/pages/messages/index' }).catch(() => null);
  };

  const goProviderOnboarding = () => {
    Taro.navigateTo({ url: '/pages/provider/onboarding/index?from=demand-list' }).catch(() => {
      Taro.showToast({ title: '入驻页暂不可用', icon: 'none' });
    });
  };

  const goBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
    } else {
      Taro.switchTab({ url: '/pages/home/index' }).catch(() => null);
    }
  };

  const openQuickQuote = async (item: VisualDemand) => {
    let suggestedPriceYuan = item.suggestedPriceYuan || null;
    try {
      const res = await demandV2Service.getSuggestedPrice(item.id);
      const yuan = Number((res as any)?.yuan || (res as any)?.data?.yuan || 0);
      if (Number.isFinite(yuan) && yuan > 0) {
        suggestedPriceYuan = yuan;
      }
    } catch {
      // 后端推荐价不可用时保留预算均值兜底，不阻断快速报价。
    }
    const priceParam = suggestedPriceYuan ? `&priceYuan=${suggestedPriceYuan}` : '';
    Taro.navigateTo({
      url: `/pages/demand/quote/index?id=${item.id}&quick=1&demandTitle=${encodeURIComponent(item.title)}${priceParam}`,
    }).catch(() => Taro.showToast({ title: '报价页暂不可用', icon: 'none' }));
  };

  return (
    <View className='pd-page'>
      <View
        className='pd-header'
        style={{ paddingTop: `${headerTopRpx}rpx` }}
      >
        <View
          className='pd-header-back'
          style={{ top: `${headerActionTopRpx}rpx` }}
          onClick={goBack}
        >
          <View className='pd-header-back-arrow' />
        </View>
        <Text className='pd-header-title'>可接吊运需求</Text>
        <View
          className='pd-header-action'
          style={{ top: `${headerActionTopRpx}rpx` }}
          onClick={openMessages}
        >
          <Image className='pd-header-action-icon' src={headerMessageIcon} mode='aspectFit' />
          <Image className='pd-header-action-dot' src={messageDotIcon} mode='aspectFit' />
        </View>
      </View>

      <ScrollView
        scrollY
        enhanced
        showScrollbar={false}
        className='pd-scroll'
        lowerThreshold={80}
        onScrollToLower={loadMore}
      >
        {headerExtra ? (
          <View className='pd-segment-host'>{headerExtra}</View>
        ) : null}
        {providerCapabilityCopy && isAuthenticated ? (
          <View className='pd-capability-notice'>
            <View className='pd-capability-copy'>
              <Text className='pd-capability-title'>{providerCapabilityCopy.title}</Text>
              <Text className='pd-capability-desc'>{providerCapabilityCopy.desc}</Text>
            </View>
            <View className='pd-capability-action' onClick={goProviderOnboarding}>
              <Text>去完善</Text>
            </View>
          </View>
        ) : null}
        <View className='pd-filter-area'>
          <View className='pd-filter-row'>
            {filterMeta.map(item => (
              <View
                key={item.key}
                className='pd-filter-chip'
                onClick={() => openFilter(item.key, item.options)}
              >
                <Text className='pd-filter-text'>{filters[item.key]}</Text>
                <Image className='pd-filter-chevron' src={filterChevronIcon} mode='aspectFit' />
              </View>
            ))}
          </View>

          <View className='pd-sort-row'>
            <View
              className={`pd-sort-chip ${sortKey === 'distance' ? 'is-active' : ''}`}
              onClick={() => changeSort('distance')}
            >
              <Text>距离最近</Text>
            </View>
            <View
              className={`pd-sort-chip ${sortKey === 'price' ? 'is-active' : ''}`}
              onClick={() => changeSort('price')}
            >
              <Text>价格优先</Text>
            </View>
          </View>
        </View>

        {visualDemands.map((item) => (
          <View
            key={item.id}
            className='pd-demand-card'
            onClick={() => goDetail(item)}
          >
            <View className='pd-route'>
              <Image className='pd-route-pin' src={locationPinIcon} mode='aspectFit' />
              <Text className='pd-route-title'>{item.route}</Text>
              <Text className='pd-distance'>{item.distance}</Text>
            </View>

            <View className='pd-metrics'>
              <View className='pd-metric'>
                <Image className='pd-metric-icon' src={weightIcon} mode='aspectFit' />
                <View className='pd-metric-body'>
                  <Text className='pd-metric-label'>货物重量</Text>
                  <Text className='pd-metric-value'>{item.weight}</Text>
                </View>
              </View>
              <View className='pd-metric'>
                <Image className='pd-metric-icon' src={clockIcon} mode='aspectFit' />
                <View className='pd-metric-body'>
                  <Text className='pd-metric-label'>作业时间</Text>
                  <Text className='pd-metric-value'>{item.schedule}</Text>
                </View>
              </View>
              <View className='pd-metric'>
                <Image className='pd-metric-icon' src={sceneIcon} mode='aspectFit' />
                <View className='pd-metric-body'>
                  <Text className='pd-metric-label'>场景类型</Text>
                  <Text className='pd-metric-value'>{item.scene}</Text>
                </View>
              </View>
              <View className='pd-metric'>
                <Image className='pd-metric-icon' src={priceIcon} mode='aspectFit' />
                <View className='pd-metric-body'>
                  <Text className='pd-metric-label'>平台预估价</Text>
                  <Text className='pd-metric-value pd-metric-value-price'>{item.price}</Text>
                </View>
              </View>
            </View>

            <View className='pd-card-foot'>
              <View className='pd-airspace'>
                <Image className='pd-airspace-icon' src={airspaceIcon} mode='aspectFit' />
                <View className='pd-airspace-text'>
                  <Text className='pd-airspace-label'>空域状态</Text>
                  <Text className={`pd-airspace-value pd-airspace-${item.airspaceTone}`}>{item.airspace}</Text>
                </View>
              </View>
              <View className='pd-buttons'>
                <View
                  className='pd-button pd-button-quick'
                  onClick={(event: any) => {
                    event.stopPropagation && event.stopPropagation();
                    openQuickQuote(item);
                  }}
                >
                  <Text>{item.hasQuoted ? '更新报价' : '快速报价'}</Text>
                </View>
                <View
                  className='pd-button pd-button-primary'
                  onClick={(event: any) => {
                    event.stopPropagation && event.stopPropagation();
                    goDetail(item);
                  }}
                >
                  <Text>查看详情</Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        {loading && demands.length === 0 ? (
          <View className='pd-empty-card'>
            <Text className='pd-empty-title'>正在加载需求</Text>
            <Text className='pd-empty-desc'>请稍候，正在读取服务商可接需求。</Text>
          </View>
        ) : null}

        {!loading && fetchError ? (
          <View className='pd-empty-card'>
            <Text className='pd-empty-title'>无法加载需求</Text>
            <Text className='pd-empty-desc'>{fetchError}</Text>
            {isAuthenticated ? (
              <View className='pd-empty-action' onClick={goProviderOnboarding}>
                <Text>去完善</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!loading && !fetchError && visualDemands.length === 0 ? (
          <View className='pd-empty-card'>
            <Text className='pd-empty-title'>{demands.length ? '当前筛选下没有接单需求' : '附近还没有可报价需求'}</Text>
            <Text className='pd-empty-desc'>{demands.length ? '请调整区域、重量、时间或场景后再刷新。' : '保持接单状态，稍后刷新会看到新任务。'}</Text>
          </View>
        ) : null}

        {loading && demands.length > 0 ? (
          <View className='pd-loading'>
            <Text className='pd-loading-text'>加载中…</Text>
          </View>
        ) : null}

        <View className='pd-scroll-spacer' />
      </ScrollView>

      {filterSheet ? (
        <View className='pd-filter-mask' onClick={() => setFilterSheet(null)}>
          <View className='pd-filter-panel' onClick={(e: any) => e.stopPropagation && e.stopPropagation()}>
            <View className='pd-filter-panel-head'>
              <Text className='pd-filter-panel-title'>
                {filterMeta.find(m => m.key === filterSheet.key)?.label || '选择'}
              </Text>
              <Text className='pd-filter-panel-close' onClick={() => setFilterSheet(null)}>取消</Text>
            </View>
            <ScrollView scrollY className='pd-filter-panel-list'>
              {filterSheet.options.map(option => {
                const active = filters[filterSheet.key] === option
                  || (option.startsWith('全部') && filters[filterSheet.key] === filterMeta.find(m => m.key === filterSheet.key)?.label);
                return (
                  <View
                    key={option}
                    className={`pd-filter-panel-item ${active ? 'is-active' : ''}`}
                    onClick={() => {
                      applyFilterChoice(filterSheet.key, option);
                      setFilterSheet(null);
                    }}
                  >
                    <Text>{option}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}
