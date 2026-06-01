export const WECHAT_SUBSCRIBE_TEMPLATES = {
  directOrderCreated: '',
  directOrderConfirmed: '',
  demandQuoteSubmitted: '',
  demandSelected: '',
  demandCancelled: '',
  orderPaid: '',
  orderCancelled: '',
  orderInTransit: '',
  orderDelivered: '',
  orderCompleted: '',
  settlementSettled: '',
  broadcastAutoAssigned: '',
  broadcastAutoAssignExhausted: '',
  dispatchCreated: '',
  pilotVerificationResult: '',
} as const;

const compactTemplateIds = (ids: string[]) =>
  Array.from(new Set(ids.map(id => String(id || '').trim()).filter(Boolean)));

export const CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES = compactTemplateIds([
  WECHAT_SUBSCRIBE_TEMPLATES.directOrderConfirmed,
  WECHAT_SUBSCRIBE_TEMPLATES.demandQuoteSubmitted,
  WECHAT_SUBSCRIBE_TEMPLATES.broadcastAutoAssignExhausted,
  WECHAT_SUBSCRIBE_TEMPLATES.orderInTransit,
  WECHAT_SUBSCRIBE_TEMPLATES.orderDelivered,
  WECHAT_SUBSCRIBE_TEMPLATES.broadcastAutoAssigned,
]);

export const PROVIDER_WORKBENCH_SUBSCRIBE_TEMPLATES = compactTemplateIds([
  WECHAT_SUBSCRIBE_TEMPLATES.directOrderCreated,
  WECHAT_SUBSCRIBE_TEMPLATES.demandSelected,
  WECHAT_SUBSCRIBE_TEMPLATES.demandCancelled,
  WECHAT_SUBSCRIBE_TEMPLATES.orderCancelled,
  WECHAT_SUBSCRIBE_TEMPLATES.orderPaid,
  WECHAT_SUBSCRIBE_TEMPLATES.orderCompleted,
  WECHAT_SUBSCRIBE_TEMPLATES.settlementSettled,
  WECHAT_SUBSCRIBE_TEMPLATES.broadcastAutoAssigned,
  WECHAT_SUBSCRIBE_TEMPLATES.dispatchCreated,
]);

export const PILOT_VERIFICATION_SUBSCRIBE_TEMPLATES = compactTemplateIds([
  WECHAT_SUBSCRIBE_TEMPLATES.pilotVerificationResult,
]);

export const COMMON_PLATFORM_SUBSCRIBE_TEMPLATES = compactTemplateIds([
  ...CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES,
  ...PROVIDER_WORKBENCH_SUBSCRIBE_TEMPLATES,
  ...PILOT_VERIFICATION_SUBSCRIBE_TEMPLATES,
]);
