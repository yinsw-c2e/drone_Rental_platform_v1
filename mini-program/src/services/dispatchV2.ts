import { apiV2 } from './api';
import {
  V2DispatchActionResult,
  V2DispatchTaskDetail,
  V2DispatchTaskSummary,
  V2ListData,
  V2PageMeta,
} from '../types';

export type DispatchRole = 'owner' | 'pilot';

export type DispatchListParams = {
  role?: DispatchRole;
  status?: string;
  page?: number;
  page_size?: number;
};

export const dispatchV2Service = {
  list: (params?: DispatchListParams) =>
    apiV2.get<V2ListData<V2DispatchTaskSummary> & { meta: V2PageMeta }>('/dispatch-tasks', params),

  get: (dispatchId: number) =>
    apiV2.get<V2DispatchTaskDetail>(`/dispatch-tasks/${dispatchId}`),

  accept: (dispatchId: number) =>
    apiV2.post<V2DispatchTaskSummary>(`/dispatch-tasks/${dispatchId}/accept`),

  reject: (dispatchId: number, reason?: string) =>
    apiV2.post<V2DispatchTaskSummary>(`/dispatch-tasks/${dispatchId}/reject`, { reason }),

  reassign: (dispatchId: number, payload: { dispatch_mode: string; target_pilot_user_id?: number; reason?: string }) =>
    apiV2.post<V2DispatchActionResult>(`/dispatch-tasks/${dispatchId}/reassign`, payload),
};
