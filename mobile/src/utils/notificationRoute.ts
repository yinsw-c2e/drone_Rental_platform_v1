export type NotificationRoute = {
  name: string;
  params?: Record<string, unknown>;
};

export type NotificationRoutingContext = {
  canUseProviderWorkbench?: boolean;
  canManageProviderBindings?: boolean;
  hasExecutorCapability?: boolean;
  hasProviderApplication?: boolean;
};

const normalizeObject = (value: Record<string, unknown>) =>
  Object.entries(value).reduce<Record<string, unknown>>((acc, [key, item]) => {
    if (item !== undefined && item !== null) {
      acc[key] = item;
    }
    return acc;
  }, {});

export const normalizeNotificationExtras = (raw: unknown): Record<string, unknown> => {
  if (!raw) {
    return {};
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? normalizeObject(parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeObject(raw as Record<string, unknown>);
  }
  return {};
};

const textOf = (value: unknown) => String(value || '').trim();

const numberOf = (...values: unknown[]) => {
  for (const value of values) {
    const nextValue = Number(value || 0);
    if (Number.isFinite(nextValue) && nextValue > 0) {
      return nextValue;
    }
  }
  return 0;
};

const includesAny = (text: string, candidates: string[]) =>
  candidates.some(candidate => text.includes(candidate));

export const resolveNotificationRoute = (
  rawExtras: unknown,
  context: NotificationRoutingContext = {},
): NotificationRoute | null => {
  const extras = normalizeNotificationExtras(rawExtras);
  const businessType = textOf(extras.business_type).toLowerCase();
  const eventType = textOf(extras.event_type).toLowerCase();
  const nextAction = textOf(extras.next_action).toLowerCase();
  const orderId = numberOf(extras.order_id, extras.id);
  const dispatchTaskId = numberOf(extras.dispatch_task_id, extras.dispatch_id, extras.task_id);
  const demandId = numberOf(extras.demand_id);
  const bindingId = numberOf(extras.binding_id);
  const isSettlement =
    businessType === 'settlement' ||
    nextAction === 'wallet' ||
    includesAny(eventType, ['settlement', 'withdrawal']);

  if (isSettlement) {
    return {name: 'Wallet'};
  }

  if (nextAction === 'payment' && orderId) {
    return {name: 'Payment', params: {orderId, id: orderId}};
  }

  if (nextAction === 'after_sale' && orderId) {
    return {name: 'OrderAfterSale', params: {orderId, id: orderId}};
  }

  if (nextAction === 'review' && orderId) {
    return {name: 'Review', params: {orderId, id: orderId}};
  }

  const preferOrderView =
    !context.canUseProviderWorkbench && !context.hasExecutorCapability;

  if (orderId && (preferOrderView || !dispatchTaskId)) {
    return {name: 'OrderDetail', params: {orderId, id: orderId}};
  }

  if (dispatchTaskId) {
    return {
      name: 'DispatchTaskDetail',
      params: {dispatchId: dispatchTaskId, id: dispatchTaskId},
    };
  }

  if (orderId) {
    return {name: 'OrderDetail', params: {orderId, id: orderId}};
  }

  if (demandId) {
    return {name: 'DemandDetail', params: {demandId, id: demandId}};
  }

  if (bindingId) {
    if (context.canManageProviderBindings) {
      return {name: 'OwnerPilotBindings'};
    }
    if (context.hasExecutorCapability) {
      return {name: 'PilotOwnerBindings'};
    }
  }

  const isQualification =
    businessType === 'qualification' ||
    includesAny(eventType, ['qualification', 'verification']);

  if (isQualification) {
    if (
      context.hasExecutorCapability ||
      includesAny(eventType, ['pilot_verification', 'pilot'])
    ) {
      return {name: 'PilotProfile'};
    }
    if (context.canUseProviderWorkbench) {
      return {name: 'OwnerProfile'};
    }
    if (context.hasProviderApplication) {
      return {name: 'ProviderOnboarding'};
    }
    return {name: 'PilotRegister'};
  }

  return {name: 'MainTabs', params: {screen: 'Messages'}};
};

export const isNotificationOpenEvent = (eventType?: string) => {
  const value = textOf(eventType).toLowerCase();
  return includesAny(value, ['open', 'click', 'tap']);
};
