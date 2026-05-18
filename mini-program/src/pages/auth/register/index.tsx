import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import { useDispatch } from 'react-redux';
import { authService } from '../../../services/auth';
import { setCredentials } from '../../../store/slices/authSlice';

export default function RegisterPage() {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!phone || !password) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authService.register(phone, password, nickname);
      dispatch(setCredentials({
        user: (res as any).user,
        token: (res as any).token,
        roleSummary: (res as any).role_summary || null,
      }));
      Taro.showToast({ title: '注册成功', icon: 'success' });
      Taro.switchTab({ url: '/pages/home/index' });
    } catch (e: any) {
      Taro.showToast({ title: e.message || '注册失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

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
        onClick={() => Taro.navigateBack()}
      >
        已有账号？去登录
      </Text>
    </View>
  );
}
