import type { ProviderNextAction, ProviderReviewState, ProviderReviewStatus, ProviderRoleSummary, RoleSummary, User } from '../types';
import type { HaulRoleMode } from '../store/slices/roleSlice';

export interface ProviderCapabilities {
  hasProviderRole: boolean;
  hasProviderApplication: boolean;
  hasAssetProviderRole: boolean;
  hasExecutorRole: boolean;
  providerStatus: ProviderReviewStatus;
  assetStatus: ProviderReviewStatus;
  executorStatus: ProviderReviewStatus;
  rejectReason: string;
  assetReviewState: ProviderReviewState;
  assetRejectReason: string;
  executorReviewState: ProviderReviewState;
  executorRejectReason: string;
  canPublishSupply: boolean;
  canAcceptDispatch: boolean;
  canSelfExecute: boolean;
  canUseWorkbench: boolean;
  canArrangeDispatch: boolean;
  canManageAssets: boolean;
  needsProviderOnboarding: boolean;
  nextAction: ProviderNextAction;
}

const EMPTY_PROVIDER_SUMMARY: ProviderRoleSummary = {
  status: 'none',
  asset_status: 'none',
  executor_status: 'none',
  reject_reason: '',
  asset_review_state: 'none',
  asset_reject_reason: '',
  executor_review_state: 'none',
  executor_reject_reason: '',
  can_use_workbench: false,
  can_quote: false,
  can_arrange_dispatch: false,
  can_accept_dispatch: false,
  can_self_execute: false,
  next_action: 'start_onboarding',
};

export const EMPTY_ROLE_SUMMARY: RoleSummary = {
  has_client_role: true,
  has_owner_role: false,
  has_pilot_role: false,
  can_publish_supply: false,
  can_accept_dispatch: false,
  can_self_execute: false,
  provider: EMPTY_PROVIDER_SUMMARY,
};

export const buildFallbackRoleSummary = (): RoleSummary => EMPTY_ROLE_SUMMARY;

const combineStatus = (assetStatus: ProviderReviewStatus, executorStatus: ProviderReviewStatus): ProviderReviewStatus => {
  if (assetStatus === 'suspended' || executorStatus === 'suspended') return 'suspended';
  if (assetStatus === 'rejected' || executorStatus === 'rejected') return 'rejected';
  if (assetStatus === 'approved' && executorStatus === 'approved') return 'approved';
  if (assetStatus === 'pending_review' || executorStatus === 'pending_review') return 'pending_review';
  if (assetStatus === 'approved' || executorStatus === 'approved') return 'pending_review';
  return 'none';
};

const nextActionOf = (status: ProviderReviewStatus): ProviderNextAction => {
  if (status === 'approved') return 'open_workbench';
  if (status === 'pending_review') return 'wait_review';
  if (status === 'rejected' || status === 'suspended') return 'fix_rejected';
  return 'start_onboarding';
};

const reviewStateOf = (status?: ProviderReviewStatus): ProviderReviewState => {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'suspended') return 'rejected';
  if (status === 'pending_review') return 'pending';
  return 'none';
};

const deriveProviderSummary = (summary: RoleSummary): ProviderRoleSummary => {
  const assetStatus: ProviderReviewStatus = summary.can_publish_supply
    ? 'approved'
    : summary.has_owner_role
      ? 'pending_review'
      : 'none';
  const executorStatus: ProviderReviewStatus = summary.can_self_execute || summary.can_accept_dispatch
    ? 'approved'
    : summary.has_pilot_role
      ? 'pending_review'
      : 'none';
  const status = combineStatus(assetStatus, executorStatus);
  const unifiedReady = assetStatus === 'approved' && executorStatus === 'approved';

  return {
    status,
    asset_status: assetStatus,
    executor_status: executorStatus,
    reject_reason: '',
    asset_review_state: reviewStateOf(assetStatus),
    asset_reject_reason: '',
    executor_review_state: reviewStateOf(executorStatus),
    executor_reject_reason: '',
    can_use_workbench: unifiedReady,
    can_quote: unifiedReady,
    can_arrange_dispatch: unifiedReady,
    can_accept_dispatch: unifiedReady && Boolean(summary.can_accept_dispatch),
    can_self_execute: unifiedReady,
    next_action: unifiedReady ? 'open_workbench' : nextActionOf(status),
  };
};

const withProviderSummary = (summary: RoleSummary): RoleSummary => ({
  ...summary,
  provider: summary.provider || deriveProviderSummary(summary),
});

export const getEffectiveRoleSummary = (roleSummary?: RoleSummary | null, _user?: User | null): RoleSummary =>
  withProviderSummary(roleSummary || buildFallbackRoleSummary());

export const resolveProviderCapabilities = (roleSummary?: RoleSummary | null): ProviderCapabilities => {
  const summary = getEffectiveRoleSummary(roleSummary);
  const provider = summary.provider || EMPTY_PROVIDER_SUMMARY;
  const canPublishSupply = Boolean(provider.can_quote);
  const canAcceptDispatch = Boolean(provider.can_accept_dispatch);
  const canSelfExecute = Boolean(provider.can_self_execute);
  const canUseWorkbench = Boolean(provider.can_use_workbench);
  const hasAssetProviderRole = provider.asset_status === 'approved';
  const hasExecutorRole = provider.executor_status === 'approved';
  const hasProviderApplication = provider.status !== 'none';

  return {
    hasProviderRole: canUseWorkbench,
    hasProviderApplication,
    hasAssetProviderRole,
    hasExecutorRole,
    providerStatus: provider.status,
    assetStatus: provider.asset_status,
    executorStatus: provider.executor_status,
    rejectReason: provider.reject_reason || '',
    assetReviewState: provider.asset_review_state || reviewStateOf(provider.asset_status),
    assetRejectReason: provider.asset_reject_reason || '',
    executorReviewState: provider.executor_review_state || reviewStateOf(provider.executor_status),
    executorRejectReason: provider.executor_reject_reason || '',
    canPublishSupply,
    canAcceptDispatch,
    canSelfExecute,
    canUseWorkbench,
    canArrangeDispatch: Boolean(provider.can_arrange_dispatch),
    canManageAssets: Boolean(summary.has_owner_role || provider.asset_status !== 'none' || canPublishSupply),
    needsProviderOnboarding: !canUseWorkbench,
    nextAction: provider.next_action,
  };
};

export const canUseProviderWorkbench = (roleSummary?: RoleSummary | null) =>
  resolveProviderCapabilities(roleSummary).canUseWorkbench;

export const canEnterMode = (mode: HaulRoleMode, roleSummary?: RoleSummary | null) => {
  const summary = getEffectiveRoleSummary(roleSummary);
  if (mode === 'customer') {
    return Boolean(summary.has_client_role);
  }
  const provider = summary.provider || EMPTY_PROVIDER_SUMMARY;
  return Boolean(
    summary.has_client_role ||
    summary.has_owner_role ||
    summary.has_pilot_role ||
    provider.status !== 'none'
  );
};

export const getRoleLabels = (roleSummary?: RoleSummary | null, user?: User | null): string[] => {
  const summary = getEffectiveRoleSummary(roleSummary, user);
  const labels: string[] = [];
  if (summary.has_client_role) {
    labels.push('客户');
  }
  if (resolveProviderCapabilities(summary).hasProviderApplication) {
    labels.push('服务商');
  }
  return labels;
};

export const getRoleDisplayText = (roleSummary?: RoleSummary | null, user?: User | null) => {
  const labels = getRoleLabels(roleSummary, user);
  if (!labels.length) {
    return '未识别身份';
  }
  return labels.join(' / ');
};
