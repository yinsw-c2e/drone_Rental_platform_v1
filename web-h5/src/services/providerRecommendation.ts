import {
  ProviderInviteResult,
  ProviderRecommendationSummary,
  V2ListData,
  V2PageMeta,
} from '../types';
import { apiV2 } from './api';

export type ProviderRecommendationParams = {
  demand_id?: number;
  origin_latitude?: number;
  origin_longitude?: number;
  cargo_scene?: string;
  cargo_weight_kg?: number;
  keyword?: string;
  page?: number;
  page_size?: number;
};

export const providerRecommendationService = {
  list: (params?: ProviderRecommendationParams) =>
    apiV2.get<V2ListData<ProviderRecommendationSummary> & { meta: V2PageMeta }>('/providers/recommended', params),

  invite: (demandId: number, payload: { provider_user_id: number; message?: string }) =>
    apiV2.post<ProviderInviteResult>(`/demands/${demandId}/provider-invitations`, payload),
};
