import {RoleSummary, User} from '../types';

export const EMPTY_ROLE_SUMMARY: RoleSummary = {
  has_client_role: true,
  has_owner_role: false,
  has_pilot_role: false,
  can_publish_supply: false,
  can_accept_dispatch: false,
  can_self_execute: false,
};

export const buildFallbackRoleSummary = (): RoleSummary => EMPTY_ROLE_SUMMARY;

export const getEffectiveRoleSummary = (roleSummary?: RoleSummary | null, user?: User | null): RoleSummary =>
  roleSummary || buildFallbackRoleSummary();

export const getRoleLabels = (roleSummary?: RoleSummary | null, user?: User | null): string[] => {
  const summary = getEffectiveRoleSummary(roleSummary, user);
  const labels: string[] = [];
  if (summary.has_client_role) {
    labels.push('业主');
  }
  if (summary.has_owner_role) {
    labels.push('机主');
  }
  if (summary.has_pilot_role) {
    labels.push('飞手');
  }
  return labels;
};

export const getRoleDisplayText = (roleSummary?: RoleSummary | null, user?: User | null): string => {
  const labels = getRoleLabels(roleSummary, user);
  if (labels.length === 0) {
    return '未识别身份';
  }
  return labels.join(' / ');
};
