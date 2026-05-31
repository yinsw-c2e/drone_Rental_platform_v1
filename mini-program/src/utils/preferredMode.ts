import Taro from '@tarojs/taro';

import { authService } from '../services/auth';
import type { HaulRoleMode } from '../store/slices/roleSlice';

const AUTH_TOKEN_STORAGE_KEY = 'haul_auth_token';

// 把用户在双端模式下选择的意向身份同步到后端,供管理端运营分群。
// 未登录时静默跳过(本地 Redux + Storage 已记住选择,后续登录时会再次触发同步)。
// 网络/接口失败也只 warn,不抛错——避免影响主流程(选择身份、登录、注册)。
export function syncPreferredModeWithBackend(mode: HaulRoleMode) {
  try {
    const stored: any = Taro.getStorageSync(AUTH_TOKEN_STORAGE_KEY);
    if (!stored?.access_token) {
      return;
    }
  } catch {
    return;
  }
  authService.setPreferredMode(mode).catch((e: unknown) => {
    // 不阻塞主流程,仅做诊断。
    console.warn('[preferred-mode] sync failed:', e);
  });
}
