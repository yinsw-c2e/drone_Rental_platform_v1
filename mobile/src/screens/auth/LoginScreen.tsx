import React, {useState} from 'react';
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
} from 'react-native';
import {useDispatch} from 'react-redux';
import {authService} from '../../services/auth';
import {setCredentials} from '../../store/slices/authSlice';
import {API_BASE_URL, WS_BASE_URL, APP_CONFIG} from '../../constants';

export default function LoginScreen({navigation}: any) {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('code');
  const [countdown, setCountdown] = useState(0);
  const [debugError, setDebugError] = useState<string>(''); // 调试错误信息
  const [showConfig, setShowConfig] = useState(false); // 配置信息展开/折叠

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
          <View style={styles.devButtons}>
            <TouchableOpacity
              style={styles.devBtn}
              onPress={() => quickLogin('13800000001', 'password123', '机主1')}>
              <Text style={styles.devBtnText}>机主1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devBtn}
              onPress={() => quickLogin('13800000002', 'password123', '机主2')}>
              <Text style={styles.devBtnText}>机主2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devBtn}
              onPress={() => quickLogin('13800000003', 'password123', '租客1')}>
              <Text style={styles.devBtnText}>租客1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.devBtn}
              onPress={() => quickLogin('13800000004', 'password123', '租客2')}>
              <Text style={styles.devBtnText}>租客2</Text>
            </TouchableOpacity>
          </View>
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
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  devTitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 12,
  },
  devButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  devBtn: {
    width: '48%',
    height: 44,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  devBtnText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
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
