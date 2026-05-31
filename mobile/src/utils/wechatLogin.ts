import {Alert} from 'react-native';
import type {Dispatch} from '@reduxjs/toolkit';
import * as WeChat from 'react-native-wechat-lib';

import {THIRD_PARTY_LOGIN} from '../constants';
import {authService} from '../services/auth';
import {setCredentials} from '../store/slices/authSlice';
import {HaulRoleMode, setHaulRoleMode} from '../store/slices/roleSlice';
import {friendlyErrorMessage} from './errorMessage';
import {canEnterMode} from './roleSummary';
import {syncPreferredModeWithBackend} from './preferredMode';

type PerformWeChatLoginOptions = {
  dispatch: Dispatch;
  mode: HaulRoleMode;
  beginSubmit?: () => void;
  endSubmit?: () => void;
};

export async function performWeChatLogin({
  dispatch,
  mode,
  beginSubmit,
  endSubmit,
}: PerformWeChatLoginOptions): Promise<boolean> {
  beginSubmit?.();
  try {
    const appId = THIRD_PARTY_LOGIN.wechatAppId;
    if (!appId) {
      Alert.alert('提示', '微信登录未配置 AppID');
      return false;
    }

    await WeChat.registerApp(appId, THIRD_PARTY_LOGIN.wechatUniversalLink || undefined).catch((error: unknown) => {
      console.warn('[WeChat] register failed:', error);
    });

    const isInstalled = await WeChat.isWXAppInstalled();
    if (!isInstalled) {
      Alert.alert('提示', '请先安装微信 App');
      return false;
    }

    const result = await WeChat.sendAuthRequest('snsapi_userinfo', 'haul');
    if (result.errCode === -2) {
      return false;
    }
    if (result.errCode !== 0 || !result.code) {
      throw new Error(`微信授权失败: ${result.errCode}`);
    }

    const res = await authService.wechatLogin(result.code);
    const payload = res.data;
    if (!payload?.user || !payload?.token) {
      throw new Error('微信登录返回数据不完整');
    }
    const roleSummary = payload.role_summary || null;
    if (mode !== 'provider' && !canEnterMode(mode, roleSummary)) {
      Alert.alert(
        '账号身份不匹配',
        '当前账号不能进入「我要吊运」，请切换客户账号后再试。',
      );
      return false;
    }

    dispatch(setHaulRoleMode(mode));
    dispatch(setCredentials({
      user: payload.user,
      token: payload.token,
      roleSummary,
    }));
    syncPreferredModeWithBackend(mode);
    return true;
  } catch (error: unknown) {
    Alert.alert('微信登录失败', friendlyErrorMessage(error, '无法拉起微信'));
    return false;
  } finally {
    endSubmit?.();
  }
}
