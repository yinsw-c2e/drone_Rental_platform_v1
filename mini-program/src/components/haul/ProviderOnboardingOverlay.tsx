import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from '@tarojs/components';
import './ProviderOnboardingOverlay.scss';

type ProviderOnboardingOverlayProps = {
  visible: boolean;
  onClose: () => void;
};

const steps = [
  {
    key: 'preferences',
    title: '配置接单偏好',
    desc: '先选你能服务的范围，再勾选可接机型。系统会按这些条件帮你筛选合适订单。',
    hint: '服务半径和可接机型会直接影响派单范围',
  },
  {
    key: 'presence',
    title: '了解上线含义',
    desc: '上线后平台会主动派单给你；下线时仍能去「接单」tab 主动报价。',
    hint: '准备好接单后再上线，避免客户久等',
  },
  {
    key: 'orders',
    title: '看看接单方式',
    desc: '被动派单 + 主动报价两种姿态都在这里，底部「接单」入口可以随时查看机会。',
    hint: '主动报价不依赖上线状态',
  },
] as const;

export default function ProviderOnboardingOverlay({ visible, onClose }: ProviderOnboardingOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const current = useMemo(() => steps[stepIndex], [stepIndex]);
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const goNext = () => {
    if (isLast) {
      onClose();
      return;
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  };

  return (
    <View className={`provider-onboarding-overlay provider-onboarding-overlay-${current.key}`}>
      <View className='provider-onboarding-spotlight' />
      <View className='provider-onboarding-bubble'>
        <Text className='provider-onboarding-count'>{stepIndex + 1} / {steps.length}</Text>
        <Text className='provider-onboarding-overlay-title'>{current.title}</Text>
        <Text className='provider-onboarding-overlay-desc'>{current.desc}</Text>
        <Text className='provider-onboarding-overlay-hint'>{current.hint}</Text>
      </View>
      <View className='provider-onboarding-bottom'>
        <View className='provider-onboarding-skip' onClick={onClose}>
          <Text>跳过</Text>
        </View>
        <View className='provider-onboarding-next' onClick={goNext}>
          <Text>{isLast ? '完成' : '下一步'}</Text>
        </View>
      </View>
    </View>
  );
}

