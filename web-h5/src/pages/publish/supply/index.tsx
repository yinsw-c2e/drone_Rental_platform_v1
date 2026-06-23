import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import ProviderAccessNotice from '../../../components/business/ProviderAccessNotice';
import { ownerService } from '../../../services/owner';
import { RootState } from '../../../store/store';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const SCENE_OPTIONS = [
  { key: 'power_grid', label: '电网建设' },
  { key: 'mountain_agriculture', label: '山区农副产品' },
  { key: 'plateau_supply', label: '高原给养' },
  { key: 'island_supply', label: '海岛补给' },
  { key: 'emergency', label: '应急救援' },
];

const PRICING_OPTIONS = [
  { key: 'per_trip', label: '按架次' },
  { key: 'per_km', label: '按公里' },
  { key: 'per_hour', label: '按小时' },
  { key: 'per_kg', label: '按公斤' },
];

export default function PublishSupplyPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );
  const canPublishSupply = Boolean(
    isAuthenticated && providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [droneId, setDroneId] = useState('');
  const [description, setDescription] = useState('');
  const [selectedScenes, setSelectedScenes] = useState<string[]>(['power_grid']);
  const [price, setPrice] = useState('');
  const [pricingUnit, setPricingUnit] = useState('per_trip');
  const [pricingRule, setPricingRule] = useState('');
  const [slots, setSlots] = useState('');
  const [customCargoScene, setCustomCargoScene] = useState('');

  const toggleScene = (scene: string) => {
    setSelectedScenes(prev =>
      prev.includes(scene) ? prev.filter(s => s !== scene) : [...prev, scene]
    );
  };

  const handleSubmit = async () => {
    if (!canPublishSupply) {
      Taro.showToast({ title: '接单资质通过后才能上架服务', icon: 'none' });
      return;
    }
    if (!title.trim()) { Taro.showToast({ title: '请输入服务标题', icon: 'none' }); return; }
    if (!droneId) { Taro.showToast({ title: '请输入无人机ID', icon: 'none' }); return; }
    if (!price || Number(price) <= 0) { Taro.showToast({ title: '请输入有效价格', icon: 'none' }); return; }
    const customScene = customCargoScene.trim();
    const effectiveScenes = customScene
      ? Array.from(new Set([...selectedScenes, customScene]))
      : selectedScenes;
    if (effectiveScenes.length === 0) { Taro.showToast({ title: '请至少选择一个适用场景', icon: 'none' }); return; }

    setSubmitting(true);
    try {
      await ownerService.createSupply({
        drone_id: Number(droneId),
        title: title.trim(),
        description: description.trim(),
        cargo_scenes: effectiveScenes,
        base_price_amount: Math.round(Number(price) * 100),
        pricing_unit: pricingUnit,
        pricing_rule: pricingRule.trim() ? { summary: pricingRule.trim() } : undefined,
        available_time_slots: slots.trim() ? { summary: slots.trim() } : undefined,
        accepts_direct_order: true,
        status: 'active',
      });
      Taro.showToast({ title: '上架成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) { Taro.showToast({ title: friendlyErrorMessage(e, '上架失败'), icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  if (!canPublishSupply) {
    return (
      <View className="publish-wrap">
        <ProviderAccessNotice
          title={isAuthenticated ? '接单资质未开通' : '请先登录服务商账号'}
          description={isAuthenticated ? '设备资质和履约资质全部通过后，才能上架正式服务。' : '登录后才能上架服务商供给。'}
          actionText={isAuthenticated ? '查看服务商入驻' : undefined}
          onAction={isAuthenticated ? () => Taro.navigateTo({ url: '/pages/provider/onboarding/index' }) : undefined}
        />
      </View>
    );
  }

  return (
    <View className="publish-wrap">
      <View className="publish-steps">
        <View className="publish-step-track">
          <View className="publish-step-dot publish-step-dot-active" />
          <View className={`publish-step-line ${step >= 2 ? 'publish-step-line-active' : ''}`} />
          <View className={`publish-step-dot ${step >= 2 ? 'publish-step-dot-active' : ''}`} />
        </View>
        <View className="publish-step-labels">
          <Text className="publish-step-label publish-step-label-active">设备与方案</Text>
          <Text className={`publish-step-label ${step >= 2 ? 'publish-step-label-active' : ''}`}>价格与规则</Text>
        </View>
      </View>

      <ScrollView scrollY className="publish-scroll">
        {step === 1 ? (
          <View className="card">
            <Text className="section-title">1. 执行设备资产</Text>
            <Text className="publish-label">无人机 ID *</Text>
            <Input className="publish-input" type="number" placeholder="输入你的无人机ID" value={droneId} onInput={e => setDroneId(e.detail.value)} />

            <Text className="section-title" style={{ marginTop: '20px' }}>2. 服务方案设置</Text>
            <Text className="publish-label">服务标题 *</Text>
            <Input className="publish-input" placeholder="例如：海岛补给重载吊运服务" value={title} onInput={e => setTitle(e.detail.value)} />

            <Text className="publish-label">适用场景</Text>
            <View className="publish-option-row">
              {SCENE_OPTIONS.map(opt => {
                const active = selectedScenes.includes(opt.key);
                return (
                  <View key={opt.key} className={`publish-option-btn ${active ? 'publish-option-active' : ''}`}
                    onClick={() => toggleScene(opt.key)}>
                    <Text className={`publish-option-text ${active ? 'publish-option-text-active' : ''}`}>{opt.label}</Text>
                  </View>
                );
              })}
            </View>
            <Input
              className="publish-input publish-custom-scene-input"
              placeholder="其他场景，可直接填写"
              value={customCargoScene}
              onInput={e => setCustomCargoScene(e.detail.value)}
            />

            <Text className="publish-label">服务说明</Text>
            <Textarea className="publish-textarea" placeholder="说明你的执行经验、具体适用范围和交付保障能力" value={description} onInput={e => setDescription(e.detail.value)} />

            <View className="publish-actions">
              <View className="publish-btn-primary" onClick={() => setStep(2)}>
                <Text className="publish-btn-primary-text">下一步：设置价格规则</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="card">
            <Text className="section-title">3. 经营价格规则</Text>

            <Text className="publish-label">基础价格 (元) *</Text>
            <Input className="publish-input" type="digit" placeholder="0.00" value={price} onInput={e => setPrice(e.detail.value)} />

            <Text className="publish-label">计价方式</Text>
            <View className="publish-option-row">
              {PRICING_OPTIONS.map(opt => {
                const active = pricingUnit === opt.key;
                return (
                  <View key={opt.key} className={`publish-option-btn ${active ? 'publish-option-active' : ''}`}
                    onClick={() => setPricingUnit(opt.key)}>
                    <Text className={`publish-option-text ${active ? 'publish-option-text-active' : ''}`}>{opt.label}</Text>
                  </View>
                );
              })}
            </View>

            <Text className="publish-label">价格详情说明</Text>
            <Textarea className="publish-textarea" placeholder="例如：基础价含 1 架次，超出的按 300/架计算" value={pricingRule} onInput={e => setPricingRule(e.detail.value)} />

            <Text className="publish-label">可接单时段</Text>
            <Input className="publish-input" placeholder="例如：工作日 09:00-18:00" value={slots} onInput={e => setSlots(e.detail.value)} />

            <View className="publish-actions publish-actions-multi">
              <View className="publish-btn-ghost" onClick={() => setStep(1)}>
                <Text className="publish-btn-ghost-text">上一步</Text>
              </View>
              <View className={`publish-btn-primary ${submitting ? 'publish-btn-disabled' : ''}`} onClick={handleSubmit}>
                <Text className="publish-btn-primary-text">{submitting ? '上架中...' : '正式上架'}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
