import api from './api';
import {ApiResponse} from '../types';

export const paymentService = {
  create: (orderId: number, method: string) =>
    api.post<any, ApiResponse>('/payment/create', {
      order_id: orderId,
      method,
    }),

  getStatus: (paymentNo: string) =>
    api.get<any, ApiResponse>(`/payment/${paymentNo}/status`),

  mockCallback: (paymentNo: string) =>
    api.post<any, ApiResponse>('/payment/mock/callback', {
      payment_no: paymentNo,
    }),

  refund: (orderId: number) =>
    api.post<any, ApiResponse>(`/payment/${orderId}/refund`),

  history: (page?: number, pageSize?: number) =>
    api.get<any, ApiResponse>('/payment/history', {
      params: {page, page_size: pageSize},
    }),
};
