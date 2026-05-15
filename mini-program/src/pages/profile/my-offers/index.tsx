import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { ownerService } from '../../../services/owner';
import { supplyService } from '../../../services/supply';
import { SupplySummary } from '../../../types';
import { getObjectStatusMeta } from '../../../utils';
import '../shared-list.scss';

const GROUPS = ['all', 'draft', 'active', 'paused', 'closed'] as const;
const LABELS: Record<string, string> = { all: '全部', draft: '草稿', active: '生效中', paused: '已暂停', closed: '已关闭' };
const NEXT: Record<string, { status: string; label: string }> = { draft: { status: 'active', label: '立即上架' }, active: { status: 'paused', label: '暂停' }, paused: { status: 'active', label: '恢复上架' } };

export default function MyOffersPage() {
  const [offers, setOffers] = useState<SupplySummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const load = () => ownerService.listMySupplies({ page: 1, page_size: 50 }).then(res => setOffers((res as any).items || [])).catch(() => {});
  useDidShow(() => { load(); });
  const filtered = useMemo(() => offers.filter(o => activeGroup === 'all' || o.status === activeGroup), [offers, activeGroup]);

  const handleStatus = async (item: SupplySummary) => {
    const next = NEXT[item.status]; if (!next) return;
    setUpdatingId(item.id);
    try { await supplyService.updateStatus(item.id, next.status); await load(); } catch {} finally { setUpdatingId(null); }
  };

  return (
    <ScrollView scrollY className="profile-list-page">
      <View className="profile-list-content">
        <Text className="list-header-title">我的服务</Text>
        <View className="filter-chips">
          {GROUPS.map(g => (
            <View key={g} className={`filter-chip ${activeGroup === g ? 'filter-chip-active filter-chip-active-offers' : ''}`} onClick={() => setActiveGroup(g)}>{LABELS[g]}</View>
          ))}
        </View>
        {filtered.length === 0 ? <View className="empty-state"><Text className="empty-state-text">暂无服务</Text></View> :
          filtered.map(o => (
            <View key={o.id} className="list-item-card">
              <View className="list-item-card-header">
                <Text className="list-item-card-no">{o.supply_no}</Text>
                <Text className="list-item-card-status status-offers">{getObjectStatusMeta('supply', o.status).label}</Text>
              </View>
              <Text className="list-item-card-title">{o.title}</Text>
              <View className="list-item-card-meta">
                <Text className="list-item-card-meta-text">吊重: {o.max_payload_kg || 0}kg</Text>
                <Text className="list-item-card-price">¥{(o.base_price_amount || 0) / 100}</Text>
              </View>
              <View className="list-item-card-actions">
                <View className="list-item-card-action" onClick={() => Taro.navigateTo({ url: `/pages/supply/detail/index?id=${o.id}` })}>查看</View>
                {NEXT[o.status] && <View className="list-item-card-action list-item-card-action-primary" onClick={() => handleStatus(o)}>{updatingId === o.id ? '...' : NEXT[o.status].label}</View>}
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}
