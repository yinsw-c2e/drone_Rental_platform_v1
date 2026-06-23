import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { ownerService } from '../../../services/owner';
import { orderV2Service } from '../../../services/orderV2';
import { DemandQuoteSummary, V2OrderSummary } from '../../../types';
import { RootState } from '../../../store/store';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import '../shared-list.scss';
import './index.scss';

const GROUPS = ['all', 'submitted', 'selected', 'rejected', 'expired'] as const;
const LABELS: Record<string, string> = { all: '全部', submitted: '已提交', selected: '已选中', rejected: '未中选', expired: '已过期' };
const STATUS_LABELS: Record<string, string> = {
  submitted: '已提交',
  selected: '报价已选中',
  rejected: '未中选',
  expired: '已过期',
};

const listItemsOf = (response: unknown): V2OrderSummary[] => {
  const data = response as any;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
};

const quoteSortRank = (quote: DemandQuoteSummary) => {
  if (quote.status === 'selected') return 0;
  if (quote.status === 'submitted') return 1;
  if (quote.status === 'rejected') return 2;
  if (quote.status === 'expired') return 3;
  return 4;
};

const quoteTime = (quote: DemandQuoteSummary) => {
  const time = quote.created_at ? new Date(quote.created_at).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const selectedOrderHint = (order?: V2OrderSummary) => {
  const status = String(order?.status || '').toLowerCase();
  if (status === 'pending_payment') return '客户已选中你的报价，请关注合同签署和支付状态。';
  if (status === 'pending_dispatch') return '客户已完成支付，这单已进入待开始履约。';
  if (['assigned', 'preparing', 'in_transit', 'delivered'].includes(status)) return '这单已进入履约流程，请及时处理。';
  if (status === 'completed') return '这单已完成，可在订单详情查看结算进度。';
  return '客户已选中你的报价，请进入订单查看后续状态。';
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
  const [ordersByDemandId, setOrdersByDemandId] = useState<Record<number, V2OrderSummary>>({});
  const [activeGroup, setActiveGroup] = useState<string>('all');
  useDidShow(() => {
    if (!canViewQuotes) {
      setQuotes([]);
      setOrdersByDemandId({});
      return;
    }
    Promise.all([
      ownerService.listMyQuotes({ page: 1, page_size: 50 }).catch(() => null),
      orderV2Service.list({ role: 'provider', page: 1, page_size: 50 }).catch(() => null),
    ]).then(([quoteRes, orderRes]) => {
      const nextQuotes = ((quoteRes as any)?.items || []) as DemandQuoteSummary[];
      setQuotes(nextQuotes);
      const nextMap: Record<number, V2OrderSummary> = {};
      listItemsOf(orderRes).forEach((order) => {
        const demandId = Number(order.demand_id || 0);
        if (demandId > 0) nextMap[demandId] = order;
      });
      setOrdersByDemandId(nextMap);
    }).catch(() => {});
  });
  const filtered = useMemo(
    () => quotes
      .filter(q => activeGroup === 'all' || q.status === activeGroup)
      .sort((a, b) => {
        const rankDiff = quoteSortRank(a) - quoteSortRank(b);
        if (rankDiff !== 0) return rankDiff;
        return quoteTime(b) - quoteTime(a);
      }),
    [quotes, activeGroup],
  );

  const openQuoteTarget = (quote: DemandQuoteSummary) => {
    const selectedOrder = ordersByDemandId[Number(quote.demand_id || 0)];
    if (quote.status === 'selected') {
      if (selectedOrder?.id) {
        Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${selectedOrder.id}` });
        return;
      }
      Taro.navigateTo({ url: '/pages/orders/provider/index' });
      return;
    }
    if (quote.demand?.id) {
      Taro.navigateTo({ url: `/pages/demand/detail/index?id=${quote.demand.id}` });
    }
  };

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
        {filtered.length === 0 ? <View className="empty-state"><Text className="empty-state-text">还没有报价记录，可到接单需求里提交报价</Text></View> :
          filtered.map(q => {
            const selectedOrder = ordersByDemandId[Number(q.demand_id || 0)];
            const isSelected = q.status === 'selected';
            return (
            <View key={q.id} className={`list-item-card quote-card ${isSelected ? 'quote-card-selected' : ''}`} onClick={() => openQuoteTarget(q)}>
              <View className="list-item-card-header">
                <Text className="list-item-card-no">{q.quote_no}</Text>
                <Text className={`list-item-card-status status-quotes ${isSelected ? 'status-quotes-selected' : ''}`}>
                  {STATUS_LABELS[q.status] || '状态未知'}
                </Text>
              </View>
              <Text className="list-item-card-title" numberOfLines={2}>{q.demand?.title || `需求 #${q.demand_id}`}</Text>
              {isSelected ? (
                <View className="quote-selected-notice">
                  <Text className="quote-selected-notice-title">报价已被客户选中</Text>
                  <Text className="quote-selected-notice-desc">{selectedOrderHint(selectedOrder)}</Text>
                </View>
              ) : null}
              <View className="list-item-card-meta">
                <Text className="list-item-card-meta-text">{q.drone?.brand} {q.drone?.model}</Text>
                <Text className="list-item-card-price">¥{(q.price_amount || 0) / 100}</Text>
              </View>
              <View className="list-item-card-actions">
                <Text className={`list-item-card-action ${isSelected ? 'list-item-card-action-primary' : ''}`}>
                  {isSelected ? '查看订单' : '查看任务'}
                </Text>
              </View>
            </View>
            );
          })}
      </View>
    </ScrollView>
  );
}
