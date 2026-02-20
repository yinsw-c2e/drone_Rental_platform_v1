import api from './api';
import {ApiResponse, Drone, PageData} from '../types';

export const droneService = {
  list: (params?: {page?: number; page_size?: number; city?: string}) =>
    api.get<any, ApiResponse<PageData<Drone>>>('/drone', {params}),

  getById: (id: number) =>
    api.get<any, ApiResponse<Drone>>(`/drone/${id}`),

  create: (data: Partial<Drone>) =>
    api.post<any, ApiResponse<Drone>>('/drone', data),

  update: (id: number, data: Partial<Drone>) =>
    api.put<any, ApiResponse>(`/drone/${id}`, data),

  delete: (id: number) =>
    api.delete<any, ApiResponse>(`/drone/${id}`),

  myDrones: (params?: {page?: number; page_size?: number}) =>
    api.get<any, ApiResponse<PageData<Drone>>>('/drone/my', {params}),

  nearby: (lat: number, lng: number, radius?: number) =>
    api.get<any, ApiResponse<PageData<Drone>>>('/drone/nearby', {
      params: {lat, lng, radius},
    }),

  updateAvailability: (id: number, status: string) =>
    api.put<any, ApiResponse>(`/drone/${id}/availability`, {status}),
};
