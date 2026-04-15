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
import {API_ROOT_URL} from '../../constants';
import {launchImageLibrary} from 'react-native-image-picker';
import {droneService} from '../../services/drone';
import api from '../../services/api';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const IMAGE_BASE_URL = API_ROOT_URL;

const VERIFY_MAP: Record<string, {label: string; colorKey: 'warning' | 'success' | 'danger' | 'textHint'}> = {
  pending: {label: '待审核', colorKey: 'warning'},
  verified: {label: '已通过', colorKey: 'success'},
  rejected: {label: '已拒绝', colorKey: 'danger'},
};

type CertType = 'uom' | 'insurance' | 'airworthiness';

export default function DroneCertificationScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
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

  const loadData = useCallback(async () => {
    try {
      const res = await droneService.getById(droneId);
      setDrone(res.data);
    } catch (e: any) {
      Alert.alert('错误', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [droneId]);

  useFocusEffect(
    useCallback(() => {
      if (droneId) {
        loadData();
      }
    }, [droneId, loadData]),
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
        formData.append('files', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'cert.jpg',
        } as any);

        const uploadRes: any = await api.post('/drone/upload', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        const urls = uploadRes.data?.urls;
        if (urls && urls.length > 0) {
          // 将相对路径转为完整 URL
          const fullUrl = urls[0].startsWith('http')
            ? urls[0]
            : `${IMAGE_BASE_URL}${urls[0]}`;
          setter(fullUrl);
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
    const entry = VERIFY_MAP[status] || {label: '未提交', colorKey: 'textHint' as const};
    return {label: entry.label, color: theme[entry.colorKey]};
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

  if (!drone) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
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
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bgSecondary}]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
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
          <View style={[styles.overallBadge, {backgroundColor: overallStatus.color + '15'}]}>
            <Text style={[styles.overallText, {color: overallStatus.color}]}>
              {overallStatus.label}
            </Text>
          </View>
        </View>

        {/* UOM平台登记 */}
        <View style={styles.certCard}>
          <View style={styles.certHeader}>
            <Text style={styles.certTitle}>UOM 平台登记</Text>
            <View style={[styles.statusBadge, {backgroundColor: uomStatus.color + '15'}]}>
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
            <View style={styles.emptyCard}>
              <Text style={styles.emptyHint}>尚未提交UOM平台登记信息</Text>
            </View>
          )}
          <TouchableOpacity activeOpacity={0.7} style={styles.certAction} onPress={() => openForm('uom')}>
            <Text style={styles.certActionText}>
              {drone.uom_registration_no ? '更新登记信息' : '提交 UOM 登记'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 保险信息 */}
        <View style={styles.certCard}>
          <View style={styles.certHeader}>
            <Text style={styles.certTitle}>无人机保险</Text>
            <View style={[styles.statusBadge, {backgroundColor: insuranceStatus.color + '15'}]}>
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
            <View style={styles.emptyCard}>
              <Text style={styles.emptyHint}>尚未提交保险单信息</Text>
            </View>
          )}
          <TouchableOpacity activeOpacity={0.7} style={styles.certAction} onPress={() => openForm('insurance')}>
            <Text style={styles.certActionText}>
              {drone.insurance_policy_no ? '更新保险资料' : '提交保险资料'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 适航证书 */}
        <View style={styles.certCard}>
          <View style={styles.certHeader}>
            <Text style={styles.certTitle}>适航证书</Text>
            <View style={[styles.statusBadge, {backgroundColor: airworthinessStatus.color + '15'}]}>
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
            <View style={styles.emptyCard}>
              <Text style={styles.emptyHint}>尚未提交适航证书资料</Text>
            </View>
          )}
          <TouchableOpacity activeOpacity={0.7} style={styles.certAction} onPress={() => openForm('airworthiness')}>
            <Text style={styles.certActionText}>
              {drone.airworthiness_cert_no ? '更新证书资料' : '提交适航证书'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 维护记录入口 */}
        <TouchableOpacity
          activeOpacity={0.7}
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
                  ? '保险资料'
                  : '适航证书'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Text style={styles.modalClose}>\u2715</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {activeType === 'uom' && (
                <View style={styles.formGroupContainer}>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>UOM登记号 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="请输入UOM平台登记号"
                      placeholderTextColor={theme.textHint}
                      value={uomRegNo}
                      onChangeText={setUomRegNo}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>登记证明文件 *</Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.imageUpload}
                      onPress={() => pickImage(setUomDoc)}>
                      {uomDoc ? (
                        <Image source={{uri: uomDoc}} style={styles.uploadedImage} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Text style={styles.uploadIcon}>+</Text>
                          <Text style={styles.uploadText}>上传 UOM 登记证明</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeType === 'insurance' && (
                <View style={styles.formGroupContainer}>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>保险单号 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="请输入保单号"
                      placeholderTextColor={theme.textHint}
                      value={insurancePolicyNo}
                      onChangeText={setInsurancePolicyNo}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>保险公司 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="如: 中国人保"
                      placeholderTextColor={theme.textHint}
                      value={insuranceCompany}
                      onChangeText={setInsuranceCompany}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>保额 (万元) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="如: 500"
                      placeholderTextColor={theme.textHint}
                      value={insuranceCoverage}
                      onChangeText={setInsuranceCoverage}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>到期日期 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textHint}
                      value={insuranceExpireDate}
                      onChangeText={setInsuranceExpireDate}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>保险单文件 *</Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.imageUpload}
                      onPress={() => pickImage(setInsuranceDoc)}>
                      {insuranceDoc ? (
                        <Image source={{uri: insuranceDoc}} style={styles.uploadedImage} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Text style={styles.uploadIcon}>+</Text>
                          <Text style={styles.uploadText}>上传保险单扫描件</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeType === 'airworthiness' && (
                <View style={styles.formGroupContainer}>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>证书编号 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="请输入适航证书编号"
                      placeholderTextColor={theme.textHint}
                      value={airworthinessCertNo}
                      onChangeText={setAirworthinessCertNo}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>有效期至 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textHint}
                      value={airworthinessExpire}
                      onChangeText={setAirworthinessExpire}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>适航证书文件 *</Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.imageUpload}
                      onPress={() => pickImage(setAirworthinessDoc)}>
                      {airworthinessDoc ? (
                        <Image source={{uri: airworthinessDoc}} style={styles.uploadedImage} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Text style={styles.uploadIcon}>+</Text>
                          <Text style={styles.uploadText}>上传适航证书照片</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitBtnText}>
                  {submitting ? '提交中...' : '确认提交资料'}
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
  droneHeader: {flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: theme.cardBorder, gap: 16},
  droneIcon: {width: 60, height: 60, borderRadius: 30, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center'},
  droneIconText: {fontSize: 24, fontWeight: '900', color: theme.primary},
  droneInfo: {flex: 1, gap: 4},
  droneName: {fontSize: 20, fontWeight: '900', color: theme.text, letterSpacing: -0.5},
  droneSerial: {fontSize: 14, color: theme.textSub, fontWeight: '600'},
  overallBadge: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10},
  overallText: {fontSize: 13, fontWeight: '700'},
  certCard: {backgroundColor: theme.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: theme.cardBorder, gap: 16},
  certHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  certTitle: {fontSize: 18, fontWeight: '900', color: theme.text, letterSpacing: -0.5},
  statusBadge: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10},
  statusText: {fontSize: 13, fontWeight: '700'},
  certBody: {borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: 16, gap: 10},
  certRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  certLabel: {fontSize: 14, color: theme.textSub, fontWeight: '600'},
  certValue: {fontSize: 14, color: theme.text, fontWeight: '700'},
  emptyCard: {paddingVertical: 12},
  emptyHint: {fontSize: 14, color: theme.textHint, fontWeight: '500', fontStyle: 'italic'},
  certAction: {marginTop: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.cardBorder, alignItems: 'center'},
  certActionText: {fontSize: 14, color: theme.primary, fontWeight: '800'},
  maintenanceEntry: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: theme.cardBorder},
  maintenanceLeft: {flex: 1, gap: 4},
  maintenanceTitle: {fontSize: 17, fontWeight: '900', color: theme.text},
  maintenanceSub: {fontSize: 14, color: theme.textSub, fontWeight: '500'},
  maintenanceArrow: {fontSize: 24, color: theme.textHint, fontWeight: '300'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  modalContent: {backgroundColor: theme.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: theme.divider},
  modalTitle: {fontSize: 20, fontWeight: '900', color: theme.text, letterSpacing: -0.5},
  modalClose: {fontSize: 24, color: theme.textSub, fontWeight: '300'},
  modalBody: {paddingHorizontal: 24},
  modalScrollContent: {paddingBottom: 40},
  formGroupContainer: {gap: 20, marginTop: 24},
  formGroup: {gap: 10},
  label: {fontSize: 14, fontWeight: '800', color: theme.text, opacity: 0.9},
  input: {borderWidth: 1.5, borderColor: theme.cardBorder, borderRadius: 16, backgroundColor: theme.bgSecondary, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.text},
  imageUpload: {minHeight: 180, borderWidth: 2, borderColor: theme.cardBorder, borderStyle: 'dashed', borderRadius: 18, overflow: 'hidden', backgroundColor: theme.bgSecondary},
  uploadPlaceholder: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 8},
  uploadIcon: {fontSize: 40, color: theme.textHint, fontWeight: '300'},
  uploadText: {fontSize: 14, color: theme.textSub, fontWeight: '600', textAlign: 'center'},
  uploadedImage: {width: '100%', height: '100%', resizeMode: 'cover'},
  submitBtn: {height: 56, backgroundColor: theme.primary, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 32, shadowColor: theme.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6},
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: theme.btnPrimaryText, fontSize: 18, fontWeight: '900'},
});
