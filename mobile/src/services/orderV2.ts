import {apiV2} from './api';
import {
  V2ApiResponse,
  V2DispatchActionResult,
  V2OrderMonitor,
  V2OrderDetail,
  V2OrderLive,
  V2EstimateOrderPayload,
  V2ListData,
  V2OrderSummary,
  V2PageMeta,
  V2PlatformOrderResult,
  V2PricingEstimate,
  V2ServiceClass,
  V2SiteSafetyCheckSummary,
  V2SiteSafetyChecklistItem,
  V2OrderTimelineResponse,
} from '../types';

export type OrderV2ListParams = {
  role?: 'client' | 'owner' | 'pilot' | 'provider';
  status?: string;
  page?: number;
  page_size?: number;
};

export type RedispatchOrderPayload = {
  price_bump_percent?: number;
  price_bump_yuan?: number;
  radius_bump_km?: number;
};

export const orderV2Service = {
  listServiceClasses: () =>
    apiV2.get<any, V2ApiResponse<V2ServiceClass[]>>('/service-classes'),

  estimate: (payload: V2EstimateOrderPayload) =>
    apiV2.post<any, V2ApiResponse<V2PricingEstimate>>('/orders/estimate', payload),

  createInstant: (payload: V2EstimateOrderPayload) =>
    apiV2.post<any, V2ApiResponse<V2PlatformOrderResult>>('/orders/instant', payload),

  createReservation: (payload: V2EstimateOrderPayload) =>
    apiV2.post<any, V2ApiResponse<V2PlatformOrderResult>>('/orders/reservation', payload),

  list: (params?: OrderV2ListParams) =>
    apiV2.get<any, V2ApiResponse<V2ListData<V2OrderSummary>, V2PageMeta>>('/orders', {params}),

  get: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderDetail>>(`/orders/${orderId}`),

  getTimeline: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderTimelineResponse>>(`/orders/${orderId}/timeline`),

  getMonitor: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderMonitor>>(`/orders/${orderId}/monitor`),

  getLive: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderLive>>(`/orders/${orderId}/live`),

  confirmSiteSafety: (orderId: number, payload?: {note?: string}) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(
      `/orders/${orderId}/site-safety-check`,
      payload || {},
    ),

  getLatestSiteSafetyCheck: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2SiteSafetyCheckSummary | null>>(
      `/orders/${orderId}/site-safety-checks/latest`,
    ),

  submitSiteSafetyCheck: (
    orderId: number,
    payload: {checklist: V2SiteSafetyChecklistItem[]; photos: string[]; note?: string},
  ) =>
    apiV2.post<any, V2ApiResponse<V2SiteSafetyCheckSummary>>(
      `/orders/${orderId}/site-safety-checks`,
      payload,
    ),

  providerConfirm: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/provider-confirm`),

  providerReject: (orderId: number, reason?: string) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/provider-reject`, {reason}),

  cancel: (orderId: number, reason?: string) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/cancel`, {reason}),

  redispatch: (orderId: number, payload: RedispatchOrderPayload) =>
    apiV2.post<any, V2ApiResponse<{order: V2OrderSummary}>>(
      `/customer/orders/${orderId}/redispatch`,
      payload,
    ),

  addTip: (orderId: number, amount: number) =>
    apiV2.post<any, V2ApiResponse<any>>(`/orders/${orderId}/tip`, {
      amount,
      payment_method: 'mock',
    }),

  priceIncrease: (
    orderId: number,
    payload: {amount: number; reason?: string; method?: string; payment_method?: string},
  ) =>
    apiV2.post<any, V2ApiResponse<any>>(`/orders/${orderId}/price-increase`, {
      ...payload,
      payment_method: payload.payment_method || 'mock',
    }),

  increasePrice: (
    orderId: number,
    payload: {amount: number; reason?: string; method?: string; payment_method?: string},
  ) =>
    apiV2.post<any, V2ApiResponse<any>>(`/orders/${orderId}/price-increase`, {
      ...payload,
      payment_method: payload.payment_method || 'mock',
    }),

  dispatch: (
    orderId: number,
    payload: {dispatch_mode: string; target_pilot_user_id?: number; reason?: string},
  ) => apiV2.post<any, V2ApiResponse<V2DispatchActionResult>>(`/orders/${orderId}/dispatch`, payload),

  startSelfFulfillment: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2DispatchActionResult>>(`/orders/${orderId}/dispatch`, {
      dispatch_mode: 'self_execute',
      reason: '服务商开始履约',
    }),

  startPreparing: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/start-preparing`, {}),

  startFlight: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/start-flight`, {}),

  confirmDelivery: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/confirm-delivery`, {}),
};

export const updateExecutionStatus = async (orderId: number, status: string): Promise<void> => {
  await apiV2.post(`/orders/${orderId}/execution-status`, {status});
};

export const confirmReceipt = async (orderId: number): Promise<void> => {
  await apiV2.post(`/orders/${orderId}/confirm-receipt`);
};
