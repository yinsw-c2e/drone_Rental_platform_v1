import { apiV1 } from './api';
import { ApiResponse, AddressData, POIItem, ReverseGeoResult } from '../types';

export const locationService = {
  // === 位置搜索 ===

  /** 关键词搜索POI */
  searchPOI: (params: {keyword: string; city?: string; page?: number; page_size?: number}) =>
    apiV1.get<any, ApiResponse<{list: POIItem[]; total: number}>>('/location/search', {params}),

  /** 逆地理编码: 坐标 -> 地址 */
  reverseGeoCode: (lng: number, lat: number) =>
    apiV1.get<any, ApiResponse<ReverseGeoResult>>('/location/regeocode', {params: {lng, lat}}),

  /** 周边POI搜索 */
  searchNearby: (params: {lng: number; lat: number; radius?: number; keyword?: string; page?: number; page_size?: number}) =>
    apiV1.get<any, ApiResponse<{list: POIItem[]; total: number}>>('/location/nearby', {params}),

  // === 常用地址管理 ===

  /** 获取用户常用地址列表 */
  getAddressList: () =>
    apiV1.get<any, ApiResponse<AddressData[]>>('/address'),

  /** 新增常用地址 */
  createAddress: (data: {
    address: string;
    latitude: number;
    longitude: number;
    label?: string;
    name?: string;
    province?: string;
    city?: string;
    district?: string;
    is_default?: boolean;
  }) =>
    apiV1.post<any, ApiResponse<AddressData>>('/address', data),

  /** 更新常用地址 */
  updateAddress: (id: number, data: Partial<Omit<AddressData, 'id' | 'created_at' | 'updated_at'>>) =>
    apiV1.put<any, ApiResponse>(`/address/${id}`, data),

  /** 删除常用地址 */
  deleteAddress: (id: number) =>
    apiV1.delete<any, ApiResponse>(`/address/${id}`),

  /** 设为默认地址 */
  setDefaultAddress: (id: number) =>
    apiV1.put<any, ApiResponse>(`/address/${id}/default`),
};
