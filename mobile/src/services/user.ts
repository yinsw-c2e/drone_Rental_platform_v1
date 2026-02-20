import api from './api';
import {ApiResponse, User} from '../types';

export const userService = {
  getProfile: () =>
    api.get<any, ApiResponse<User>>('/user/profile'),

  updateProfile: (data: Partial<User>) =>
    api.put<any, ApiResponse<User>>('/user/profile', data),

  uploadAvatar: (formData: FormData) =>
    api.post<any, ApiResponse<{url: string}>>('/user/avatar', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    }),

  submitIDVerify: (data: {real_name: string; id_number: string; front_image: string; back_image: string}) =>
    api.post<any, ApiResponse>('/user/id-verify', data),

  getIDVerifyStatus: () =>
    api.get<any, ApiResponse>('/user/id-verify/status'),

  getPublicProfile: (id: number) =>
    api.get<any, ApiResponse<User>>(`/user/${id}`),
};
