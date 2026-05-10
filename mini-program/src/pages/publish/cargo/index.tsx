import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components';
import { createCargoDeclaration } from '../../../services/client';
import '../demand/index.scss';

const SCENE_OPTIONS = [
  { key: 'power_grid', label: '电网建设' },
  { key: 'mountain_agriculture', label: '山区农副产品' },
  { key: 'plateau_supply', label: '高原给养' },
  { key: 'island_supply', label: '海岛补给' },
  { key: 'emergency', label: '应急救援' },
];

export default function PublishCargoPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [cargoScene, setCargoScene] = useState(SCENE_OPTIONS[0].key);
  const [customCargoScene, setCustomCargoScene] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [cargoLength, setCargoLength] = useState('');
  const [cargoWidth, setCargoWidth] = useState('');
  const [cargoHeight, setCargoHeight] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [budgetMax, setBudgetMax] = useState('');
  const [specialReq, setSpecialReq] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) { Taro.showToast({ title: '请输入任务标题', icon: 'none' }); return; }
    if (!(Number(cargoWeight) > 0)) { Taro.showToast({ title: '请填写有效的货物重量', icon: 'none' }); return; }

    setSubmitting(true);
    try {
      const effectiveCargoScene = customCargoScene.trim() || cargoScene;
      await createCargoDeclaration({
        cargo_category: effectiveCargoScene,
        cargo_name: title.trim(),
        cargo_description: description.trim() || undefined,
        quantity: Math.max(Number(tripCount) || 1, 1),
        total_weight: Number(cargoWeight),
        length: cargoLength ? Number(cargoLength) : undefined,
        width: cargoWidth ? Number(cargoWidth) : undefined,
        height: cargoHeight ? Number(cargoHeight) : undefined,
        declared_value: budgetMax ? Math.round(Number(budgetMax) * 100) : 0,
      });
      Taro.showToast({ title: '申报成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) { Taro.showToast({ title: e.message || '申报失败', icon: 'none' }); }
    finally { setSubmitting(false); }
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
          <Text className="publish-step-label publish-step-label-active">核心需求</Text>
          <Text className={`publish-step-label ${step >= 2 ? 'publish-step-label-active' : ''}`}>更多细节</Text>
        </View>
      </View>

      <ScrollView scrollY className="publish-scroll">
        {step === 1 ? (
          <View className="card">
            <Text className="section-title">1. 核心需求信息</Text>

            <Text className="publish-label">任务标题 *</Text>
            <Input className="publish-input" placeholder="例如：山区设备吊运" value={title} onInput={e => setTitle(e.detail.value)} />

            <Text className="publish-label">作业场景</Text>
            <View className="publish-option-row">
              {SCENE_OPTIONS.map(opt => (
                <View key={opt.key} className={`publish-option-btn ${!customCargoScene.trim() && cargoScene === opt.key ? 'publish-option-active' : ''}`}
                  onClick={() => {
                    setCargoScene(opt.key);
                    setCustomCargoScene('');
                  }}>
                  <Text className={`publish-option-text ${!customCargoScene.trim() && cargoScene === opt.key ? 'publish-option-text-active' : ''}`}>{opt.label}</Text>
                </View>
              ))}
            </View>
            <Input
              className="publish-input publish-custom-scene-input"
              placeholder="其他场景，可直接填写"
              value={customCargoScene}
              onInput={e => setCustomCargoScene(e.detail.value)}
            />

            <Text className="publish-label">货物重量 (kg) *</Text>
            <View className="publish-input-unit-wrap">
              <Input className="publish-input" type="digit" placeholder="例如：120" value={cargoWeight} onInput={e => setCargoWeight(e.detail.value)} />
              <Text className="publish-input-unit">kg</Text>
            </View>

            <View className="publish-actions">
              <View className="publish-btn-primary" onClick={() => setStep(2)}>
                <Text className="publish-btn-primary-text">进入下一步</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="card">
            <Text className="section-title">2. 更多细节 (选填)</Text>

            <Text className="publish-label">货物类型</Text>
            <Input className="publish-input" placeholder="如：塔材" value={cargoType} onInput={e => setCargoType(e.detail.value)} />

            <Text className="publish-label">货物尺寸（cm，可选）</Text>
            <View className="publish-dimension-row">
              <Input className="publish-input publish-dimension-input" type="digit" placeholder="长" value={cargoLength} onInput={e => setCargoLength(e.detail.value)} />
              <Input className="publish-input publish-dimension-input" type="digit" placeholder="宽" value={cargoWidth} onInput={e => setCargoWidth(e.detail.value)} />
              <Input className="publish-input publish-dimension-input" type="digit" placeholder="高" value={cargoHeight} onInput={e => setCargoHeight(e.detail.value)} />
            </View>

            <View className="publish-budget-row">
              <View style={{ flex: 1 }}>
                <Text className="publish-label">预计架次</Text>
                <Input className="publish-input" type="digit" placeholder="默认 1" value={tripCount} onInput={e => setTripCount(e.detail.value)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="publish-label">预算上限 (元)</Text>
                <Input className="publish-input" type="digit" placeholder="待议" value={budgetMax} onInput={e => setBudgetMax(e.detail.value)} />
              </View>
            </View>

            <Text className="publish-label">特殊要求</Text>
            <Input className="publish-input" placeholder="例如：需防水、防震包装..." value={specialReq} onInput={e => setSpecialReq(e.detail.value)} />

            <Text className="publish-label">任务说明</Text>
            <Textarea className="publish-textarea" placeholder="补充现场环境、装卸条件等信息..." value={description} onInput={e => setDescription(e.detail.value)} />

            <View className="publish-actions publish-actions-multi">
              <View className="publish-btn-ghost" onClick={() => setStep(1)}>
                <Text className="publish-btn-ghost-text">上一步</Text>
              </View>
              <View className={`publish-btn-primary ${submitting ? 'publish-btn-disabled' : ''}`} onClick={handleSubmit}>
                <Text className="publish-btn-primary-text">{submitting ? '提交中...' : '提交申报'}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
