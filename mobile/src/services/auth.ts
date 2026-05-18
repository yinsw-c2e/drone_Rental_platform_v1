import {apiV2} from './api';
import {RoleSummary, TokenPair, User, V2ApiResponse} from '../types';

type AuthPayload = {
  user: User;
  token: TokenPair;
  role_summary?: RoleSummary;
};

export const authService = {
  sendCode: (phone: string) =>
    apiV2.post<any, V2ApiResponse>('/auth/send-code', {phone}),

  register: (phone: string, password: string, code: string, nickname?: string) =>
    apiV2.post<any, V2ApiResponse<AuthPayload>>('/auth/register', {
      phone,
      password,
      nickname,
    }),

  login: (phone: string, password?: string, code?: string) =>
    apiV2.post<any, V2ApiResponse<AuthPayload>>('/auth/login', {
      phone,
      password,
      code,
    }),

  refreshToken: (refreshToken: string) =>
    apiV2.post<any, V2ApiResponse<TokenPair>>('/auth/refresh-token', {
      refresh_token: refreshToken,
    }),

  logout: () => apiV2.post<any, V2ApiResponse>('/auth/logout'),

  // 微信登录
  wechatLogin: (code: string) =>
    apiV2.post<any, V2ApiResponse<{user: User; token: TokenPair}>>('/auth/wechat-login', {code}),

  // QQ登录
  qqLogin: (accessToken: string) =>
    apiV2.post<any, V2ApiResponse<{user: User; token: TokenPair}>>('/auth/qq-login', {
      access_token: accessToken,
    }),
};
