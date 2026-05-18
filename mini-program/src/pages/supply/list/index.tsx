import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { supplyService } from '../../../services/supply';
import { SupplySummary } from '../../../types';
import { formatUnknownEnumLabel, getSupplySceneLabel } from '../../../utils';
import './index.scss';

const SCENE_FILTERS = [
  { key: '', label: '全部场景' },
  { key: 'power_grid', label: '电网建设' },
  { key: 'mountain_agriculture', label: '山区农副产品' },
  { key: 'plateau_supply', label: '高原给养' },
  { key: 'island_supply', label: '海岛补给' },
  { key: 'emergency', label: '应急救援' },
];

const formatAmount = (v?: number | null) => `¥${((v || 0) / 100).toFixed(2)}`;
const formatPricing = (amount?: number | null, unit?: string | null) => {
  const UNIT_MAP: Record<string, string> = { per_order: '单', per_trip: '架次', per_km: '公里', per_hour: '小时', per_day: '天', per_kg: '公斤', fixed: '一口价' };
  return `${formatAmount(amount)} / ${UNIT_MAP[String(unit)] || formatUnknownEnumLabel(unit, '元')}`;
};

export default function OfferListPage() {
  const [supplies, setSupplies] = useState<SupplySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [activeScene, setActiveScene] = useState('');

  const fetchSupplies = useCallback(async (nextPage = 1, isRefresh = false) => {
    try {
      setLoading(true);
      const res: any = await supplyService.list({
        page: nextPage,
        page_size: 20,
        cargo_scene: activeScene || undefined,
        service_type: 'heavy_cargo_lift_transport' as any,
      });
      const items = res.data?.items || res.items || [];
      const total = Number(res.data?.total || res.meta?.total || 0);

      if (isRefresh || nextPage === 1) {
        setSupplies(items);
      } else {
        setSupplies(prev => [...prev, ...items]);
      }
      setHasMore(nextPage * 20 < total);
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  }, [activeScene]);

  useDidShow(() => {
    fetchSupplies(1, true);
  });

  const handleSceneChange = (key: string) => {
    setActiveScene(key);
    setPage(1);
    // fetching will be triggered on next effect or we can just call it
    setTimeout(() => fetchSupplies(1, true), 50);
  };

  const loadMore = () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSupplies(nextPage, false);
  };

  return (
    <View className="page-wrap">
      <View className="hero">
        <Text className="hero-title">服务大厅</Text>
        <Text className="hero-desc">寻找合适的重载无人机运力服务，可直接快捷下单。</Text>
      </View>
      <ScrollView scrollX className="filter-scroll">
        <View className="filter-row">
          {SCENE_FILTERS.map(f => (
            <View key={f.key} className={`filter-chip ${activeScene === f.key ? 'active' : ''}`} onClick={() => handleSceneChange(f.key)}>
              <Text className={`filter-text ${activeScene === f.key ? 'active-text' : ''}`}>{f.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <ScrollView scrollY className="list-content" onScrollToLower={loadMore} lowerThreshold={50}>
        {supplies.length === 0 && !loading ? (
          <View className="empty-state"><Text className="empty-state-text">未找到相关服务</Text></View>
        ) : (
          supplies.map(item => (
            <View key={item.id} className="supply-card" onClick={() => Taro.navigateTo({ url: `/pages/supply/detail/index?id=${item.id}` })}>
              <View className="sc-header">
                <Text className="sc-title">{item.title}</Text>
                {item.accepts_direct_order && <View className="sc-badge"><Text className="sc-badge-text">支持快捷下单</Text></View>}
              </View>
              <View className="sc-meta-row">
                <Text className="sc-meta-text">载重 {item.max_payload_kg || 0}kg · {item.cargo_scenes?.map(s => getSupplySceneLabel(s)).join('/')}</Text>
              </View>
              <View className="sc-footer">
                <Text className="sc-price">{formatPricing(item.base_price_amount, item.pricing_unit)}</Text>
                <View className="btn-order" onClick={(e: any) => { e.stopPropagation(); Taro.navigateTo({ url: `/pages/publish/quick-order/index?supplyId=${item.id}` }); }}>
                  <Text className="btn-order-text">去下单</Text>
                </View>
              </View>
            </View>
          ))
        )}
        {loading && <View className="loading-state"><Text className="loading-text">加载中...</Text></View>}
      </ScrollView>
    </View>
  );
}
