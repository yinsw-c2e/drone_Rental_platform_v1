import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { demandV2Service } from '../../../services/demandV2';
import { droneService } from '../../../services/drone';
import { RootState } from '../../../store/store';
import { Drone, DemandDetail } from '../../../types';
import { getDemandSceneLabel } from '../../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const formatAddressText = (snap?: { text?: string; district?: string; city?: string } | null): string => {
  if (!snap) return '';
  return snap.text || [snap.city, snap.district].filter(Boolean).join('') || '';
};

const formatScheduledAt = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
};

export default function DemandQuotePage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canQuote = Boolean(
    isAuthenticated && providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply,
  );
  const params = Taro.getCurrentInstance().router?.params || {};
  const demandId = Number(params.id || params.demandId || 0);
  const demandTitle = params.demandTitle ? decodeURIComponent(String(params.demandTitle)) : '需求';
  const initialPriceYuan = Number(params.priceYuan || 0);
  const isQuickQuote = params.quick === '1';

  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDroneId, setSelectedDroneId] = useState<number>(0);
  const [priceText, setPriceText] = useState(initialPriceYuan > 0 ? String(initialPriceYuan) : '');
  const [executionPlan, setExecutionPlan] = useState(
    isQuickQuote ? '根据需求时间、重量和现场条件安排可用无人机执行，作业前完成安全复核。' : '',
  );
  const [demandDetail, setDemandDetail] = useState<DemandDetail | null>(null);

  useDidShow(() => {
    if (!canQuote) {
      setDrones([]);
      setLoading(false);
      return;
    }
    droneService.myDrones({ page: 1, page_size: 50 }).then((res: any) => {
      const allDrones = res.data?.list || res.list || [];
      const list = allDrones.filter(
        (d: any) => d.certification_status === 'approved' && d.availability_status === 'available'
      );
      setDrones(list);
      if (list.length > 0) setSelectedDroneId(list[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));

    if (demandId > 0) {
      demandV2Service.getById(demandId)
        .then((detail: any) => {
          const data = (detail?.data ?? detail) as DemandDetail;
          if (data && typeof data === 'object') setDemandDetail(data);
        })
        .catch(() => {});
    }
  });

  const demandPickup = formatAddressText(demandDetail?.departure_address as any);
  const demandDropoff = formatAddressText(demandDetail?.destination_address as any);
  const demandWeight = demandDetail?.cargo_weight_kg ? `${demandDetail.cargo_weight_kg} kg` : '';
  const demandScheduled = formatScheduledAt(demandDetail?.scheduled_start_at);
  const demandScene = demandDetail?.cargo_scene ? getDemandSceneLabel(demandDetail.cargo_scene) : '';
  const demandDescription = (demandDetail?.description || '').trim();
  const demandSpecial = (demandDetail?.cargo_special_requirements || '').trim();

  const handleSubmit = async () => {
    if (!canQuote) return Taro.showToast({ title: '接单资质通过后才能报价', icon: 'none' });
    if (!demandId) return Taro.showToast({ title: '需求无效', icon: 'none' });
    if (!selectedDroneId) return Taro.showToast({ title: '请选择无人机', icon: 'none' });
    const amountYuan = Number(priceText);
    if (!Number.isFinite(amountYuan) || amountYuan <= 0) return Taro.showToast({ title: '请输入有效报价', icon: 'none' });

    setSubmitting(true);
    try {
      await demandV2Service.createQuote(demandId, {
        drone_id: selectedDroneId,
        price_amount: Math.round(amountYuan * 100),
        execution_plan: executionPlan.trim(),
      });
      Taro.showToast({ title: '报价提交成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '提交失败'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View className="page-wrap"><Text style={{ padding: '20px', textAlign: 'center' }}>加载中...</Text></View>;

  if (!canQuote) {
    return (
      <ProviderAccessNotice
        title={isAuthenticated ? '接单资质未开通' : '请先登录服务商账号'}
        description={isAuthenticated ? '设备资质和履约资质全部通过后，才能给客户需求提交正式报价。' : '登录后才能提交服务商报价。'}
        actionText={isAuthenticated ? '查看服务商入驻' : undefined}
        onAction={isAuthenticated ? () => Taro.navigateTo({ url: '/pages/provider/onboarding/index' }) : undefined}
      />
    );
  }

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="hero">
        <Text className="hero-title">{demandTitle}</Text>
        <Text className="hero-desc">
          {isQuickQuote
            ? '已按平台推荐价预填，确认机型后一键提交即可。'
            : '提交方案后，客户会对比所有报价并挑一家。被选中后才会正式建单。'}
        </Text>
      </View>

      <View className="form-card demand-card">
        <Text className="section-title">客户需求</Text>
        {demandDetail ? (
          <View className="demand-info">
            {(demandPickup || demandDropoff) ? (
              <View className="demand-row">
                <Text className="demand-label">路线</Text>
                <Text className="demand-value">
                  {(demandPickup || '起吊点')} → {(demandDropoff || '落放点')}
                </Text>
              </View>
            ) : null}
            {demandWeight ? (
              <View className="demand-row">
                <Text className="demand-label">货物重量</Text>
                <Text className="demand-value">{demandWeight}</Text>
              </View>
            ) : null}
            {demandScheduled ? (
              <View className="demand-row">
                <Text className="demand-label">作业时间</Text>
                <Text className="demand-value">{demandScheduled}</Text>
              </View>
            ) : null}
            {demandScene ? (
              <View className="demand-row">
                <Text className="demand-label">场景类型</Text>
                <Text className="demand-value">{demandScene}</Text>
              </View>
            ) : null}
            <View className="demand-row demand-row-block">
              <Text className="demand-label">作业说明</Text>
              <Text className={`demand-value demand-desc ${demandDescription ? '' : 'is-empty'}`}>
                {demandDescription || '客户未补充说明'}
              </Text>
            </View>
            {demandSpecial ? (
              <View className="demand-row demand-row-block">
                <Text className="demand-label">特殊要求</Text>
                <Text className="demand-value demand-desc">{demandSpecial}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text className="demand-loading">需求详情加载中…</Text>
        )}
      </View>

      <View className="form-card">
        <Text className="section-title">选择执行无人机</Text>
        {drones.length === 0 ? (
          <View className="empty-box"><Text className="empty-text">没有符合条件的无人机（需资质审核通过且可用）</Text></View>
        ) : (
          <ScrollView scrollX className="drone-list-h">
            <View className="drone-row-h">
              {drones.map(drone => (
                <View key={drone.id} className={`drone-item-h ${drone.id === selectedDroneId ? 'active' : ''}`} onClick={() => setSelectedDroneId(drone.id)}>
                  <Text className={`drone-name-h ${drone.id === selectedDroneId ? 'active-text' : ''}`}>{drone.brand} {drone.model}</Text>
                  <Text className="drone-desc-h">载重 {drone.max_load || drone.max_payload_kg || 0}kg</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View className="form-card">
        <Text className="section-title">方案报价</Text>
        <View className="input-row">
          <Text className="input-prefix">¥</Text>
          <Input className="price-input" type="digit" placeholder="0.00" value={priceText} onInput={e => setPriceText(e.detail.value)} />
        </View>
      </View>

      <View className="form-card">
        <Text className="section-title">执行方案描述 (选填)</Text>
        <Input className="textarea-input" style={{ width: '100%', height: '100px' }} placeholder="简单描述您的服务优势或执行计划..." value={executionPlan} onInput={e => setExecutionPlan(e.detail.value)} />
      </View>

      <View style={{ padding: '20px 16px' }}>
        <View className={`btn-primary ${submitting ? 'disabled' : ''}`} onClick={handleSubmit}>
          <Text className="btn-text">提交报价</Text>
        </View>
      </View>
    </ScrollView>
  );
}
