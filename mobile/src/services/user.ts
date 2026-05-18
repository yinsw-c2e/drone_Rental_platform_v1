import {apiV2} from './api';
import {ApiResponse, User} from '../types';

export const userService = {
  getProfile: () =>
    apiV2.get<any, ApiResponse<User>>('/user/profile'),

  updateProfile: (data: Partial<User>) =>
    apiV2.put<any, ApiResponse<User>>('/user/profile', data),

  uploadAvatar: (formData: FormData) =>
    apiV2.post<any, ApiResponse<{url: string}>>('/user/avatar', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    }),

  submitIDVerify: (data: {real_name: string; id_number: string; front_image: string; back_image: string}) =>
    apiV2.post<any, ApiResponse>('/user/id-verify', data),

  getIDVerifyStatus: () =>
    apiV2.get<any, ApiResponse>('/user/id-verify/status'),

  getPublicProfile: (id: number) =>
    apiV2.get<any, ApiResponse<User>>(`/user/${id}`),
};
