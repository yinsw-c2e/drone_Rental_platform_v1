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
} from 'react-native';
import {useDispatch} from 'react-redux';
import {authService} from '../../services/auth';
import {setCredentials} from '../../store/slices/authSlice';

export default function LoginScreen({navigation}: any) {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('code');
  const [countdown, setCountdown] = useState(0);

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
});
