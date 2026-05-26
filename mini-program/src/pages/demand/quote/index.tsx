import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { demandV2Service } from '../../../services/demandV2';
import { droneService } from '../../../services/drone';
import { RootState } from '../../../store/store';
import { Drone } from '../../../types';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import './index.scss';

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
  });

  const handleSubmit = async () => {
    if (!canQuote) return Taro.showToast({ title: '服务商设备能力审核通过后才能报价', icon: 'none' });
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
      Taro.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View className="page-wrap"><Text style={{ padding: '20px', textAlign: 'center' }}>加载中...</Text></View>;

  if (!canQuote) {
    return (
      <ProviderAccessNotice
        title={isAuthenticated ? '服务商报价能力未开通' : '请先登录服务商账号'}
        description={isAuthenticated ? '设备与关键资质审核通过后，才能给客户需求提交正式报价。' : '登录后才能提交服务商报价。'}
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
            ? '已按平台预算预填报价，确认无人机并提交后才会生成真实报价。'
            : '服务商报价只针对需求撮合，不会在这里混入订单信息。客户选定您的方案后，才会进入订单履约环节。'}
        </Text>
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
