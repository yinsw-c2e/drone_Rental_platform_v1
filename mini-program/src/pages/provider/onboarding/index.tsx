import Taro, { useDidShow } from '@tarojs/taro';
import React, { useMemo } from 'react';
import { Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState, useAppDispatch } from '../../../store/store';
import { setHaulRoleMode } from '../../../store/slices/roleSlice';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import { syncCustomTabBar } from '../../../utils/tabBar';
import type { ProviderReviewStatus } from '../../../types';
import './index.scss';

type StatusTone = 'gray' | 'blue' | 'orange' | 'green' | 'red';

type StatusMeta = {
  label: string;
  tone: StatusTone;
  desc: string;
};

type FlowStep = {
  title: string;
  desc: string;
  status: string;
  tone: StatusTone;
};

const STATUS_META: Record<ProviderReviewStatus, StatusMeta> = {
  none: {
    label: '未开始',
    tone: 'gray',
    desc: '提交资料后进入平台审核。',
  },
  pending_review: {
    label: '审核中',
    tone: 'orange',
    desc: '资料已进入审核，暂不能进入正式工作台。',
  },
  approved: {
    label: '已通过',
    tone: 'green',
    desc: '能力已开通，可使用对应接单和履约功能。',
  },
  rejected: {
    label: '需补充',
    tone: 'red',
    desc: '资料未通过，请按要求补充后重新提交。',
  },
  suspended: {
    label: '已暂停',
    tone: 'red',
    desc: '当前能力被暂停，请联系平台处理。',
  },
};

const safeNavigateTo = (url: string) => {
  Taro.navigateTo({ url }).catch(() => {
    Taro.showToast({ title: '页面暂未开放', icon: 'none' });
  });
};

const statusMetaOf = (status?: ProviderReviewStatus | null) =>
  STATUS_META[status || 'none'] || STATUS_META.none;

const buildStep = (
  title: string,
  desc: string,
  status: ProviderReviewStatus,
  fallbackStatus = '待完善',
): FlowStep => {
  const meta = statusMetaOf(status);
  return {
    title,
    desc,
    status: status === 'none' ? fallbackStatus : meta.label,
    tone: status === 'none' ? 'gray' : meta.tone,
  };
};

export default function ProviderOnboardingPage() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary, user), [roleSummary, user]);
  const capabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const providerMeta = statusMetaOf(capabilities.providerStatus);
  const assetMeta = statusMetaOf(capabilities.assetStatus);
  const executorMeta = statusMetaOf(capabilities.executorStatus);

  useDidShow(() => {
    // 仅同步当前 TabBar 选中态，不强制写全局身份。
    syncCustomTabBar(0);
  });

  const headerCopy = useMemo(() => {
    if (!isAuthenticated) {
      return {
        label: '待登录',
        tone: 'blue' as StatusTone,
        title: '登录后开始服务商入驻',
        desc: '我要接单面向服务商，登录后可以提交设备资质和履约资质。',
        action: '去登录',
      };
    }
    if (capabilities.canUseWorkbench) {
      return {
        label: '已通过',
        tone: 'green' as StatusTone,
        title: '服务商能力已开通',
        desc: '你的账号已具备正式接单能力，可进入工作台查看需求、履约和结算信息。',
        action: '进入工作台',
      };
    }
    if (capabilities.nextAction === 'wait_review') {
      return {
        label: providerMeta.label,
        tone: providerMeta.tone,
        title: '服务商资质审核中',
        desc: '审核通过后即可进入正式工作台，查看需求、履约和结算信息。',
        action: '查看可补充资料',
      };
    }
    if (capabilities.nextAction === 'fix_rejected') {
      return {
        label: providerMeta.label,
        tone: providerMeta.tone,
        title: '服务商资质需补充',
        desc: '请补充被驳回或暂停的资料，重新通过平台审核后才能正式接单。',
        action: '补充服务商资料',
      };
    }
    return {
      label: '未开通',
      tone: 'gray' as StatusTone,
      title: '开始服务商入驻',
      desc: '请完善服务商资料、设备资质和履约资质。审核通过后才能进入正式工作台。',
      action: '完善服务商资料',
    };
  }, [capabilities.canUseWorkbench, capabilities.nextAction, providerMeta.label, providerMeta.tone, isAuthenticated]);

  const assetSteps: FlowStep[] = useMemo(() => [
    buildStep('服务商资料', '维护联系人、服务范围和基础履约信息。', capabilities.assetStatus),
    buildStep('无人机设备与资质', '提交设备、证照、适航、保险和 UOM 相关材料。', capabilities.assetStatus),
    buildStep('平台审核', '审核通过后可报价、发布服务并承接订单。', capabilities.assetStatus, '待提交'),
  ], [capabilities.assetStatus]);

  const executorSteps: FlowStep[] = useMemo(() => [
    buildStep('履约资料', '填写履约负责人、服务区域和联系方式。', capabilities.executorStatus),
    buildStep('履约资质审核', '提交履约资质，平台确认后开通订单推进能力。', capabilities.executorStatus),
    {
      title: '服务商履约',
      desc: '审核通过后由服务商主体开始履约并推进订单状态。',
      status: capabilities.canAcceptDispatch || capabilities.canUseWorkbench ? '可履约' : '待开通',
      tone: capabilities.canAcceptDispatch || capabilities.canUseWorkbench ? 'green' : 'gray',
    },
  ], [capabilities.canAcceptDispatch, capabilities.canUseWorkbench, capabilities.executorStatus]);

  const runPrimaryAction = () => {
    if (!isAuthenticated) {
      safeNavigateTo('/pages/auth/login/index?roleMode=provider');
      return;
    }
    if (capabilities.canUseWorkbench) {
      // 用户显式点击"进入工作台"——此处属于明确的角色切换意图，
      // 等同 mode-selection 的用户主动选择，所以可以 dispatch。
      dispatch(setHaulRoleMode('provider'));
      Taro.switchTab({ url: '/pages/home/index' })
        .then(() => syncCustomTabBar(0))
        .catch(() => null);
      return;
    }
    safeNavigateTo('/pages/profile/owner/index');
  };

  const openProviderProfile = () => safeNavigateTo('/pages/profile/owner/index');
  const openDroneAssets = () => safeNavigateTo('/pages/profile/drones/index');
  const openExecutorRegister = () => safeNavigateTo('/pages/pilot/register/index');
  const openVerification = () => safeNavigateTo('/pages/verification/index');
  const openAccountProfile = () => {
    Taro.switchTab({ url: '/pages/profile/index' })
      .then(() => syncCustomTabBar(3))
      .catch(() => null);
  };

  return (
    <View className="provider-onboarding-page">
      <View className="provider-onboarding-scroll">
        <View className="provider-onboarding-content">
          <View className="provider-onboarding-hero">
            <View className={`provider-onboarding-status provider-onboarding-status-${headerCopy.tone}`}>
              <Text className="provider-onboarding-status-text">{headerCopy.label}</Text>
            </View>
            <Text className="provider-onboarding-title">{headerCopy.title}</Text>
            <Text className="provider-onboarding-desc">{headerCopy.desc}</Text>
            <View className="provider-onboarding-actions">
              <View className="provider-onboarding-primary" onClick={runPrimaryAction}>
                <Text className="provider-onboarding-primary-text">{headerCopy.action}</Text>
              </View>
              <View className="provider-onboarding-secondary" onClick={openAccountProfile}>
                <Text className="provider-onboarding-secondary-text">查看账号资料</Text>
              </View>
            </View>
          </View>

          <View className="provider-onboarding-card">
            <View className="provider-onboarding-card-head">
              <View>
                <Text className="provider-onboarding-card-title">设备服务能力</Text>
                <Text className="provider-onboarding-card-desc">适合自有或可调度无人机的服务商。</Text>
              </View>
              <View className={`provider-onboarding-pill provider-onboarding-pill-${assetMeta.tone}`}>
                <Text className="provider-onboarding-pill-text">{assetMeta.label}</Text>
              </View>
            </View>
            <Text className="provider-onboarding-card-note">{assetMeta.desc}</Text>
            <View className="provider-onboarding-step-list">
              {assetSteps.map((step) => (
                <View key={step.title} className="provider-onboarding-step">
                  <View className={`provider-onboarding-dot provider-onboarding-dot-${step.tone}`} />
                  <View className="provider-onboarding-step-main">
                    <Text className="provider-onboarding-step-title">{step.title}</Text>
                    <Text className="provider-onboarding-step-desc">{step.desc}</Text>
                  </View>
                  <Text className={`provider-onboarding-step-status provider-onboarding-step-status-${step.tone}`}>
                    {step.status}
                  </Text>
                </View>
              ))}
            </View>
            <View className="provider-onboarding-card-actions">
              <View className="provider-onboarding-link-btn" onClick={openProviderProfile}>
                <Text className="provider-onboarding-link-text">服务商资料</Text>
              </View>
              <View className="provider-onboarding-link-btn provider-onboarding-link-btn-blue" onClick={openDroneAssets}>
                <Text className="provider-onboarding-link-text provider-onboarding-link-text-blue">设备与资质</Text>
              </View>
            </View>
          </View>

          <View className="provider-onboarding-card">
            <View className="provider-onboarding-card-head">
              <View>
                <Text className="provider-onboarding-card-title">履约资质</Text>
                <Text className="provider-onboarding-card-desc">用于证明服务商具备现场履约和订单推进能力。</Text>
              </View>
              <View className={`provider-onboarding-pill provider-onboarding-pill-${executorMeta.tone}`}>
                <Text className="provider-onboarding-pill-text">{executorMeta.label}</Text>
              </View>
            </View>
            <Text className="provider-onboarding-card-note">{executorMeta.desc}</Text>
            <View className="provider-onboarding-step-list">
              {executorSteps.map((step) => (
                <View key={step.title} className="provider-onboarding-step">
                  <View className={`provider-onboarding-dot provider-onboarding-dot-${step.tone}`} />
                  <View className="provider-onboarding-step-main">
                    <Text className="provider-onboarding-step-title">{step.title}</Text>
                    <Text className="provider-onboarding-step-desc">{step.desc}</Text>
                  </View>
                  <Text className={`provider-onboarding-step-status provider-onboarding-step-status-${step.tone}`}>
                    {step.status}
                  </Text>
                </View>
              ))}
            </View>
            <View className="provider-onboarding-card-actions">
              <View className="provider-onboarding-link-btn provider-onboarding-link-btn-blue" onClick={openExecutorRegister}>
                <Text className="provider-onboarding-link-text provider-onboarding-link-text-blue">履约资质认证</Text>
              </View>
            </View>
          </View>

          <View className="provider-onboarding-card provider-onboarding-card-compact">
            <Text className="provider-onboarding-card-title">基础资料</Text>
            <View className="provider-onboarding-basic-row" onClick={openVerification}>
              <View>
                <Text className="provider-onboarding-basic-title">实名认证</Text>
                <Text className="provider-onboarding-basic-desc">账号实名是服务商审核的基础条件之一。</Text>
              </View>
              <Text className="provider-onboarding-basic-action">去完善</Text>
            </View>
            <View className="provider-onboarding-basic-row provider-onboarding-basic-row-last" onClick={openAccountProfile}>
              <View>
                <Text className="provider-onboarding-basic-title">账号资料</Text>
                <Text className="provider-onboarding-basic-desc">查看手机号、昵称、客户资料和当前身份状态。</Text>
              </View>
              <Text className="provider-onboarding-basic-action">查看</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
