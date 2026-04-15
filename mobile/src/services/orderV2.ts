import {apiV2} from './api';
import {
  V2ApiResponse,
  V2DispatchActionResult,
  V2OrderMonitor,
  V2OrderDetail,
  V2ListData,
  V2OrderSummary,
  V2PageMeta,
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
    apiV2.get<any, V2ApiResponse<V2ListData<V2OrderSummary>, V2PageMeta>>('/orders', {params}),

  get: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderDetail>>(`/orders/${orderId}`),

  getTimeline: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderTimelineResponse>>(`/orders/${orderId}/timeline`),

  getMonitor: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderMonitor>>(`/orders/${orderId}/monitor`),

  providerConfirm: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/provider-confirm`),

  providerReject: (orderId: number, reason?: string) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/provider-reject`, {reason}),

  cancel: (orderId: number, reason?: string) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/cancel`, {reason}),

  dispatch: (
    orderId: number,
    payload: {dispatch_mode: string; target_pilot_user_id?: number; reason?: string},
  ) => apiV2.post<any, V2ApiResponse<V2DispatchActionResult>>(`/orders/${orderId}/dispatch`, payload),
};

export const updateExecutionStatus = async (orderId: number, status: string): Promise<void> => {
  await apiV2.post(`/orders/${orderId}/execution-status`, {status});
};

export const confirmReceipt = async (orderId: number): Promise<void> => {
  await apiV2.post(`/orders/${orderId}/confirm-receipt`);
};
