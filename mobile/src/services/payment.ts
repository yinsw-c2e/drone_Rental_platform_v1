import {apiV2} from './api';
import {ApiResponse} from '../types';

export const paymentService = {
  create: (orderId: number, method: string) =>
    apiV2.post<any, ApiResponse>('/payment/create', {
      order_id: orderId,
      method,
    }),

  getStatus: (paymentNo: string) =>
    apiV2.get<any, ApiResponse>(`/payment/${paymentNo}/status`),

  mockCallback: (paymentNo: string) =>
    apiV2.post<any, ApiResponse>('/payment/mock/callback', {
      payment_no: paymentNo,
    }),

  refund: (orderId: number) =>
    apiV2.post<any, ApiResponse>(`/payment/${orderId}/refund`),

  history: (page?: number, pageSize?: number) =>
    apiV2.get<any, ApiResponse>('/payment/history', {
      params: {page, page_size: pageSize},
    }),
};
