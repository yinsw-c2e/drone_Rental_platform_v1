import Taro, { useRouter } from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Input, Button, Image, ScrollView } from '@tarojs/components';
import { useDispatch, useSelector } from 'react-redux';
import { authService } from '../../../services/auth';
import { setCredentials } from '../../../store/slices/authSlice';
import {
  HaulRoleMode,
  setHaulRoleMode,
} from '../../../store/slices/roleSlice';
import { RootState } from '../../../store/store';
import { canEnterMode } from '../../../utils/roleSummary';
import loginBg from '../../../assets/login/images/login_page_bg.jpg';
import phoneIcon from '../../../assets/login/icons/phone.png';
import lockIcon from '../../../assets/login/icons/lock.png';
import eyeOffIcon from '../../../assets/login/icons/eye_off.png';
import wechatIcon from '../../../assets/icons/wechat.svg';
import toolsIcon from '../../../assets/login/icons/tools.png';
import userIcon from '../../../assets/login/icons/user.png';
import './index.scss';

const QUICK_ACCOUNTS = [
  { label: '客户样本 (13800000004)', phone: '13800000004', password: 'password123', role: '客户', key: 'client' as const },
  { label: '服务商样本 (13800000007)', phone: '13800000007', password: 'password123', role: '服务商', key: 'owner' as const },
  { label: '服务商履约样本 (13900000016)', phone: '13900000016', password: 'password123', role: '服务商', key: 'pilot' as const },
  { label: '陈服务商履约 (13900000017)', phone: '13900000017', password: 'password123', role: '服务商', key: 'pilot' as const },
  { label: '综合服务样本 (13800000002)', phone: '13800000002', password: 'password123', role: '综合服务', key: 'composite' as const },
  { label: '管理员 (13800000001)', phone: '13800000001', password: 'password123', role: '管理员', key: 'admin' as const },
];

const ROLE_CATEGORIES = [
  { key: 'client', label: '客户', color: '#2A78FF' },
  { key: 'owner', label: '服务商', color: '#19A974' },
  { key: 'composite', label: '综合', color: '#F5222D' },
];

const ROLE_ACCOUNTS: Record<string, typeof QUICK_ACCOUNTS> = {
  client: QUICK_ACCOUNTS.filter(a => a.key === 'client'),
  owner: QUICK_ACCOUNTS.filter(a => a.key === 'owner'),
  composite: QUICK_ACCOUNTS.filter(a => a.key === 'pilot' || a.key === 'composite' || a.key === 'admin'),
};

const normalizeRoleMode = (value?: string): HaulRoleMode | null =>
  value === 'provider' || value === 'customer' ? value : null;

const modeLabel = (mode: HaulRoleMode) => mode === 'provider' ? '我要接单' : '我要吊运';

const devCategoriesForMode = (mode: HaulRoleMode) =>
  ROLE_CATEGORIES.filter(cat => (
    mode === 'provider'
      ? true
      : cat.key === 'client'
  ));

const canUseDevQuickLogin = () => {
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    const envVersion = Taro.getAccountInfoSync?.().miniProgram?.envVersion;
    return envVersion === 'develop' || envVersion === 'trial';
  } catch {
    return false;
  }
};

export default function LoginPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const routeRoleMode = normalizeRoleMode(router.params.roleMode);
  const activeMode = routeRoleMode || selectedMode;
  const lastTouchActionAt = useRef(0);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('password');
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const devQuickLoginEnabled = canUseDevQuickLogin();
  const visibleDevCategories = devCategoriesForMode(activeMode);

  useEffect(() => {
    if (routeRoleMode) {
      dispatch(setHaulRoleMode(routeRoleMode));
    }
  }, [dispatch, routeRoleMode]);

  const beginSubmit = () => {
    setSubmitting(true);
    return Date.now();
  };

  const bindPress = (action: () => void | Promise<any>) => ({
    onTouchEnd: () => {
      lastTouchActionAt.current = Date.now();
      action();
    },
    onClick: () => {
      if (Date.now() - lastTouchActionAt.current < 350) return;
      action();
    },
  });

  const ensureModeAllowed = (mode: HaulRoleMode, roleSummary: any) => {
    if (mode === 'provider') {
      return true;
    }
    if (canEnterMode(mode, roleSummary)) {
      return true;
    }
    Taro.showModal({
      title: '账号身份不匹配',
      content: '当前账号不能进入“我要吊运”，请切换客户账号后再试。',
      confirmText: '知道了',
      showCancel: false,
    });
    return false;
  };

  const finishLogin = (res: any, mode: HaulRoleMode) => {
    const roleSummary = res?.role_summary || null;
    if (!ensureModeAllowed(mode, roleSummary)) {
      return false;
    }
    dispatch(setHaulRoleMode(mode));
    dispatch(setCredentials({ user: res.user, token: res.token, roleSummary }));
    Taro.showToast({ title: '登录成功', icon: 'success' });
    Taro.switchTab({ url: '/pages/home/index' });
    return true;
  };

  const handleLogin = async () => {
    if (!phone) { Taro.showToast({ title: '请输入手机号', icon: 'none' }); return; }
    if (submitting) return;
    beginSubmit();
    Taro.showLoading({ title: '正在登录...' });
    try {
      let res;
      if (loginMode === 'code') res = await authService.login(phone, undefined, code);
      else res = await authService.login(phone, password);
      Taro.hideLoading();
      finishLogin(res as any, activeMode);
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWeChatLogin = async () => {
    if (submitting) return;
    beginSubmit();
    Taro.showLoading({ title: '正在登录...' });
    try {
      const loginRes = await Taro.login();
      if (!loginRes.code) {
        throw new Error('未获得微信登录凭证');
      }
      const res = await authService.wechatMiniLogin(loginRes.code);
      Taro.hideLoading();
      finishLogin(res as any, activeMode);
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: e.message || '微信登录失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = async (p: string, pw: string, roleMode: HaulRoleMode) => {
    if (submitting) return;
    beginSubmit();
    Taro.showLoading({ title: '正在登录...' });
    try {
      const res = await authService.login(p, pw);
      Taro.hideLoading();
      finishLogin(res as any, roleMode);
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="login-root">
      <Image className="login-bg" src={loginBg} mode="widthFix" />
      <ScrollView scrollY className="login-scroll" showScrollbar={false}>
        <View className="login-scroll-content">
          <View className="login-hero">
            <Text className="login-title">无人机服务</Text>
            <View className="login-subtitle-row">
              <View className="login-subtitle-line" />
              <Text className="login-subtitle">重载运输调度平台</Text>
              <View className="login-subtitle-line" />
            </View>
          </View>

          <View className="login-form-card">
            <View className="login-input-row">
              <Image className="login-input-icon" src={phoneIcon} mode="aspectFit" />
              <Input className="login-input" placeholderClass="login-placeholder" placeholder="手机号" type="number" maxlength={11} value={phone} onInput={e => setPhone(e.detail.value)} />
            </View>
            {loginMode === 'code' ? (
              <View className="login-input-row login-code-row">
                <Image className="login-input-icon" src={lockIcon} mode="aspectFit" />
                <Input className="login-input login-code-input" placeholderClass="login-placeholder" placeholder="验证码" type="number" maxlength={6} value={code} onInput={e => setCode(e.detail.value)} />
                <View className={`login-code-btn ${countdown > 0 ? 'login-code-btn-disabled' : ''}`} {...bindPress(() => {
                  if (countdown === 0) Taro.showToast({title: '功能暂未开放'});
                })}>
                  <Text className="login-code-btn-text">{countdown > 0 ? `重新发送(${countdown}s)` : '发送验证码'}</Text>
                </View>
              </View>
            ) : (
              <View className="login-input-row">
                <Image className="login-input-icon" src={lockIcon} mode="aspectFit" />
                <Input className="login-input" placeholderClass="login-placeholder" placeholder="密码" password={!showPassword} value={password} onInput={e => setPassword(e.detail.value)} />
                <Image className="login-eye-icon" src={eyeOffIcon} mode="aspectFit" {...bindPress(() => setShowPassword(value => !value))} />
              </View>
            )}
            <View className={`login-submit-btn ${submitting ? 'login-submit-btn-disabled' : ''}`} {...bindPress(handleLogin)}>
              <Text className="login-submit-btn-text">{submitting ? '登录中...' : '登 录'}</Text>
            </View>
          </View>

          <View className="login-links-row">
            <Text className="login-link" {...bindPress(() => setLoginMode(loginMode === 'code' ? 'password' : 'code'))}>
              {loginMode === 'code' ? '使用密码登录' : '使用验证码登录'}
            </Text>
            <Text
              className="login-link"
              {...bindPress(() => {
                const url = `/pages/auth/register/index?roleMode=${activeMode}`;
                // 用 redirectTo 替换当前 login，避免反复 push 撑栈
                Taro.redirectTo({ url }).catch(() => {
                  Taro.navigateTo({ url }).catch(() => null);
                });
              })}
            >
              注册新账号
            </Text>
          </View>

          <View className="login-third-party">
            <View className="login-divider-row">
              <View className="login-divider-line" />
              <Text className="login-divider-text">其他登录方式</Text>
              <View className="login-divider-line" />
            </View>
            <View className="login-third-party-btns">
              <View
                className={`login-tp-btn ${submitting ? 'login-tp-btn-disabled' : ''}`}
                {...bindPress(handleWeChatLogin)}
              >
                <View className="login-tp-icon-wrap login-wechat-icon-wrap">
                  <Image src={wechatIcon} className="login-wechat-icon" mode="aspectFit" />
                </View>
                <Text className="login-tp-label">微信登录</Text>
              </View>
            </View>
          </View>

          {devQuickLoginEnabled ? (
          <View className="login-dev-section">
            <View className="login-dev-title-row">
              <Image className="login-dev-tools-icon" src={toolsIcon} mode="aspectFit" />
              <Text className="login-dev-title">开发模式快速登录 · {modeLabel(activeMode)}</Text>
            </View>

            {visibleDevCategories.map(cat => {
              const accounts = ROLE_ACCOUNTS[cat.key] || [];
              return (
                <View key={cat.key} className="login-dev-group">
                  <View className="login-dev-role-row">
                    <Image className="login-dev-user-icon" src={userIcon} mode="aspectFit" />
                    <Text className="login-dev-role" style={{ color: cat.color }}>{cat.label}</Text>
                  </View>
                  <View className="login-dev-account-list">
                    {accounts.map(account => (
                      <Button
                        key={account.phone}
                        className={`login-dev-account-btn ${submitting ? 'login-dev-account-btn-disabled' : ''}`}
                        style={{ borderColor: cat.color, color: cat.color }}
                        plain

                        {...bindPress(() => quickLogin(account.phone, account.password, activeMode))}
                        hoverClass="login-dev-account-btn-hover"
                      >
                        {submitting ? '登录中...' : account.label}
                      </Button>
                    ))}
                  </View>
                  {accounts.length === 0 && (
                    <Text className="login-dev-empty">暂无可用账号</Text>
                  )}
                </View>
              );
            })}
          </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
