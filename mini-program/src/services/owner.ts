import {
  OwnerProfile,
  OwnerPilotBindingSummary,
  OwnerWorkbenchView,
  SupplyDetail,
  DemandQuoteSummary,
  SupplySummary,
  V2ListData,
  V2PageMeta,
} from '../types';
import { apiV2 } from './api';

export type OwnerListParams = {
  page?: number;
  page_size?: number;
  status?: string;
};

export type OwnerSupplyPayload = {
  drone_id: number;
  title: string;
  description?: string;
  service_types?: string[];
  cargo_scenes: string[];
  service_area_snapshot?: any;
  base_price_amount: number;
  pricing_unit: string;
  pricing_rule?: any;
  available_time_slots?: any;
  accepts_direct_order?: boolean;
  status?: string;
};

export const ownerService = {
  getProfile: () =>
    apiV2.get<OwnerProfile>('/owner/profile'),

  getWorkbench: () =>
    apiV2.get<OwnerWorkbenchView>('/owner/workbench'),

  updateProfile: (payload: { service_city?: string; contact_phone?: string; intro?: string }) =>
    apiV2.put<OwnerProfile>('/owner/profile', payload),

  listMySupplies: (params?: OwnerListParams) =>
    apiV2.get<V2ListData<SupplySummary> & { meta: V2PageMeta }>('/owner/supplies', params),

  getMySupplyById: (supplyId: number) =>
    apiV2.get<SupplyDetail>(`/owner/supplies/${supplyId}`),

  createSupply: (payload: OwnerSupplyPayload) =>
    apiV2.post<SupplyDetail>('/owner/supplies', payload),

  updateSupply: (supplyId: number, payload: OwnerSupplyPayload) =>
    apiV2.put<SupplyDetail>(`/owner/supplies/${supplyId}`, payload),

  listMyQuotes: (params?: OwnerListParams) =>
    apiV2.get<V2ListData<DemandQuoteSummary> & { meta: V2PageMeta }>('/owner/quotes', params),

  listPilotBindings: (params?: OwnerListParams) =>
    apiV2.get<V2ListData<OwnerPilotBindingSummary> & { meta: V2PageMeta }>('/owner/pilot-bindings', params),

  invitePilotBinding: (payload: { pilot_user_id: number; is_priority?: boolean; note?: string }) =>
    apiV2.post<OwnerPilotBindingSummary>('/owner/pilot-bindings', payload),

  confirmPilotBinding: (bindingId: number) =>
    apiV2.post<OwnerPilotBindingSummary>(`/owner/pilot-bindings/${bindingId}/confirm`),

  rejectPilotBinding: (bindingId: number) =>
    apiV2.post<OwnerPilotBindingSummary>(`/owner/pilot-bindings/${bindingId}/reject`),

  updatePilotBindingStatus: (bindingId: number, status: string) =>
    apiV2.patch<OwnerPilotBindingSummary>(`/owner/pilot-bindings/${bindingId}/status`, { status }),
};
