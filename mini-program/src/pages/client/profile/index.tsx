// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';

import StatusBadge from '../../../components/business/StatusBadge';
import {
  getClientEligibility,
  getClientProfile,
  registerIndividual,
  requestCreditCheck,
  updateClientProfile,
} from '../../../services/client';
import { RootState } from '../../../store/store';
import './index.scss';

const sceneOptions = ['电网建设', '山区运输', '海岛给养', '应急救援', '高原补给'];

const VERIFY_STATUS_MAP = {
  approved: { label: '已认证', tone: 'green' },
  verified: { label: '已认证', tone: 'green' },
  pending: { label: '审核中', tone: 'orange' },
  rejected: { label: '未通过', tone: 'red' },
  unverified: { label: '未认证', tone: 'gray' },
};

const CREDIT_STATUS_MAP = {
  approved: { label: '已通过', tone: 'green' },
  verified: { label: '已通过', tone: 'green' },
  pending: { label: '审核中', tone: 'orange' },
  rejected: { label: '未通过', tone: 'red' },
  failed: { label: '未通过', tone: 'red' },
  unverified: { label: '未查询', tone: 'gray' },
};

const ACCOUNT_QUALIFICATION_HELP =
  '客户能力主要看实名认证、账号状态和平台信用。企业升级只在需要企业主体资料时再补。';

const emptyDraft = {
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  default_pickup_address: '',
  default_delivery_address: '',
  preferred_cargo_types: [],
};

export default function ClientProfilePage() {
  const user = useSelector((state: RootState) => state.auth.user);

  const [client, setClient] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const syncDraft = useCallback(
    (profile: any) => {
      setDraft({
        contact_person: profile.contact_person || '',
        contact_phone: profile.contact_phone || user?.phone || '',
        contact_email: profile.contact_email || '',
        default_pickup_address: profile.default_pickup_address || '',
        default_delivery_address: profile.default_delivery_address || '',
        preferred_cargo_types: profile.preferred_cargo_types || [],
      });
    },
    [user?.phone],
  );

  const loadData = useCallback(async () => {
    try {
      let profile: any;
      try {
        profile = await getClientProfile();
      } catch {
        await registerIndividual();
        profile = await getClientProfile();
      }

      setClient(profile);
      syncDraft(profile);

      try {
        const eligibilityRes = await getClientEligibility();
        setEligibility(eligibilityRes);
      } catch {
        setEligibility(profile?.eligibility || null);
      }
    } catch {
      setClient(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [syncDraft]);

  useDidShow(() => {
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const verificationStatus =
    VERIFY_STATUS_MAP[
      client?.identity_verification_status || client?.verification_status || 'unverified'
    ] || VERIFY_STATUS_MAP.unverified;
  const creditStatus =
    CREDIT_STATUS_MAP[client?.credit_check_status || 'unverified'] || CREDIT_STATUS_MAP.unverified;

  const summaryItems = useMemo(
    () => [
      { label: '需求', value: client?.demand_count ?? 0 },
      { label: '完成订单', value: client?.completed_orders || 0 },
      {
        label: '总消费',
        value: client?.total_spending ? `¥${(client.total_spending / 100).toFixed(0)}` : '0',
      },
      { label: '评分', value: client?.average_rating?.toFixed(1) || '5.0' },
    ],
    [client],
  );

  const toggleScene = (scene: string) => {
    setDraft((prev) => ({
      ...prev,
      preferred_cargo_types: prev.preferred_cargo_types.includes(scene)
        ? prev.preferred_cargo_types.filter((item) => item !== scene)
        : [...prev.preferred_cargo_types, scene],
    }));
  };

  const handleSave = async () => {
    if (!draft.contact_person.trim()) {
      Taro.showToast({ title: '请先填写联系人', icon: 'none' });
      return;
    }
    if (!draft.contact_phone.trim()) {
      Taro.showToast({ title: '请先填写联系电话', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const nextProfile = await updateClientProfile({
        contact_person: draft.contact_person.trim(),
        contact_phone: draft.contact_phone.trim(),
        contact_email: draft.contact_email.trim() || undefined,
        default_pickup_address: draft.default_pickup_address.trim() || undefined,
        default_delivery_address: draft.default_delivery_address.trim() || undefined,
        preferred_cargo_types: draft.preferred_cargo_types,
      });
      setClient(nextProfile);
      syncDraft(nextProfile);
      Taro.showToast({ title: '客户档案已更新', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '保存失败，请稍后重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreditCheck = () => {
    Taro.showModal({
      title: '发起征信查询',
      content: '征信结果会影响部分订单的支付与下单资格，确定继续吗？',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await requestCreditCheck();
          Taro.showToast({ title: '已提交征信查询', icon: 'success' });
          loadData();
        } catch (error: any) {
          Taro.showToast({ title: error?.message || '提交失败', icon: 'none' });
        }
      },
    });
  };

  const showAccountHelp = () => {
    Taro.showModal({
      title: '账号与资格',
      content: ACCOUNT_QUALIFICATION_HELP,
      showCancel: false,
    });
  };

  if (loading) {
    return (
      <View className='cp-wrap'>
        <View className='cp-loading'>
          <Text className='cp-loading-text'>客户档案加载中...</Text>
        </View>
      </View>
    );
  }

  if (!client) {
    return (
      <View className='cp-wrap'>
        <View className='cp-empty'>
          <Text className='cp-empty-title'>客户档案暂时不可用</Text>
          <Text className='cp-empty-desc'>请下拉刷新，重新初始化客户档案。</Text>
          <View className='cp-empty-btn' onClick={loadData}>
            <Text className='cp-empty-btn-text'>重试初始化</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className='cp-wrap'>
      <ScrollView
        scrollY
        className='cp-scroll'
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        <View className='cp-content'>
          <View className='cp-hero'>
            <View className='cp-hero-top'>
              <View>
                <Text className='cp-hero-title'>客户档案</Text>
                <Text className='cp-hero-sub'>
                  {draft.contact_phone || user?.phone || '-'} ·{' '}
                  {client?.client_type === 'enterprise' ? '企业客户' : '个人客户'}
                </Text>
              </View>
              <View onClick={showAccountHelp}>
                <StatusBadge label='资格说明' tone='blue' />
              </View>
            </View>

            <View className='cp-summary-grid'>
              {summaryItems.map((item) => (
                <View key={item.label} className='cp-summary-card'>
                  <Text className='cp-summary-value'>{item.value}</Text>
                  <Text className='cp-summary-label'>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='cp-section'>
            <View className='cp-section-header'>
              <Text className='cp-section-title'>账号与资格</Text>
              <StatusBadge label={verificationStatus.label} tone={verificationStatus.tone} />
            </View>

            <View className='cp-capability-row'>
              <Text className='cp-capability-label'>发布需求资格</Text>
              <StatusBadge
                label={eligibility?.can_publish_demand ? '已就绪' : '待补齐'}
                tone={eligibility?.can_publish_demand ? 'green' : 'orange'}
              />
            </View>
            <View className='cp-capability-row'>
              <Text className='cp-capability-label'>直达下单资格</Text>
              <StatusBadge
                label={eligibility?.can_create_direct_order ? '已就绪' : '待补齐'}
                tone={eligibility?.can_create_direct_order ? 'green' : 'orange'}
              />
            </View>
            <View className='cp-capability-row cp-capability-row-last'>
              <Text className='cp-capability-label'>平台信用</Text>
              <StatusBadge label={creditStatus.label} tone={creditStatus.tone} />
            </View>

            {eligibility?.blockers?.length ? (
              <View className='cp-blocker-box'>
                <Text className='cp-blocker-title'>当前还需处理：</Text>
                <Text className='cp-blocker-item'>
                  • {eligibility.blockers[0].message}
                </Text>
              </View>
            ) : null}

            <View className='cp-secondary-btn' onClick={handleCreditCheck}>
              <Text className='cp-secondary-btn-text'>发起征信查询</Text>
            </View>
          </View>

          <View className='cp-section'>
            <Text className='cp-section-title'>联系人与常用地址</Text>

            <Text className='cp-label'>联系人</Text>
            <Input
              className='cp-input'
              placeholder='填写联系人姓名'
              value={draft.contact_person}
              onInput={(e) =>
                setDraft((prev) => ({ ...prev, contact_person: e.detail.value }))
              }
            />

            <Text className='cp-label'>联系电话</Text>
            <Input
              className='cp-input'
              type='number'
              placeholder='填写联系电话'
              value={draft.contact_phone}
              onInput={(e) =>
                setDraft((prev) => ({ ...prev, contact_phone: e.detail.value }))
              }
            />

            <Text className='cp-label'>联系邮箱</Text>
            <Input
              className='cp-input'
              placeholder='选填'
              value={draft.contact_email}
              onInput={(e) =>
                setDraft((prev) => ({ ...prev, contact_email: e.detail.value }))
              }
            />

            <Text className='cp-label'>默认取货地址</Text>
            <Input
              className='cp-input'
              placeholder='填写常用起点'
              value={draft.default_pickup_address}
              onInput={(e) =>
                setDraft((prev) => ({ ...prev, default_pickup_address: e.detail.value }))
              }
            />

            <Text className='cp-label'>默认送达地址</Text>
            <Input
              className='cp-input'
              placeholder='填写常用终点'
              value={draft.default_delivery_address}
              onInput={(e) =>
                setDraft((prev) => ({ ...prev, default_delivery_address: e.detail.value }))
              }
            />
          </View>

          <View className='cp-section'>
            <Text className='cp-section-title'>常用任务场景</Text>
            <View className='cp-scene-row'>
              {sceneOptions.map((scene) => {
                const active = draft.preferred_cargo_types.includes(scene);
                return (
                  <View
                    key={scene}
                    className={`cp-scene-chip ${active ? 'cp-scene-chip-active' : ''}`}
                    onClick={() => toggleScene(scene)}
                  >
                    <Text
                      className={`cp-scene-text ${active ? 'cp-scene-text-active' : ''}`}
                    >
                      {scene}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            className={`cp-save-btn ${saving ? 'cp-save-disabled' : ''}`}
            onClick={handleSave}
          >
            <Text className='cp-save-text'>{saving ? '保存中...' : '保存客户档案'}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
