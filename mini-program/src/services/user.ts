import Taro from '@tarojs/taro';

import { API_V1_BASE_URL } from '../constants';
import { store } from '../store/store';
import { User } from '../types';
import { apiV1 } from './api';

const getAccessToken = () => {
  const token = store.getState().auth.accessToken;
  if (token) {
    return token;
  }
  return Taro.getStorageSync('token') || '';
};

const parseUploadResponse = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('上传结果解析失败，请重试');
  }
};

export const uploadFileToEndpoint = async (
  endpoint: string,
  filePath: string,
  name = 'file',
) => {
  const token = getAccessToken();
  const response = await Taro.uploadFile({
    url: `${API_V1_BASE_URL}${endpoint}`,
    filePath,
    name,
    header: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const body = parseUploadResponse(response.data);
  if (body?.code !== 'OK' && body?.code !== 0) {
    throw new Error(body?.message || '上传失败');
  }

  return body?.data || body;
};

export const userService = {
  getProfile: () => apiV1.get<User>('/user/profile'),

  updateProfile: (data: Partial<User>) => apiV1.put<User>('/user/profile', data),

  uploadAvatar: async (filePath: string) => {
    const result = await uploadFileToEndpoint('/user/avatar', filePath);
    return result?.url || '';
  },

  submitIDVerify: (data: {
    real_name: string;
    id_number: string;
    front_image: string;
    back_image: string;
  }) => apiV1.post('/user/id-verify', data),

  getIDVerifyStatus: () =>
    apiV1.get<{
      id_verified?: string;
      real_name?: string;
      id_number?: string;
      reject_reason?: string;
    }>('/user/id-verify/status'),

  getPublicProfile: (id: number) => apiV1.get<User>(`/user/${id}`),
};

export default userService;
