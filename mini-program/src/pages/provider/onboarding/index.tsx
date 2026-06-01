import Taro, { useDidShow } from '@tarojs/taro';
import React, { useMemo } from 'react';
import { Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState, useAppDispatch } from '../../../store/store';
import { setHaulRoleMode } from '../../../store/slices/roleSlice';
import {
  getEffectiveRoleSummary,
  resolveProviderCapabilities,
  type ProviderCapabilities,
} from '../../../utils/roleSummary';
import { buildProviderReviewFixItems } from '../../../utils/providerReview';
import { syncCustomTabBar } from '../../../utils/tabBar';
import type { ProviderReviewStatus, User } from '../../../types';
import './index.scss';

type StatusTone = 'gray' | 'blue' | 'orange' | 'green' | 'red';
type ActionKey = 'login' | 'workbench' | 'verification' | 'owner' | 'drones' | 'executor';

type HeroCopy = {
  label: string;
  tone: StatusTone;
  title: string;
  desc: string;
  primaryCtaText: string;
  action: ActionKey;
  showSecondary?: boolean;
};

type TimelineStep = {
  title: string;
  desc: string;
  status: string;
  tone: StatusTone;
  icon: 'done' | 'current' | 'future' | 'review' | 'fix';
  interactive: boolean;
};

type TimelineState = {
  steps: TimelineStep[];
  currentIndex: number | null;
  completedCount: number;
  hero: HeroCopy;
};

const safeNavigateTo = (url: string) => {
  Taro.navigateTo({ url }).catch(() => {
    Taro.showToast({ title: '页面暂未开放', icon: 'none' });
  });
};

const isIdentityApproved = (status?: User['id_verified'] | null) =>
  status === 'approved' || status === 'verified';

const isQualificationFixRequired = (status: ProviderReviewStatus) => status === 'rejected' || status === 'suspended';

const makeHero = (
  label: string,
  tone: StatusTone,
  title: string,
  desc: string,
  primaryCtaText: string,
  action: ActionKey,
  showSecondary = false,
): HeroCopy => ({ label, tone, title, desc, primaryCtaText, action, showSecondary });

const buildStep = (
  title: string,
  desc: string,
  done: boolean,
  index: number,
  currentIndex: number | null,
  override?: { status: string; tone: StatusTone; icon: TimelineStep['icon'] },
): TimelineStep => {
  const isCurrent = currentIndex === index;
  const status = done ? '已完成' : override?.status || (isCurrent ? '进行中' : '待提交');
  const tone = done ? 'green' : override?.tone || (isCurrent ? 'blue' : 'gray');
  const icon = done ? 'done' : override?.icon || (isCurrent ? 'current' : 'future');
  return {
    title,
    desc,
    status,
    tone,
    icon,
    interactive: isCurrent,
  };
};

const deriveTimelineState = (
  capabilities: ProviderCapabilities,
  user: User | null | undefined,
  isAuthenticated: boolean,
): TimelineState => {
  const idStatus = user?.id_verified;
  const assetStatus = capabilities.assetStatus;
  const executorStatus = capabilities.executorStatus;
  const assetApproved = assetStatus === 'approved';
  const executorApproved = executorStatus === 'approved';
  const qualificationApproved = assetApproved && executorApproved && capabilities.canUseWorkbench;
  const qualificationStarted = assetStatus !== 'none' || executorStatus !== 'none';
  const qualificationAction: ActionKey = assetApproved ? 'executor' : 'drones';
  const doneFlags = [
    isIdentityApproved(idStatus),
    qualificationStarted,
    qualificationApproved,
  ];
  const currentIndex = doneFlags.every(Boolean) ? null : doneFlags.findIndex((done) => !done);
  const completedCount = doneFlags.filter(Boolean).length;

  const step1Override = idStatus === 'pending'
    ? { status: '审核中', tone: 'orange' as StatusTone, icon: 'review' as const }
    : idStatus === 'rejected'
      ? { status: '需补充', tone: 'red' as StatusTone, icon: 'fix' as const }
      : undefined;
  const hasQualificationFix = isQualificationFixRequired(assetStatus) || isQualificationFixRequired(executorStatus);
  const hasQualificationReview = assetStatus === 'pending_review' || executorStatus === 'pending_review';
  const step3Override = hasQualificationFix
    ? { status: '需补充', tone: 'red' as StatusTone, icon: 'fix' as const }
    : hasQualificationReview
      ? { status: '审核中', tone: 'orange' as StatusTone, icon: 'review' as const }
      : undefined;

  const steps = [
    buildStep('实名认证', '账号实名是服务商审核的基础', doneFlags[0], 0, currentIndex, step1Override),
    buildStep('服务商资料', '维护联系人与服务范围', doneFlags[1], 1, currentIndex),
    buildStep('接单资质', '提交设备资质与履约资质', doneFlags[2], 2, currentIndex, step3Override),
  ];

  let hero = makeHero('未开通', 'gray', '开始服务商入驻', '完善服务商资料和接单资质即可进入审核。', '完善服务商资料', 'owner');
  if (!isAuthenticated) {
    hero = makeHero('待登录', 'blue', '登录后开始服务商入驻', '登录后即可提交服务商资料和接单资质。', '去登录', 'login');
  } else if (capabilities.canUseWorkbench) {
    hero = makeHero('已通过', 'green', '接单能力已开通', '你的账号已具备正式接单能力。', '进入工作台', 'workbench', true);
  } else if (idStatus === 'pending') {
    hero = makeHero('审核中', 'orange', '实名认证审核中', '等待实名核验通过后，即可继续提交服务商资料。', '查看实名认证进度', 'verification');
  } else if (idStatus === 'rejected') {
    hero = makeHero('需补充', 'red', '实名认证未通过', '请按要求重新提交实名信息。', '重新提交实名', 'verification');
  } else if (!doneFlags[0]) {
    hero = makeHero('未开始', 'gray', '先完成实名认证', '实名是服务商审核的基础条件。', '去实名认证', 'verification');
  } else if (currentIndex === 1 && !qualificationStarted) {
    hero = makeHero('未开始', 'gray', '完善服务商资料', '填写联系人、服务范围与基础履约信息。', '完善服务商资料', 'owner');
  } else if (currentIndex === 2 && hasQualificationReview) {
    hero = makeHero(
      '审核中',
      'orange',
      '接单资质审核中',
      '设备资质和履约资质全部通过后将开通接单能力。',
      '查看可补充资料',
      qualificationAction,
    );
  } else if (currentIndex === 2 && hasQualificationFix) {
    hero = makeHero('需补充', 'red', '接单资质需补充', '请补充被驳回或暂停的资料后重新提交。', '补充接单资质', qualificationAction);
  } else if (currentIndex === 2) {
    hero = makeHero('未完成', 'gray', '完善接单资质', '需要设备资质和履约资质全部通过后，才能正式接单。', assetApproved ? '补充履约资质' : '补充设备资质', qualificationAction);
  }

  return { steps, currentIndex, completedCount, hero };
};

export default function ProviderOnboardingPage() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary, user), [roleSummary, user]);
  const capabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const reviewFixItems = useMemo(() => buildProviderReviewFixItems(capabilities), [capabilities]);
  const timelineState = useMemo(
    () => deriveTimelineState(capabilities, user, isAuthenticated),
    [capabilities, isAuthenticated, user],
  );

  useDidShow(() => {
    syncCustomTabBar(0);
  });

  const runAction = (action: ActionKey) => {
    if (action === 'login') {
      safeNavigateTo('/pages/auth/login/index?roleMode=provider');
      return;
    }
    if (action === 'workbench') {
      dispatch(setHaulRoleMode('provider'));
      Taro.switchTab({ url: '/pages/home/index' })
        .then(() => syncCustomTabBar(0))
        .catch(() => null);
      return;
    }
    if (action === 'verification') {
      safeNavigateTo('/pages/verification/index');
      return;
    }
    if (action === 'drones') {
      safeNavigateTo('/pages/profile/drones/index');
      return;
    }
    if (action === 'executor') {
      safeNavigateTo('/pages/pilot/register/index');
      return;
    }
    safeNavigateTo('/pages/profile/owner/index');
  };

  const openAccountProfile = () => {
    Taro.switchTab({ url: '/pages/profile/index' })
      .then(() => syncCustomTabBar(3))
      .catch(() => null);
  };
  const openExecutorRegister = () => safeNavigateTo('/pages/pilot/register/index');
  const { hero, steps, completedCount } = timelineState;

  return (
    <View className="provider-onboarding-page">
      <View className="provider-onboarding-scroll">
        <View className="provider-onboarding-content">
          <View className="provider-onboarding-hero">
            <View className="provider-onboarding-hero-top">
              <Text className="provider-onboarding-progress-label">入驻进度 {completedCount} / 3</Text>
              <View className={`provider-onboarding-status provider-onboarding-status-${hero.tone}`}>
                <Text className="provider-onboarding-status-text">{hero.label}</Text>
              </View>
            </View>
            <View className="provider-onboarding-progressbar">
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  className={`provider-onboarding-progress-segment${index < completedCount ? ' provider-onboarding-progress-segment-active' : ''}`}
                />
              ))}
            </View>
            <Text className="provider-onboarding-title">{hero.title}</Text>
            <Text className="provider-onboarding-desc">{hero.desc}</Text>
            <View className="provider-onboarding-actions">
              <View className="provider-onboarding-primary" onClick={() => runAction(hero.action)}>
                <Text className="provider-onboarding-primary-text">{hero.primaryCtaText}</Text>
              </View>
              {hero.showSecondary && (
                <View className="provider-onboarding-secondary" onClick={openAccountProfile}>
                  <Text className="provider-onboarding-secondary-text">查看账号资料</Text>
                </View>
              )}
            </View>
          </View>

          {reviewFixItems.length ? (
            <View className="provider-onboarding-card provider-onboarding-fix-card">
              <Text className="provider-onboarding-fix-title">服务商资质待修复</Text>
              <Text className="provider-onboarding-fix-desc">按下列项目修改后，重新提交审核即可继续入驻。</Text>
              {reviewFixItems.map((item) => (
                <View
                  key={`${item.key}-${item.url}`}
                  className="provider-onboarding-fix-row"
                  onClick={() => safeNavigateTo(item.url)}
                >
                  <View className="provider-onboarding-fix-main">
                    <Text className="provider-onboarding-fix-name">{item.title}</Text>
                    <Text className="provider-onboarding-fix-reason">{item.reason}</Text>
                  </View>
                  <Text className="provider-onboarding-fix-action">去修改 →</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className="provider-onboarding-card provider-onboarding-timeline">
            {steps.map((step, index) => (
              <View
                key={step.title}
                className={`provider-onboarding-timeline-row${step.interactive ? ' provider-onboarding-timeline-row-active' : ''}`}
                onClick={step.interactive ? () => runAction(hero.action) : undefined}
              >
                <View className="provider-onboarding-timeline-rail">
                  <View className={`provider-onboarding-timeline-icon provider-onboarding-timeline-icon-${step.icon}`}>
                    {step.icon === 'done' && <Text className="provider-onboarding-timeline-icon-text">✓</Text>}
                    {step.icon === 'fix' && <Text className="provider-onboarding-timeline-icon-text">!</Text>}
                    {step.icon === 'current' && <View className="provider-onboarding-timeline-icon-dot" />}
                    {step.icon === 'review' && <View className="provider-onboarding-timeline-icon-dot" />}
                  </View>
                  {index < steps.length - 1 && <View className="provider-onboarding-timeline-line" />}
                </View>
                <View className="provider-onboarding-timeline-main">
                  <Text className="provider-onboarding-timeline-title">{step.title}</Text>
                  <Text className="provider-onboarding-timeline-desc">{step.desc}</Text>
                </View>
                <View className="provider-onboarding-timeline-state">
                  <Text className={`provider-onboarding-timeline-status provider-onboarding-timeline-status-${step.tone}`}>
                    {step.status}
                  </Text>
                  {step.interactive && <Text className="provider-onboarding-timeline-chevron">›</Text>}
                </View>
              </View>
            ))}
          </View>

          <View className="provider-onboarding-more">
            <View className="provider-onboarding-more-row" onClick={() => safeNavigateTo('/pages/profile/drones/index')}>
              <Text className="provider-onboarding-more-text">设备资质资料</Text>
              <Text className="provider-onboarding-more-chevron">›</Text>
            </View>
            <View className="provider-onboarding-more-row" onClick={openExecutorRegister}>
              <Text className="provider-onboarding-more-text">履约资质资料</Text>
              <Text className="provider-onboarding-more-chevron">›</Text>
            </View>
            <View className="provider-onboarding-more-row" onClick={openAccountProfile}>
              <Text className="provider-onboarding-more-text">账号资料</Text>
              <Text className="provider-onboarding-more-chevron">›</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
