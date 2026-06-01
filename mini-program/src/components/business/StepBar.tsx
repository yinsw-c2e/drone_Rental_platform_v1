import React from 'react';
import { Text, View } from '@tarojs/components';
import './StepBar.scss';

export type StepBarState = 'done' | 'current' | 'pending' | 'review' | 'fix';

export type StepBarStep = {
  key?: string;
  label: string;
  state?: StepBarState;
  onClick?: () => void;
};

type Props = {
  steps: StepBarStep[];
  currentIndex?: number;
  theme?: 'hero' | 'light';
};

const stateFromIndex = (index: number, currentIndex: number): StepBarState => {
  if (index < currentIndex) return 'done';
  if (index === currentIndex) return 'current';
  return 'pending';
};

const shouldCompleteLine = (current: StepBarState, next?: StepBarState) => (
  current === 'done' && next !== undefined && next !== 'pending'
);

export default function StepBar({ steps, currentIndex = 0, theme = 'hero' }: Props) {
  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    state: step.state || stateFromIndex(index, currentIndex),
  }));

  return (
    <View className={`business-stepbar business-stepbar-${theme}`}>
      {normalizedSteps.map((step, index) => (
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
            <View className={`business-stepbar-line ${shouldCompleteLine(step.state, normalizedSteps[index + 1]?.state) ? 'business-stepbar-line-done' : ''}`} />
          ) : null}
        </View>
      ))}
    </View>
  );
}
