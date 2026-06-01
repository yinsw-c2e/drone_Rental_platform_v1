import React from 'react';
import { Text, View } from '@tarojs/components';
import './StepBar.scss';

export type StepBarState = 'done' | 'current' | 'pending' | 'review' | 'fix';

export type StepBarStep = {
  key?: string;
  label: string;
  state: StepBarState;
  onClick?: () => void;
};

type Props = {
  steps: StepBarStep[];
};

export default function StepBar({ steps }: Props) {
  return (
    <View className="business-stepbar">
      {steps.map((step, index) => (
        <View
          key={step.key || step.label}
          className={`business-stepbar-node business-stepbar-node-${step.state}`}
          onClick={step.onClick}
        >
          <View className={`business-stepbar-dot business-stepbar-dot-${step.state}`}>
            <Text className="business-stepbar-dot-text">{step.state === 'done' ? '✓' : String(index + 1)}</Text>
          </View>
          <Text className={`business-stepbar-label business-stepbar-label-${step.state}`}>{step.label}</Text>
          {index < steps.length - 1 ? (
            <View className={`business-stepbar-line ${steps[index + 1]?.state === 'done' ? 'business-stepbar-line-done' : ''}`} />
          ) : null}
        </View>
      ))}
    </View>
  );
}
