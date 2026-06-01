import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { ownerService } from '../../../services/owner';
import { DemandQuoteSummary } from '../../../types';
import { RootState } from '../../../store/store';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import '../shared-list.scss';

const GROUPS = ['all', 'submitted', 'selected', 'rejected', 'expired'] as const;
const LABELS: Record<string, string> = { all: '全部', submitted: '已提交', selected: '已选中', rejected: '未中选', expired: '已过期' };
const STATUS_LABELS: Record<string, string> = {
  submitted: '已提交',
  selected: '已选中',
  rejected: '未中选',
  expired: '已过期',
};

export default function MyQuotesPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canViewQuotes = Boolean(
    isAuthenticated && providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply,
  );
  const [quotes, setQuotes] = useState<DemandQuoteSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  useDidShow(() => {
    if (!canViewQuotes) {
      setQuotes([]);
      return;
    }
    ownerService.listMyQuotes({ page: 1, page_size: 50 }).then(res => setQuotes((res as any).items || [])).catch(() => {});
  });
  const filtered = useMemo(() => quotes.filter(q => activeGroup === 'all' || q.status === activeGroup), [quotes, activeGroup]);

  if (!canViewQuotes) {
    return (
	      <ProviderAccessNotice
	        title={isAuthenticated ? '接单资质未开通' : '请先登录服务商账号'}
	        description={isAuthenticated ? '设备资质和履约资质全部通过后，才能查看和管理你提交的报价。' : '登录后才能查看服务商报价记录。'}
        actionText={isAuthenticated ? '查看服务商入驻' : undefined}
        onAction={isAuthenticated ? () => Taro.navigateTo({ url: '/pages/provider/onboarding/index' }) : undefined}
      />
    );
  }

  return (
    <ScrollView scrollY className="profile-list-page">
      <View className="profile-list-content">
        <Text className="list-header-title">我的报价</Text>
        <View className="filter-chips">
          {GROUPS.map(g => (
            <View key={g} className={`filter-chip ${activeGroup === g ? 'filter-chip-active filter-chip-active-quotes' : ''}`} onClick={() => setActiveGroup(g)}>{LABELS[g]}</View>
          ))}
        </View>
        {filtered.length === 0 ? <View className="empty-state"><Text className="empty-state-text">暂无报价记录</Text></View> :
          filtered.map(q => (
            <View key={q.id} className="list-item-card" onClick={() => q.demand?.id && Taro.navigateTo({ url: `/pages/demand/detail/index?id=${q.demand.id}` })}>
              <View className="list-item-card-header">
                <Text className="list-item-card-no">{q.quote_no}</Text>
                <Text className="list-item-card-status status-quotes">{STATUS_LABELS[q.status] || '状态未知'}</Text>
              </View>
              <Text className="list-item-card-title" numberOfLines={2}>{q.demand?.title || `需求 #${q.demand_id}`}</Text>
              <View className="list-item-card-meta">
                <Text className="list-item-card-meta-text">{q.drone?.brand} {q.drone?.model}</Text>
                <Text className="list-item-card-price">¥{(q.price_amount || 0) / 100}</Text>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}
