import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import {requestWithdrawal} from '../../services/settlement';

const METHODS = [
  {key: 'bank_card', label: '银行卡'},
  {key: 'alipay', label: '支付宝'},
  {key: 'wechat', label: '微信'},
];

export default function WithdrawalScreen({navigation}: any) {
  const [method, setMethod] = useState('bank_card');
  const [amountStr, setAmountStr] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [alipayAccount, setAlipayAccount] = useState('');
  const [wechatAccount, setWechatAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const amount = Math.round(parseFloat(amountStr) * 100); // 转为分
    if (isNaN(amount) || amount <= 0) {
      return Alert.alert('提示', '请输入正确的提现金额');
    }
    if (amount < 100) {
      return Alert.alert('提示', '最低提现1元');
    }

    if (method === 'bank_card') {
      if (!bankName.trim()) return Alert.alert('提示', '请输入银行名称');
      if (!accountNo.trim()) return Alert.alert('提示', '请输入银行卡号');
      if (!accountName.trim()) return Alert.alert('提示', '请输入持卡人姓名');
    } else if (method === 'alipay') {
      if (!alipayAccount.trim()) return Alert.alert('提示', '请输入支付宝账号');
    } else if (method === 'wechat') {
      if (!wechatAccount.trim()) return Alert.alert('提示', '请输入微信账号');
    }

    setSubmitting(true);
    try {
      await requestWithdrawal({
        amount,
        method,
        bank_name: bankName,
        bank_branch: bankBranch,
        account_no: accountNo,
        account_name: accountName,
        alipay_account: alipayAccount,
        wechat_account: wechatAccount,
      });
      Alert.alert('提交成功', '提现申请已提交，请等待审核', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (err: any) {
      Alert.alert('提现失败', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>提现金额</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountPrefix}>¥</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amountStr}
            onChangeText={setAmountStr}
          />
        </View>
        <Text style={styles.hint}>手续费: 0.1% (最低1元)</Text>

        <Text style={styles.sectionTitle}>提现方式</Text>
        <View style={styles.methodRow}>
          {METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodChip, method === m.key && styles.methodChipActive]}
              onPress={() => setMethod(m.key)}>
              <Text style={[styles.methodText, method === m.key && styles.methodTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {method === 'bank_card' && (
          <>
            <Text style={styles.label}>银行名称 *</Text>
            <TextInput style={styles.input} placeholder="例: 中国工商银行" value={bankName} onChangeText={setBankName} />
            <Text style={styles.label}>开户支行</Text>
            <TextInput style={styles.input} placeholder="例: 成都高新支行" value={bankBranch} onChangeText={setBankBranch} />
            <Text style={styles.label}>银行卡号 *</Text>
            <TextInput style={styles.input} placeholder="请输入银行卡号" keyboardType="number-pad" value={accountNo} onChangeText={setAccountNo} />
            <Text style={styles.label}>持卡人姓名 *</Text>
            <TextInput style={styles.input} placeholder="请输入持卡人姓名" value={accountName} onChangeText={setAccountName} />
          </>
        )}

        {method === 'alipay' && (
          <>
            <Text style={styles.label}>支付宝账号 *</Text>
            <TextInput style={styles.input} placeholder="手机号或邮箱" value={alipayAccount} onChangeText={setAlipayAccount} />
            <Text style={styles.label}>真实姓名 *</Text>
            <TextInput style={styles.input} placeholder="请输入真实姓名" value={accountName} onChangeText={setAccountName} />
          </>
        )}

        {method === 'wechat' && (
          <>
            <Text style={styles.label}>微信账号 *</Text>
            <TextInput style={styles.input} placeholder="微信号" value={wechatAccount} onChangeText={setWechatAccount} />
            <Text style={styles.label}>真实姓名 *</Text>
            <TextInput style={styles.input} placeholder="请输入真实姓名" value={accountName} onChangeText={setAccountName} />
          </>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && {opacity: 0.6}]}
          onPress={handleSubmit}
          disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? '提交中...' : '确认提现'}</Text>
        </TouchableOpacity>

        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  form: {flex: 1, padding: 16},
  sectionTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8},
  amountRow: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8},
  amountPrefix: {fontSize: 28, fontWeight: '700', color: '#333', marginRight: 4},
  amountInput: {flex: 1, fontSize: 28, fontWeight: '600', color: '#333', padding: 0},
  hint: {fontSize: 12, color: '#999', marginTop: 6},
  methodRow: {flexDirection: 'row', gap: 10, marginBottom: 8},
  methodChip: {flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9d9d9', alignItems: 'center'},
  methodChipActive: {backgroundColor: '#e6f7ff', borderColor: '#1890ff'},
  methodText: {fontSize: 14, color: '#666'},
  methodTextActive: {color: '#1890ff', fontWeight: '600'},
  label: {fontSize: 13, color: '#666', marginBottom: 4, marginTop: 10},
  input: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333'},
  submitBtn: {backgroundColor: '#1890ff', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 24},
  submitBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});
