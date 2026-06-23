import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Image, Input, Picker } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { demandV2Service } from '../../services/demandV2';
import { supplyService } from '../../services/supply';
import { RootState } from '../../store/store';
import { DemandSummary, SupplySummary } from '../../types';
import { formatUnknownEnumLabel, getDemandSceneLabel, getEffectiveRoleSummary, getSupplySceneLabel } from '../../utils';
import arrowRightIcon from '../../assets/service-market/icons/arrow_right.png';
import backIcon from '../../assets/service-market/icons/back.png';
import chevronDownIcon from '../../assets/service-market/icons/chevron_down.png';
import docCtaIcon from '../../assets/service-market/icons/doc_cta.png';
import filterIcon from '../../assets/service-market/icons/filter.png';
import lightningIcon from '../../assets/service-market/icons/lightning.png';
import markerHexIcon from '../../assets/service-market/icons/marker_hex.png';
import plusBoxIcon from '../../assets/service-market/icons/plus_box.png';
import searchIcon from '../../assets/service-market/icons/search.png';
import serviceHexIcon from '../../assets/service-market/icons/service_hex.png';
import taskHallIcon from '../../assets/service-market/icons/task_hall.png';
import serviceDrone1 from '../../assets/service-market/images/service_card_drone_1.jpg';
import serviceDrone2 from '../../assets/service-market/images/service_card_drone_2.jpg';
import serviceDrone3 from '../../assets/service-market/images/service_card_drone_3.jpg';
import './index.scss';

type MarketTab = 'demand' | 'supply';

const formatAmount = (v?: number | null) => `¥${((v || 0) / 100).toFixed(2)}`;
const serviceThumbs = [serviceDrone1, serviceDrone2, serviceDrone3];
const capabilityLabels = ['专业执行团队', '合规运营', '安全可靠'];
const regionFilters = [
  { label: '全部地区', value: '' },
  { label: '佛山', value: '佛山' },
  { label: '广州', value: '广州' },
  { label: '深圳', value: '深圳' },
  { label: '东莞', value: '东莞' },
  { label: '中山', value: '中山' },
];
const payloadFilters = [
  { label: '全部载重', value: 0 },
  { label: '50kg以上', value: 50 },
  { label: '80kg以上', value: 80 },
  { label: '100kg以上', value: 100 },
];
const sceneFilters = [
  { label: '全部场景', value: '' },
  { label: '电网建设', value: 'power_grid' },
  { label: '山区农副产品', value: 'mountain_agriculture' },
  { label: '高原给养', value: 'plateau_supply' },
  { label: '海岛补给', value: 'island_supply' },
  { label: '应急救援', value: 'emergency' },
];

const formatDemandBudget = (min?: number | null, max?: number | null) => {
  const lo = Number(min || 0);
  const hi = Number(max || 0);
  if (lo > 0 && hi > 0) return `${formatAmount(lo)} - ${formatAmount(hi)}`;
  if (hi > 0) return `${formatAmount(hi)} 以内`;
  if (lo > 0) return `${formatAmount(lo)} 起`;
  return '预算待沟通';
};

const formatDemandSchedule = (start?: string, end?: string) => {
  if (!start && !end) return '时间待沟通';
  const fmt = (v: string) => {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `${start ? fmt(start) : '待定'} - ${end ? fmt(end) : '待定'}`;
};

const resolvePrimaryAddress = (item: any) =>
  item.service_address_text ||
  item.service_address?.text ||
  item.departure_address?.text ||
  item.destination_address?.text ||
  '地址待补充';

const formatSupplyPricing = (amount?: number | null, unit?: string | null) => {
  const UNIT_LABELS: Record<string, string> = {
    per_order: '元/单', per_trip: '元/架次', per_km: '元/公里',
    per_hour: '元/小时', per_day: '元/天', per_kg: '元/公斤', fixed: '一口价',
  };
  return `${formatAmount(amount)} ${UNIT_LABELS[String(unit || '')] || formatUnknownEnumLabel(unit, '元')}`;
};

const getSupplyPriceParts = (amount?: number | null, unit?: string | null) => {
  const [price, ...unitParts] = formatSupplyPricing(amount, unit).split(' ');
  return { price, unit: unitParts.join(' ') || '元' };
};

const getServiceThumb = (id?: number) => {
  const index = Math.max(Number(id || 1) - 1, 0) % serviceThumbs.length;
  return serviceThumbs[index];
};

const getSupplySceneLabels = (item: SupplySummary) =>
  (item.cargo_scenes || []).map((s: string) => getSupplySceneLabel(s)).filter(Boolean);

const getSupplySearchableText = (item: any) => [
  item.title,
  item.supply_no,
  item.service_area_snapshot?.text,
  item.service_area_snapshot?.city,
  item.service_area_snapshot?.district,
  item.drone?.city,
  item.drone?.brand,
  item.drone?.model,
  item.drone?.serial_number,
  ...(item.cargo_scenes || []),
  ...(item.cargo_scenes || []).map((scene: string) => getSupplySceneLabel(scene)),
].filter(Boolean).join(' ').toLowerCase();

const getSceneValueFromKeyword = (keyword: string) => {
  const text = keyword.trim().toLowerCase();
  if (!text) return '';
  const matched = sceneFilters.slice(1).find(item =>
    item.value.toLowerCase().includes(text) ||
    item.label.toLowerCase().includes(text) ||
    text.includes(item.label.toLowerCase()),
  );
  return matched?.value || '';
};

export default function MarketPage() {
  const didShowOnceRef = useRef(false);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(
    () => getEffectiveRoleSummary(roleSummary, user),
    [roleSummary, user],
  );
  const isClientFocused = effectiveRoleSummary.has_client_role;

  const [activeTab, setActiveTab] = useState<MarketTab>(
    effectiveRoleSummary.has_client_role && !effectiveRoleSummary.has_owner_role && !effectiveRoleSummary.has_pilot_role
      ? 'supply'
      : 'demand',
  );
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [supplies, setSupplies] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [regionIndex, setRegionIndex] = useState(0);
  const [payloadIndex, setPayloadIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);

  const selectedRegion = regionFilters[regionIndex] || regionFilters[0];
  const selectedPayload = payloadFilters[payloadIndex] || payloadFilters[0];
  const selectedScene = sceneFilters[sceneIndex] || sceneFilters[0];
  const hasActiveFilters = Boolean(
    appliedKeyword ||
    selectedRegion.value ||
    selectedPayload.value ||
    selectedScene.value,
  );

  const fetchDemands = useCallback(async () => {
    try {
      const res = await demandV2Service.listMarketplaceDemands({ page: 1, page_size: 10 });
      setDemands((res as any).items || []);
    } catch { /* ignore */ }
  }, []);

  const fetchSupplies = useCallback(async () => {
    try {
      const sceneFromKeyword = getSceneValueFromKeyword(appliedKeyword);
      const res = await supplyService.list({
        page: 1,
        page_size: 20,
        keyword: sceneFromKeyword && !selectedScene.value ? undefined : appliedKeyword || undefined,
        region: selectedRegion.value || undefined,
        min_payload_kg: selectedPayload.value || undefined,
        cargo_scene: selectedScene.value || sceneFromKeyword || undefined,
        accepts_direct_order: true,
        service_type: 'heavy_cargo_lift_transport' as any,
      });
      setSupplies((res as any).items || []);
    } catch { /* ignore */ }
  }, [appliedKeyword, selectedPayload.value, selectedRegion.value, selectedScene.value]);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (activeTab === 'demand') {
      await fetchDemands();
    } else {
      await fetchSupplies();
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeTab, fetchDemands, fetchSupplies]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedKeyword(searchText.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useDidShow(() => {
    if (!didShowOnceRef.current) {
      didShowOnceRef.current = true;
      return;
    }
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredDemands = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return demands.filter((item: any) => {
      const sceneLabel = getDemandSceneLabel(item.cargo_scene);
      const searchable = [
        item.title,
        item.cargo_scene,
        sceneLabel,
        resolvePrimaryAddress(item),
        item.departure_address?.text,
        item.destination_address?.text,
        item.service_address?.text,
      ].filter(Boolean).join(' ').toLowerCase();
      if (keyword && !searchable.includes(keyword)) return false;
      if (selectedRegion.value && !searchable.includes(selectedRegion.value.toLowerCase())) return false;
      if (selectedPayload.value && Number(item.cargo_weight_kg || item.max_payload_kg || 0) < selectedPayload.value) return false;
      if (selectedScene.value && String(item.cargo_scene || '') !== selectedScene.value) return false;
      return true;
    });
  }, [appliedKeyword, demands, selectedPayload.value, selectedRegion.value, selectedScene.value]);

  const filteredSupplies = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return supplies.filter((item: any) => {
      const searchable = getSupplySearchableText(item);
      if (keyword && !searchable.includes(keyword)) return false;
      if (selectedRegion.value && !searchable.includes(selectedRegion.value.toLowerCase())) return false;
      if (selectedPayload.value && Number(item.max_payload_kg || 0) < selectedPayload.value) return false;
      if (selectedScene.value && !(item.cargo_scenes || []).includes(selectedScene.value)) return false;
      return true;
    });
  }, [appliedKeyword, selectedPayload.value, selectedRegion.value, selectedScene.value, supplies]);

  const items = activeTab === 'demand' ? filteredDemands : filteredSupplies;

  const applySearch = useCallback(() => {
    setAppliedKeyword(searchText.trim());
  }, [searchText]);

  const resetFilters = useCallback(() => {
    setSearchText('');
    setAppliedKeyword('');
    setRegionIndex(0);
    setPayloadIndex(0);
    setSceneIndex(0);
  }, []);

  const handleFilterButton = useCallback(() => {
    setAppliedKeyword(searchText.trim());
    setFilterPanelVisible(true);
  }, [searchText]);

  const confirmFilterPanel = useCallback(() => {
    setAppliedKeyword(searchText.trim());
    setFilterPanelVisible(false);
  }, [searchText]);

  const closeFilterPanel = useCallback(() => {
    setFilterPanelVisible(false);
  }, []);

  const handleBack = useCallback(() => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' });
  }, []);

  const handleQuickOrder = useCallback(() => {
    Taro.navigateTo({ url: '/pages/publish/quick-order/index' });
  }, []);

  const renderDemandItem = (item: DemandSummary) => (
    <View
      key={item.id}
      className="market-demand-card"
      onClick={() => Taro.navigateTo({ url: `/pages/demand/detail/index?id=${item.id}` })}
    >
      <View className="market-demand-main">
        <View className="market-demand-icon-wrap">
          <Image className="market-demand-icon" src={taskHallIcon} mode="aspectFit" />
        </View>
        <View className="market-demand-info">
          <Text className="market-demand-title">{item.title}</Text>
          <View className="market-meta-badges">
            <Text className="market-meta-badge">{getDemandSceneLabel((item as any).cargo_scene)}</Text>
            <Text className="market-meta-badge market-address-badge">{resolvePrimaryAddress(item)}</Text>
          </View>
        </View>
      </View>
      <View className="market-demand-footer">
        <Text className="market-demand-time">{formatDemandSchedule((item as any).scheduled_start_at, (item as any).scheduled_end_at)}</Text>
        <Text className="market-budget">{formatDemandBudget(item.budget_min, item.budget_max)}</Text>
      </View>
    </View>
  );

  const renderSupplyItem = (item: SupplySummary) => {
    const sceneLabels = getSupplySceneLabels(item);
    const priceParts = getSupplyPriceParts(item.base_price_amount, item.pricing_unit);

    return (
      <View
        key={item.id}
        className="market-supply-card"
        onClick={() => Taro.navigateTo({ url: `/pages/supply/detail/index?id=${item.id}` })}
      >
        <Image className="market-supply-thumb" src={getServiceThumb(item.id)} mode="aspectFill" />
        <View className="market-supply-main">
          <View className="market-supply-info">
            <Text className="market-supply-title">{item.title}</Text>
            <View className="market-supply-meta-row">
              <View className="market-supply-meta-item">
                <Image className="market-supply-meta-icon" src={markerHexIcon} mode="aspectFit" />
                <Text className="market-supply-meta">最大载重 {item.max_payload_kg || 0}kg</Text>
              </View>
              {sceneLabels.slice(0, 2).map((scene) => (
                <View key={scene} className="market-supply-meta-item">
                  <Image className="market-supply-meta-icon" src={markerHexIcon} mode="aspectFit" />
                  <Text className="market-supply-scenes">{scene}</Text>
                </View>
              ))}
              {sceneLabels.length === 0 && (
                <View className="market-supply-meta-item">
                  <Image className="market-supply-meta-icon" src={markerHexIcon} mode="aspectFit" />
                  <Text className="market-supply-scenes">服务场景待补充</Text>
                </View>
              )}
            </View>
            <View className="market-capability-row">
              {capabilityLabels.map((label) => (
                <Text key={label} className="market-capability-text">{label}</Text>
              ))}
            </View>
            <View className="market-supply-footer">
              <View className="market-price-wrap">
                <Text className="market-price">{priceParts.price}</Text>
                <Text className="market-price-unit"> {priceParts.unit}</Text>
              </View>
              <View className="market-order-btn" onClick={(e: any) => { e.stopPropagation(); Taro.navigateTo({ url: `/pages/supply/detail/index?id=${item.id}&from=market` }); }}>
                <Text className="market-order-btn-text">查看服务</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="market-page">
      <View className="market-navbar">
        <View className="market-nav-side">
          <View className="market-nav-back" onClick={handleBack}>
            <Image className="market-nav-icon market-nav-back-icon" src={backIcon} mode="aspectFit" />
          </View>
        </View>
        <Text className="market-nav-title">服务市场</Text>
        <View className="market-nav-side market-nav-side-right" />
      </View>

      <ScrollView
        className="market-scroll"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        <View className="market-content">
          <View className="market-entry-grid">
            <View className="market-entry-row">
              <View className="market-entry-item market-entry-primary" onClick={handleQuickOrder}>
                <Image className="market-entry-icon market-entry-icon-white" src={lightningIcon} mode="aspectFit" />
                <Text className="market-entry-primary-text">快速下单</Text>
              </View>
              <View className="market-entry-item" onClick={() => Taro.navigateTo({ url: '/pages/publish/demand/index' })}>
                <Image className="market-entry-icon" src={plusBoxIcon} mode="aspectFit" />
                <Text className="market-entry-text">发布任务</Text>
              </View>
            </View>
            <View className="market-entry-row">
              <View
                className={`market-entry-item ${activeTab === 'demand' ? 'market-entry-soft-active' : ''}`}
                onClick={() => setActiveTab('demand')}
              >
                <Image className="market-entry-icon" src={taskHallIcon} mode="aspectFit" />
                <Text className={activeTab === 'demand' ? 'market-entry-soft-text' : 'market-entry-text'}>任务大厅</Text>
              </View>
              <View
                className={`market-entry-item ${activeTab === 'supply' ? 'market-entry-soft-active' : ''}`}
                onClick={() => setActiveTab('supply')}
              >
                <Image className="market-entry-icon" src={serviceHexIcon} mode="aspectFit" />
                <Text className={activeTab === 'supply' ? 'market-entry-soft-text' : 'market-entry-text'}>找服务</Text>
              </View>
            </View>
          </View>

          <View className="market-filter-panel">
            <View className="market-search-row">
              <View className={`market-search-box ${appliedKeyword ? 'market-search-box-active' : ''}`}>
                <Image className="market-search-icon" src={searchIcon} mode="aspectFit" />
                <Input
                  className="market-search-input"
                  value={searchText}
                  placeholder={activeTab === 'demand' ? '搜索任务名称、地址或场景' : '搜索服务名称、场景或关键词'}
                  placeholderClass="market-search-placeholder"
                  confirmType="search"
                  onInput={(e: any) => {
                    const value = String(e.detail.value || '');
                    setSearchText(value);
                    if (!value.trim()) {
                      setAppliedKeyword('');
                    }
                  }}
                  onConfirm={applySearch}
                  onBlur={applySearch}
                />
              </View>
              <View className={`market-filter-btn ${hasActiveFilters ? 'market-filter-btn-active' : ''}`} onClick={handleFilterButton}>
                <Image className="market-filter-icon" src={filterIcon} mode="aspectFit" />
                <Text className={`market-filter-text ${hasActiveFilters ? 'market-filter-text-active' : ''}`}>
                  筛选
                </Text>
              </View>
            </View>
            <View className="market-filter-row">
              <Picker className="market-filter-picker" mode="selector" range={regionFilters.map(item => item.label)} value={regionIndex} onChange={(e: any) => setRegionIndex(Number(e.detail.value || 0))}>
                <View className={`market-filter-chip ${selectedRegion.value ? 'market-filter-chip-active' : ''}`}>
                  <Text className={`market-filter-chip-text ${selectedRegion.value ? 'market-filter-chip-text-active' : ''}`}>{selectedRegion.label}</Text>
                  <Image className="market-filter-chip-icon" src={chevronDownIcon} mode="aspectFit" />
                </View>
              </Picker>
              <Picker className="market-filter-picker" mode="selector" range={payloadFilters.map(item => item.label)} value={payloadIndex} onChange={(e: any) => setPayloadIndex(Number(e.detail.value || 0))}>
                <View className={`market-filter-chip ${selectedPayload.value ? 'market-filter-chip-active' : ''}`}>
                  <Text className={`market-filter-chip-text ${selectedPayload.value ? 'market-filter-chip-text-active' : ''}`}>{selectedPayload.label}</Text>
                  <Image className="market-filter-chip-icon" src={chevronDownIcon} mode="aspectFit" />
                </View>
              </Picker>
              <Picker className="market-filter-picker" mode="selector" range={sceneFilters.map(item => item.label)} value={sceneIndex} onChange={(e: any) => setSceneIndex(Number(e.detail.value || 0))}>
                <View className={`market-filter-chip ${selectedScene.value ? 'market-filter-chip-active' : ''}`}>
                  <Text className={`market-filter-chip-text ${selectedScene.value ? 'market-filter-chip-text-active' : ''}`}>{selectedScene.label}</Text>
                  <Image className="market-filter-chip-icon" src={chevronDownIcon} mode="aspectFit" />
                </View>
              </Picker>
            </View>
          </View>

          {loading ? (
            <View className="empty-state">
              <Text className="empty-state-text">加载中...</Text>
            </View>
          ) : items.length === 0 ? (
            <View className="empty-state">
              <Image className="empty-state-icon" src={activeTab === 'demand' ? taskHallIcon : serviceHexIcon} mode="aspectFit" />
              <Text className="empty-state-text">
                {isClientFocused
                  ? activeTab === 'demand' ? '当前还没有公开任务' : '当前还没有可浏览的服务'
                  : `暂无公开${activeTab === 'demand' ? '需求' : '服务'}`}
              </Text>
            </View>
          ) : (
            items.map((item: any) =>
              activeTab === 'demand' ? renderDemandItem(item as DemandSummary) : renderSupplyItem(item as SupplySummary)
            )
          )}
        </View>
      </ScrollView>

      {filterPanelVisible && (
        <View className="market-filter-mask" onClick={closeFilterPanel}>
          <View className="market-filter-sheet" onClick={(e: any) => e.stopPropagation()}>
            <View className="market-filter-sheet-head">
              <Text className="market-filter-sheet-title">{activeTab === 'demand' ? '筛选任务' : '筛选服务'}</Text>
              <Text className="market-filter-reset" onClick={resetFilters}>重置</Text>
            </View>

            <View className="market-filter-group">
              <Text className="market-filter-group-title">地区</Text>
              <View className="market-filter-option-row">
                {regionFilters.map((item, index) => (
                  <View
                    key={item.label}
                    className={`market-filter-option ${regionIndex === index ? 'market-filter-option-active' : ''}`}
                    onClick={() => setRegionIndex(index)}
                  >
                    <Text className={`market-filter-option-text ${regionIndex === index ? 'market-filter-option-text-active' : ''}`}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="market-filter-group">
              <Text className="market-filter-group-title">载重</Text>
              <View className="market-filter-option-row">
                {payloadFilters.map((item, index) => (
                  <View
                    key={item.label}
                    className={`market-filter-option ${payloadIndex === index ? 'market-filter-option-active' : ''}`}
                    onClick={() => setPayloadIndex(index)}
                  >
                    <Text className={`market-filter-option-text ${payloadIndex === index ? 'market-filter-option-text-active' : ''}`}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="market-filter-group">
              <Text className="market-filter-group-title">场景</Text>
              <View className="market-filter-option-row">
                {sceneFilters.map((item, index) => (
                  <View
                    key={item.label}
                    className={`market-filter-option ${sceneIndex === index ? 'market-filter-option-active' : ''}`}
                    onClick={() => setSceneIndex(index)}
                  >
                    <Text className={`market-filter-option-text ${sceneIndex === index ? 'market-filter-option-text-active' : ''}`}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="market-filter-sheet-actions">
              <View className="market-filter-sheet-cancel" onClick={closeFilterPanel}>
                <Text className="market-filter-sheet-cancel-text">取消</Text>
              </View>
              <View className="market-filter-sheet-confirm" onClick={confirmFilterPanel}>
                <Text className="market-filter-sheet-confirm-text">完成筛选</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View className="market-footer">
        <View className="market-main-btn" onClick={() => Taro.navigateTo({ url: '/pages/publish/demand/index' })}>
          <Image className="market-cta-icon" src={docCtaIcon} mode="aspectFit" />
          <Text className="market-main-btn-text">找不到合适服务？发布任务</Text>
          <Image className="market-cta-arrow" src={arrowRightIcon} mode="aspectFit" />
        </View>
      </View>
    </View>
  );
}
