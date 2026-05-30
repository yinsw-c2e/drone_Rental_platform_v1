import Taro from '@tarojs/taro';
import type { Dispatch } from '@reduxjs/toolkit';

import { authService } from '../services/auth';
import { setCredentials } from '../store/slices/authSlice';
import { HaulRoleMode, setHaulRoleMode } from '../store/slices/roleSlice';
import { canEnterMode } from './roleSummary';
import { friendlyErrorMessage } from './errorMessage';

type PerformWeChatLoginOptions = {
  dispatch: Dispatch;
  mode: HaulRoleMode;
  beginSubmit?: () => void;
  endSubmit?: () => void;
};

/**
 * 拉起微信登录全流程：Taro.login → 后端 /auth/wechat-mini-login → 写入 store → 跳转首页 Tab。
 * 失败/取消会显示 toast 并返回 false；不会抛错。
 */
export async function performWeChatLogin({
  dispatch,
  mode,
  beginSubmit,
  endSubmit,
}: PerformWeChatLoginOptions): Promise<boolean> {
  beginSubmit?.();
  Taro.showLoading({ title: '正在登录...' });
  try {
    const loginRes = await Taro.login();
    if (!loginRes.code) {
      throw new Error('未获得微信登录凭证');
    }
    const res = (await authService.wechatMiniLogin(loginRes.code)) as any;
    Taro.hideLoading();
    const roleSummary = res?.role_summary || null;
    if (mode !== 'provider' && !canEnterMode(mode, roleSummary)) {
      Taro.showModal({
        title: '账号身份不匹配',
        content: '当前账号不能进入「我要吊运」，请切换客户账号后再试。',
        confirmText: '知道了',
        showCancel: false,
      });
      return false;
    }
    dispatch(setHaulRoleMode(mode));
    dispatch(setCredentials({ user: res.user, token: res.token, roleSummary }));
    Taro.showToast({ title: '登录成功', icon: 'success' });
    Taro.switchTab({ url: '/pages/home/index' });
    return true;
  } catch (e: any) {
    Taro.hideLoading();
    Taro.showToast({ title: friendlyErrorMessage(e, '微信登录失败'), icon: 'none' });
    return false;
  } finally {
    endSubmit?.();
  }
}
