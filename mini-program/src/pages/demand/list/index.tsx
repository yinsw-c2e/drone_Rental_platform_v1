import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { demandV2Service } from '../../../services/demandV2';
import { homeService } from '../../../services/home';
import { RootState } from '../../../store/store';
import { DemandSummary } from '../../../types';
import { getDemandSceneLabel, getEffectiveRoleSummary } from '../../../utils';
import './index.scss';

type MarketDemandMode = 'public' | 'owner' | 'pilot';

const PAGE_SIZE = 20;

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

export default function DemandListPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const requestedMode = params.mode as MarketDemandMode | undefined;

  const authUser = useSelector((state: RootState) => state.auth.user);
  const authRoleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const roleSummary = useMemo(() => getEffectiveRoleSummary(authRoleSummary, authUser), [authRoleSummary, authUser]);

  const availableModes = useMemo<MarketDemandMode[]>(() => {
    const modes: MarketDemandMode[] = ['public'];
    if (roleSummary.has_owner_role) modes.push('owner');
    if (roleSummary.has_pilot_role) modes.push('pilot');
    return modes;
  }, [roleSummary.has_owner_role, roleSummary.has_pilot_role]);

  const [mode, setMode] = useState<MarketDemandMode>(() => {
    if (requestedMode && availableModes.includes(requestedMode)) return requestedMode;
    return availableModes[0] || 'public';
  });

  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPublicDemands = async () => {
    const dashboard: any = await homeService.getDashboard();
    const demandIds = Array.from(
      new Set(
        (dashboard.data?.market_feed || [])
          .filter((item: any) => item.object_type === 'demand')
          .map((item: any) => item.object_id),
      ),
    );
    if (demandIds.length === 0) return [];
    const details = await Promise.all(
      demandIds.slice(0, PAGE_SIZE).map(async (id: any) => {
        try {
          const res: any = await demandV2Service.getById(id);
          return res.data || res;
        } catch { return null; }
      }),
    );
    return details.filter(Boolean) as DemandSummary[];
  };

  const fetchDemands = useCallback(async (nextPage = 1, isRefresh = false) => {
    try {
      setLoading(true);
      let items: DemandSummary[] = [];
      let total = 0;

      if (mode === 'public') {
        items = await fetchPublicDemands();
        total = items.length;
      } else {
        const fetchParams = { page: nextPage, page_size: PAGE_SIZE };
        const res: any = mode === 'pilot'
          ? await demandV2Service.listPilotCandidateDemands(fetchParams)
          : await demandV2Service.listMarketplaceDemands(fetchParams);
        items = res.data?.items || res.items || [];
        total = Number(res.data?.total || res.meta?.total || 0);
      }

      if (isRefresh || nextPage === 1) {
        setDemands(items);
      } else {
        setDemands(prev => [...prev, ...items]);
      }
      setHasMore(mode !== 'public' && nextPage * PAGE_SIZE < total);
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useDidShow(() => {
    fetchDemands(1, true);
  });

  const loadMore = () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDemands(nextPage, false);
  };

  const renderItem = (item: DemandSummary) => {
    return (
      <View key={item.id} className="demand-card" onClick={() => Taro.navigateTo({ url: `/pages/demand/detail/index?id=${item.id}` })}>
        <View className="dc-header">
          <Text className="dc-title">{item.title}</Text>
          {item.status === 'open' && <View className="dc-badge"><Text className="dc-badge-text">招募中</Text></View>}
        </View>
        <View className="dc-tags">
          <Text className="dc-tag">{getDemandSceneLabel((item as any).cargo_scene)}</Text>
          <Text className="dc-tag">{(item as any).service_address_text || item.departure_address?.city || '地址不限'}</Text>
        </View>
        <View className="dc-meta">
          <Text className="dc-meta-text">{formatDemandSchedule((item as any).scheduled_start_at, (item as any).scheduled_end_at)}</Text>
          <Text className="dc-budget">{formatDemandBudget(item.budget_min, item.budget_max)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View className="page-wrap">
      <View className="hero">
        <Text className="hero-title">{mode === 'public' ? '公开任务' : mode === 'owner' ? '机主可报价任务' : '飞手可接任务'}</Text>
        <Text className="hero-desc">{mode === 'public' ? '查看当前公开重载需求' : mode === 'owner' ? '浏览可报价的潜在订单' : '浏览需要飞手协助的公开任务'}</Text>
      </View>
      <View className="tabs-bar">
        {availableModes.map(m => (
          <View key={m} className={`tab-item ${mode === m ? 'active' : ''}`} onClick={() => { setMode(m); setPage(1); }}>
            <Text className={`tab-text ${mode === m ? 'active-text' : ''}`}>{m === 'public' ? '全部大厅' : m === 'owner' ? '机主专区' : '飞手专区'}</Text>
          </View>
        ))}
      </View>
      <ScrollView scrollY className="list-content" onScrollToLower={loadMore} lowerThreshold={50}>
        {demands.length === 0 && !loading ? (
          <View className="empty-state"><Text className="empty-state-text">暂无相关需求</Text></View>
        ) : (
          demands.map(renderItem)
        )}
        {loading && <View className="loading-state"><Text className="loading-text">加载中...</Text></View>}
      </ScrollView>
    </View>
  );
}
