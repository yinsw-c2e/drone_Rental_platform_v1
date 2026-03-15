import {apiV2} from './api';
import {
  V2ApiResponse,
  V2CreateOrderPaymentResult,
  V2DisputeSummary,
  V2ListData,
  V2PaymentSummary,
  V2RefundSummary,
  V2ReviewSummary,
  V2SettlementSummary,
} from '../types';

export const orderFinanceV2Service = {
  createPayment: (orderId: number, method: string) =>
    apiV2.post<any, V2ApiResponse<V2CreateOrderPaymentResult>>(`/orders/${orderId}/pay`, {
      method,
    }),

  listPayments: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2ListData<V2PaymentSummary>>>(`/orders/${orderId}/payments`),

  listRefunds: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2ListData<V2RefundSummary>>>(`/orders/${orderId}/refunds`),

  refund: (orderId: number) =>
    apiV2.post<any, V2ApiResponse<V2ListData<V2RefundSummary>>>(`/orders/${orderId}/refund`, {}),

  getSettlement: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2SettlementSummary>>(`/orders/${orderId}/settlement`),

  listReviews: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2ListData<V2ReviewSummary>>>(`/orders/${orderId}/reviews`),

  createReview: (
    orderId: number,
    payload: {
      target_user_id: number;
      target_role: string;
      rating: number;
      content: string;
    },
  ) => apiV2.post<any, V2ApiResponse<V2ReviewSummary>>(`/orders/${orderId}/reviews`, payload),

  listDisputes: (orderId: number) =>
    apiV2.get<any, V2ApiResponse<V2ListData<V2DisputeSummary>>>(`/orders/${orderId}/disputes`),

  createDispute: (
    orderId: number,
    payload: {
      dispute_type?: string;
      summary: string;
    },
  ) => apiV2.post<any, V2ApiResponse<V2DisputeSummary>>(`/orders/${orderId}/disputes`, payload),
};

