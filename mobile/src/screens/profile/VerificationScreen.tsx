import React, {useState, useEffect} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../store/store';
import {updateUser} from '../../store/slices/authSlice';
import {userService} from '../../services/user';

type VerifyStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export default function VerificationScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<VerifyStatus>('unverified');
  const [rejectReason, setRejectReason] = useState('');

  // 表单字段
  const [realName, setRealName] = useState('');
  const [idNumber, setIdNumber] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await userService.getIDVerifyStatus();
      const data = res.data;
      if (data) {
        setStatus(data.id_verified || 'unverified');
        if (data.real_name) setRealName(data.real_name);
        if (data.id_number) setIdNumber(data.id_number);
        if (data.reject_reason) setRejectReason(data.reject_reason);
      }
    } catch (_e) {
      // 获取失败使用默认状态
      const currentStatus = user?.id_verified as VerifyStatus;
      if (currentStatus) setStatus(currentStatus);
    } finally {
      setLoading(false);
    }
  };

  const validateIdNumber = (id: string): boolean => {
    // 简易校验：18位身份证号
    return /^\d{17}[\dXx]$/.test(id);
  };

  const handleSubmit = async () => {
    if (!realName.trim()) {
      Alert.alert('提示', '请输入真实姓名');
      return;
    }
    if (!idNumber.trim()) {
      Alert.alert('提示', '请输入身份证号码');
      return;
    }
    if (!validateIdNumber(idNumber.trim())) {
      Alert.alert('提示', '请输入有效的18位身份证号码');
      return;
    }

    setSubmitting(true);
    try {
      await userService.submitIDVerify({
        real_name: realName.trim(),
        id_number: idNumber.trim(),
        front_image: '',
        back_image: '',
      });
      setStatus('pending');
      dispatch(updateUser({id_verified: 'pending'}));
      Alert.alert('提交成功', '您的实名认证信息已提交，请等待审核');
    } catch (e: any) {
      Alert.alert('提交失败', e?.response?.data?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{marginTop: 100}} color="#1890ff" />
      </SafeAreaView>
    );
  }

  // 已通过认证
  if (status === 'approved') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, {backgroundColor: '#f6ffed'}]}>
            <Text style={{fontSize: 48}}>{'\\u2705'}</Text>
          </View>
          <Text style={styles.resultTitle}>实名认证已通过</Text>
          <Text style={styles.resultDesc}>您的身份信息已经过验证</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>真实姓名</Text>
              <Text style={styles.infoValue}>
                {realName ? realName.charAt(0) + '**' : '***'}
              </Text>
            </View>
            <View style={[styles.infoRow, {borderBottomWidth: 0}]}>
              <Text style={styles.infoLabel}>身份证号</Text>
              <Text style={styles.infoValue}>
                {idNumber ? idNumber.substring(0, 4) + '**********' + idNumber.substring(14) : '****'}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 审核中
  if (status === 'pending') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, {backgroundColor: '#e6f7ff'}]}>
            <Text style={{fontSize: 48}}>{'\\u23F3'}</Text>
          </View>
          <Text style={styles.resultTitle}>认证审核中</Text>
          <Text style={styles.resultDesc}>
            您的实名认证信息正在审核中，预计1-3个工作日内完成
          </Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>真实姓名</Text>
              <Text style={styles.infoValue}>
                {realName ? realName.charAt(0) + '**' : '已提交'}
              </Text>
            </View>
            <View style={[styles.infoRow, {borderBottomWidth: 0}]}>
              <Text style={styles.infoLabel}>提交状态</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>审核中</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 被拒绝（可重新提交）
  const isRejected = status === 'rejected';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {isRejected && (
          <View style={styles.rejectBanner}>
            <Text style={styles.rejectTitle}>认证未通过</Text>
            <Text style={styles.rejectReason}>
              {rejectReason || '提交的信息不符合要求，请重新填写'}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>身份信息</Text>
          <Text style={styles.sectionDesc}>
            请填写您的真实身份信息，用于平台信任验证
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              真实姓名 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="请输入身份证上的姓名"
              placeholderTextColor="#bbb"
              value={realName}
              onChangeText={setRealName}
              maxLength={20}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              身份证号 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="请输入18位身份证号码"
              placeholderTextColor="#bbb"
              value={idNumber}
              onChangeText={setIdNumber}
              maxLength={18}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.tipSection}>
          <Text style={styles.tipTitle}>认证说明</Text>
          <Text style={styles.tipText}>1. 实名认证后可提升信用等级，获得更多平台权限</Text>
          <Text style={styles.tipText}>2. 您的信息将被严格保密，仅用于身份验证</Text>
          <Text style={styles.tipText}>3. 审核通常在1-3个工作日内完成</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isRejected ? '重新提交' : '提交认证'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  scroll: {flex: 1},

  // 审核结果页
  resultContainer: {flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 24},
  resultIcon: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  resultTitle: {fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8},
  resultDesc: {fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20},
  infoCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginTop: 24,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: {fontSize: 14, color: '#666'},
  infoValue: {fontSize: 14, color: '#333', fontWeight: '500'},
  pendingBadge: {
    backgroundColor: '#e6f7ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4,
  },
  pendingText: {color: '#1890ff', fontSize: 12, fontWeight: '500'},

  // 拒绝横幅
  rejectBanner: {
    backgroundColor: '#fff1f0', padding: 16, margin: 12, borderRadius: 8,
    borderLeftWidth: 4, borderLeftColor: '#ff4d4f',
  },
  rejectTitle: {fontSize: 15, fontWeight: '600', color: '#ff4d4f', marginBottom: 4},
  rejectReason: {fontSize: 13, color: '#ff7875', lineHeight: 18},

  // 表单区域
  section: {backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16},
  sectionTitle: {fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4},
  sectionDesc: {fontSize: 13, color: '#999', marginBottom: 16},
  formGroup: {marginBottom: 16},
  formLabel: {fontSize: 14, color: '#333', fontWeight: '500', marginBottom: 8},
  required: {color: '#ff4d4f'},
  input: {
    backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e8e8e8',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#333',
  },

  // 提示
  tipSection: {
    backgroundColor: '#fff', margin: 12, marginTop: 0, borderRadius: 12, padding: 16,
  },
  tipTitle: {fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8},
  tipText: {fontSize: 13, color: '#999', lineHeight: 22},

  // 底部按钮
  footer: {
    backgroundColor: '#fff', padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#e8e8e8',
  },
  submitBtn: {
    height: 48, backgroundColor: '#1890ff', borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnDisabled: {backgroundColor: '#91caff'},
  submitBtnText: {color: '#fff', fontSize: 17, fontWeight: '600'},
});
