import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { demandV2Service } from '../../services/demandV2';
import { supplyService } from '../../services/supply';
import { RootState } from '../../store/store';
import { DemandSummary, SupplySummary } from '../../types';
import { formatUnknownEnumLabel, getDemandSceneLabel, getEffectiveRoleSummary, getSupplySceneLabel } from '../../utils';
import './index.scss';

type MarketTab = 'demand' | 'supply';

const formatAmount = (v?: number | null) => `¥${((v || 0) / 100).toFixed(2)}`;

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

export default function MarketPage() {
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

  const fetchDemands = useCallback(async () => {
    try {
      const res = await demandV2Service.listMarketplaceDemands({ page: 1, page_size: 10 });
      setDemands((res as any).items || []);
    } catch { /* ignore */ }
  }, []);

  const fetchSupplies = useCallback(async () => {
    try {
      const res = await supplyService.list({
        page: 1,
        page_size: 10,
        accepts_direct_order: true,
        service_type: 'heavy_cargo_lift_transport' as any,
      });
      setSupplies((res as any).items || []);
    } catch { /* ignore */ }
  }, []);

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

  useDidShow(() => {
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const items = activeTab === 'demand' ? demands : supplies;

  const mainAction = useMemo(() => {
    if (isClientFocused) {
      if (activeTab === 'supply') {
        return { label: '找不到合适服务？发布任务', onPress: () => Taro.navigateTo({ url: '/pages/publish/demand/index' }) };
      }
      return { label: '先去找服务', onPress: () => { setActiveTab('supply'); } };
    }
    if (activeTab === 'demand') {
      return {
        label: effectiveRoleSummary.has_client_role ? '发布任务' : '查看全部任务',
        onPress: () => Taro.navigateTo({ url: effectiveRoleSummary.has_client_role ? '/pages/publish/demand/index' : '/pages/demand/list/index' }),
      };
    }
    return {
      label: effectiveRoleSummary.has_owner_role ? '上架服务' : '查看全部服务',
      onPress: () => Taro.navigateTo({ url: effectiveRoleSummary.has_owner_role ? '/pages/publish/supply/index' : '/pages/supply/list/index' }),
    };
  }, [activeTab, effectiveRoleSummary, isClientFocused]);

  const renderDemandItem = (item: DemandSummary) => (
    <View
      key={item.id}
      className="list-item market-demand-card"
      onClick={() => Taro.navigateTo({ url: `/pages/demand/detail/index?id=${item.id}` })}
    >
      <View className="list-item-header">
        <View style={{ flex: 1 }}>
          <Text className="list-item-title">{item.title}</Text>
        </View>
      </View>
      <View className="market-meta-badges">
        <Text className="market-meta-badge">{getDemandSceneLabel((item as any).cargo_scene)}</Text>
        <Text className="market-meta-badge">{resolvePrimaryAddress(item)}</Text>
      </View>
      <View className="list-item-meta">
        <Text className="list-item-meta-text">{formatDemandSchedule((item as any).scheduled_start_at, (item as any).scheduled_end_at)}</Text>
        <Text className="market-budget">{formatDemandBudget(item.budget_min, item.budget_max)}</Text>
      </View>
    </View>
  );

  const renderSupplyItem = (item: SupplySummary) => (
    <View
      key={item.id}
      className="list-item market-supply-card"
      onClick={() => Taro.navigateTo({ url: `/pages/supply/detail/index?id=${item.id}` })}
    >
      <View className="market-supply-img">
        <Text className="market-supply-emoji">🚁</Text>
      </View>
      <View className="market-supply-info">
        <Text className="list-item-title">{item.title}</Text>
        <View className="list-item-meta" style={{ marginTop: '4px' }}>
          <Text className="list-item-meta-text">最大载重 {item.max_payload_kg || 0}kg</Text>
          <Text className="list-item-meta-text" style={{ marginLeft: '6px', marginRight: '6px' }}> · </Text>
          <Text className="list-item-meta-text">{(item.cargo_scenes || []).map((s: string) => getSupplySceneLabel(s)).join('/')}</Text>
        </View>
        <View className="list-item-meta" style={{ marginTop: '8px', justifyContent: 'space-between' }}>
          <Text className="market-price">{formatSupplyPricing(item.base_price_amount, item.pricing_unit)}</Text>
          <View className="market-order-btn" onClick={(e: any) => { e.stopPropagation(); Taro.navigateTo({ url: `/pages/supply/detail/index?id=${item.id}` }); }}>
            <Text style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>去下单</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View className="market-page">
      <ScrollView
        scrollY
        style={{ flex: 1 }}
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        <View style={{ padding: '16px' }}>
          {isClientFocused && (
            <View className="market-entry-card">
              <View className="market-entry-row">
                <View className="market-entry-primary" onClick={() => setActiveTab('supply')}>
                  <Text style={{ color: '#fff', fontSize: '15px', fontWeight: '800' }}>快速下单</Text>
                </View>
                <View className="market-entry-secondary" onClick={() => Taro.navigateTo({ url: '/pages/publish/demand/index' })}>
                  <Text style={{ color: '#1A1D26', fontSize: '15px', fontWeight: '800' }}>发布任务</Text>
                </View>
              </View>
            </View>
          )}

          <View className="market-tab-bar">
            <View
              className={`market-tab ${activeTab === 'demand' ? 'market-tab-active' : ''}`}
              onClick={() => setActiveTab('demand')}
            >
              <Text className={`market-tab-text ${activeTab === 'demand' ? 'market-tab-text-active' : ''}`}>
                {isClientFocused ? '任务大厅' : '看需求'}
              </Text>
            </View>
            <View
              className={`market-tab ${activeTab === 'supply' ? 'market-tab-active' : ''}`}
              onClick={() => setActiveTab('supply')}
            >
              <Text className={`market-tab-text ${activeTab === 'supply' ? 'market-tab-text-active' : ''}`}>
                {isClientFocused ? '找服务' : '看服务'}
              </Text>
            </View>
          </View>

          {loading ? (
            <View className="empty-state">
              <Text className="empty-state-text">加载中...</Text>
            </View>
          ) : items.length === 0 ? (
            <View className="empty-state">
              <Text className="empty-state-icon">{activeTab === 'demand' ? '📋' : '🛩️'}</Text>
              <Text className="empty-state-text">
                {isClientFocused
                  ? activeTab === 'demand' ? '当前还没有公开任务' : '当前还没有可快速下单的服务'
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

      <View className="market-footer">
        <View className="market-main-btn" onClick={mainAction.onPress}>
          <Text style={{ color: '#fff', fontSize: '15px', fontWeight: '800' }}>
            {mainAction.label}
          </Text>
        </View>
      </View>
    </View>
  );
}
