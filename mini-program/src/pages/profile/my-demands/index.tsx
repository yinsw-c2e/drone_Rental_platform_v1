import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { demandV2Service } from '../../../services/demandV2';
import { DemandSummary } from '../../../types';
import { getObjectStatusMeta, getTonePalette } from '../../../components/business/visuals';
import { getDemandSceneLabel } from '../../../utils';
import '../shared-list.scss';

const STATUS_GROUPS = ['all', 'draft', 'quoting', 'selected', 'converted_to_order', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = { all: '全部', draft: '草稿', quoting: '询价中', selected: '已选定', converted_to_order: '已转订单', closed: '已结束' };

const matchesGroup = (status: string, group: string) => {
  if (group === 'all') return true;
  if (group === 'quoting') return status === 'published' || status === 'quoting';
  if (group === 'closed') return ['cancelled', 'expired', 'closed'].includes(status);
  return status === group;
};

export default function MyDemandsPage() {
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('all');

  useDidShow(() => {
    demandV2Service.listMyDemands({ page: 1, page_size: 100 })
      .then(res => setDemands((res as any).items || (res as any).data?.items || []))
      .catch(() => {});
  });

  const filtered = useMemo(() => demands.filter(d => matchesGroup(d.status, activeGroup)), [demands, activeGroup]);

  return (
    <ScrollView scrollY className="profile-list-page">
      <View className="profile-list-content">
        <Text className="list-header-title">我的需求</Text>
        <View className="filter-chips">
          {STATUS_GROUPS.map(g => (
            <View key={g} className={`filter-chip ${activeGroup === g ? 'filter-chip-active filter-chip-active-demands' : ''}`} onClick={() => setActiveGroup(g)}>{STATUS_LABELS[g]}</View>
          ))}
        </View>
        {filtered.length === 0 ? <View className="empty-state"><Text className="empty-state-text">暂无需求</Text></View> :
          filtered.map(d => {
            const meta = getObjectStatusMeta('demand', d.status);
            const palette = getTonePalette(meta.tone, false);
            return (
              <View key={d.id} className="list-item-card" onClick={() => Taro.navigateTo({ url: `/pages/demand/detail/index?id=${d.id}` })}>
                <View className="list-item-card-header">
                  <Text className="list-item-card-no">{d.demand_no}</Text>
                  <View className="status-badge" style={{ backgroundColor: palette.bg, padding: '2px 8px', borderRadius: '10px' }}>
                    <Text className="status-badge-text" style={{ color: palette.text, fontSize: '11px' }}>{meta.label}</Text>
                  </View>
                </View>
                <Text className="list-item-card-title" numberOfLines={2}>{d.title}</Text>
                <View style={{ display: 'flex', flexDirection: 'row', marginBottom: '8px' }}>
                  <Text style={{ fontSize: '11px', color: '#9CA3AF', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>{getDemandSceneLabel(d.cargo_scene)}</Text>
                </View>
                <View className="list-item-card-stats">
                  <View className="list-item-card-stat"><Text className="list-item-card-stat-value">{d.quote_count || 0}</Text><Text className="list-item-card-stat-label">报价</Text></View>
                  <View className="list-item-card-stat"><Text className="list-item-card-stat-value" style={{ color: '#FA8C16' }}>{d.candidate_pilot_count || 0}</Text><Text className="list-item-card-stat-label">候选飞手</Text></View>
                  <View className="list-item-card-stat"><Text className="list-item-card-stat-value" style={{ color: '#F5222D' }}>¥{((d.budget_max || 0) / 100).toFixed(0)}</Text><Text className="list-item-card-stat-label">预算</Text></View>
                </View>
              </View>
            );
          })}
      </View>
    </ScrollView>
  );
}
