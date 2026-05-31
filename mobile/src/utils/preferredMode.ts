import AsyncStorage from '@react-native-async-storage/async-storage';
import {authService} from '../services/auth';
import {AUTH_TOKEN_STORAGE_KEY} from '../store/slices/authSlice';
import {store} from '../store/store';
import type {HaulRoleMode} from '../store/slices/roleSlice';

type StoredToken = {
  access_token?: string;
};

const readStoredToken = async (): Promise<StoredToken | null> => {
  try {
    const value = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as StoredToken;
  } catch {
    return null;
  }
};

// 把用户在双端模式下选择的意向身份同步到后端,供管理端运营分群。
// 未登录或同步失败都不阻塞主流程。
export async function syncPreferredModeWithBackend(mode: HaulRoleMode) {
  if (store.getState().auth.accessToken) {
    authService.setPreferredMode(mode).catch((error: unknown) => {
      console.warn('[preferred-mode] sync failed:', error);
    });
    return;
  }

  const stored = await readStoredToken();
  if (!stored?.access_token) {
    return;
  }

  authService.setPreferredMode(mode).catch((error: unknown) => {
    console.warn('[preferred-mode] sync failed:', error);
  });
}
