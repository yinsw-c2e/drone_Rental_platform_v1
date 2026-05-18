import {apiV2} from './api';
import {ApiResponse, Order, PageData} from '../types';

export const orderService = {
  create: (data: {
    order_type: string;
    drone_id: number;
    title: string;
    service_type: string;
    start_time: string;
    end_time: string;
    total_amount: number;
    latitude?: number;
    longitude?: number;
    address?: string;
  }) => apiV2.post<any, ApiResponse<Order>>('/order', data),

  list: (params?: {role?: string; status?: string; page?: number; page_size?: number}) =>
    apiV2.get<any, ApiResponse<PageData<Order>>>('/order', {params}),

  getById: (id: number) =>
    apiV2.get<any, ApiResponse<Order>>(`/order/${id}`),

  accept: (id: number) =>
    apiV2.put<any, ApiResponse>(`/order/${id}/accept`),

  reject: (id: number, reason?: string) =>
    apiV2.put<any, ApiResponse>(`/order/${id}/reject`, {reason}),

  cancel: (id: number, reason?: string) =>
    apiV2.put<any, ApiResponse>(`/order/${id}/cancel`, {reason}),

  start: (id: number) =>
    apiV2.put<any, ApiResponse>(`/order/${id}/start`),

  complete: (id: number) =>
    apiV2.put<any, ApiResponse>(`/order/${id}/complete`),

  getTimeline: (id: number) =>
    apiV2.get<any, ApiResponse>(`/order/${id}/timeline`),
};
