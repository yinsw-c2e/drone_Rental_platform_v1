import { apiV2 } from './api';
import { RoleSummary, TokenPair, User } from '../types';

type AuthPayload = {
  user: User;
  token: TokenPair;
  role_summary?: RoleSummary;
};

export const authService = {
  sendCode: (phone: string) =>
    apiV2.post<any>('/auth/send-code', { phone }),

  register: (phone: string, password: string, nickname?: string) =>
    apiV2.post<AuthPayload>('/auth/register', { phone, password, nickname }),

  login: (phone: string, password?: string, code?: string) =>
    apiV2.post<AuthPayload>('/auth/login', { phone, password, code }),

  refreshToken: (refreshToken: string) =>
    apiV2.post<TokenPair>('/auth/refresh-token', { refresh_token: refreshToken }),

  logout: () => apiV2.post<void>('/auth/logout'),

  wechatLogin: (code: string) =>
    apiV2.post<{ user: User; token: TokenPair }>('/auth/wechat-login', { code }),

  wechatMiniLogin: (code: string) =>
    apiV2.post<AuthPayload>('/auth/wechat-mini-login', { code }),

  qqLogin: (accessToken: string) =>
    apiV2.post<{ user: User; token: TokenPair }>('/auth/qq-login', { access_token: accessToken }),
};
