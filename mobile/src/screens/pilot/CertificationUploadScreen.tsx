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

const STATUS_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待审核', color: '#faad14'},
  verified: {label: '已认证', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* 添加证书按钮 */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}>
          <Text style={styles.addBtnIcon}>+</Text>
          <Text style={styles.addBtnText}>添加新证书</Text>
        </TouchableOpacity>

        {/* 证书列表 */}
        {certifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无证书记录</Text>
            <Text style={styles.emptySubText}>点击上方按钮添加您的资质证书</Text>
          </View>
        ) : (
          certifications.map(cert => {
            const status = STATUS_MAP[cert.verification_status] || STATUS_MAP.pending;
            return (
              <View key={cert.id} style={styles.certCard}>
                <View style={styles.certHeader}>
                  <Text style={styles.certType}>{getCertTypeLabel(cert.cert_type)}</Text>
                  <View style={[styles.statusBadge, {backgroundColor: status.color + '20'}]}>
                    <Text style={[styles.statusText, {color: status.color}]}>
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
                    <Text style={styles.certLabel}>发证机关</Text>
                    <Text style={styles.certValue}>{cert.issuer || '-'}</Text>
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
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* 证书类型 */}
              <Text style={styles.label}>证书类型</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

              {/* 根据类型显示不同表单 */}
              {certType === 'criminal_check' ? (
                <View>
                  <Text style={styles.tipText}>
                    请上传有效的无犯罪记录证明文件
                  </Text>
                </View>
              ) : certType === 'health_check' ? (
                <View>
                  <Text style={styles.label}>有效期至 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={healthExpireDate}
                    onChangeText={setHealthExpireDate}
                  />
                </View>
              ) : (
                <View>
                  <Text style={styles.label}>证书名称 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入证书名称"
                    value={certName}
                    onChangeText={setCertName}
                  />

                  <Text style={styles.label}>证书编号 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入证书编号"
                    value={certNo}
                    onChangeText={setCertNo}
                  />

                  <Text style={styles.label}>发证机关 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入发证机关"
                    value={issuer}
                    onChangeText={setIssuer}
                  />

                  <Text style={styles.label}>发证日期 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={issueDate}
                    onChangeText={setIssueDate}
                  />

                  <Text style={styles.label}>有效期至 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={expireDate}
                    onChangeText={setExpireDate}
                  />
                </View>
              )}

              {/* 证书照片 */}
              <Text style={styles.label}>证书照片 *</Text>
              <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
                {certImage ? (
                  <Image source={{uri: certImage}} style={styles.uploadedImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadIcon}>+</Text>
                    <Text style={styles.uploadText}>点击上传证书照片</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* 提交按钮 */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitBtnText}>
                  {submitting ? '提交中...' : '提交'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1890ff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  addBtnIcon: {
    fontSize: 20,
    color: '#fff',
    marginRight: 8,
  },
  addBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
  certCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  certType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  certBody: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  certLabel: {
    fontSize: 14,
    color: '#666',
  },
  certValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  certImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#999',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  typeContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    marginRight: 8,
  },
  typeOptionActive: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
  },
  typeOptionText: {
    fontSize: 13,
    color: '#666',
  },
  typeOptionTextActive: {
    color: '#fff',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    lineHeight: 22,
  },
  imageUpload: {
    height: 150,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  uploadIcon: {
    fontSize: 36,
    color: '#ccc',
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    color: '#999',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  submitBtn: {
    height: 50,
    backgroundColor: '#1890ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
