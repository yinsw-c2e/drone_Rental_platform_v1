import {
  AddressSnapshot,
  DemandCandidateSummary,
  DemandDetail,
  DemandSummary,
  DemandQuoteInput,
  DemandQuoteSummary,
  DemandSelectProviderResult,
  V2ApiResponse,
  V2ListData,
  V2PageMeta,
} from '../types';
import {apiV2} from './api';

export type DemandListParams = {
  page?: number;
  page_size?: number;
  status?: string;
};

export type DemandUpsertPayload = {
  title?: string;
  service_type?: 'heavy_cargo_lift_transport';
  cargo_scene?: string;
  description?: string;
  departure_address?: AddressSnapshot;
  destination_address?: AddressSnapshot;
  service_address?: AddressSnapshot;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  cargo_weight_kg?: number;
  cargo_volume_m3?: number;
  cargo_type?: string;
  cargo_special_requirements?: string;
  estimated_trip_count?: number;
  budget_min?: number;
  budget_max?: number;
  allows_pilot_candidate?: boolean;
  expires_at?: string;
};

export const demandV2Service = {
  listMarketplaceDemands: (params?: DemandListParams) =>
    apiV2.get<any, V2ApiResponse<V2ListData<DemandSummary>, V2PageMeta>>('/owner/demands/recommended', {params}),

  listPilotCandidateDemands: (params?: DemandListParams) =>
    apiV2.get<any, V2ApiResponse<V2ListData<DemandSummary>, V2PageMeta>>('/pilot/candidate-demands', {params}),

  listMyDemands: (params?: DemandListParams) =>
    apiV2.get<any, V2ApiResponse<V2ListData<DemandSummary>, V2PageMeta>>('/demands/my', {params}),

  getById: (demandId: number) =>
    apiV2.get<any, V2ApiResponse<DemandDetail>>(`/demands/${demandId}`),

  listQuotes: (demandId: number) =>
    apiV2.get<any, V2ApiResponse<{items: DemandQuoteSummary[]}>>(`/demands/${demandId}/quotes`),

  createQuote: (demandId: number, payload: DemandQuoteInput) =>
    apiV2.post<any, V2ApiResponse<DemandQuoteSummary>>(`/demands/${demandId}/quotes`, payload),

  selectProvider: (demandId: number, quoteId: number) =>
    apiV2.post<any, V2ApiResponse<DemandSelectProviderResult>>(`/demands/${demandId}/select-provider`, {
      quote_id: quoteId,
    }),

  create: (payload: DemandUpsertPayload) =>
    apiV2.post<any, V2ApiResponse<DemandDetail>>('/demands', payload),

  update: (demandId: number, payload: DemandUpsertPayload) =>
    apiV2.patch<any, V2ApiResponse<DemandDetail>>(`/demands/${demandId}`, payload),

  publish: (demandId: number) =>
    apiV2.post<any, V2ApiResponse<DemandDetail>>(`/demands/${demandId}/publish`),

  cancel: (demandId: number) =>
    apiV2.post<any, V2ApiResponse<DemandDetail>>(`/demands/${demandId}/cancel`),

  applyCandidate: (demandId: number) =>
    apiV2.post<any, V2ApiResponse<DemandCandidateSummary>>(`/demands/${demandId}/candidate`),

  withdrawCandidate: (demandId: number) =>
    apiV2.delete<any, V2ApiResponse<DemandCandidateSummary>>(`/demands/${demandId}/candidate`),
};
