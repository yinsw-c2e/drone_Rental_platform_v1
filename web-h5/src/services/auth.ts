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

  register: (phone: string, password: string, nickname: string | undefined, code: string) =>
    apiV2.post<AuthPayload>('/auth/register', { phone, password, nickname, code }),

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

  // 落库用户在小程序选择的意向身份(customer/provider),用于管理端分群和登录态恢复。
  // 不影响 role_summary 能力位,失败时静默丢弃即可(不阻塞主流程)。
  setPreferredMode: (mode: 'customer' | 'provider') =>
    apiV2.post<{ preferred_mode: string }>('/user/preferred-mode', { mode }),
};
