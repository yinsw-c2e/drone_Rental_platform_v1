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
  Modal,
  FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useDispatch} from 'react-redux';
import {authService} from '../../services/auth';
import {setCredentials} from '../../store/slices/authSlice';
import {API_BASE_URL} from '../../constants';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const QUICK_LOGIN_ACCOUNTS = {
  client: [
    {label: '客户样本 (13800000004)', phone: '13800000004', password: 'password123', role: '客户'},
  ],
  owner: [
    {label: '机主样本 (13800000007)', phone: '13800000007', password: 'password123', role: '机主'},
  ],
  pilot: [
    {label: '飞手样本 (13900000016)', phone: '13900000016', password: 'password123', role: '飞手'},
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

export default function LoginScreen({navigation}: any) {
  const {theme, toggleTheme} = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const styles = getStyles(theme);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('code');
  const [countdown, setCountdown] = useState(0);
  const [debugError, setDebugError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [dropdown, setDropdown] = useState<{key: DropdownKey; visible: boolean} | null>(null);
  const [selected, setSelected] = useState<{[k in DropdownKey]?: AccountItem}>({});
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
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

  const handleWeChatLogin = () => {
    Alert.alert('微信登录', '微信登录需要在微信开放平台注册应用并集成SDK。\n\n当前开发模式，请使用手机号登录。', [{text: '确定'}]);
  };

  const handleQQLogin = () => {
    Alert.alert('QQ登录', 'QQ登录需要在QQ互联平台注册应用并集成SDK。\n\n当前开发模式，请使用手机号登录。', [{text: '确定'}]);
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
      setDebugError('');
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

  const quickLogin = async (userPhone: string, userPassword: string, role: string) => {
    const requestId = beginSubmit();
    if (!requestId) return;
    setDebugError('');
    try {
      const startTime = Date.now();
      const res = await authService.login(userPhone, userPassword);
      if (!isLatestRequest(requestId)) return;
      const elapsed = Date.now() - startTime;
      dispatch(setCredentials({
        user: res.data.user,
        token: res.data.token,
        roleSummary: res.data.role_summary || null,
      }));
      setDebugError(`✅ 登录成功\n角色: ${role}\n耗时: ${elapsed}ms\nAPI: ${API_BASE_URL}`);
    } catch (e: any) {
      if (!isLatestRequest(requestId)) return;
      const errorMsg = e.message || '未知错误';
      const errorDetails = `❌ 快速登录失败\n\n账号: ${userPhone}\n密码: ${userPassword}\n角色: ${role}\n\nAPI: ${API_BASE_URL}\n\n错误信息:\n${errorMsg}\n\n原始错误:\n${JSON.stringify(e, null, 2)}`;
      setDebugError(errorDetails);
      Alert.alert('快速登录失败', `${errorMsg}\n\n详细错误信息请查看下方红色区域`);
    } finally {
      finishSubmit(requestId);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.isDark ? ['#060B18', '#0A1025', '#111D35'] : [theme.bg, theme.bgTertiary, theme.bg]}
        style={StyleSheet.absoluteFill}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
      />
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
          <Text style={styles.title}>无人机租赁平台</Text>
          <Text style={styles.subtitle}>登录 / 注册</Text>

          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="手机号"
              placeholderTextColor={theme.inputPlaceholder}
              keyboardType="phone-pad"
              maxLength={11}
              value={phone}
              onChangeText={setPhone}
            />
            {loginMode === 'code' ? (
              <View style={styles.codeRow}>
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
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor={theme.inputPlaceholder}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
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
                <View style={styles.tpIconWrap}>
                  <Text style={styles.tpIcon}>{'💬'}</Text>
                </View>
                <Text style={styles.tpLabel}>微信</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.thirdPartyBtn} onPress={handleQQLogin}>
                <View style={styles.tpIconWrap}>
                  <Text style={styles.tpIcon}>{'🐧'}</Text>
                </View>
                <Text style={styles.tpLabel}>QQ</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.devSection}>
            <Text style={styles.devTitle}>🛠️ 开发模式快速登录</Text>
            {([
              {key: 'client' as DropdownKey, label: '📦 客户', color: theme.primary},
              {key: 'owner' as DropdownKey, label: '🚁 机主', color: theme.success},
              {key: 'pilot' as DropdownKey, label: '✈️ 飞手', color: theme.warning},
              {key: 'composite' as DropdownKey, label: '🧩 复合身份', color: theme.danger},
            ]).map(({key, label, color}) => {
              const acct = selected[key];
              return (
                <View key={key} style={styles.devRow}>
                  <TouchableOpacity
                    style={styles.devDropdown}
                    onPress={() => setDropdown({key, visible: true})}>
                    <Text style={[styles.devDropdownLabel, {color}]}>{label}</Text>
                    <Text style={styles.devDropdownValue} numberOfLines={1}>
                      {acct ? acct.label : `选择${label.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|\s/gu, '')}账号`}
                    </Text>
                    <Text style={styles.devDropdownArrow}>▾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.devLoginBtn, {backgroundColor: acct ? color : theme.textHint}]}
                    onPress={() => acct && quickLogin(acct.phone, acct.password, acct.role)}
                    disabled={!acct || submitting}>
                    <Text style={styles.devLoginBtnText}>{submitting ? '...' : '登录'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <Modal
              visible={!!dropdown?.visible}
              transparent
              animationType="fade"
              onRequestClose={() => setDropdown(null)}>
              <TouchableOpacity
                style={styles.modalMask}
                activeOpacity={1}
                onPress={() => setDropdown(null)}>
                <View style={styles.modalBox}>
                  <Text style={styles.modalTitle}>
                    {dropdown ? {
                      client: '📦 选择客户账号',
                      owner: '🚁 选择机主账号',
                      pilot: '✈️ 选择飞手账号',
                      composite: '🧩 选择复合身份账号',
                      admin: '⚙️ 选择管理员账号',
                    }[dropdown.key] : ''}
                  </Text>
                  <FlatList
                    data={dropdown ? QUICK_LOGIN_ACCOUNTS[dropdown.key] : []}
                    keyExtractor={item => item.phone}
                    renderItem={({item}) => (
                      <TouchableOpacity
                        style={[styles.modalItem, selected[dropdown!.key]?.phone === item.phone && styles.modalItemActive]}
                        onPress={() => {
                          setSelected(prev => ({...prev, [dropdown!.key]: item}));
                          setDropdown(null);
                        }}>
                        <Text style={[styles.modalItemText, selected[dropdown!.key]?.phone === item.phone && styles.modalItemTextActive]}>
                          {item.label}
                        </Text>
                        {selected[dropdown!.key]?.phone === item.phone && (
                          <Text style={styles.modalItemCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
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
  kavFlex: {flex: 1},
  scrollContent: {paddingHorizontal: 28},
  glowOrb: {position: 'absolute', width: 260, height: 260, borderRadius: 130},
  title: {
    fontSize: 30, fontWeight: '800', color: theme.primary, textAlign: 'center', letterSpacing: 2,
    textShadowColor: theme.isDark ? theme.primary : 'transparent',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: theme.isDark ? 24 : 0,
  },
  subtitle: {fontSize: 15, color: theme.textSub, textAlign: 'center', marginTop: 8, marginBottom: 36, letterSpacing: 1},
  formCard: {
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    borderRadius: 20, padding: 20, borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : theme.cardBorder,
    shadowColor: theme.isDark ? 'transparent' : '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: theme.isDark ? 0 : 0.06,
    shadowRadius: theme.isDark ? 0 : 16,
    elevation: theme.isDark ? 0 : 4,
  },
  input: {
    height: 50, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 16, marginBottom: 14, backgroundColor: theme.inputBg, color: theme.inputText,
  },
  codeRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  codeInput: {flex: 1, marginRight: 12, marginBottom: 0},
  codeBtn: {height: 50, paddingHorizontal: 16, backgroundColor: theme.btnPrimary, borderRadius: 12, justifyContent: 'center'},
  codeBtnDisabled: {backgroundColor: theme.textHint},
  codeBtnText: {color: theme.btnPrimaryText, fontSize: 14, fontWeight: '600'},
  loginBtn: {
    height: 52, backgroundColor: theme.btnPrimary, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4,
    shadowColor: theme.primary,
    shadowOffset: {width: 0, height: theme.isDark ? 0 : 4},
    shadowOpacity: theme.isDark ? 0.4 : 0.25,
    shadowRadius: theme.isDark ? 16 : 8,
    elevation: theme.isDark ? 8 : 6,
  },
  loginBtnDisabled: {opacity: 0.6},
  loginBtnText: {color: theme.btnPrimaryText, fontSize: 18, fontWeight: '700', letterSpacing: 4},
  linksRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 4},
  linkText: {color: theme.primary, fontSize: 14},
  thirdPartySection: {marginTop: 32},
  dividerRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 24},
  dividerLine: {flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.divider},
  dividerText: {color: theme.textHint, fontSize: 13, marginHorizontal: 14},
  thirdPartyButtons: {flexDirection: 'row', justifyContent: 'center'},
  thirdPartyBtn: {alignItems: 'center', marginHorizontal: 28},
  tpIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : theme.bgTertiary,
    borderWidth: 1, borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : theme.cardBorder,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  tpIcon: {fontSize: 24},
  tpLabel: {fontSize: 12, color: theme.textSub},
  devSection: {marginTop: 36, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.divider},
  devTitle: {fontSize: 13, color: theme.textHint, textAlign: 'center', marginBottom: 12},
  devRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8},
  devDropdown: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: 42,
    borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 10, paddingHorizontal: 10, backgroundColor: theme.inputBg,
  },
  devDropdownLabel: {fontSize: 12, fontWeight: '600', marginRight: 6, minWidth: 44},
  devDropdownValue: {flex: 1, fontSize: 12, color: theme.textSub},
  devDropdownArrow: {fontSize: 12, color: theme.textHint, marginLeft: 4},
  devLoginBtn: {height: 42, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center', alignItems: 'center'},
  devLoginBtnText: {color: theme.btnPrimaryText, fontSize: 13, fontWeight: '600'},
  modalMask: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24},
  modalBox: {
    backgroundColor: theme.isDark ? theme.bgSecondary : '#FFFFFF',
    borderRadius: 16, width: '100%', maxHeight: 340, overflow: 'hidden',
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
  },
  modalTitle: {fontSize: 15, fontWeight: '600', color: theme.text, textAlign: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.divider},
  modalItem: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider},
  modalItemActive: {backgroundColor: theme.primaryBg},
  modalItemText: {flex: 1, fontSize: 14, color: theme.text},
  modalItemTextActive: {color: theme.primary, fontWeight: '600'},
  modalItemCheck: {fontSize: 16, color: theme.primary},
  themeToggle: {position: 'absolute', right: 20, zIndex: 999},
  togglePill: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    borderWidth: 1, borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  toggleIcon: {fontSize: 20},
});