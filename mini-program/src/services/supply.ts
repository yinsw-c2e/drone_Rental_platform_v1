import {
  DirectOrderInput,
  DirectOrderResult,
  SupplyDetail,
  SupplySummary,
  V2ListData,
  V2PageMeta,
} from '../types';
import { apiV2 } from './api';

export type SupplyMarketParams = {
  region?: string;
  keyword?: string;
  cargo_scene?: string;
  service_type?: string;
  min_payload_kg?: number;
  origin_latitude?: number;
  origin_longitude?: number;
  accepts_direct_order?: boolean;
  page?: number;
  page_size?: number;
};

export const supplyService = {
  list: (params?: SupplyMarketParams) =>
    apiV2.get<V2ListData<SupplySummary> & { meta: V2PageMeta }>('/supplies', params),

  getById: (supplyId: number) =>
    apiV2.get<SupplyDetail>(`/supplies/${supplyId}`),

  createDirectOrder: (supplyId: number, payload: DirectOrderInput) =>
    apiV2.post<DirectOrderResult>(`/supplies/${supplyId}/orders`, payload),

  updateStatus: (supplyId: number, status: string) =>
    apiV2.patch<SupplyDetail>(`/owner/supplies/${supplyId}/status`, { status }),
};
