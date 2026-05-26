import { apiV2 } from './api';
import type { V2UserAddress } from '../types';

export const addressService = {
  list: () => apiV2.get<V2UserAddress[]>('/address'),

  create: (payload: Partial<V2UserAddress>) =>
    apiV2.post<V2UserAddress>('/address', payload),

  update: (id: number, payload: Partial<V2UserAddress>) =>
    apiV2.put<V2UserAddress>(`/address/${id}`, payload),

  remove: (id: number) =>
    apiV2.delete<void>(`/address/${id}`),

  setDefault: (id: number) =>
    apiV2.put<V2UserAddress>(`/address/${id}/default`, {}),
};

export default addressService;
