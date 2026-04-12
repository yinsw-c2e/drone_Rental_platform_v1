import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {launchImageLibrary} from 'react-native-image-picker';
import {
  getCertifications,
  submitCertification,
  submitCriminalCheck,
  submitHealthCheck,
  PilotCertification,
  SubmitCertificationRequest,
} from '../../services/pilot';
import api from '../../services/api';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const STATUS_MAP: Record<string, {label: string; colorKey: 'warning' | 'success' | 'danger'}> = {
  pending: {label: '待审核', colorKey: 'warning'},
  verified: {label: '已认证', colorKey: 'success'},
  rejected: {label: '已拒绝', colorKey: 'danger'},
};

const CERT_TYPES = [
  {label: '无犯罪记录证明', value: 'criminal_check'},
  {label: '健康证明', value: 'health_check'},
  {label: 'CAAC 执照', value: 'caac_license'},
  {label: 'AOPA 合格证', value: 'aopa_cert'},
  {label: 'UTC 操控师证', value: 'utc_cert'},
  {label: '培训结业证书', value: 'training_cert'},
  {label: '保险证明', value: 'insurance'},
  {label: '其他资质', value: 'other'},
];

export default function CertificationUploadScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [certifications, setCertifications] = useState<PilotCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单字段
  const [certType, setCertType] = useState('other');
  const [certNo, setCertNo] = useState('');
  const [certName, setCertName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [certImage, setCertImage] = useState('');
  const [healthExpireDate, setHealthExpireDate] = useState('');

  const loadData = async () => {
    try {
      const data = await getCertifications();
      setCertifications(data || []);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const resetForm = () => {
    setCertType('other');
    setCertNo('');
    setCertName('');
    setIssuer('');
    setIssueDate('');
    setExpireDate('');
    setCertImage('');
    setHealthExpireDate('');
  };

  const pickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'cert.jpg',
        } as any);

        const uploadRes: any = await api.post('/pilot/upload-cert', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        setCertImage(uploadRes.data.url);
        Alert.alert('提示', '图片上传成功');
      }
    } catch (e: any) {
      Alert.alert('错误', e.message || '图片上传失败');
    }
  };

  const validateDate = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateStr);
  };

  const handleSubmit = async () => {
    if (!certImage) {
      Alert.alert('提示', '请上传证书照片');
      return;
    }

    setSubmitting(true);
    try {
      // 根据证书类型调用不同的接口
      if (certType === 'criminal_check') {
        await submitCriminalCheck(certImage);
        Alert.alert('成功', '无犯罪记录证明已提交');
      } else if (certType === 'health_check') {
        if (!healthExpireDate || !validateDate(healthExpireDate)) {
          Alert.alert('提示', '请输入健康证明有效期 (格式: YYYY-MM-DD)');
          setSubmitting(false);
          return;
        }
        await submitHealthCheck({
          doc_url: certImage,
          expire_date: healthExpireDate,
        });
        Alert.alert('成功', '健康证明已提交');
      } else {
        // 其他类型证书
        if (!certNo.trim()) {
          Alert.alert('提示', '请输入证书编号');
          setSubmitting(false);
          return;
        }
        if (!certName.trim()) {
          Alert.alert('提示', '请输入证书名称');
          setSubmitting(false);
          return;
        }
        if (!issuer.trim()) {
          Alert.alert('提示', '请输入发证机关');
          setSubmitting(false);
          return;
        }
        if (!issueDate || !validateDate(issueDate)) {
          Alert.alert('提示', '请输入正确的发证日期 (格式: YYYY-MM-DD)');
          setSubmitting(false);
          return;
        }
        if (!expireDate || !validateDate(expireDate)) {
          Alert.alert('提示', '请输入正确的有效期 (格式: YYYY-MM-DD)');
          setSubmitting(false);
          return;
        }

        const data: SubmitCertificationRequest = {
          cert_type: certType,
          cert_no: certNo.trim(),
          cert_name: certName.trim(),
          issuer: issuer.trim(),
          issue_date: issueDate,
          expire_date: expireDate,
          cert_image: certImage,
        };
        await submitCertification(data);
        Alert.alert('成功', '证书已提交');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (e: any) {
      Alert.alert('提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getCertTypeLabel = (type: string): string => {
    const found = CERT_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bgSecondary}]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }>
        {/* 添加证书按钮 */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.addBtn}
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}>
          <View style={styles.addBtnIconBox}>
            <Text style={styles.addBtnIcon}>+</Text>
          </View>
          <Text style={styles.addBtnText}>添加新证书</Text>
        </TouchableOpacity>

        {/* 证书列表 */}
        {certifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'\ud83d\udcc4'}</Text>
            <Text style={styles.emptyText}>暂无证书记录</Text>
            <Text style={styles.emptySubText}>点击上方按钮添加您的资质证书</Text>
          </View>
        ) : (
          certifications.map(cert => {
            const status = STATUS_MAP[cert.verification_status] || STATUS_MAP.pending;
            const statusColor = theme[status.colorKey];
            return (
              <View key={cert.id} style={styles.certCard}>
                <View style={styles.certHeader}>
                  <Text style={styles.certType}>{getCertTypeLabel(cert.cert_type)}</Text>
                  <View style={[styles.statusBadge, {backgroundColor: statusColor + '15'}]}>
                    <Text style={[styles.statusText, {color: statusColor}]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.certBody}>
                  <View style={styles.certRow}>
                    <Text style={styles.certLabel}>证书名称</Text>
                    <Text style={styles.certValue}>{cert.cert_name || '-'}</Text>
                  </View>
                  <View style={styles.certRow}>
                    <Text style={styles.certLabel}>证书编号</Text>
                    <Text style={styles.certValue}>{cert.cert_no || '-'}</Text>
                  </View>
                  <View style={styles.certRow}>
                    <Text style={styles.certLabel}>有效期至</Text>
                    <Text style={styles.certValue}>
                      {cert.expire_date?.substring(0, 10) || '-'}
                    </Text>
                  </View>
                </View>
                {cert.cert_image && (
                  <Image
                    source={{uri: cert.cert_image}}
                    style={styles.certImage}
                    resizeMode="cover"
                  />
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 添加证书弹窗 */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加证书</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Text style={styles.modalClose}>\u2715</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* 证书类型 */}
              <View style={styles.formSection}>
                <Text style={styles.label}>证书类型</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScrollContent}>
                  <View style={styles.typeContainer}>
                    {CERT_TYPES.map(type => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.typeOption,
                          certType === type.value && styles.typeOptionActive,
                        ]}
                        onPress={() => setCertType(type.value)}>
                        <Text
                          style={[
                            styles.typeOptionText,
                            certType === type.value && styles.typeOptionTextActive,
                          ]}>
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* 根据类型显示不同表单 */}
              <View style={styles.formGroupContainer}>
                {certType === 'criminal_check' ? (
                  <View style={styles.tipCard}>
                    <Text style={styles.tipText}>
                      请上传有效的无犯罪记录证明文件，用于增强您的信用背书。
                    </Text>
                  </View>
                ) : certType === 'health_check' ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>有效期至 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textHint}
                      value={healthExpireDate}
                      onChangeText={setHealthExpireDate}
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>证书名称 *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="请输入证书全称"
                        placeholderTextColor={theme.textHint}
                        value={certName}
                        onChangeText={setCertName}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>证书编号 *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="如：C12345678"
                        placeholderTextColor={theme.textHint}
                        value={certNo}
                        onChangeText={setCertNo}
                        autoCapitalize="characters"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>发证机关 *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="请输入签发机构"
                        placeholderTextColor={theme.textHint}
                        value={issuer}
                        onChangeText={setIssuer}
                      />
                    </View>

                    <View style={styles.row}>
                      <View style={[styles.formGroup, {flex: 1}]}>
                        <Text style={styles.label}>发证日期 *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={theme.textHint}
                          value={issueDate}
                          onChangeText={setIssueDate}
                        />
                      </View>
                      <View style={{width: 12}} />
                      <View style={[styles.formGroup, {flex: 1}]}>
                        <Text style={styles.label}>有效期至 *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={theme.textHint}
                          value={expireDate}
                          onChangeText={setExpireDate}
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* 证书照片 */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>证书照片 *</Text>
                  <TouchableOpacity activeOpacity={0.7} style={styles.imageUpload} onPress={pickImage}>
                    {certImage ? (
                      <Image source={{uri: certImage}} style={styles.uploadedImage} />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Text style={styles.uploadIcon}>+</Text>
                        <Text style={styles.uploadText}>点击上传清晰的证书原件照片</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* 提交按钮 */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitBtnText}>
                  {submitting ? '提交中...' : '提交证书资料'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  scrollContent: {padding: 20, paddingBottom: 40, gap: 20},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {fontSize: 16, color: theme.textSub},
  addBtn: {flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingVertical: 18, paddingHorizontal: 24, borderRadius: 18, shadowColor: theme.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6},
  addBtnIconBox: {width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12},
  addBtnIcon: {fontSize: 20, color: theme.btnPrimaryText, fontWeight: 'bold'},
  addBtnText: {fontSize: 18, color: theme.btnPrimaryText, fontWeight: '900'},
  emptyContainer: {paddingTop: 80, alignItems: 'center', gap: 12},
  emptyIcon: {fontSize: 64, marginBottom: 8, opacity: 0.5},
  emptyText: {fontSize: 18, fontWeight: '800', color: theme.textSub},
  emptySubText: {fontSize: 14, color: theme.textHint},
  certCard: {backgroundColor: theme.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: theme.cardBorder, gap: 16},
  certHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  certType: {fontSize: 18, fontWeight: '900', color: theme.text, letterSpacing: -0.5},
  statusBadge: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10},
  statusText: {fontSize: 13, fontWeight: '700'},
  certBody: {borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: 16, gap: 8},
  certRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  certLabel: {fontSize: 14, color: theme.textSub, fontWeight: '600'},
  certValue: {fontSize: 14, color: theme.text, fontWeight: '700'},
  certImage: {width: '100%', height: 180, borderRadius: 14, marginTop: 8},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  modalContent: {backgroundColor: theme.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: theme.divider},
  modalTitle: {fontSize: 20, fontWeight: '900', color: theme.text, letterSpacing: -0.5},
  modalClose: {fontSize: 24, color: theme.textSub, fontWeight: '300'},
  modalBody: {paddingHorizontal: 24},
  modalScrollContent: {paddingBottom: 40},
  modalScrollContentInner: {gap: 24},
  formSection: {marginTop: 20, gap: 12},
  formGroupContainer: {gap: 20, marginTop: 20},
  formGroup: {gap: 10},
  row: {flexDirection: 'row'},
  label: {fontSize: 14, fontWeight: '800', color: theme.text, opacity: 0.9},
  input: {borderWidth: 1.5, borderColor: theme.cardBorder, borderRadius: 16, backgroundColor: theme.bgSecondary, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.text},
  typeScrollContent: {paddingBottom: 4},
  typeContainer: {flexDirection: 'row', gap: 10},
  typeOption: {paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.bgSecondary, borderWidth: 1.5, borderColor: theme.cardBorder},
  typeOptionActive: {backgroundColor: theme.primary + '15', borderColor: theme.primary},
  typeOptionText: {fontSize: 14, fontWeight: '700', color: theme.textSub},
  typeOptionTextActive: {color: theme.primary},
  tipCard: {backgroundColor: theme.primary + '10', padding: 16, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: theme.primary},
  tipText: {fontSize: 14, color: theme.textSub, lineHeight: 22, fontWeight: '500'},
  imageUpload: {minHeight: 180, borderWidth: 2, borderColor: theme.cardBorder, borderStyle: 'dashed', borderRadius: 18, overflow: 'hidden', backgroundColor: theme.bgSecondary},
  uploadPlaceholder: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 8},
  uploadIcon: {fontSize: 40, color: theme.textHint, fontWeight: '300'},
  uploadText: {fontSize: 14, color: theme.textSub, fontWeight: '600', textAlign: 'center'},
  uploadedImage: {width: '100%', height: '100%', resizeMode: 'cover'},
  submitBtn: {height: 56, backgroundColor: theme.primary, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 32, shadowColor: theme.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6},
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: theme.btnPrimaryText, fontSize: 18, fontWeight: '900'},
});
