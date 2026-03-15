import {
  DirectOrderInput,
  DirectOrderResult,
  SupplyDetail,
  SupplySummary,
  V2ApiResponse,
  V2ListData,
  V2PageMeta,
} from '../types';
import {apiV2} from './api';

export type SupplyMarketParams = {
  region?: string;
  cargo_scene?: string;
  service_type?: string;
  min_payload_kg?: number;
  accepts_direct_order?: boolean;
  page?: number;
  page_size?: number;
};

export const supplyService = {
  list: (params?: SupplyMarketParams) =>
    apiV2.get<any, V2ApiResponse<V2ListData<SupplySummary>, V2PageMeta>>('/supplies', {params}),

  getById: (supplyId: number) =>
    apiV2.get<any, V2ApiResponse<SupplyDetail>>(`/supplies/${supplyId}`),

  createDirectOrder: (supplyId: number, payload: DirectOrderInput) =>
    apiV2.post<any, V2ApiResponse<DirectOrderResult>>(`/supplies/${supplyId}/orders`, payload),

  updateStatus: (supplyId: number, status: string) =>
    apiV2.patch<any, V2ApiResponse<SupplyDetail>>(`/owner/supplies/${supplyId}/status`, {status}),
};
