import Taro, { useRouter } from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import { useDispatch } from 'react-redux';
import { authService } from '../../../services/auth';
import { setCredentials } from '../../../store/slices/authSlice';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import {
  HaulRoleMode,
  setHaulRoleMode,
} from '../../../store/slices/roleSlice';

const normalizeRoleMode = (value?: string): HaulRoleMode | null =>
  value === 'provider' || value === 'customer' ? value : null;

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const COUNTDOWN_SECONDS = 60;

export default function RegisterPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const routeRoleMode = normalizeRoleMode(router.params.roleMode);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (routeRoleMode) {
      dispatch(setHaulRoleMode(routeRoleMode));
    }
  }, [dispatch, routeRoleMode]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, []);

  const startCountdown = () => {
    setCountdown(COUNTDOWN_SECONDS);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (sendingCode || countdown > 0) return;
    if (!PHONE_REGEX.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    setSendingCode(true);
    try {
      await authService.sendCode(phone);
      Taro.showToast({ title: '验证码已发送', icon: 'success' });
      startCountdown();
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '发送失败，请稍后重试'), icon: 'none' });
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async () => {
    if (!PHONE_REGEX.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      Taro.showToast({ title: '请输入 6 位验证码', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      Taro.showToast({ title: '密码至少 6 位', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authService.register(phone, password, nickname, code);
      dispatch(setCredentials({
        user: (res as any).user,
        token: (res as any).token,
        roleSummary: (res as any).role_summary || null,
      }));
      Taro.showToast({ title: '注册成功', icon: 'success' });
      if (routeRoleMode === 'provider') {
        Taro.redirectTo({ url: '/pages/provider/onboarding/index?from=register' }).catch(() => {
          Taro.navigateTo({ url: '/pages/provider/onboarding/index?from=register' }).catch(() => null);
        });
        return;
      }
      Taro.switchTab({ url: '/pages/home/index' });
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '注册失败'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const codeButtonText = sendingCode
    ? '发送中…'
    : countdown > 0
      ? `${countdown}s 后重发`
      : '获取验证码';
  const codeButtonDisabled = sendingCode || countdown > 0;

  return (
    <View style={{ padding: '60px 28px 40px', backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <Text style={{ fontSize: '24px', fontWeight: '800', color: '#333', textAlign: 'center', marginBottom: '32px', display: 'block' }}>
        注册新账号
      </Text>
      <View style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '20px' }}>
        <Input
          style={{ height: '48px', border: '1px solid #e5e5e5', borderRadius: '12px', paddingLeft: '16px', fontSize: '15px', marginBottom: '14px' }}
          placeholder="手机号"
          type="number"
          maxlength={11}
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
        />
        <View style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
          <Input
            style={{ flex: 1, height: '48px', border: '1px solid #e5e5e5', borderRadius: '12px', paddingLeft: '16px', fontSize: '15px' }}
            placeholder="6 位验证码"
            type="number"
            maxlength={6}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <View
            onClick={handleSendCode}
            style={{
              height: '48px',
              minWidth: '108px',
              padding: '0 14px',
              borderRadius: '12px',
              backgroundColor: codeButtonDisabled ? '#e6ecf5' : '#eaf3ff',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <Text style={{ color: codeButtonDisabled ? '#8a98ad' : '#1677ff' }}>{codeButtonText}</Text>
          </View>
        </View>
        <Input
          style={{ height: '48px', border: '1px solid #e5e5e5', borderRadius: '12px', paddingLeft: '16px', fontSize: '15px', marginBottom: '14px' }}
          placeholder="设置密码（至少6位）"
          password
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
        />
        <Input
          style={{ height: '48px', border: '1px solid #e5e5e5', borderRadius: '12px', paddingLeft: '16px', fontSize: '15px', marginBottom: '14px' }}
          placeholder="昵称（选填）"
          value={nickname}
          onInput={(e) => setNickname(e.detail.value)}
        />
        <Button
          style={{ height: '50px', backgroundColor: submitting ? '#91caff' : '#1677ff', borderRadius: '14px', color: '#fff', fontSize: '17px', fontWeight: '700', lineHeight: '50px', border: 'none', marginTop: '8px' }}
          onClick={handleRegister}
          loading={submitting}
        >
          注册
        </Button>
      </View>
      <Text
        style={{ color: '#1677ff', fontSize: '13px', textAlign: 'center', marginTop: '20px', display: 'block' }}
        onClick={() => {
          const url = `/pages/auth/login/index${routeRoleMode ? `?roleMode=${routeRoleMode}` : ''}`;
          // 用 redirectTo 替换当前页，避免 register/login 反复 push 撑栈
          Taro.redirectTo({ url }).catch(() => {
            Taro.navigateTo({ url }).catch(() => null);
          });
        }}
      >
        已有账号？去登录
      </Text>
    </View>
  );
}
