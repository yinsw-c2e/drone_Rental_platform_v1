import { apiV2 } from './api';
import {
  V2DispatchActionResult,
  V2OrderMonitor,
  V2OrderDetail,
  V2ListData,
  V2OrderSummary,
  V2PageMeta,
  V2SiteSafetyCheckSummary,
  V2SiteSafetyChecklistItem,
  V2OrderTimelineResponse,
} from '../types';

export type OrderV2ListParams = {
  role?: 'client' | 'owner' | 'pilot';
  status?: string;
  page?: number;
  page_size?: number;
};

export const orderV2Service = {
  list: (params?: OrderV2ListParams) =>
    apiV2.get<V2ListData<V2OrderSummary> & { meta: V2PageMeta }>('/orders', params),

  get: (orderId: number) =>
    apiV2.get<V2OrderDetail>(`/orders/${orderId}`),

  getTimeline: (orderId: number) =>
    apiV2.get<V2OrderTimelineResponse>(`/orders/${orderId}/timeline`),

  getMonitor: (orderId: number) =>
    apiV2.get<V2OrderMonitor>(`/orders/${orderId}/monitor`),

  confirmSiteSafety: (orderId: number, payload?: { note?: string }) =>
    apiV2.post<V2OrderSummary>(`/orders/${orderId}/site-safety-check`, payload || {}),

  getLatestSiteSafetyCheck: (orderId: number) =>
    apiV2.get<V2SiteSafetyCheckSummary | null>(`/orders/${orderId}/site-safety-checks/latest`),

  submitSiteSafetyCheck: (
    orderId: number,
    payload: { checklist: V2SiteSafetyChecklistItem[]; photos: string[]; note?: string },
  ) => apiV2.post<V2SiteSafetyCheckSummary>(`/orders/${orderId}/site-safety-checks`, payload),

  providerConfirm: (orderId: number) =>
    apiV2.post<V2OrderSummary>(`/orders/${orderId}/provider-confirm`),

  providerReject: (orderId: number, reason?: string) =>
    apiV2.post<V2OrderSummary>(`/orders/${orderId}/provider-reject`, { reason }),

  cancel: (orderId: number, reason?: string) =>
    apiV2.post<V2OrderSummary>(`/orders/${orderId}/cancel`, { reason }),

  dispatch: (
    orderId: number,
    payload: { dispatch_mode: string; target_pilot_user_id?: number; reason?: string },
  ) => apiV2.post<V2DispatchActionResult>(`/orders/${orderId}/dispatch`, payload),

  startSelfFulfillment: (orderId: number) =>
    apiV2.post<V2DispatchActionResult>(`/orders/${orderId}/dispatch`, {
      dispatch_mode: 'self_execute',
      reason: '服务商开始履约',
    }),
};

export const updateExecutionStatus = async (orderId: number, status: string): Promise<void> => {
  await apiV2.post(`/orders/${orderId}/execution-status`, { status });
};

export const confirmReceipt = async (orderId: number): Promise<void> => {
  await apiV2.post(`/orders/${orderId}/confirm-receipt`);
};
