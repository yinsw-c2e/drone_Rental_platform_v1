import React, {useCallback, useEffect, useState} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../store/store';
import {updateUser} from '../../store/slices/authSlice';
import {userService} from '../../services/user';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type VerifyStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export default function VerificationScreen({_navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<VerifyStatus>('unverified');
  const [rejectReason, setRejectReason] = useState('');

  // 表单字段
  const [realName, setRealName] = useState('');
  const [idNumber, setIdNumber] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await userService.getIDVerifyStatus();
      const data = res.data;
      if (data) {
        const nextStatus = data.id_verified || 'unverified';
        setStatus(nextStatus);
        dispatch(updateUser({id_verified: nextStatus}));
        if (data.real_name) setRealName(data.real_name);
        if (data.id_number) setIdNumber(data.id_number);
        if (data.reject_reason) setRejectReason(data.reject_reason);
      }
    } catch {
      // 获取失败使用默认状态
      const currentStatus = user?.id_verified as VerifyStatus;
      if (currentStatus) setStatus(currentStatus);
    } finally {
      setLoading(false);
    }
  }, [dispatch, user?.id_verified]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status !== 'pending') {
      return undefined;
    }
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [fetchStatus, status]);

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
      Alert.alert('提交成功', '认证结果以实名核验返回为准，完成后权限将自动更新。');
    } catch (e: any) {
      Alert.alert('提交失败', e?.response?.data?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={{marginTop: 100}} color={theme.primary} />
      </SafeAreaView>
    );
  }

  // 已通过认证
  if (status === 'approved') {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.resultIcon, {backgroundColor: theme.success + '15'}]}>
            <Text style={{fontSize: 48}}>{'\u2705'}</Text>
          </View>
          <Text style={styles.resultTitle}>实名认证已通过</Text>
          <Text style={styles.resultDesc}>您的身份信息已通过实名核验</Text>
          
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 审核中
  if (status === 'pending') {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.resultIcon, {backgroundColor: theme.info + '15'}]}>
            <Text style={{fontSize: 48}}>{'\u23F3'}</Text>
          </View>
          <Text style={styles.resultTitle}>认证审核中</Text>
          <Text style={styles.resultDesc}>
            您的实名认证信息已提交，当前为模拟核验，预计 1 分钟内自动完成。
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 被拒绝（可重新提交）
  const isRejected = status === 'rejected';

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
              placeholderTextColor={theme.textHint}
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
              placeholderTextColor={theme.textHint}
              value={idNumber}
              onChangeText={setIdNumber}
              maxLength={18}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.tipSection}>
          <Text style={styles.tipTitle}>认证说明</Text>
          <View style={styles.tipList}>
            <Text style={styles.tipText}>1. 实名认证后可提升信用等级，获得更多平台权限</Text>
            <Text style={styles.tipText}>2. 您的信息将被严格保密，仅用于身份验证</Text>
            <Text style={styles.tipText}>3. 认证结果以实名核验返回为准，完成后权限将自动更新</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={theme.btnPrimaryText} />
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

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  scroll: {flex: 1},
  scrollContent: {padding: 20, gap: 20},

  // 审核结果页
  resultContainer: {alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 8},
  resultIcon: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  resultTitle: {fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5},
  resultDesc: {fontSize: 15, color: theme.textSub, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20},
  infoCard: {
    width: '100%', backgroundColor: theme.card, borderRadius: 16,
    padding: 16, marginTop: 32,
    borderWidth: 1, borderColor: theme.cardBorder,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.cardBorder,
  },
  infoLabel: {fontSize: 14, color: theme.textSub, fontWeight: '500'},
  infoValue: {fontSize: 15, color: theme.text, fontWeight: '600'},
  pendingBadge: {
    backgroundColor: theme.warning + '14', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: theme.warning + '55',
  },
  pendingText: {color: theme.warning, fontSize: 11, fontWeight: '700'},

  // 拒绝横幅
  rejectBanner: {
    backgroundColor: theme.danger + '15', padding: 20, borderRadius: 16,
    borderLeftWidth: 6, borderLeftColor: theme.danger,
  },
  rejectTitle: {fontSize: 17, fontWeight: '800', color: theme.danger, marginBottom: 6},
  rejectReason: {fontSize: 14, color: theme.danger, lineHeight: 20, fontWeight: '500'},

  // 表单区域
  section: {backgroundColor: theme.card, borderRadius: 16, padding: 16, gap: 16, borderWidth: 1, borderColor: theme.cardBorder},
  sectionTitle: {fontSize: 16, fontWeight: '600', color: theme.text},
  sectionDesc: {fontSize: 14, color: theme.textSub, lineHeight: 20, marginTop: -8, marginBottom: 2},
  formGroup: {gap: 10},
  formLabel: {fontSize: 14, color: theme.text, fontWeight: '700'},
  required: {color: theme.danger},
  input: {
    backgroundColor: theme.inputBg, borderWidth: 1.5, borderColor: theme.inputBorder,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: theme.text,
  },

  // 提示
  tipSection: {
    backgroundColor: theme.primaryBg, borderRadius: 16, padding: 16, gap: 12,
  },
  tipTitle: {fontSize: 16, fontWeight: '600', color: theme.text},
  tipList: {gap: 8},
  tipText: {fontSize: 14, color: theme.textSub, lineHeight: 22, fontWeight: '500'},

  // 底部按钮
  footer: {
    backgroundColor: theme.card, padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: theme.cardBorder,
  },
  submitBtn: {
    height: 48, backgroundColor: theme.primary, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: '600'},
});
