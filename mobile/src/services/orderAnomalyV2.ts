import {apiV2} from './api';
import {
  V2ApiResponse,
  V2ListData,
  V2OrderAnomaly,
  V2OrderAnomalySummary,
  V2PageMeta,
} from '../types';

export type OrderAnomalyListParams = {
  role?: 'client' | 'owner' | 'pilot';
  severity?: string;
  anomaly_type?: string;
  status?: string;
  keyword?: string;
  order_id?: number;
  page?: number;
  page_size?: number;
};

export const orderAnomalyV2Service = {
  list: (params?: OrderAnomalyListParams) =>
    apiV2.get<any, V2ApiResponse<V2ListData<V2OrderAnomaly>, V2PageMeta>>('/order-anomalies', {params}),

  summary: (params?: Omit<OrderAnomalyListParams, 'page' | 'page_size'>) =>
    apiV2.get<any, V2ApiResponse<V2OrderAnomalySummary>>('/order-anomalies/summary', {params}),
};
