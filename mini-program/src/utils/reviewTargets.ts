import type { OrderPartySummary, V2OrderDetail } from '../types';

export type ReviewTargetRole = 'client' | 'owner' | 'pilot';

export type ReviewTarget = {
  userId: number;
  role: ReviewTargetRole;
  label: string;
  subtitle: string;
};

type MergeableReviewTarget = ReviewTarget & {
  name: string;
  roleLabels: string[];
};

const roleRank: Record<ReviewTargetRole, number> = {
  owner: 0,
  pilot: 1,
  client: 2,
};

export const reviewTargetKeyOf = (target: ReviewTarget) => `${target.role}:${target.userId}`;

export const buildReviewPartySummary = (
  party?: OrderPartySummary | null,
  fallbackRole = '参与方',
) => {
  if (!party) return fallbackRole;
  return party.nickname || `${fallbackRole} #${party.user_id}`;
};

const fallbackParty = (
  userId: number | null | undefined,
  role: ReviewTargetRole,
): OrderPartySummary | null => {
  const id = Number(userId || 0);
  return id > 0 ? { user_id: id, role } : null;
};

const preferredRoleOf = (current: ReviewTargetRole, incoming: ReviewTargetRole) =>
  roleRank[incoming] < roleRank[current] ? incoming : current;

const titleForRoles = (roleLabels: string[]) =>
  roleLabels.includes('承接方') && roleLabels.includes('履约方')
    ? '服务商'
    : roleLabels[0] || '参与方';

export const buildReviewTargets = (
  detail: V2OrderDetail | null,
  currentUserId: number,
): ReviewTarget[] => {
  if (!detail || !currentUserId) return [];

  const participants = detail.participants || {};
  const client = participants.client || detail.client || fallbackParty(detail.contract?.client_user_id, 'client');
  const provider = participants.provider || detail.provider || fallbackParty(detail.provider_user_id, 'owner');
  const executor = participants.executor || detail.executor || fallbackParty(detail.executor_pilot_user_id, 'pilot');
  const byUser = new Map<number, MergeableReviewTarget>();

  const pushTarget = (
    party: OrderPartySummary | null | undefined,
    role: ReviewTargetRole,
    label: string,
  ) => {
    if (!party?.user_id || party.user_id === currentUserId) return;

    const existing = byUser.get(party.user_id);
    if (!existing) {
      byUser.set(party.user_id, {
        userId: party.user_id,
        role,
        label,
        name: buildReviewPartySummary(party, label),
        roleLabels: [label],
        subtitle: buildReviewPartySummary(party, label),
      });
      return;
    }

    if (!existing.roleLabels.includes(label)) {
      existing.roleLabels.push(label);
    }
    existing.role = preferredRoleOf(existing.role, role);
    existing.label = titleForRoles(existing.roleLabels);
    existing.subtitle = `${existing.name} · ${existing.roleLabels.join(' / ')}`;
  };

  pushTarget(client, 'client', '客户');
  pushTarget(provider, 'owner', '承接方');
  pushTarget(executor, 'pilot', '履约方');

  return Array.from(byUser.values()).map(({ name: _name, roleLabels: _roleLabels, ...target }) => target);
};
