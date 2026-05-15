// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';

import StatusBadge from '../../../components/business/StatusBadge';
import { droneService } from '../../../services/drone';
import { ownerService } from '../../../services/owner';
import { RootState } from '../../../store/store';
import { getEffectiveRoleSummary } from '../../../utils/roleSummary';
import './index.scss';

const formatAmount = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;

export default function OwnerProfilePage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [draft, setDraft] = useState({ service_city: '', contact_phone: '', intro: '' });
  const [stats, setStats] = useState({ drones: 0, activeSupplies: 0, quotes: 0, bindings: 0 });
  const [workbench, setWorkbench] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [
        profileRes,
        dronesRes,
        suppliesRes,
        quotesRes,
        bindingsRes,
        workbenchRes,
      ] = await Promise.all([
        ownerService.getProfile().catch(() => null),
        droneService.myDrones({ page: 1, page_size: 50 }).catch(() => null),
        ownerService.listMySupplies({ page: 1, page_size: 50 }).catch(() => null),
        ownerService.listMyQuotes({ page: 1, page_size: 50 }).catch(() => null),
        ownerService.listPilotBindings({ status: 'active', page: 1, page_size: 50 }).catch(() => null),
        ownerService.getWorkbench().catch(() => null),
      ]);

      setProfile(profileRes || null);
      setDraft({
        service_city: profileRes?.service_city || '',
        contact_phone: profileRes?.contact_phone || user?.phone || '',
        intro: profileRes?.intro || '',
      });

      const supplyItems = suppliesRes?.items || [];
      setWorkbench(workbenchRes || null);
      setStats({
        drones: Number(dronesRes?.list?.length || 0),
        activeSupplies: supplyItems.filter((item: any) => item.status === 'active').length,
        quotes: Number(quotesRes?.meta?.total || quotesRes?.total || 0),
        bindings: Number(bindingsRes?.meta?.total || bindingsRes?.total || 0),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.phone]);

  useDidShow(() => {
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const capabilityItems = useMemo(
    () => [
      {
        label: '可发布供给',
        enabled: effectiveRoleSummary.can_publish_supply,
        desc: effectiveRoleSummary.can_publish_supply
          ? '无人机与关键资质已满足主市场准入。'
          : '先完善无人机与关键资质，才能把供给上架到主市场。',
      },
      {
        label: '可自执行',
        enabled: effectiveRoleSummary.can_self_execute,
        desc: effectiveRoleSummary.can_self_execute
          ? '你已同时具备机主与飞手能力，可直接选择自执行。'
          : '如果要机主自执行，还需要同步具备飞手能力。',
      },
    ],
    [effectiveRoleSummary.can_publish_supply, effectiveRoleSummary.can_self_execute],
  );

  const workbenchPreviewItems = useMemo(
    () => [
      ...((workbench?.recommended_demands || []).slice(0, 2).map((item: any) => ({
        key: `demand-${item.id}`,
        eyebrow: '新需求',
        title: item.title || '待报价任务',
        desc: `${item.service_address_text || '待补地址'} · 预算 ${formatAmount(item.budget_min)}-${formatAmount(item.budget_max)}`,
        url: `/pages/demand/detail/index?id=${item.id}`,
      })) || []),
      ...((workbench?.pending_provider_confirmation_orders || []).slice(0, 1).map((item: any) => ({
        key: `confirm-${item.id}`,
        eyebrow: '待确认直达单',
        title: item.title || item.order_no,
        desc: `${item.service_address || '待补地址'} · 订单金额 ${formatAmount(item.total_amount)}`,
        url: `/pages/orders/detail/index?orderId=${item.id}`,
      })) || []),
      ...((workbench?.pending_dispatch_orders || []).slice(0, 1).map((item: any) => ({
        key: `dispatch-${item.id}`,
        eyebrow: '待安排执行',
        title: item.title || item.order_no,
        desc: `${item.service_address || '待补地址'} · 成交后待指派执行方`,
        url: `/pages/orders/detail/index?orderId=${item.id}`,
      })) || []),
    ],
    [workbench],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextProfile = await ownerService.updateProfile({
        service_city: draft.service_city.trim(),
        contact_phone: draft.contact_phone.trim(),
        intro: draft.intro.trim(),
      });
      setProfile(nextProfile);
      Taro.showToast({ title: '机主档案已更新', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '保存失败，请稍后重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className='owner-wrap'>
        <View className='owner-loading'>
          <Text className='owner-loading-text'>机主档案加载中...</Text>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className='owner-wrap'>
        <View className='owner-empty'>
          <Text className='owner-empty-title'>还没有机主档案</Text>
          <Text className='owner-empty-desc'>请先完善机主资料，后面这里才会出现服务和履约管理。</Text>
        </View>
      </View>
    );
  }

  return (
    <View className='owner-wrap'>
      <ScrollView
        scrollY
        className='owner-scroll'
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        <View className='owner-content'>
          <View className='owner-hero'>
            <View className='owner-hero-top'>
              <View>
                <Text className='owner-hero-title'>机主工作台</Text>
                <Text className='owner-hero-sub'>管理设备、服务与履约进度</Text>
              </View>
              <StatusBadge
                label={effectiveRoleSummary.can_publish_supply ? '主市场准入' : '供给待就绪'}
                tone={effectiveRoleSummary.can_publish_supply ? 'blue' : 'gray'}
              />
            </View>

            <View className='owner-stats-grid'>
              <View className='owner-stat-card'>
                <Text className='owner-stat-value'>{stats.drones}</Text>
                <Text className='owner-stat-label'>无人机资产</Text>
              </View>
              <View className='owner-stat-card'>
                <Text className='owner-stat-value'>{stats.activeSupplies}</Text>
                <Text className='owner-stat-label'>在线服务</Text>
              </View>
              <View className='owner-stat-card'>
                <Text className='owner-stat-value'>{stats.quotes}</Text>
                <Text className='owner-stat-label'>方案报价</Text>
              </View>
              <View className='owner-stat-card'>
                <Text className='owner-stat-value'>{stats.bindings}</Text>
                <Text className='owner-stat-label'>协作飞手</Text>
              </View>
            </View>
          </View>

          <View className='owner-section'>
            <View className='owner-section-header'>
              <Text className='owner-section-title'>经营待办</Text>
              <Text
                className='owner-section-link'
                onClick={() => Taro.navigateTo({ url: '/pages/profile/my-demands/index' })}
              >
                查看全部
              </Text>
            </View>

            <View className='owner-workbench-grid'>
              <View className='owner-workbench-card'>
                <Text className='owner-workbench-value'>
                  {workbench?.summary?.recommended_demand_count || 0}
                </Text>
                <Text className='owner-workbench-label'>新机会</Text>
              </View>
              <View className='owner-workbench-card'>
                <Text className='owner-workbench-value owner-workbench-value-warn'>
                  {workbench?.summary?.pending_provider_confirmation_order_count || 0}
                </Text>
                <Text className='owner-workbench-label'>待确认单</Text>
              </View>
              <View className='owner-workbench-card'>
                <Text className='owner-workbench-value owner-workbench-value-success'>
                  {workbench?.summary?.pending_dispatch_order_count || 0}
                </Text>
                <Text className='owner-workbench-label'>待派人</Text>
              </View>
              <View className='owner-workbench-card'>
                <Text className='owner-workbench-value'>
                  {workbench?.summary?.draft_supply_count || 0}
                </Text>
                <Text className='owner-workbench-label'>草稿服务</Text>
              </View>
            </View>

            {workbenchPreviewItems.length ? (
              <View className='owner-preview-list'>
                {workbenchPreviewItems.map((item) => (
                  <View
                    key={item.key}
                    className='owner-preview-item'
                    onClick={() => Taro.navigateTo({ url: item.url })}
                  >
                    <View className='owner-preview-main'>
                      <Text className='owner-preview-eyebrow'>{item.eyebrow}</Text>
                      <Text className='owner-preview-title'>{item.title}</Text>
                      <Text className='owner-preview-desc'>{item.desc}</Text>
                    </View>
                    <Text className='owner-preview-action'>查看 ›</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className='owner-empty-card'>
                <Text className='owner-empty-card-text'>暂无紧急经营事项</Text>
              </View>
            )}
          </View>

          <View className='owner-section'>
            <Text className='owner-section-title'>快捷管理</Text>
            <View className='owner-quick-grid'>
              <View
                className='owner-quick-card'
                onClick={() => Taro.navigateTo({ url: '/pages/profile/drones/index' })}
              >
                <Text className='owner-quick-icon'>🚁</Text>
                <Text className='owner-quick-title'>我的无人机</Text>
              </View>
              <View
                className='owner-quick-card'
                onClick={() => Taro.navigateTo({ url: '/pages/profile/my-offers/index' })}
              >
                <Text className='owner-quick-icon'>📦</Text>
                <Text className='owner-quick-title'>我的服务</Text>
              </View>
              <View
                className='owner-quick-card'
                onClick={() => Taro.navigateTo({ url: '/pages/profile/my-quotes/index' })}
              >
                <Text className='owner-quick-icon'>💬</Text>
                <Text className='owner-quick-title'>我的报价</Text>
              </View>
              <View
                className='owner-quick-card'
                onClick={() => Taro.navigateTo({ url: '/pages/owner/bind-pilot/index' })}
              >
                <Text className='owner-quick-icon'>🤝</Text>
                <Text className='owner-quick-title'>绑定飞手</Text>
              </View>
            </View>
          </View>

          <View className='owner-section'>
            <Text className='owner-section-title'>能力状态</Text>
            {capabilityItems.map((item, index) => (
              <View
                key={item.label}
                className={`owner-capability-row ${
                  index === capabilityItems.length - 1 ? 'owner-capability-row-last' : ''
                }`}
              >
                <View className='owner-capability-main'>
                  <Text className='owner-capability-label'>{item.label}</Text>
                  <Text className='owner-capability-desc'>{item.desc}</Text>
                </View>
                <StatusBadge label={item.enabled ? '已就绪' : '待补齐'} tone={item.enabled ? 'green' : 'gray'} />
              </View>
            ))}
          </View>

          <View className='owner-section'>
            <Text className='owner-section-title'>档案设置</Text>

            <Text className='owner-label'>服务城市</Text>
            <Input
              className='owner-input'
              placeholder='例如：佛山'
              value={draft.service_city}
              onInput={(e) => setDraft((prev) => ({ ...prev, service_city: e.detail.value }))}
            />

            <Text className='owner-label'>联系电话</Text>
            <Input
              className='owner-input'
              type='number'
              placeholder='用于对外联系'
              value={draft.contact_phone}
              onInput={(e) => setDraft((prev) => ({ ...prev, contact_phone: e.detail.value }))}
            />

            <Text className='owner-label'>经营简介</Text>
            <Input
              className='owner-input'
              placeholder='介绍常服务的场景与能力'
              value={draft.intro}
              onInput={(e) => setDraft((prev) => ({ ...prev, intro: e.detail.value }))}
            />
          </View>

          <View
            className={`owner-save-btn ${saving ? 'owner-save-disabled' : ''}`}
            onClick={handleSave}
          >
            <Text className='owner-save-text'>{saving ? '保存中...' : '保存机主档案'}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
