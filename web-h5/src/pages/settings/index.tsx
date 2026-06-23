// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Switch, Text, View } from '@tarojs/components';
import { useDispatch, useSelector } from 'react-redux';

import { logout } from '../../store/slices/authSlice';
import { setHaulRoleMode, type HaulRoleMode } from '../../store/slices/roleSlice';
import { RootState } from '../../store/store';
import RoleModeCard from '../../components/business/RoleModeCard';
import { COMMON_PLATFORM_SUBSCRIBE_TEMPLATES } from '../../constants/subscribeTemplates';
import { requestSubscribe } from '../../services/push';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../utils/roleSummary';
import { syncPreferredModeWithBackend } from '../../utils/preferredMode';
import { PROVIDER_WORKBENCH_ONBOARDING_STORAGE_KEY } from '../../utils/providerOnboarding';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import './index.scss';

const PUSH_STORAGE_KEY = 'profile_push_enabled';

const getVerifyText = (status?: string) => {
  if (status === 'approved') return '已认证';
  if (status === 'pending') return '审核中';
  return '未认证';
};

export default function SettingsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);
  const providerCapabilities = resolveProviderCapabilities(effectiveRoleSummary);
  const hasProviderMode = Boolean(
    providerCapabilities.hasProviderApplication ||
    providerCapabilities.canUseWorkbench ||
    effectiveRoleSummary.has_owner_role ||
    effectiveRoleSummary.has_pilot_role,
  );

  const [pushEnabled, setPushEnabled] = useState(true);
  const [subscriptionsMainSwitch, setSubscriptionsMainSwitch] = useState<boolean | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const isDevMode = process.env.NODE_ENV !== 'production';

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const localPreference = Taro.getStorageSync(PUSH_STORAGE_KEY);
      if (typeof localPreference === 'boolean') {
        setPushEnabled(localPreference);
      }

      const res: any = await Taro.getSetting({ withSubscriptions: true } as any).catch(() => null);
      setSubscriptionsMainSwitch(
        typeof res?.subscriptionsSetting?.mainSwitch === 'boolean'
          ? res.subscriptionsSetting.mainSwitch
          : null,
      );
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useDidShow(() => {
    loadSettings();
  });

  const handleOpenSystemSettings = async () => {
    try {
      await Taro.openSetting();
      loadSettings();
    } catch {
      Taro.showToast({ title: '无法打开设置', icon: 'none' });
    }
  };

  const handleTogglePush = async (nextValue: boolean) => {
    setPushEnabled(nextValue);
    Taro.setStorageSync(PUSH_STORAGE_KEY, nextValue);

    let acceptedCount = 0;
    if (nextValue) {
      const accepted = await requestSubscribe(COMMON_PLATFORM_SUBSCRIBE_TEMPLATES);
      acceptedCount = accepted.length;
    }

    if (nextValue && subscriptionsMainSwitch === false) {
      Taro.showModal({
        title: '通知入口待开启',
        content: '应用内开关已打开，但微信通知入口还未开启。请在系统设置里检查通知和订阅消息权限。',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            handleOpenSystemSettings();
          }
        },
      });
      return;
    }

    if (!nextValue) {
      Taro.showToast({ title: '已关闭当前设备提醒', icon: 'none' });
      return;
    }

    if (acceptedCount > 0) {
      Taro.showToast({ title: '通知已开启', icon: 'success' });
    }
  };

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        dispatch(logout());
        Taro.reLaunch({ url: '/pages/auth/login/index' });
      },
    });
  };

  const handleResetProviderOnboarding = () => {
    try {
      Taro.removeStorageSync(PROVIDER_WORKBENCH_ONBOARDING_STORAGE_KEY);
      dispatch(setHaulRoleMode('provider'));
      Taro.showToast({ title: '已重置新手引导', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/home/index' }).catch(() => {
          Taro.showToast({ title: '首页暂不可用', icon: 'none' });
        });
      }, 350);
    } catch (error) {
      Taro.showToast({ title: friendlyErrorMessage(error, '重置失败'), icon: 'none' });
    }
  };

  const handleSelectRoleMode = (mode: HaulRoleMode) => {
    if (mode === selectedMode) return;
    dispatch(setHaulRoleMode(mode));
    syncPreferredModeWithBackend(mode);
    Taro.showToast({ title: `已切换到${mode === 'provider' ? '服务商' : '客户'}身份`, icon: 'none' });
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/home/index' }).catch(() => null);
    }, 250);
  };

  const notificationStatusText = useMemo(() => {
    if (loadingSettings) {
      return '读取中...';
    }
    if (subscriptionsMainSwitch === true) {
      return '微信侧已开启';
    }
    if (subscriptionsMainSwitch === false) {
      return '微信侧待开启';
    }
    return '待确认';
  }, [loadingSettings, subscriptionsMainSwitch]);

  return (
    <View className='settings-page'>
      <ScrollView scrollY className='settings-scroll'>
        <View className='settings-content'>
          <View className='settings-section-header'>
            <Text className='settings-section-title'>账户信息</Text>
          </View>
          <View className='settings-section'>
            <View className='settings-row'>
              <Text className='settings-row-label'>手机号</Text>
              <Text className='settings-row-value'>{user?.phone || '未绑定'}</Text>
            </View>

            <View
              className='settings-row settings-row-clickable'
              onClick={() => Taro.navigateTo({ url: '/pages/edit-profile/index' })}
            >
              <Text className='settings-row-label'>昵称</Text>
              <View className='settings-row-right'>
                <Text className='settings-row-value'>{user?.nickname || '未设置'}</Text>
                <Text className='settings-row-arrow'>›</Text>
              </View>
            </View>

            <View
              className='settings-row settings-row-clickable settings-row-last'
              onClick={() => Taro.navigateTo({ url: '/pages/verification/index' })}
            >
              <Text className='settings-row-label'>实名认证</Text>
              <View className='settings-row-right'>
                <Text
                  className={`settings-row-value ${
                    user?.id_verified === 'approved'
                      ? 'settings-row-value-success'
                      : 'settings-row-value-warning'
                  }`}
                >
                  {getVerifyText(user?.id_verified)}
                </Text>
                <Text className='settings-row-arrow'>›</Text>
              </View>
            </View>
          </View>

          <RoleModeCard
            selectedMode={selectedMode}
            hasClientMode={Boolean(effectiveRoleSummary.has_client_role)}
            hasProviderMode={hasProviderMode}
            onSelectMode={handleSelectRoleMode}
            onOpenClientProfile={() => Taro.navigateTo({ url: '/pages/client/profile/index' })}
            onOpenProviderOnboarding={() => Taro.navigateTo({ url: '/pages/provider/onboarding/index' })}
          />

          <View className='settings-section-header'>
            <Text className='settings-section-title'>通知设置</Text>
          </View>
          <View className='settings-section'>
            <View className='settings-row'>
              <View className='settings-row-main'>
                <Text className='settings-row-label'>接收平台通知</Text>
                <Text className='settings-row-hint'>控制当前设备是否接收平台消息提醒</Text>
              </View>
              <Switch
                checked={pushEnabled}
                color='#2563EB'
                onChange={(e) => handleTogglePush(!!e.detail.value)}
              />
            </View>

            <View className='settings-row'>
              <View className='settings-row-main'>
                <Text className='settings-row-label settings-row-label-muted'>微信通知入口</Text>
                <Text className='settings-row-hint settings-row-hint-muted'>
                  {notificationStatusText}
                </Text>
              </View>
              <Text className='settings-mini-status'>{notificationStatusText}</Text>
            </View>

            <View
              className='settings-row settings-row-clickable settings-row-last'
              onClick={handleOpenSystemSettings}
            >
              <View className='settings-row-main'>
                <Text className='settings-row-label'>打开授权设置</Text>
                <Text className='settings-row-hint'>检查通知、订阅消息与微信授权状态</Text>
              </View>
              <Text className='settings-row-arrow'>›</Text>
            </View>
          </View>

          <View className='settings-section-header'>
            <Text className='settings-section-title'>服务商设置</Text>
          </View>
          <View className='settings-section'>
            <View
              className='settings-row settings-row-clickable settings-row-last'
              onClick={handleResetProviderOnboarding}
            >
              <View className='settings-row-main'>
                <Text className='settings-row-label'>重看新手引导</Text>
                <Text className='settings-row-hint'>回到服务商工作台后重新显示三步引导</Text>
              </View>
              <Text className='settings-row-arrow'>›</Text>
            </View>
          </View>

          {isDevMode ? (
            <>
              <View className='settings-section-header'>
                <Text className='settings-section-title'>诊断信息</Text>
              </View>
              <View className='settings-section settings-dev-section'>
                <View className='settings-row'>
                  <Text className='settings-row-label'>当前环境</Text>
                  <Text className='settings-row-value'>测试模式</Text>
                </View>
                <View className='settings-row'>
                  <Text className='settings-row-label'>登录状态</Text>
                  <Text className='settings-row-value'>{user?.id ? '已登录' : '未登录'}</Text>
                </View>
                <View className='settings-row'>
                  <Text className='settings-row-label'>本机提醒偏好</Text>
                  <Text className='settings-row-value'>{pushEnabled ? '已开启' : '已关闭'}</Text>
                </View>
                <View
                  className='settings-row settings-row-clickable settings-row-last'
                  onClick={() => Taro.navigateTo({ url: '/pages/dev/subscribe-test/index' })}
                >
                  <Text className='settings-row-label'>订阅消息诊断</Text>
                  <Text className='settings-row-arrow'>›</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View className='settings-footer'>
        <View className='settings-logout-btn' onClick={handleLogout}>
          <Text className='settings-logout-text'>退出登录</Text>
        </View>
      </View>
    </View>
  );
}
