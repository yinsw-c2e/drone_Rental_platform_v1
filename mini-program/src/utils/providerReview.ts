import type { ProviderCapabilities } from './roleSummary';

export type ProviderReviewFixTarget = 'profile' | 'asset' | 'executor';

export type ProviderReviewFixItem = {
  key: ProviderReviewFixTarget;
  title: string;
  reason: string;
  url: string;
};

const isRejectedState = (state?: string, status?: string) =>
  state === 'rejected' || status === 'rejected' || status === 'suspended';

export const buildProviderReviewFixItems = (capabilities: ProviderCapabilities): ProviderReviewFixItem[] => {
  const items: ProviderReviewFixItem[] = [];
  const profileReason = capabilities.rejectReason.trim();
  const assetReason = capabilities.assetRejectReason.trim();
  const executorReason = capabilities.executorRejectReason.trim();

  if (profileReason && !assetReason && !executorReason) {
    items.push({
      key: 'profile',
      title: '服务商资料',
      reason: profileReason,
      url: '/pages/profile/owner/index',
    });
  }

  if (isRejectedState(capabilities.assetReviewState, capabilities.assetStatus)) {
    const reason = assetReason || '设备资质未通过，请重新上传资料';
    const looksLikeProfileIssue = reason.includes('服务商资料') || reason.includes('服务商档案');
    items.push({
      key: looksLikeProfileIssue ? 'profile' : 'asset',
      title: looksLikeProfileIssue ? '服务商资料' : '设备资质',
      reason,
      url: looksLikeProfileIssue ? '/pages/profile/owner/index' : '/pages/profile/drones/index',
    });
  }

  if (isRejectedState(capabilities.executorReviewState, capabilities.executorStatus)) {
    items.push({
      key: 'executor',
      title: '履约资质',
      reason: executorReason || '履约资质未通过，请重新提交履约资料',
      url: '/pages/pilot/register/index',
    });
  }

  if (profileReason && items.every(item => item.key !== 'profile')) {
    items.unshift({
      key: 'profile',
      title: '服务商资料',
      reason: profileReason,
      url: '/pages/profile/owner/index',
    });
  }

  return items;
};

