import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {authService} from '../../services/auth';
import {setCredentials} from '../../store/slices/authSlice';
import {API_BASE_URL, WS_BASE_URL, APP_CONFIG} from '../../constants';

// ============ 快速登录账号数据 ============
const QUICK_LOGIN_ACCOUNTS = {
  business: [
    {label: '业主1 (13800000002)', phone: '13800000002', password: 'password123', role: '业主1'},
    {label: '业主2 (13800000003)', phone: '13800000003', password: 'password123', role: '业主2'},
    {label: '业主6 (13800000006)', phone: '13800000006', password: 'password123', role: '业主6'},
    {label: '业主7 (13800000007)', phone: '13800000007', password: 'password123', role: '业主7'},
  ],
  pilot: [
    {label: '张飞手 (13900000013)', phone: '13900000013', password: 'password123', role: '飞手·张'},
    {label: '李飞手 (13900000014)', phone: '13900000014', password: 'password123', role: '飞手·李'},
    {label: '王飞手 (13900000015)', phone: '13900000015', password: 'password123', role: '飞手·王'},
    {label: '赵飞手 (13900000016)', phone: '13900000016', password: 'password123', role: '飞手·赵'},
    {label: '陈飞手 (13900000017)', phone: '13900000017', password: 'password123', role: '飞手·陈'},
  ],
  renter: [
    {label: '租客1 (13800000004)', phone: '13800000004', password: 'password123', role: '租客1'},
    {label: '租客2 (13800000005)', phone: '13800000005', password: 'password123', role: '租客2'},
  ],
  admin: [
    {label: '管理员 (13800000001)', phone: '13800000001', password: 'password123', role: '管理员'},
  ],
};

type AccountItem = {label: string; phone: string; password: string; role: string};
type DropdownKey = 'business' | 'pilot' | 'renter' | 'admin';

export default function LoginScreen({navigation}: any) {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('code');
  const [countdown, setCountdown] = useState(0);
  const [debugError, setDebugError] = useState<string>(''); // 调试错误信息
  const [showConfig, setShowConfig] = useState(false); // 配置信息展开/折叠

  // 下拉框状态
  const [dropdown, setDropdown] = useState<{key: DropdownKey; visible: boolean} | null>(null);
  const [selected, setSelected] = useState<{[k in DropdownKey]?: AccountItem}>({});

  const handleWeChatLogin = () => {
    // 微信SDK需要原生模块支持，这里提示需要配置
    Alert.alert(
      '微信登录',
      '微信登录需要在微信开放平台注册应用并集成SDK。\n\n当前开发模式，请使用手机号登录。',
      [{text: '确定'}],
    );
  };

  const handleQQLogin = () => {
    // QQ SDK需要原生模块支持，这里提示需要配置
    Alert.alert(
      'QQ登录',
      'QQ登录需要在QQ互联平台注册应用并集成SDK。\n\n当前开发模式，请使用手机号登录。',
      [{text: '确定'}],
    );
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
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    }
  };

  const handleLogin = async () => {
    if (!phone) {
      Alert.alert('提示', '请输入手机号');
      return;
    }
    try {
      let res;
      if (loginMode === 'code') {
        res = await authService.login(phone, undefined, code);
      } else {
        res = await authService.login(phone, password);
      }
      dispatch(setCredentials(res.data));
    } catch (e: any) {
      Alert.alert('登录失败', e.message);
    }
  };

  // 快速登录（开发模式）
  const quickLogin = async (userPhone: string, userPassword: string, role: string) => {
    setDebugError(''); // 清空之前的错误
    try {
      const startTime = Date.now();
      const res = await authService.login(userPhone, userPassword);
      const elapsed = Date.now() - startTime;
      
      dispatch(setCredentials(res.data));
      
      // 成功信息
      const successMsg = `✅ 登录成功\n角色: ${role}\n耗时: ${elapsed}ms\nAPI: ${API_BASE_URL}`;
      setDebugError(successMsg);
      Alert.alert('成功', `已登录为${role}`);
    } catch (e: any) {
      const errorMsg = e.message || '未知错误';
      const errorDetails = `❌ 快速登录失败\n\n账号: ${userPhone}\n密码: ${userPassword}\n角色: ${role}\n\nAPI: ${API_BASE_URL}\n\n错误信息:\n${errorMsg}\n\n原始错误:\n${JSON.stringify(e, null, 2)}`;
      
      setDebugError(errorDetails);
      
      // 也显示 Alert，但不阻断查看详细信息
      Alert.alert('快速登录失败', `${errorMsg}\n\n详细错误信息请查看下方红色区域`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}>
        <Text style={styles.title}>无人机租赁平台</Text>
        <Text style={styles.subtitle}>登录 / 注册</Text>

        <TextInput
          style={styles.input}
          placeholder="手机号"
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
                {countdown > 0 ? `${countdown}s` : '发送验证码'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="密码"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
          <Text style={styles.loginBtnText}>登录</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => setLoginMode(loginMode === 'code' ? 'password' : 'code')}>
          <Text style={styles.switchBtnText}>
            {loginMode === 'code' ? '使用密码登录' : '使用验证码登录'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => navigation.navigate('Register')}>
          <Text style={styles.switchBtnText}>注册新账号</Text>
        </TouchableOpacity>

        {/* 第三方登录 */}
        <View style={styles.thirdPartySection}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>其他登录方式</Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={styles.thirdPartyButtons}>
            <TouchableOpacity
              style={styles.thirdPartyBtn}
              onPress={handleWeChatLogin}>
              <Text style={styles.thirdPartyIcon}>{'💬'}</Text>
              <Text style={styles.thirdPartyLabel}>微信</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.thirdPartyBtn}
              onPress={handleQQLogin}>
              <Text style={styles.thirdPartyIcon}>{'🐧'}</Text>
              <Text style={styles.thirdPartyLabel}>QQ</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 开发模式快速登录 */}
        {/* 配置信息显示（可折叠） */}
        <TouchableOpacity 
          style={styles.configToggle}
          onPress={() => setShowConfig(!showConfig)}>
          <Text style={styles.configToggleText}>
            {showConfig ? '🔽' : '🔼'} 配置信息 {showConfig ? '(点击收起)' : '(点击展开)'}
          </Text>
        </TouchableOpacity>
        
        {showConfig && (
          <View style={styles.configInfo}>
            <Text style={styles.configText}>API: {API_BASE_URL}</Text>
            <Text style={styles.configText}>WS: {WS_BASE_URL}</Text>
            <Text style={styles.configText}>环境: {APP_CONFIG.env}</Text>
          </View>
        )}

        {/* 错误信息显示区域 */}
        {debugError ? (
          <View style={debugError.includes('✅') ? styles.debugSuccess : styles.debugError}>
            <ScrollView style={{maxHeight: 280}}>
              <Text style={debugError.includes('✅') ? styles.debugSuccessText : styles.debugErrorText}>
                {debugError}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.devSection}>
          <Text style={styles.devTitle}>🛠️ 开发模式快速登录</Text>

          {([
            {key: 'business' as DropdownKey, label: '🏠 业主', color: '#1890ff'},
            {key: 'pilot' as DropdownKey, label: '✈️ 飞手', color: '#52c41a'},
            {key: 'renter' as DropdownKey, label: '📦 租客', color: '#fa8c16'},
            {key: 'admin' as DropdownKey, label: '⚙️ 管理员', color: '#722ed1'},
          ]).map(({key, label, color}) => {
            const acct = selected[key];
            const accounts = QUICK_LOGIN_ACCOUNTS[key];
            return (
              <View key={key} style={styles.devRow}>
                {/* 下拉选择器 */}
                <TouchableOpacity
                  style={styles.devDropdown}
                  onPress={() => setDropdown({key, visible: true})}>
                  <Text style={[styles.devDropdownLabel, {color}]}>{label}</Text>
                  <Text style={styles.devDropdownValue} numberOfLines={1}>
                    {acct ? acct.label : `选择${label.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|\s/gu, '')}账号`}
                  </Text>
                  <Text style={styles.devDropdownArrow}>▾</Text>
                </TouchableOpacity>
                {/* 一键登录按钮 */}
                <TouchableOpacity
                  style={[styles.devLoginBtn, {backgroundColor: acct ? color : '#d9d9d9'}]}
                  onPress={() => acct && quickLogin(acct.phone, acct.password, acct.role)}
                  disabled={!acct}>
                  <Text style={styles.devLoginBtnText}>登录</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* 下拉弹窗 */}
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
                    business: '🏠 选择业主账号',
                    pilot: '✈️ 选择飞手账号',
                    renter: '📦 选择租客账号',
                    admin: '⚙️ 选择管理员账号',
                  }[dropdown.key] : ''}
                </Text>
                <FlatList
                  data={dropdown ? QUICK_LOGIN_ACCOUNTS[dropdown.key] : []}
                  keyExtractor={item => item.phone}
                  renderItem={({item}) => (
                    <TouchableOpacity
                      style={[
                        styles.modalItem,
                        selected[dropdown!.key]?.phone === item.phone && styles.modalItemActive,
                      ]}
                      onPress={() => {
                        setSelected(prev => ({...prev, [dropdown!.key]: item}));
                        setDropdown(null);
                      }}>
                      <Text style={[
                        styles.modalItemText,
                        selected[dropdown!.key]?.phone === item.phone && styles.modalItemTextActive,
                      ]}>{item.label}</Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  content: {flex: 1, justifyContent: 'center', padding: 24},
  title: {fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#1890ff'},
  subtitle: {fontSize: 16, textAlign: 'center', color: '#666', marginTop: 8, marginBottom: 40},
  input: {
    height: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 16, fontSize: 16, marginBottom: 16,
  },
  codeRow: {flexDirection: 'row', alignItems: 'center'},
  codeInput: {flex: 1, marginRight: 12},
  codeBtn: {
    height: 48, paddingHorizontal: 16, backgroundColor: '#1890ff',
    borderRadius: 8, justifyContent: 'center',
  },
  codeBtnDisabled: {backgroundColor: '#ccc'},
  codeBtnText: {color: '#fff', fontSize: 14},
  loginBtn: {
    height: 48, backgroundColor: '#1890ff', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  loginBtnText: {color: '#fff', fontSize: 18, fontWeight: 'bold'},
  switchBtn: {marginTop: 16, alignItems: 'center'},
  switchBtnText: {color: '#1890ff', fontSize: 14},
  devSection: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  devTitle: {
    fontSize: 13,
    color: '#bbb',
    textAlign: 'center',
    marginBottom: 10,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  devDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fafafa',
  },
  devDropdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
    minWidth: 44,
  },
  devDropdownValue: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  devDropdownArrow: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  devLoginBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devLoginBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: '100%',
    maxHeight: 340,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalItemActive: {
    backgroundColor: '#e6f7ff',
  },
  modalItemText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  modalItemTextActive: {
    color: '#1890ff',
    fontWeight: '500',
  },
  modalItemCheck: {
    fontSize: 16,
    color: '#1890ff',
  },
  thirdPartySection: {
    marginTop: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e8e8e8',
  },
  dividerText: {
    color: '#999',
    fontSize: 13,
    marginHorizontal: 12,
  },
  thirdPartyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  thirdPartyBtn: {
    alignItems: 'center',
    marginHorizontal: 24,
  },
  thirdPartyIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  thirdPartyLabel: {
    fontSize: 12,
    color: '#666',
  },
  configToggle: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#91caff',
    alignItems: 'center',
  },
  configToggleText: {
    fontSize: 12,
    color: '#1890ff',
    fontWeight: '500',
  },
  configInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#91caff',
  },
  configTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1890ff',
    marginBottom: 10,
  },
  configText: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  debugError: {
    backgroundColor: '#fff2f0',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#ff4d4f',
    maxHeight: 300,
  },
  debugErrorText: {
    fontSize: 11,
    color: '#ff4d4f',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  debugSuccess: {
    backgroundColor: '#f6ffed',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#52c41a',
  },
  debugSuccessText: {
    fontSize: 11,
    color: '#52c41a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
});
