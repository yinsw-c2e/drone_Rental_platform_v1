import api from './api';
import {ApiResponse, User, TokenPair} from '../types';

export const authService = {
  sendCode: (phone: string) =>
    api.post<any, ApiResponse>('/auth/send-code', {phone}),

  register: (phone: string, password: string, code: string, nickname?: string) =>
    api.post<any, ApiResponse<{user: User; token: TokenPair}>>('/auth/register', {
      phone,
      password,
      code,
      nickname,
    }),

  login: (phone: string, password?: string, code?: string) =>
    api.post<any, ApiResponse<{user: User; token: TokenPair}>>('/auth/login', {
      phone,
      password,
      code,
    }),

  refreshToken: (refreshToken: string) =>
    api.post<any, ApiResponse<TokenPair>>('/auth/refresh-token', {
      refresh_token: refreshToken,
    }),

  logout: () => api.post<any, ApiResponse>('/auth/logout'),

  // 微信登录
  wechatLogin: (code: string) =>
    api.post<any, ApiResponse<{user: User; token: TokenPair}>>('/auth/wechat-login', {code}),

  // QQ登录
  qqLogin: (accessToken: string) =>
    api.post<any, ApiResponse<{user: User; token: TokenPair}>>('/auth/qq-login', {
      access_token: accessToken,
    }),
};
