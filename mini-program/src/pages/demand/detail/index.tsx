import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { demandV2Service } from '../../../services/demandV2';
import { DemandDetail, DemandQuoteSummary } from '../../../types';
import { CARGO_TYPES } from '../../../constants';
import { getDemandSceneLabel, getObjectStatusMeta } from '../../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import './index.scss';

export default function DemandDetailPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary));
  const params = Taro.getCurrentInstance().router?.params || {};
  const demandId = Number(params.id || params.demandId || 0);

  const [demand, setDemand] = useState<DemandDetail | null>(null);
  const [quotes, setQuotes] = useState<DemandQuoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!demandId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await demandV2Service.getById(demandId);
      const detail = res as any;
      setDemand(detail);
      if (Number(detail?.client_user_id || 0) === Number(user?.id || 0)) {
        const quoteRes: any = await demandV2Service.listQuotes(demandId).catch(() => null);
        setQuotes(quoteRes?.data?.items || quoteRes?.items || []);
      } else {
        setQuotes([]);
      }
    } catch {
      setDemand(null);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [demandId, user?.id]);

  useDidShow(() => { loadData(); });

  const isOwnDemand = demand?.client_user_id === user?.id;
  const canEdit = isOwnDemand && ['draft', 'published', 'quoting'].includes(demand?.status || '');
  const canQuote = !isOwnDemand && providerCapabilities.canPublishSupply;
  const canCandidate = !isOwnDemand && roleSummary?.has_pilot_role && demand?.allows_pilot_candidate;
  const hasOwnQuote = Boolean((demand as any)?.my_quote);

  const handleCancel = async () => {
    const res = await Taro.showModal({ title: '确认撤销', content: '撤销后不可恢复' });
    if (!res.confirm) return;
    setSubmitting(true);
    try { await demandV2Service.cancel(demandId); Taro.showToast({ title: '已撤销' }); loadData(); }
    catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const handleCandidateToggle = async () => {
    setSubmitting(true);
    try {
      if ((demand as any)?.my_candidate?.status === 'active') {
        await demandV2Service.withdrawCandidate(demandId);
      } else {
        await demandV2Service.applyCandidate(demandId);
      }
      loadData();
    } catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const handleSelectQuote = async (quote: DemandQuoteSummary) => {
    const res = await Taro.showModal({
      title: '选择报价',
      content: `确认选择该服务商报价 ¥${((quote.price_amount || 0) / 100).toFixed(2)} 并生成订单？`,
      confirmText: '生成订单',
    });
    if (!res.confirm) return;
    setSubmitting(true);
    try {
      const result = await demandV2Service.selectProvider(demandId, quote.id);
      Taro.showToast({ title: '订单已生成', icon: 'success' });
      const orderId = Number((result as any)?.order_id || 0);
      setTimeout(() => {
        if (orderId) Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
        else loadData();
      }, 800);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '选择失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View className="page-wrap"><Text className="empty-text">加载中...</Text></View>;
  if (!demand) return <View className="page-wrap"><Text className="empty-text">任务不存在</Text></View>;

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="hero">
        <View className="hero-top">
          <Text className="demand-no">{demand.demand_no}</Text>
          <View className="status-badge"><Text className="status-text">{getObjectStatusMeta('demand', demand.status).label}</Text></View>
        </View>
        <Text className="hero-title">{demand.title}</Text>
        <Text className="hero-budget">预算: ¥{((demand.budget_min || 0) / 100).toFixed(2)} - ¥{((demand.budget_max || 0) / 100).toFixed(2)}</Text>
      </View>

      <View className="info-card">
        <Text className="section-title">操作</Text>
        <View className="action-row">
          {canEdit && demand.status === 'draft' && (
            <View className="btn btn-primary" onClick={() => demandV2Service.publish(demandId).then(() => { loadData(); })}><Text className="btn-text">发布任务</Text></View>
          )}
          {canEdit && (
            <View className="btn btn-outline" onClick={handleCancel}><Text className="btn-text-outline">撤销</Text></View>
          )}
          {canQuote && (
            <View className="btn btn-primary" onClick={() => Taro.navigateTo({ url: `/pages/demand/quote/index?demandId=${demandId}&demandTitle=${encodeURIComponent(demand.title)}` })}><Text className="btn-text">{hasOwnQuote ? '更新报价' : '提交报价'}</Text></View>
          )}
          {canCandidate && (
            <View className={`btn ${(demand as any)?.my_candidate?.status === 'active' ? 'btn-outline' : 'btn-warning'}`} onClick={handleCandidateToggle}>
              <Text className={`btn-text ${(demand as any)?.my_candidate?.status === 'active' ? 'btn-text-outline' : ''}`}>{(demand as any)?.my_candidate?.status === 'active' ? '撤回报名' : '报名承接'}</Text>
            </View>
          )}
        </View>
      </View>

      <View className="info-card">
        <Text className="section-title">任务概况</Text>
        <View className="info-row"><Text className="info-label">场景</Text><Text className="info-value">{getDemandSceneLabel(demand.cargo_scene)}</Text></View>
        <View className="info-row"><Text className="info-label">预估重量</Text><Text className="info-value">{demand.cargo_weight_kg || 0} kg</Text></View>
        <View className="info-row"><Text className="info-label">货物类型</Text><Text className="info-value">{CARGO_TYPES[String(demand.cargo_type || '')] || demand.cargo_type || '-'}</Text></View>
        <View className="info-row border-none"><Text className="info-label">地址</Text><Text className="info-value">{(demand as any).departure_address?.text || (demand as any).service_address_text || '-'}</Text></View>
      </View>

      <View className="info-card">
        <View className="stats-row">
          <View className="stat-box">
            <Text className="stat-num">{demand.quote_count || 0}</Text>
            <Text className="stat-label">已收报价</Text>
          </View>
          <View className="stat-box">
            <Text className="stat-num stat-orange">{demand.candidate_pilot_count || 0}</Text>
            <Text className="stat-label">已报名服务商</Text>
          </View>
        </View>
      </View>

      {isOwnDemand ? (
        <View className="info-card">
          <Text className="section-title">服务商报价</Text>
          {quotes.length === 0 ? (
            <View className="quote-empty">
              <Text className="quote-empty-text">暂无服务商提交报价</Text>
            </View>
          ) : (
            quotes.map((quote) => (
              <View key={quote.id} className="quote-card">
                <View className="quote-main">
                  <Text className="quote-title">{quote.owner?.nickname || quote.drone?.brand || `服务商 #${quote.owner_user_id}`}</Text>
                  <Text className="quote-desc">
                    {quote.drone ? `${quote.drone.brand} ${quote.drone.model}` : '无人机信息待补'}
                    {quote.execution_plan ? ` · ${quote.execution_plan}` : ''}
                  </Text>
                </View>
                <View className="quote-side">
                  <Text className="quote-price">¥{((quote.price_amount || 0) / 100).toFixed(2)}</Text>
                  {quote.status === 'submitted' ? (
                    <View className={`quote-select ${submitting ? 'disabled' : ''}`} onClick={() => handleSelectQuote(quote)}>
                      <Text className="quote-select-text">{submitting ? '处理中' : '选定'}</Text>
                    </View>
                  ) : (
                    <Text className="quote-status">{getObjectStatusMeta('quote', quote.status).label || quote.status}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
