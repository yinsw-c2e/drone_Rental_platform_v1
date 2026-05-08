import { apiV1 } from './api';

export const paymentService = {
  create: (orderId: number, method: string) =>
    apiV1.post('/payment/create', { order_id: orderId, method }),

  getStatus: (paymentNo: string) =>
    apiV1.get(`/payment/${paymentNo}/status`),

  mockCallback: (paymentNo: string) =>
    apiV1.post('/payment/mock/callback', { payment_no: paymentNo }),

  refund: (orderId: number) =>
    apiV1.post(`/payment/${orderId}/refund`),

  history: (page?: number, pageSize?: number) =>
    apiV1.get('/payment/history', { page, page_size: pageSize }),
};
