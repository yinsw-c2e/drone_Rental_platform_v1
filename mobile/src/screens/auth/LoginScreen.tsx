import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import * as WeChat from 'react-native-wechat-lib';
import {useDispatch} from 'react-redux';
import {authService} from '../../services/auth';
import {setCredentials} from '../../store/slices/authSlice';
import {THIRD_PARTY_LOGIN} from '../../constants';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {loginAssets} from '../../assets/miniProgramAssets';

const QUICK_LOGIN_ACCOUNTS = {
  client: [
    {label: '客户样本 (13800000004)', phone: '13800000004', password: 'password123', role: '客户'},
  ],
  owner: [
    {label: '机主样本 (13800000007)', phone: '13800000007', password: 'password123', role: '机主'},
  ],
  pilot: [
    {label: '飞手样本 (13900000016)', phone: '13900000016', password: 'password123', role: '飞手'},
    {label: '陈飞手 (13900000017)', phone: '13900000017', password: 'password123', role: '飞手'},
  ],
  composite: [
    {label: '复合身份样本 (13800000002)', phone: '13800000002', password: 'password123', role: '复合身份'},
  ],
  admin: [
    {label: '管理员 (13800000001)', phone: '13800000001', password: 'password123', role: '管理员'},
  ],
};

type AccountItem = {label: string; phone: string; password: string; role: string};
type DropdownKey = 'client' | 'owner' | 'pilot' | 'composite' | 'admin';

const ROLE_CATEGORIES: Array<{key: DropdownKey; label: string; color: string}> = [
  {key: 'client', label: '客户', color: '#2A78FF'},
  {key: 'owner', label: '机主', color: '#19A974'},
  {key: 'pilot', label: '飞手', color: '#FA8C16'},
  {key: 'composite', label: '复合', color: '#F5222D'},
];

const ROLE_ACCOUNTS: Record<DropdownKey, AccountItem[]> = {
  client: QUICK_LOGIN_ACCOUNTS.client,
  owner: QUICK_LOGIN_ACCOUNTS.owner,
  pilot: QUICK_LOGIN_ACCOUNTS.pilot,
  composite: [
    ...QUICK_LOGIN_ACCOUNTS.composite,
    ...QUICK_LOGIN_ACCOUNTS.admin,
  ],
  admin: QUICK_LOGIN_ACCOUNTS.admin,
};

export default function LoginScreen({navigation}: any) {
  const {theme, toggleTheme} = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const styles = getStyles(theme);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('password');
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // 初始化微信 SDK
  useEffect(() => {
    const appId = THIRD_PARTY_LOGIN.wechatAppId;
    if (appId && WeChat && WeChat.registerApp) {
      WeChat.registerApp(appId, 'https://dronerentalplat.cpolar.top/app/')
        .then(() => console.log('[WeChat] SDK registered'))
        .catch((e: any) => console.warn('[WeChat] register failed:', e));
    } else {
      console.warn('[WeChat] SDK not available or appId empty, appId=', appId, 'WeChat=', WeChat);
    }
  }, []);

  const beginSubmit = () => {
    if (submittingRef.current) return null;
    submittingRef.current = true;
    requestIdRef.current += 1;
    setSubmitting(true);
    return requestIdRef.current;
  };

  const isLatestRequest = (requestId: number) =>
    mountedRef.current && requestIdRef.current === requestId;

  const finishSubmit = (requestId: number) => {
    if (requestIdRef.current === requestId) submittingRef.current = false;
    if (isLatestRequest(requestId)) setSubmitting(false);
  };

  const handleWeChatLogin = async () => {
    console.log('[WeChat] handleWeChatLogin called');
    const appId = THIRD_PARTY_LOGIN.wechatAppId;
    console.log('[WeChat] appId =', JSON.stringify(appId));
    console.log('[WeChat] WeChat module keys:', Object.keys(WeChat));
    if (!appId) {
      Alert.alert('提示', '微信登录未配置 AppID');
      return;
    }
    try {
      console.log('[WeChat] Checking isWXAppInstalled...');
      const isInstalled = await WeChat.isWXAppInstalled();
      console.log('[WeChat] isInstalled =', isInstalled);
      if (!isInstalled) {
        Alert.alert('提示', '请先安装微信 App');
        return;
      }
      console.log('[WeChat] Sending auth request...');
      const result = await WeChat.sendAuthRequest('snsapi_userinfo');
      console.log('[WeChat] Auth result:', JSON.stringify(result));
      if (result.errCode === 0 && result.code) {
        const requestId = beginSubmit();
        if (!requestId) return;
        try {
          const res = await authService.wechatLogin(result.code);
          if (!isLatestRequest(requestId)) return;
          dispatch(setCredentials({
            user: res.data.user,
            token: res.data.token,
            roleSummary: (res.data as any).role_summary || null,
          }));
        } catch (e: any) {
          if (isLatestRequest(requestId)) Alert.alert('微信登录失败', e.message);
        } finally {
          finishSubmit(requestId);
        }
      } else if (result.errCode === -2) {
        // 用户取消
      } else {
        Alert.alert('微信授权失败', `错误码: ${result.errCode}`);
      }
    } catch (e: any) {
      console.log('[WeChat] Error:', e);
      Alert.alert('微信登录失败', e.message || '无法拉起微信');
    }
  };

  const sendCode = async () => {
    if (!phone || phone.length !== 11) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }
    try {
      await authService.sendCode(phone);
      Alert.alert('提示', '验证码已发送（开发模式请查看控制台）');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    }
  };

  const handleLogin = async () => {
    if (!phone) { Alert.alert('提示', '请输入手机号'); return; }
    const requestId = beginSubmit();
    if (!requestId) return;
    try {
      let res;
      if (loginMode === 'code') {
        res = await authService.login(phone, undefined, code);
      } else {
        res = await authService.login(phone, password);
      }
      if (!isLatestRequest(requestId)) return;
      dispatch(setCredentials({
        user: res.data.user,
        token: res.data.token,
        roleSummary: res.data.role_summary || null,
      }));
    } catch (e: any) {
      if (isLatestRequest(requestId)) Alert.alert('登录失败', e.message);
    } finally {
      finishSubmit(requestId);
    }
  };

  const quickLogin = async (userPhone: string, userPassword: string) => {
    const requestId = beginSubmit();
    if (!requestId) return;
    try {
      const res = await authService.login(userPhone, userPassword);
      if (!isLatestRequest(requestId)) return;
      dispatch(setCredentials({
        user: res.data.user,
        token: res.data.token,
        roleSummary: res.data.role_summary || null,
      }));
    } catch (e: any) {
      if (!isLatestRequest(requestId)) return;
      const errorMsg = e.message || '未知错误';
      Alert.alert('快速登录失败', errorMsg);
    } finally {
      finishSubmit(requestId);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.isDark ? ['#060B18', '#0A1025', '#111D35'] : ['#EEF7FF', '#F6FAFF', '#ECF5FF', '#F7FBFF']}
        style={StyleSheet.absoluteFill}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
      />
      {!theme.isDark ? (
        <Image source={loginAssets.bg} style={styles.bgImage} resizeMode="contain" />
      ) : null}
      {theme.isDark && (
        <>
          <View style={[styles.glowOrb, {top: -80, left: -60, backgroundColor: 'rgba(0,212,255,0.07)'}]} />
          <View style={[styles.glowOrb, {top: 220, right: -100, backgroundColor: 'rgba(0,100,255,0.05)'}]} />
        </>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kavFlex}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, {paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.title}>无人机服务</Text>
            <View style={styles.subtitleRow}>
              <View style={styles.subtitleLine} />
              <Text style={styles.subtitle}>重载运输调度平台</Text>
              <View style={styles.subtitleLine} />
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputRow}>
              <Image source={loginAssets.phone} style={styles.inputIcon} resizeMode="contain" />
              <TextInput
                style={styles.input}
                placeholder="手机号"
                placeholderTextColor={theme.inputPlaceholder}
                keyboardType="phone-pad"
                maxLength={11}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
            {loginMode === 'code' ? (
              <View style={[styles.inputRow, styles.codeRow]}>
                <Image source={loginAssets.lock} style={styles.inputIcon} resizeMode="contain" />
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="验证码"
                  placeholderTextColor={theme.inputPlaceholder}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
                <TouchableOpacity
                  style={[styles.codeBtn, countdown > 0 && styles.codeBtnDisabled]}
                  onPress={sendCode}
                  disabled={countdown > 0}>
                  <Text style={styles.codeBtnText}>
                    {countdown > 0 ? `重新发送(${countdown}s)` : '发送验证码'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <Image source={loginAssets.lock} style={styles.inputIcon} resizeMode="contain" />
                <TextInput
                  style={styles.input}
                  placeholder="密码"
                  placeholderTextColor={theme.inputPlaceholder}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(value => !value)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Image source={loginAssets.eyeOff} style={styles.eyeIcon} resizeMode="contain" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={[styles.loginBtn, submitting && styles.loginBtnDisabled]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={submitting}>
              <Text style={styles.loginBtnText}>{submitting ? '登录中...' : '登 录'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={() => setLoginMode(loginMode === 'code' ? 'password' : 'code')}>
              <Text style={styles.linkText}>
                {loginMode === 'code' ? '使用密码登录' : '使用验证码登录'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>注册新账号</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.thirdPartySection}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>其他登录方式</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.thirdPartyButtons}>
              <TouchableOpacity style={styles.thirdPartyBtn} onPress={handleWeChatLogin}>
                <View style={[styles.tpIconWrap, styles.wechatIconWrap]}>
                  <Image source={loginAssets.wechat} style={styles.wechatIcon} resizeMode="contain" />
                </View>
                <Text style={styles.tpLabel}>微信登录</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.devSection}>
            <View style={styles.devTitleRow}>
              <Image source={loginAssets.tools} style={styles.devToolsIcon} resizeMode="contain" />
              <Text style={styles.devTitle}>开发模式快速登录</Text>
            </View>
            {ROLE_CATEGORIES.map(({key, label, color}) => {
              const accounts = ROLE_ACCOUNTS[key] || [];
              return (
                <View key={key} style={styles.devGroup}>
                  <View style={styles.devRoleRow}>
                    <Image source={loginAssets.user} style={styles.devUserIcon} resizeMode="contain" />
                    <Text style={[styles.devRoleText, {color}]}>{label}</Text>
                  </View>
                  <View style={styles.devAccountList}>
                    {accounts.map(account => (
                      <TouchableOpacity
                        key={account.phone}
                        activeOpacity={0.76}
                        style={[styles.devAccountBtn, {borderColor: color}]}
                        onPress={() => quickLogin(account.phone, account.password)}
                        disabled={submitting}>
                        <Text style={[styles.devAccountText, {color}]}>
                          {submitting ? '登录中...' : account.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {accounts.length === 0 ? (
                    <Text style={styles.devEmpty}>暂无可用账号</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <TouchableOpacity
        style={[styles.themeToggle, {top: insets.top + 10}]}
        onPress={toggleTheme}
        activeOpacity={0.7}
        hitSlop={{top: 12, right: 12, bottom: 12, left: 12}}>
        <View style={styles.togglePill}>
          <Text style={styles.toggleIcon}>{theme.isDark ? '☀️' : '🌙'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.bg},
  bgImage: {
    position: 'absolute',
    top: -260,
    left: 0,
    right: 0,
    width: '100%',
    height: 520,
    opacity: 0.98,
  },
  kavFlex: {flex: 1},
  scrollContent: {paddingHorizontal: 17},
  glowOrb: {position: 'absolute', width: 260, height: 260, borderRadius: 130},
  hero: {
    alignItems: 'center',
    transform: [{translateX: -47}, {translateY: 15}],
  },
  title: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '700',
    color: theme.isDark ? theme.primary : '#0D3F92',
    textAlign: 'center',
    letterSpacing: 0,
    textShadowColor: theme.isDark ? theme.primary : 'transparent',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: theme.isDark ? 24 : 0,
  },
  subtitleRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  subtitleLine: {
    width: 42,
    height: 1,
    backgroundColor: '#CFD8E5',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7E8AA0',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0,
  },
  formCard: {
    marginTop: 126,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(230,236,245,0.92)',
    shadowColor: theme.isDark ? 'transparent' : '#000',
    shadowOffset: {width: 0, height: 7},
    shadowOpacity: theme.isDark ? 0 : 0.06,
    shadowRadius: theme.isDark ? 0 : 17,
    elevation: theme.isDark ? 0 : 4,
  },
  inputRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.isDark ? theme.inputBg : 'rgba(248,250,253,0.88)',
    borderWidth: 1,
    borderColor: theme.isDark ? theme.inputBorder : '#D7E0EE',
    marginBottom: 11,
  },
  inputIcon: {
    width: 18,
    height: 18,
  },
  eyeIcon: {
    width: 18,
    height: 18,
    opacity: 0.72,
  },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 14,
    backgroundColor: 'transparent',
    color: theme.inputText,
  },
  codeRow: {marginBottom: 11},
  codeInput: {flex: 1, marginRight: 0, marginBottom: 0},
  codeBtn: {
    height: 30,
    minWidth: 78,
    paddingHorizontal: 9,
    backgroundColor: theme.btnPrimary,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeBtnDisabled: {backgroundColor: theme.textHint},
  codeBtnText: {color: theme.btnPrimaryText, fontSize: 11, fontWeight: '600'},
  loginBtn: {
    height: 48,
    backgroundColor: theme.btnPrimary,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    shadowColor: theme.primary,
    shadowOffset: {width: 0, height: theme.isDark ? 0 : 5},
    shadowOpacity: theme.isDark ? 0.4 : 0.18,
    shadowRadius: theme.isDark ? 16 : 12,
    elevation: theme.isDark ? 8 : 6,
  },
  loginBtnDisabled: {opacity: 0.6},
  loginBtnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: '700', letterSpacing: 0},
  linksRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 19, paddingHorizontal: 4},
  linkText: {color: theme.primary, fontSize: 13, fontWeight: '500'},
  thirdPartySection: {marginTop: 41},
  dividerRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 24},
  dividerLine: {flex: 1, height: 1, backgroundColor: '#D8E0EC'},
  dividerText: {color: '#8F9AAC', fontSize: 12, marginHorizontal: 10},
  thirdPartyButtons: {flexDirection: 'row', justifyContent: 'center'},
  thirdPartyBtn: {alignItems: 'center', marginHorizontal: 28},
  tpIconWrap: {
    width: 47, height: 47, borderRadius: 24,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : theme.bgTertiary,
    borderWidth: theme.isDark ? 1 : 4,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.96)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    shadowColor: '#165A2D',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: theme.isDark ? 0 : 0.16,
    shadowRadius: 10,
  },
  wechatIconWrap: {backgroundColor: '#19C160'},
  wechatIcon: {width: 29, height: 29},
  tpLabel: {fontSize: 12, color: '#334155'},
  devSection: {
    marginTop: 36,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 13,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(230,236,245,0.96)',
    shadowColor: '#173366',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: theme.isDark ? 0 : 0.05,
    shadowRadius: 13,
    elevation: theme.isDark ? 0 : 2,
  },
  devTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  devToolsIcon: {
    width: 15,
    height: 15,
    marginRight: 6,
  },
  devTitle: {fontSize: 12, color: '#8D97A8', fontWeight: '500'},
  devGroup: {marginTop: 11},
  devRoleRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  devUserIcon: {width: 14, height: 14},
  devRoleText: {fontSize: 14, lineHeight: 20, fontWeight: '600'},
  devAccountList: {marginTop: 7, gap: 7},
  devAccountBtn: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.98)',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  devAccountText: {fontSize: 13, lineHeight: 18, fontWeight: '600'},
  devEmpty: {paddingVertical: 7, color: theme.textHint, fontSize: 12},
  themeToggle: {position: 'absolute', right: 20, zIndex: 999},
  togglePill: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    borderWidth: 1, borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  toggleIcon: {fontSize: 20},
});
