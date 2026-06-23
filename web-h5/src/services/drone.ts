import { apiV2 } from './api';
import { Drone } from '../types';

export const droneService = {
  list: (params?: { page?: number; page_size?: number; city?: string }) =>
    apiV2.get<{ list: Drone[]; total: number }>('/drone', params),

  getById: (id: number) =>
    apiV2.get<Drone>(`/drone/${id}`),

  create: (data: Partial<Drone>) =>
    apiV2.post<Drone>('/drone', data),

  update: (id: number, data: Partial<Drone>) =>
    apiV2.put(`/drone/${id}`, data),

  delete: (id: number) =>
    apiV2.delete(`/drone/${id}`),

  myDrones: (params?: { page?: number; page_size?: number }) =>
    apiV2.get<{ list: Drone[]; total: number }>('/drone/my', params),

  nearby: (lat: number, lng: number, radius?: number) =>
    apiV2.get<{ list: Drone[]; total: number }>('/drone/nearby', { lat, lng, radius }),

  updateAvailability: (id: number, status: string) =>
    apiV2.put(`/drone/${id}/availability`, { status }),
};
