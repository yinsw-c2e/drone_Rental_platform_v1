import { apiV2 } from './api';
import { ApiResponse, AddressData, POIItem, ReverseGeoResult } from '../types';

export const locationService = {
  // === 位置搜索 ===

  /** 关键词搜索POI */
  searchPOI: (params: {keyword: string; city?: string; page?: number; page_size?: number}) =>
    apiV2.get<ApiResponse<{list: POIItem[]; total: number}>>('/location/search', params),

  /** 逆地理编码: 坐标 -> 地址 */
  reverseGeoCode: (lng: number, lat: number) =>
    apiV2.get<ApiResponse<ReverseGeoResult>>('/location/regeocode', {lng, lat}),

  /** 周边POI搜索 */
  searchNearby: (params: {lng: number; lat: number; radius?: number; keyword?: string; page?: number; page_size?: number}) =>
    apiV2.get<ApiResponse<{list: POIItem[]; total: number}>>('/location/nearby', params),

  // === 常用地址管理 ===

  /** 获取用户常用地址列表 */
  getAddressList: () =>
    apiV2.get<ApiResponse<AddressData[]>>('/address'),

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
    apiV2.post<ApiResponse<AddressData>>('/address', data),

  /** 更新常用地址 */
  updateAddress: (id: number, data: Partial<Omit<AddressData, 'id' | 'created_at' | 'updated_at'>>) =>
    apiV2.put<ApiResponse>(`/address/${id}`, data),

  /** 删除常用地址 */
  deleteAddress: (id: number) =>
    apiV2.delete<ApiResponse>(`/address/${id}`),

  /** 设为默认地址 */
  setDefaultAddress: (id: number) =>
    apiV2.put<ApiResponse>(`/address/${id}/default`),
};
