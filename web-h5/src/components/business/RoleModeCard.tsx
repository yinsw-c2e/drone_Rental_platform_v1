import React from 'react';
import { Text, View } from '@tarojs/components';
import type { HaulRoleMode } from '../../store/slices/roleSlice';
import './RoleModeCard.scss';

type Props = {
  selectedMode: HaulRoleMode;
  hasClientMode: boolean;
  hasProviderMode: boolean;
  onSelectMode: (mode: HaulRoleMode) => void;
  onOpenClientProfile: () => void;
  onOpenProviderOnboarding: () => void;
};

const modeLabel = (mode: HaulRoleMode) => (mode === 'provider' ? '服务商' : '客户');

export default function RoleModeCard({
  selectedMode,
  hasClientMode,
  hasProviderMode,
  onSelectMode,
  onOpenClientProfile,
  onOpenProviderOnboarding,
}: Props) {
  const canSwitch = hasClientMode && hasProviderMode;
  const missingProvider = hasClientMode && !hasProviderMode;

  return (
    <View className='role-mode-card'>
      <View className='role-mode-head'>
        <View className='role-mode-title-wrap'>
          <Text className='role-mode-label'>当前身份</Text>
          <Text className='role-mode-title'>{modeLabel(selectedMode)}</Text>
        </View>
        {canSwitch ? (
          <View className='role-mode-segment'>
            {(['customer', 'provider'] as HaulRoleMode[]).map(mode => (
              <View
                key={mode}
                className={`role-mode-segment-item ${selectedMode === mode ? 'is-active' : ''}`}
                onClick={() => onSelectMode(mode)}
              >
                <Text className={`role-mode-segment-text ${selectedMode === mode ? 'is-active' : ''}`}>
                  {modeLabel(mode)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {canSwitch ? (
        <Text className='role-mode-desc'>切换后会回到对应首页，方便继续下单或接单。</Text>
      ) : (
        <View className='role-mode-action-row'>
          <Text className='role-mode-desc'>
            {missingProvider ? '开通服务商身份后，可上线接单并管理设备资质。' : '完善客户档案后，可发布吊运任务。'}
          </Text>
          <View
            className='role-mode-action'
            onClick={missingProvider ? onOpenProviderOnboarding : onOpenClientProfile}
          >
            <Text className='role-mode-action-text'>{missingProvider ? '开通服务商' : '完善客户档案'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
