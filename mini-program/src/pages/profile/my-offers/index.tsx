import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { ownerService } from '../../../services/owner';
import { supplyService } from '../../../services/supply';
import { SupplySummary } from '../../../types';
import { RootState } from '../../../store/store';
import { getObjectStatusMeta } from '../../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import '../shared-list.scss';

const GROUPS = ['all', 'draft', 'active', 'paused', 'closed'] as const;
const LABELS: Record<string, string> = { all: '全部', draft: '草稿', active: '生效中', paused: '已暂停', closed: '已关闭' };
const NEXT: Record<string, { status: string; label: string }> = { draft: { status: 'active', label: '立即上架' }, active: { status: 'paused', label: '暂停' }, paused: { status: 'active', label: '恢复上架' } };

export default function MyOffersPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canManageServices = Boolean(
    isAuthenticated && providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply,
  );
  const [offers, setOffers] = useState<SupplySummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const load = () => {
    if (!canManageServices) {
      setOffers([]);
      return Promise.resolve();
    }
    return ownerService.listMySupplies({ page: 1, page_size: 50 }).then(res => setOffers((res as any).items || [])).catch(() => {});
  };
  useDidShow(() => { load(); });
  const filtered = useMemo(() => offers.filter(o => activeGroup === 'all' || o.status === activeGroup), [offers, activeGroup]);

  const handleStatus = async (item: SupplySummary) => {
    if (!canManageServices) {
      Taro.showToast({ title: '服务商设备能力审核通过后才能管理正式服务', icon: 'none' });
      return;
    }
    const next = NEXT[item.status]; if (!next) return;
    setUpdatingId(item.id);
    try { await supplyService.updateStatus(item.id, next.status); await load(); } catch {} finally { setUpdatingId(null); }
  };

  if (!canManageServices) {
    return (
      <ProviderAccessNotice
        title={isAuthenticated ? '服务商设备能力未开通' : '请先登录服务商账号'}
        description={isAuthenticated ? '设备与关键资质审核通过后，才能查看、编辑和上架正式服务。' : '登录后才能查看服务商服务列表。'}
        actionText={isAuthenticated ? '查看服务商入驻' : undefined}
        onAction={isAuthenticated ? () => Taro.navigateTo({ url: '/pages/provider/onboarding/index' }) : undefined}
      />
    );
  }

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
