import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { demandV2Service } from '../../../services/demandV2';
import { DemandDetail, DemandQuoteSummary } from '../../../types';
import { CARGO_TYPES } from '../../../constants';
import { getDemandSceneLabel, getObjectStatusMeta } from '../../../utils';
import './index.scss';

export default function DemandDetailPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const params = Taro.getCurrentInstance().router?.params || {};
  const demandId = Number(params.id || params.demandId || 0);

  const [demand, setDemand] = useState<DemandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!demandId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await demandV2Service.getById(demandId);
      setDemand(res as any);
    } catch {
      setDemand(null);
    } finally {
      setLoading(false);
    }
  }, [demandId]);

  useDidShow(() => { loadData(); });

  const isOwnDemand = demand?.client_user_id === user?.id;
  const canEdit = isOwnDemand && ['draft', 'published', 'quoting'].includes(demand?.status || '');
  const canQuote = !isOwnDemand && roleSummary?.has_owner_role;
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
              <Text className={`btn-text ${(demand as any)?.my_candidate?.status === 'active' ? 'btn-text-outline' : ''}`}>{(demand as any)?.my_candidate?.status === 'active' ? '取消候选' : '报名候选'}</Text>
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
            <Text className="stat-label">候选飞手</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
