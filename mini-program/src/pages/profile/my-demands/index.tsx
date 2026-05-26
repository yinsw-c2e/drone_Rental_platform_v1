import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { Image, View, Text, ScrollView } from '@tarojs/components';
import { demandV2Service } from '../../../services/demandV2';
import { DemandSummary } from '../../../types';
import { getObjectStatusMeta } from '../../../components/business/visuals';
import { getDemandSceneLabel } from '../../../utils';
import backIcon from '../../../assets/my-demands/icons/back.png';
import folderHeroImage from '../../../assets/my-demands/images/folder_hero.png';
import './index.scss';

const STATUS_GROUPS = ['all', 'draft', 'quoting', 'selected', 'converted_to_order', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = { all: '全部', draft: '草稿', quoting: '询价中', selected: '已选定', converted_to_order: '已转订单', closed: '已结束' };

const matchesGroup = (status: string, group: string) => {
  if (group === 'all') return true;
  if (group === 'quoting') return status === 'published' || status === 'quoting';
  if (group === 'closed') return ['cancelled', 'expired', 'closed'].includes(status);
  return status === group;
};

const getStatusClass = (status: string) => {
  if (status === 'draft') return 'draft';
  if (status === 'published' || status === 'quoting') return 'inquiry';
  if (status === 'converted_to_order') return 'ordered';
  if (status === 'selected') return 'selected';
  return 'closed';
};

const formatBudget = (value?: number | null) => `¥${((value || 0) / 100).toFixed(0)}`;

export default function MyDemandsPage() {
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('all');

  useDidShow(() => {
    demandV2Service.listMyDemands({ page: 1, page_size: 50 })
      .then(res => setDemands((res as any).items || (res as any).data?.items || []))
      .catch(() => {});
  });

  const filtered = useMemo(() => demands.filter(d => matchesGroup(d.status, activeGroup)), [demands, activeGroup]);

  const handleBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/profile/index' });
  };

  return (
    <View className="md-page">
      <View className="md-navbar">
        <View className="md-nav-side">
          <View className="md-nav-back" onClick={handleBack}>
            <Image className="md-back-icon" src={backIcon} mode="aspectFit" />
          </View>
        </View>
        <Text className="md-nav-title">我的需求</Text>
        <View className="md-nav-side md-nav-side-right" />
      </View>

      <ScrollView scrollY className="md-scroll">
        <View className="md-hero">
          <Image className="md-hero-illustration" src={folderHeroImage} mode="aspectFit" />
          <View className="md-title-wrap">
            <View className="md-page-title">
              <Text className="md-page-title-text">我的需求</Text>
              <View className="md-title-dot" />
            </View>
            <Text className="md-subtitle">管理我的全部需求订单，实时掌握进度与状态</Text>
          </View>

          <ScrollView className="md-tabs-scroll" scrollX showScrollbar={false}>
            <View className="md-tabs">
              {STATUS_GROUPS.map(g => (
                <View
                  key={g}
                  className={`md-tab ${activeGroup === g ? 'is-active' : ''}`}
                  onClick={() => setActiveGroup(g)}
                >
                  <Text className={`md-tab-text ${activeGroup === g ? 'is-active' : ''}`}>{STATUS_LABELS[g]}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="md-list">
          {filtered.length === 0 ? (
            <View className="md-empty-state">
              <Text className="md-empty-state-text">暂无需求</Text>
            </View>
          ) : filtered.map(d => {
            const meta = getObjectStatusMeta('demand', d.status);
            return (
              <View
                key={d.id}
                className="md-card"
                onClick={() => Taro.navigateTo({ url: `/pages/demand/detail/index?id=${d.id}` })}
              >
                <View className="md-card-head">
                  <Text className="md-id">{d.demand_no}</Text>
                  <Text className={`md-status md-status-${getStatusClass(d.status)}`}>{meta.label}</Text>
                </View>
                <Text className="md-card-title" numberOfLines={2}>{d.title}</Text>
                <View className="md-category-wrap">
                  <Text className="md-category">{getDemandSceneLabel(d.cargo_scene)}</Text>
                </View>
                <View className="md-stats-panel">
                  <View className="md-stat-col">
                    <Text className="md-stat-num md-stat-num-blue">{d.quote_count || 0}</Text>
                    <Text className="md-stat-label">报价</Text>
                  </View>
                  <View className="md-stat-divider" />
                  <View className="md-stat-col">
                    <Text className="md-stat-num md-stat-num-orange">{d.candidate_pilot_count || 0}</Text>
                    <Text className="md-stat-label">候选服务商</Text>
                  </View>
                  <View className="md-stat-divider" />
                  <View className="md-stat-col">
                    <Text className="md-stat-num md-stat-num-red">{formatBudget(d.budget_max)}</Text>
                    <Text className="md-stat-label">预算</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
