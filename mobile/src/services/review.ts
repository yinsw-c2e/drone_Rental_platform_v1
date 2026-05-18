import {apiV2} from './api';
import {ApiResponse, Review, PageData} from '../types';

export const reviewService = {
  create: (data: {
    order_id: number;
    review_type: string;
    target_type: string;
    target_id: number;
    rating: number;
    content: string;
    images?: string[];
  }) => apiV2.post<any, ApiResponse<Review>>('/review', data),

  getByOrder: (orderId: number) =>
    apiV2.get<any, ApiResponse<Review[]>>(`/review/order/${orderId}`),

  listByTarget: (targetType: string, targetId: number, params?: {page?: number; page_size?: number}) =>
    apiV2.get<any, ApiResponse<PageData<Review>>>(`/review/${targetType}/${targetId}`, {params}),
};
