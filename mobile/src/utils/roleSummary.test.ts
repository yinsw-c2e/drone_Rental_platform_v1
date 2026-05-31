import {
  canUseProviderWorkbench,
  resolveProviderCapabilities,
} from './roleSummary';
import type {RoleSummary} from '../types';

const customerOnly: RoleSummary = {
  has_client_role: true,
  has_owner_role: false,
  has_pilot_role: false,
  can_publish_supply: false,
  can_accept_dispatch: false,
  can_self_execute: false,
  provider: {
    status: 'none',
    asset_status: 'none',
    executor_status: 'none',
    can_use_workbench: false,
    can_quote: false,
    can_arrange_dispatch: false,
    can_accept_dispatch: false,
    can_self_execute: false,
    next_action: 'start_onboarding',
  },
};

const providerPendingReview: RoleSummary = {
  has_client_role: true,
  has_owner_role: true,
  has_pilot_role: false,
  can_publish_supply: false,
  can_accept_dispatch: false,
  can_self_execute: false,
  provider: {
    status: 'pending_review',
    asset_status: 'pending_review',
    executor_status: 'none',
    can_use_workbench: false,
    can_quote: false,
    can_arrange_dispatch: false,
    can_accept_dispatch: false,
    can_self_execute: false,
    next_action: 'wait_review',
  },
};

const providerApproved: RoleSummary = {
  has_client_role: true,
  has_owner_role: true,
  has_pilot_role: true,
  can_publish_supply: true,
  can_accept_dispatch: true,
  can_self_execute: true,
  provider: {
    status: 'approved',
    asset_status: 'approved',
    executor_status: 'approved',
    can_use_workbench: true,
    can_quote: true,
    can_arrange_dispatch: true,
    can_accept_dispatch: true,
    can_self_execute: true,
    next_action: 'open_workbench',
  },
};

describe('roleSummary provider gates', () => {
  it('keeps customer-only accounts out of the provider workbench', () => {
    const capabilities = resolveProviderCapabilities(customerOnly);

    expect(capabilities.canUseWorkbench).toBe(false);
    expect(capabilities.providerStatus).toBe('none');
    expect(capabilities.nextAction).toBe('start_onboarding');
    expect(canUseProviderWorkbench(customerOnly)).toBe(false);
  });

  it('shows pending review provider accounts as onboarding-only', () => {
    const capabilities = resolveProviderCapabilities(providerPendingReview);

    expect(capabilities.canUseWorkbench).toBe(false);
    expect(capabilities.providerStatus).toBe('pending_review');
    expect(capabilities.assetStatus).toBe('pending_review');
    expect(capabilities.nextAction).toBe('wait_review');
  });

  it('allows approved provider accounts into the workbench', () => {
    const capabilities = resolveProviderCapabilities(providerApproved);

    expect(capabilities.canUseWorkbench).toBe(true);
    expect(capabilities.canPublishSupply).toBe(true);
    expect(capabilities.canAcceptDispatch).toBe(true);
    expect(capabilities.canSelfExecute).toBe(true);
    expect(capabilities.nextAction).toBe('open_workbench');
  });
});
