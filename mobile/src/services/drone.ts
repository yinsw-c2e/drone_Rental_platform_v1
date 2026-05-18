import {apiV2} from './api';
import {ApiResponse, Drone, PageData} from '../types';

export const droneService = {
  list: (params?: {page?: number; page_size?: number; city?: string}) =>
    apiV2.get<any, ApiResponse<PageData<Drone>>>('/drone', {params}),

  getById: (id: number) =>
    apiV2.get<any, ApiResponse<Drone>>(`/drone/${id}`),

  create: (data: Partial<Drone>) =>
    apiV2.post<any, ApiResponse<Drone>>('/drone', data),

  update: (id: number, data: Partial<Drone>) =>
    apiV2.put<any, ApiResponse>(`/drone/${id}`, data),

  delete: (id: number) =>
    apiV2.delete<any, ApiResponse>(`/drone/${id}`),

  myDrones: (params?: {page?: number; page_size?: number}) =>
    apiV2.get<any, ApiResponse<PageData<Drone>>>('/drone/my', {params}),

  nearby: (lat: number, lng: number, radius?: number) =>
    apiV2.get<any, ApiResponse<PageData<Drone>>>('/drone/nearby', {
      params: {lat, lng, radius},
    }),

  updateAvailability: (id: number, status: string) =>
    apiV2.put<any, ApiResponse>(`/drone/${id}/availability`, {status}),
};
