import {apiV2} from './api';
import {
  V2ApiResponse,
  V2DispatchActionResult,
  V2DispatchTaskSummary,
  V2OrderMonitor,
  V2OrderDetail,
  V2ListData,
  V2OrderSummary,
  V2PageMeta,
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

  getMonitor: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2OrderMonitor>>(`/orders/${orderId}/monitor`),

  providerConfirm: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/provider-confirm`),

  providerReject: (orderId: number, reason?: string) =>
    apiV2.post<any, V2ApiResponse<V2OrderSummary>>(`/orders/${orderId}/provider-reject`, {reason}),

  dispatch: (
    orderId: number,
    payload: {dispatch_mode: string; target_pilot_user_id?: number; reason?: string},
  ) => apiV2.post<any, V2ApiResponse<V2DispatchActionResult>>(`/orders/${orderId}/dispatch`, payload),
};
