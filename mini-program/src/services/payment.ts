import { apiV2 } from './api';

export const paymentService = {
  create: (orderId: number, method: string) =>
    apiV2.post('/payment/create', { order_id: orderId, method }),

  getStatus: (paymentNo: string) =>
    apiV2.get(`/payment/${paymentNo}/status`),

  mockCallback: (paymentNo: string) =>
    apiV2.post('/payment/mock/callback', { payment_no: paymentNo }),

  refund: (orderId: number) =>
    apiV2.post(`/payment/${orderId}/refund`),

  history: (page?: number, pageSize?: number) =>
    apiV2.get('/payment/history', { page, page_size: pageSize }),
};
