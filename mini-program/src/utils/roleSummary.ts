import type { ProviderNextAction, ProviderReviewStatus, ProviderRoleSummary, RoleSummary, User } from '../types';
import type { HaulRoleMode } from '../store/slices/roleSlice';

export interface ProviderCapabilities {
  hasProviderRole: boolean;
  hasProviderApplication: boolean;
  hasAssetProviderRole: boolean;
  hasExecutorRole: boolean;
  providerStatus: ProviderReviewStatus;
  assetStatus: ProviderReviewStatus;
  executorStatus: ProviderReviewStatus;
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
  if (assetStatus === 'approved' || executorStatus === 'approved') return 'approved';
  if (assetStatus === 'suspended' || executorStatus === 'suspended') return 'suspended';
  if (assetStatus === 'pending_review' || executorStatus === 'pending_review') return 'pending_review';
  if (assetStatus === 'rejected' || executorStatus === 'rejected') return 'rejected';
  return 'none';
};

const nextActionOf = (status: ProviderReviewStatus): ProviderNextAction => {
  if (status === 'approved') return 'open_workbench';
  if (status === 'pending_review') return 'wait_review';
  if (status === 'rejected' || status === 'suspended') return 'fix_rejected';
  return 'start_onboarding';
};

const deriveProviderSummary = (summary: RoleSummary): ProviderRoleSummary => {
  const assetStatus: ProviderReviewStatus = summary.can_publish_supply
    ? 'approved'
    : summary.has_owner_role
      ? 'pending_review'
      : 'none';
  const executorStatus: ProviderReviewStatus = summary.can_accept_dispatch
    ? 'approved'
    : summary.has_pilot_role
      ? 'pending_review'
      : 'none';
  const status = combineStatus(assetStatus, executorStatus);
  const canUseWorkbench = Boolean(summary.can_publish_supply || summary.can_accept_dispatch || summary.can_self_execute);

  return {
    status,
    asset_status: assetStatus,
    executor_status: executorStatus,
    can_use_workbench: canUseWorkbench,
    can_quote: Boolean(summary.can_publish_supply),
    can_arrange_dispatch: Boolean(summary.can_publish_supply),
    can_accept_dispatch: Boolean(summary.can_accept_dispatch),
    can_self_execute: Boolean(summary.can_self_execute),
    next_action: canUseWorkbench ? 'open_workbench' : nextActionOf(status),
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
