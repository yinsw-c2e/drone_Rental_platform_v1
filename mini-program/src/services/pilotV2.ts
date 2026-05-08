import { apiV2 } from './api';
import {
  OwnerPilotBindingSummary,
  V2PilotProfile,
  V2FlightRecordSummary,
  V2ListData,
  V2PageMeta,
} from '../types';

export type PilotFlightRecordListParams = {
  page?: number;
  page_size?: number;
  status?: string;
};

export type PilotProfilePayload = {
  caac_license_no?: string;
  caac_license_type?: string;
  caac_license_expire_date?: string;
  caac_license_image?: string;
  service_radius?: number;
  special_skills?: string[];
  current_city?: string;
};

export type PilotBindingListParams = {
  page?: number;
  page_size?: number;
  status?: string;
};

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 20;

export const pilotV2Service = {
  getProfile: () =>
    apiV2.get<V2PilotProfile>('/pilot/profile'),

  upsertProfile: (payload: PilotProfilePayload) =>
    apiV2.put<V2PilotProfile>('/pilot/profile', payload),

  updateAvailability: (availability_status: string) =>
    apiV2.patch<V2PilotProfile>('/pilot/availability', { availability_status }),

  listOwnerBindings: (params?: PilotBindingListParams) =>
    apiV2.get<V2ListData<OwnerPilotBindingSummary> & { meta: V2PageMeta }>('/pilot/owner-bindings', params),

  applyOwnerBinding: (payload: { owner_user_id: number; note?: string }) =>
    apiV2.post<OwnerPilotBindingSummary>('/pilot/owner-bindings', payload),

  confirmOwnerBinding: (bindingId: number) =>
    apiV2.post<OwnerPilotBindingSummary>(`/pilot/owner-bindings/${bindingId}/confirm`),

  rejectOwnerBinding: (bindingId: number) =>
    apiV2.post<OwnerPilotBindingSummary>(`/pilot/owner-bindings/${bindingId}/reject`),

  updateOwnerBindingStatus: (bindingId: number, status: string) =>
    apiV2.patch<OwnerPilotBindingSummary>(`/pilot/owner-bindings/${bindingId}/status`, { status }),

  listFlightRecords: (params?: PilotFlightRecordListParams) =>
    apiV2.get<V2ListData<V2FlightRecordSummary> & { meta: V2PageMeta }>('/pilot/flight-records', params),

  listAllFlightRecords: async (params?: Omit<PilotFlightRecordListParams, 'page'>) => {
    const pageSize = params?.page_size || DEFAULT_PAGE_SIZE;
    let page = 1;
    let total = 0;
    const items: V2FlightRecordSummary[] = [];

    while (page <= MAX_PAGES) {
      const response: any = await pilotV2Service.listFlightRecords({
        ...params,
        page,
        page_size: pageSize,
      });
      const batch = response.items || [];
      total = Number(response.meta?.total || 0);
      items.push(...batch);

      if (!batch.length || batch.length < pageSize || (total > 0 && items.length >= total)) {
        break;
      }
      page += 1;
    }

    return items;
  },
};
