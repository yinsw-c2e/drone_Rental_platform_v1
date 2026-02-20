import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {authService} from '../../services/auth';
import {setCredentials} from '../../store/slices/authSlice';

export default function RegisterScreen({navigation}: any) {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [countdown, setCountdown] = useState(0);

  const sendCode = async () => {
    if (!phone || phone.length !== 11) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }
    try {
      await authService.sendCode(phone);
      Alert.alert('提示', '验证码已发送');
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

  const handleRegister = async () => {
    if (!phone || !code || !password) {
      Alert.alert('提示', '请填写完整信息');
      return;
    }
    if (password.length < 6) {
      Alert.alert('提示', '密码至少6位');
      return;
    }
    try {
      const res = await authService.register(phone, password, code, nickname);
      dispatch(setCredentials(res.data));
    } catch (e: any) {
      Alert.alert('注册失败', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>注册新账号</Text>
        <TextInput style={styles.input} placeholder="手机号" keyboardType="phone-pad" maxLength={11} value={phone} onChangeText={setPhone} />
        <View style={styles.codeRow}>
          <TextInput style={[styles.input, {flex: 1, marginRight: 12}]} placeholder="验证码" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
          <TouchableOpacity style={[styles.codeBtn, countdown > 0 && {backgroundColor: '#ccc'}]} onPress={sendCode} disabled={countdown > 0}>
            <Text style={styles.codeBtnText}>{countdown > 0 ? `${countdown}s` : '发送验证码'}</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.input} placeholder="设置密码（至少6位）" secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder="昵称（选填）" value={nickname} onChangeText={setNickname} />
        <TouchableOpacity style={styles.btn} onPress={handleRegister}>
          <Text style={styles.btnText}>注册</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{marginTop: 16, alignItems: 'center'}} onPress={() => navigation.goBack()}>
          <Text style={{color: '#1890ff'}}>已有账号？去登录</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  content: {flex: 1, justifyContent: 'center', padding: 24},
  title: {fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 32},
  input: {height: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, fontSize: 16, marginBottom: 16},
  codeRow: {flexDirection: 'row', alignItems: 'center'},
  codeBtn: {height: 48, paddingHorizontal: 16, backgroundColor: '#1890ff', borderRadius: 8, justifyContent: 'center'},
  codeBtnText: {color: '#fff', fontSize: 14},
  btn: {height: 48, backgroundColor: '#1890ff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8},
  btnText: {color: '#fff', fontSize: 18, fontWeight: 'bold'},
});
