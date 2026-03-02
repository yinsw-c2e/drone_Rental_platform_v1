import React, {useState, useCallback} from 'react';
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
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {launchImageLibrary} from 'react-native-image-picker';
import {droneService} from '../../services/drone';
import api from '../../services/api';
import {Drone} from '../../types';

const VERIFY_MAP: Record<string, {label: string; color: string}> = {
  pending: {label: '待审核', color: '#faad14'},
  verified: {label: '已通过', color: '#52c41a'},
  rejected: {label: '已拒绝', color: '#ff4d4f'},
};

type CertType = 'uom' | 'insurance' | 'airworthiness';

export default function DroneCertificationScreen({route, navigation}: any) {
  const droneId = route.params?.id;
  const [drone, setDrone] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeType, setActiveType] = useState<CertType>('uom');
  const [submitting, setSubmitting] = useState(false);

  // UOM 表单
  const [uomRegNo, setUomRegNo] = useState('');
  const [uomDoc, setUomDoc] = useState('');

  // 保险表单
  const [insurancePolicyNo, setInsurancePolicyNo] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insuranceCoverage, setInsuranceCoverage] = useState('');
  const [insuranceExpireDate, setInsuranceExpireDate] = useState('');
  const [insuranceDoc, setInsuranceDoc] = useState('');

  // 适航表单
  const [airworthinessCertNo, setAirworthinessCertNo] = useState('');
  const [airworthinessExpire, setAirworthinessExpire] = useState('');
  const [airworthinessDoc, setAirworthinessDoc] = useState('');

  const loadData = async () => {
    try {
      const res = await droneService.getById(droneId);
      setDrone(res.data);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (droneId) {
        loadData();
      }
    }, [droneId]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const pickImage = async (setter: (url: string) => void) => {
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

        const uploadRes: any = await api.post('/drone/upload', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        const urls = uploadRes.data?.urls;
        if (urls && urls.length > 0) {
          setter(urls[0]);
        }
        Alert.alert('提示', '文件上传成功');
      }
    } catch (e: any) {
      Alert.alert('错误', e.message || '文件上传失败');
    }
  };

  const validateDate = (dateStr: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  };

  const openForm = (type: CertType) => {
    setActiveType(type);
    setShowModal(true);
  };

  const handleSubmitUOM = async () => {
    if (!uomRegNo.trim()) {
      Alert.alert('提示', '请输入UOM登记号');
      return;
    }
    if (!uomDoc) {
      Alert.alert('提示', '请上传UOM登记证明');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/drone/${droneId}/uom`, {
        registration_no: uomRegNo.trim(),
        registration_doc: uomDoc,
      });
      Alert.alert('成功', 'UOM登记信息已提交');
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert('提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitInsurance = async () => {
    if (!insurancePolicyNo.trim()) {
      Alert.alert('提示', '请输入保险单号');
      return;
    }
    if (!insuranceCompany.trim()) {
      Alert.alert('提示', '请输入保险公司');
      return;
    }
    if (!insuranceCoverage || isNaN(parseFloat(insuranceCoverage))) {
      Alert.alert('提示', '请输入保额(万元)');
      return;
    }
    if (!insuranceExpireDate || !validateDate(insuranceExpireDate)) {
      Alert.alert('提示', '请输入正确的到期日期 (YYYY-MM-DD)');
      return;
    }
    if (!insuranceDoc) {
      Alert.alert('提示', '请上传保险单文件');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/drone/${droneId}/insurance`, {
        policy_no: insurancePolicyNo.trim(),
        company: insuranceCompany.trim(),
        coverage: Math.round(parseFloat(insuranceCoverage) * 10000 * 100), // 万元转分
        expire_date: insuranceExpireDate,
        doc: insuranceDoc,
      });
      Alert.alert('成功', '保险信息已提交');
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert('提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAirworthiness = async () => {
    if (!airworthinessCertNo.trim()) {
      Alert.alert('提示', '请输入适航证书编号');
      return;
    }
    if (!airworthinessExpire || !validateDate(airworthinessExpire)) {
      Alert.alert('提示', '请输入正确的有效期 (YYYY-MM-DD)');
      return;
    }
    if (!airworthinessDoc) {
      Alert.alert('提示', '请上传适航证书文件');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/drone/${droneId}/airworthiness`, {
        cert_no: airworthinessCertNo.trim(),
        expire_date: airworthinessExpire,
        doc: airworthinessDoc,
      });
      Alert.alert('成功', '适航证书已提交');
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert('提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    switch (activeType) {
      case 'uom':
        handleSubmitUOM();
        break;
      case 'insurance':
        handleSubmitInsurance();
        break;
      case 'airworthiness':
        handleSubmitAirworthiness();
        break;
    }
  };

  const getVerifyStatus = (status: string) => {
    return VERIFY_MAP[status] || {label: '未提交', color: '#999'};
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

  if (!drone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>无人机不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  const uomStatus = getVerifyStatus(drone.uom_verified);
  const insuranceStatus = getVerifyStatus(drone.insurance_verified);
  const airworthinessStatus = getVerifyStatus(drone.airworthiness_verified);
  const overallStatus = getVerifyStatus(drone.certification_status);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* 无人机基本信息 */}
        <View style={styles.droneHeader}>
          <View style={styles.droneIcon}>
            <Text style={styles.droneIconText}>
              {drone.brand?.charAt(0)?.toUpperCase() || 'D'}
            </Text>
          </View>
          <View style={styles.droneInfo}>
            <Text style={styles.droneName}>{drone.brand} {drone.model}</Text>
            <Text style={styles.droneSerial}>SN: {drone.serial_number || '-'}</Text>
          </View>
          <View style={[styles.overallBadge, {backgroundColor: overallStatus.color + '20'}]}>
            <Text style={[styles.overallText, {color: overallStatus.color}]}>
              {overallStatus.label}
            </Text>
          </View>
        </View>

        {/* UOM平台登记 */}
        <View style={styles.certCard}>
          <View style={styles.certHeader}>
            <Text style={styles.certTitle}>UOM 平台登记</Text>
            <View style={[styles.statusBadge, {backgroundColor: uomStatus.color + '20'}]}>
              <Text style={[styles.statusText, {color: uomStatus.color}]}>
                {uomStatus.label}
              </Text>
            </View>
          </View>
          {drone.uom_registration_no ? (
            <View style={styles.certBody}>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>登记号</Text>
                <Text style={styles.certValue}>{drone.uom_registration_no}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyHint}>尚未提交UOM平台登记信息</Text>
          )}
          <TouchableOpacity style={styles.certAction} onPress={() => openForm('uom')}>
            <Text style={styles.certActionText}>
              {drone.uom_registration_no ? '更新登记' : '提交登记'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 保险信息 */}
        <View style={styles.certCard}>
          <View style={styles.certHeader}>
            <Text style={styles.certTitle}>无人机保险</Text>
            <View style={[styles.statusBadge, {backgroundColor: insuranceStatus.color + '20'}]}>
              <Text style={[styles.statusText, {color: insuranceStatus.color}]}>
                {insuranceStatus.label}
              </Text>
            </View>
          </View>
          {drone.insurance_policy_no ? (
            <View style={styles.certBody}>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>保险单号</Text>
                <Text style={styles.certValue}>{drone.insurance_policy_no}</Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>保险公司</Text>
                <Text style={styles.certValue}>{drone.insurance_company || '-'}</Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>保额</Text>
                <Text style={styles.certValue}>
                  {drone.insurance_coverage ? `${(drone.insurance_coverage / 100 / 10000).toFixed(0)}万元` : '-'}
                </Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>到期日期</Text>
                <Text style={styles.certValue}>
                  {drone.insurance_expire_date?.substring(0, 10) || '-'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyHint}>尚未提交保险信息</Text>
          )}
          <TouchableOpacity style={styles.certAction} onPress={() => openForm('insurance')}>
            <Text style={styles.certActionText}>
              {drone.insurance_policy_no ? '更新保险' : '提交保险'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 适航证书 */}
        <View style={styles.certCard}>
          <View style={styles.certHeader}>
            <Text style={styles.certTitle}>适航证书</Text>
            <View style={[styles.statusBadge, {backgroundColor: airworthinessStatus.color + '20'}]}>
              <Text style={[styles.statusText, {color: airworthinessStatus.color}]}>
                {airworthinessStatus.label}
              </Text>
            </View>
          </View>
          {drone.airworthiness_cert_no ? (
            <View style={styles.certBody}>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>证书编号</Text>
                <Text style={styles.certValue}>{drone.airworthiness_cert_no}</Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>有效期至</Text>
                <Text style={styles.certValue}>
                  {drone.airworthiness_cert_expire?.substring(0, 10) || '-'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyHint}>尚未提交适航证书</Text>
          )}
          <TouchableOpacity style={styles.certAction} onPress={() => openForm('airworthiness')}>
            <Text style={styles.certActionText}>
              {drone.airworthiness_cert_no ? '更新证书' : '提交证书'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 维护记录入口 */}
        <TouchableOpacity
          style={styles.maintenanceEntry}
          onPress={() => navigation.navigate('DroneMaintenanceLog', {id: droneId})}>
          <View style={styles.maintenanceLeft}>
            <Text style={styles.maintenanceTitle}>维护记录</Text>
            <Text style={styles.maintenanceSub}>
              {drone.last_maintenance_date
                ? `最近维护: ${drone.last_maintenance_date.substring(0, 10)}`
                : '暂无维护记录'}
            </Text>
          </View>
          <Text style={styles.maintenanceArrow}>›</Text>
        </TouchableOpacity>

        <View style={{height: 24}} />
      </ScrollView>

      {/* 提交表单弹窗 */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeType === 'uom'
                  ? 'UOM平台登记'
                  : activeType === 'insurance'
                  ? '保险信息'
                  : '适航证书'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {activeType === 'uom' && (
                <View>
                  <Text style={styles.label}>UOM登记号 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入UOM平台登记号"
                    value={uomRegNo}
                    onChangeText={setUomRegNo}
                  />
                  <Text style={styles.label}>登记证明文件 *</Text>
                  <TouchableOpacity
                    style={styles.imageUpload}
                    onPress={() => pickImage(setUomDoc)}>
                    {uomDoc ? (
                      <Image source={{uri: uomDoc}} style={styles.uploadedImage} />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Text style={styles.uploadIcon}>+</Text>
                        <Text style={styles.uploadText}>上传UOM登记证明</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {activeType === 'insurance' && (
                <View>
                  <Text style={styles.label}>保险单号 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入保险单号"
                    value={insurancePolicyNo}
                    onChangeText={setInsurancePolicyNo}
                  />
                  <Text style={styles.label}>保险公司 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="如: 中国人保"
                    value={insuranceCompany}
                    onChangeText={setInsuranceCompany}
                  />
                  <Text style={styles.label}>保额 (万元) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="如: 500"
                    value={insuranceCoverage}
                    onChangeText={setInsuranceCoverage}
                    keyboardType="numeric"
                  />
                  <Text style={styles.label}>到期日期 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={insuranceExpireDate}
                    onChangeText={setInsuranceExpireDate}
                  />
                  <Text style={styles.label}>保险单文件 *</Text>
                  <TouchableOpacity
                    style={styles.imageUpload}
                    onPress={() => pickImage(setInsuranceDoc)}>
                    {insuranceDoc ? (
                      <Image source={{uri: insuranceDoc}} style={styles.uploadedImage} />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Text style={styles.uploadIcon}>+</Text>
                        <Text style={styles.uploadText}>上传保险单</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {activeType === 'airworthiness' && (
                <View>
                  <Text style={styles.label}>证书编号 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入适航证书编号"
                    value={airworthinessCertNo}
                    onChangeText={setAirworthinessCertNo}
                  />
                  <Text style={styles.label}>有效期至 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={airworthinessExpire}
                    onChangeText={setAirworthinessExpire}
                  />
                  <Text style={styles.label}>适航证书文件 *</Text>
                  <TouchableOpacity
                    style={styles.imageUpload}
                    onPress={() => pickImage(setAirworthinessDoc)}>
                    {airworthinessDoc ? (
                      <Image source={{uri: airworthinessDoc}} style={styles.uploadedImage} />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Text style={styles.uploadIcon}>+</Text>
                        <Text style={styles.uploadText}>上传适航证书</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

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
  droneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  droneIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  droneIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  droneInfo: {
    flex: 1,
  },
  droneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  droneSerial: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  overallBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  overallText: {
    fontSize: 13,
    fontWeight: '600',
  },
  certCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  certTitle: {
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
  emptyHint: {
    fontSize: 14,
    color: '#999',
    paddingVertical: 8,
  },
  certAction: {
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  certActionText: {
    fontSize: 14,
    color: '#1890ff',
    fontWeight: '500',
  },
  maintenanceEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  maintenanceLeft: {
    flex: 1,
  },
  maintenanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  maintenanceSub: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  maintenanceArrow: {
    fontSize: 24,
    color: '#ccc',
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
    maxHeight: '85%',
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
    marginTop: 14,
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
