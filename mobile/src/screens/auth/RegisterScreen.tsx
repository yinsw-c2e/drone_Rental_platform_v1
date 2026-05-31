import React, {useEffect, useRef, useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {authService} from '../../services/auth';
import {setCredentials} from '../../store/slices/authSlice';
import {
  HaulRoleMode,
  setHaulRoleMode,
} from '../../store/slices/roleSlice';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {friendlyErrorMessage} from '../../utils/errorMessage';
import {syncPreferredModeWithBackend} from '../../utils/preferredMode';
import {setPostAuthRedirect} from '../../utils/postAuthRedirect';

const normalizeRoleMode = (value?: string): HaulRoleMode | null =>
  value === 'provider' || value === 'customer' ? value : null;
const PHONE_REGEX = /^1[3-9]\d{9}$/;
const COUNTDOWN_SECONDS = 60;

export default function RegisterScreen({navigation, route}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const routeRoleMode = normalizeRoleMode(route?.params?.roleMode);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeSentPhone, setCodeSentPhone] = useState('');
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeMode = routeRoleMode || 'customer';

  useEffect(() => {
    if (routeRoleMode) {
      dispatch(setHaulRoleMode(routeRoleMode));
    }
  }, [dispatch, routeRoleMode]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const startCountdown = () => {
    setCountdown(COUNTDOWN_SECONDS);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
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

  const sendCode = async () => {
    if (sendingCode || countdown > 0) {
      return;
    }
    if (!PHONE_REGEX.test(phone)) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }
    setSendingCode(true);
    try {
      await authService.sendCode(phone);
      Alert.alert('提示', '验证码已发送');
      setCodeSentPhone(phone);
      startCountdown();
    } catch (e: any) {
      Alert.alert('错误', friendlyErrorMessage(e, '发送失败，请稍后重试'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async () => {
    if (!PHONE_REGEX.test(phone)) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }
    if (codeSentPhone !== phone) {
      Alert.alert('提示', '请先发送验证码');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('提示', '请输入 6 位验证码');
      return;
    }
    if (password.length < 6) {
      Alert.alert('提示', '密码至少6位');
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await authService.register(phone, password, code, nickname);
      dispatch(setHaulRoleMode(activeMode));
      if (activeMode === 'provider') {
        setPostAuthRedirect({name: 'ProviderOnboarding', params: {from: 'register'}});
      }
      dispatch(setCredentials({
        user: res.data.user,
        token: res.data.token,
        roleSummary: res.data.role_summary || null,
      }));
      syncPreferredModeWithBackend(activeMode);
    } catch (e: any) {
      Alert.alert('注册失败', friendlyErrorMessage(e, '注册失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>注册新账号</Text>
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="手机号"
            keyboardType="phone-pad"
            maxLength={11}
            value={phone}
            onChangeText={value => {
              setPhone(value);
              if (value !== codeSentPhone) {
                setCodeSentPhone('');
              }
            }}
          />
          <View style={styles.codeRow}>
            <TextInput style={[styles.input, styles.codeInput]} placeholder="验证码" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
            <TouchableOpacity
              style={[styles.codeBtn, (countdown > 0 || sendingCode) && styles.codeBtnDisabled]}
              onPress={sendCode}
              disabled={countdown > 0 || sendingCode}>
              <Text style={styles.codeBtnText}>
                {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="设置密码（至少6位）" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="昵称（选填）" value={nickname} onChangeText={setNickname} />
          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={submitting}>
            <Text style={styles.btnText}>{submitting ? '注册中...' : '注册'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.replace('Login', {roleMode: activeMode})}>
          <Text style={styles.loginLinkText}>已有账号？去登录</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  content: {flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40},
  title: {fontSize: 24, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 32},
  formCard: {backgroundColor: theme.card, borderRadius: 16, padding: 20},
  input: {height: 48, borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: theme.text, backgroundColor: theme.inputBg, marginBottom: 14},
  codeRow: {flexDirection: 'row', alignItems: 'center'},
  codeInput: {flex: 1, marginRight: 12},
  codeBtn: {height: 48, paddingHorizontal: 14, backgroundColor: theme.primary, borderRadius: 12, justifyContent: 'center', marginBottom: 14},
  codeBtnDisabled: {backgroundColor: theme.primary + '66'},
  codeBtnText: {color: theme.btnPrimaryText, fontSize: 13, fontWeight: '700'},
  btn: {height: 50, backgroundColor: theme.primary, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 8},
  btnDisabled: {opacity: 0.6},
  btnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: '700'},
  loginLink: {marginTop: 20, alignItems: 'center'},
  loginLinkText: {color: theme.primaryText, fontSize: 13},
});
