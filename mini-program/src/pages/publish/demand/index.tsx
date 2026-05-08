import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components';
import { getClientEligibility } from '../../../services/client';
import { demandV2Service } from '../../../services/demandV2';
import { AddressData } from '../../../types';
import './index.scss';

const SCENE_OPTIONS = [
  { key: 'power_grid', label: '电网建设' },
  { key: 'mountain_agriculture', label: '山区农副产品' },
  { key: 'plateau_supply', label: '高原给养' },
  { key: 'island_supply', label: '海岛补给' },
  { key: 'emergency', label: '应急救援' },
];

function buildDefaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function buildDefaultEnd(start: Date) {
  const d = new Date(start);
  d.setHours(17, 0, 0, 0);
  return d;
}

function formatDateTime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${mi}`;
}

function parseDateInput(value: string) {
  const d = new Date(value.trim().replace(/-/g, '/'));
  return Number.isNaN(d.getTime()) ? null : d;
}

const formatAddress = (addr?: AddressData | null) =>
  addr?.address || addr?.name || '';

const toAddressSnapshot = (addr?: AddressData | null) =>
  addr
    ? {
        text: formatAddress(addr),
        province: addr.province,
        city: addr.city,
        district: addr.district,
        latitude: addr.latitude,
        longitude: addr.longitude,
      }
    : undefined;

export default function PublishDemandPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [cargoScene, setCargoScene] = useState(SCENE_OPTIONS[0].key);
  const [serviceAddress, setServiceAddress] = useState<AddressData | null>(null);
  const [cargoWeight, setCargoWeight] = useState('');

  const [tripCount, setTripCount] = useState('1');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [description, setDescription] = useState('');

  const defaultStart = useMemo(() => buildDefaultStart(), []);
  const defaultEnd = useMemo(() => buildDefaultEnd(defaultStart), [defaultStart]);
  const [startTime, setStartTime] = useState(() => formatDateTime(defaultStart));
  const [endTime, setEndTime] = useState(() => formatDateTime(defaultEnd));

  const chooseServiceAddress = async () => {
    try {
      const res = await Taro.chooseLocation({});
      if (res && (res.name || res.address)) {
        setServiceAddress({
          name: res.name || res.address,
          address: res.address || res.name,
          latitude: res.latitude,
          longitude: res.longitude,
        });
      }
    } catch {
      // 用户取消选点时不打扰。
    }
  };

  const getPayload = () => ({
    title: title.trim(),
    service_type: 'heavy_cargo_lift_transport' as const,
    cargo_scene: cargoScene,
    description: description.trim() || undefined,
    service_address: toAddressSnapshot(serviceAddress),
    cargo_weight_kg: Number(cargoWeight),
    estimated_trip_count: Math.max(Number(tripCount) || 1, 1),
    budget_min: budgetMin ? Math.round(Number(budgetMin) * 100) : undefined,
    budget_max: budgetMax ? Math.round(Number(budgetMax) * 100) : undefined,
    allows_pilot_candidate: true,
    scheduled_start_at: parseDateInput(startTime)?.toISOString(),
    scheduled_end_at: parseDateInput(endTime)?.toISOString(),
  });

  const validateBaseInfo = () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入需求标题', icon: 'none' });
      return false;
    }
    if (!serviceAddress) {
      Taro.showToast({ title: '请选择服务地址', icon: 'none' });
      return false;
    }
    if (!(Number(cargoWeight) > 0)) {
      Taro.showToast({ title: '请填写有效的货物重量', icon: 'none' });
      return false;
    }
    return true;
  };

  const validateSchedule = () => {
    const start = parseDateInput(startTime);
    const end = parseDateInput(endTime);
    if (!start || !end) {
      Taro.showToast({ title: '请填写正确的作业时间', icon: 'none' });
      return false;
    }
    if (start <= new Date()) {
      Taro.showToast({ title: '开始时间需要晚于当前时间', icon: 'none' });
      return false;
    }
    if (end <= start) {
      Taro.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateBaseInfo()) return;
    setStep(2);
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '至少填写标题才能保存草稿', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await demandV2Service.create(getPayload());
      Taro.showToast({ title: '草稿已保存', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const checkEligibility = async () => {
    try {
      const eligibility = await getClientEligibility();
      if (eligibility.can_publish_demand) return true;

      const blocker = eligibility.blockers?.[0];
      if (blocker?.suggested_action === 'verify_identity') {
        const res = await Taro.showModal({
          title: '请先完成实名认证',
          content: blocker.message || '完成实名认证后即可发布需求。',
          confirmText: '去认证',
        });
        if (res.confirm) Taro.navigateTo({ url: '/pages/verification/index' });
      } else {
        Taro.showToast({ title: blocker?.message || '当前暂不可发布', icon: 'none' });
      }
      return false;
    } catch (e: any) {
      Taro.showToast({ title: e.message || '资格检查失败', icon: 'none' });
      return false;
    }
  };

  const handlePublish = async () => {
    if (!validateBaseInfo() || !validateSchedule()) return;

    setSubmitting(true);
    try {
      const eligible = await checkEligibility();
      if (!eligible) return;

      const created = await demandV2Service.create(getPayload());
      const demandId = (created as any).id || (created as any).data?.id;
      await demandV2Service.publish(demandId);
      Taro.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) {
      Taro.showToast({ title: e.message || '发布失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="publish-wrap">
      <View className="publish-steps">
        <View className="publish-step-track">
          <View className="publish-step-dot publish-step-dot-active" />
          <View className={`publish-step-line ${step >= 2 ? 'publish-step-line-active' : ''}`} />
          <View className={`publish-step-dot ${step >= 2 ? 'publish-step-dot-active' : ''}`} />
        </View>
        <View className="publish-step-labels">
          <Text className="publish-step-label publish-step-label-active">基础信息</Text>
          <Text className={`publish-step-label ${step >= 2 ? 'publish-step-label-active' : ''}`}>运输细节</Text>
        </View>
      </View>

      <ScrollView scrollY className="publish-scroll">
        {step === 1 ? (
          <View className="publish-card">
            <Text className="section-title">第 1/2 步：基础信息</Text>

            <Text className="publish-label">需求标题 *</Text>
            <Input className="publish-input" placeholder="例如：山区电网建设塔材吊运" value={title} onInput={e => setTitle(e.detail.value)} />

            <Text className="publish-label">作业场景 *</Text>
            <View className="publish-option-row">
              {SCENE_OPTIONS.map(opt => (
                <View
                  key={opt.key}
                  className={`publish-option-btn ${cargoScene === opt.key ? 'publish-option-active' : ''}`}
                  onClick={() => setCargoScene(opt.key)}
                >
                  <Text className={`publish-option-text ${cargoScene === opt.key ? 'publish-option-text-active' : ''}`}>{opt.label}</Text>
                </View>
              ))}
            </View>

            <Text className="publish-label">服务地址 *</Text>
            <View className="publish-address-field" onClick={chooseServiceAddress}>
              <Text className={`publish-address-text ${serviceAddress ? '' : 'publish-placeholder'}`}>
                {formatAddress(serviceAddress) || '点击选择主要作业地址'}
              </Text>
              <Text className="publish-address-arrow">›</Text>
            </View>

            <Text className="publish-label">货物重量 (kg) *</Text>
            <Input className="publish-input" type="digit" placeholder="例如：80" value={cargoWeight} onInput={e => setCargoWeight(e.detail.value)} />

            <View className="publish-tip-card">
              <Text className="publish-tip-title">草稿提示</Text>
              <Text className="publish-tip-text">可以先保存草稿，之后在“我的需求”里继续补充和发布。</Text>
            </View>

            <View className="publish-actions">
              <View className={`publish-btn-secondary ${submitting ? 'publish-btn-disabled' : ''}`} onClick={handleSaveDraft}>
                <Text className="publish-btn-secondary-text">保存草稿</Text>
              </View>
              <View className="publish-btn-primary" onClick={handleNextStep}>
                <Text className="publish-btn-primary-text">下一步</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="publish-card">
            <Text className="section-title">第 2/2 步：运输细节与说明</Text>

            <Text className="publish-label">预计架次</Text>
            <Input className="publish-input" type="digit" placeholder="默认 1 架次" value={tripCount} onInput={e => setTripCount(e.detail.value)} />

            <Text className="publish-label">预约开始时间 *</Text>
            <Text className="publish-time-hint">请按“年-月-日 时:分”填写，例如：{formatDateTime(defaultStart)}</Text>
            <Input className="publish-input" placeholder="请选择期望开始时间" value={startTime} onInput={e => setStartTime(e.detail.value)} />

            <Text className="publish-label">预约结束时间 *</Text>
            <Input className="publish-input" placeholder="请选择期望结束时间" value={endTime} onInput={e => setEndTime(e.detail.value)} />

            <Text className="publish-label">预算范围 (元)</Text>
            <View className="publish-budget-row">
              <Input className="publish-input publish-flex-input" type="digit" placeholder="最低" value={budgetMin} onInput={e => setBudgetMin(e.detail.value)} />
              <Text className="publish-split">-</Text>
              <Input className="publish-input publish-flex-input" type="digit" placeholder="最高" value={budgetMax} onInput={e => setBudgetMax(e.detail.value)} />
            </View>

            <Text className="publish-label">需求说明</Text>
            <Textarea className="publish-textarea" placeholder="补充货物类型、现场条件、时效要求等" value={description} onInput={e => setDescription(e.detail.value)} />

            <View className="publish-actions publish-actions-multi">
              <View className="publish-btn-ghost" onClick={() => setStep(1)}>
                <Text className="publish-btn-ghost-text">上一步</Text>
              </View>
              <View className={`publish-btn-secondary ${submitting ? 'publish-btn-disabled' : ''}`} onClick={handleSaveDraft}>
                <Text className="publish-btn-secondary-text">保存草稿</Text>
              </View>
              <View className={`publish-btn-primary ${submitting ? 'publish-btn-disabled' : ''}`} onClick={handlePublish}>
                <Text className="publish-btn-primary-text">{submitting ? '发布中...' : '确认发布'}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
