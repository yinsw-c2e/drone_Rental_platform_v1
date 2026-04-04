import {apiV2} from './api';
import {V2ApiResponse} from '../types';

export interface ContractDetail {
  id: number;
  contract_no: string;
  order_id: number;
  order_no: string;
  title: string;
  status: string; // pending | client_signed | provider_signed | fully_signed
  client_user_id: number;
  provider_user_id: number;
  contract_amount: number;
  platform_commission: number;
  provider_amount: number;
  client_signed_at: string | null;
  provider_signed_at: string | null;
  contract_html: string;
  created_at: string;
  updated_at: string;
}

export const contractService = {
  getByOrder: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<ContractDetail>>(`/orders/${orderId}/contract`),

  sign: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<ContractDetail>>(`/orders/${orderId}/contract/sign`),
};
