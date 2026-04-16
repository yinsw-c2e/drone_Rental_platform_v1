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
  Platform,
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
  pending: {label: '审核中', colorKey: 'warning'},
  verified: {label: '已核验', colorKey: 'success'},
  approved: {label: '已核验', colorKey: 'success'},
  rejected: {label: '未通过', colorKey: 'danger'},
};

const isApprovedStatus = (value?: string) => value === 'approved' || value === 'verified';

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
          const fullUrl = urls[0].startsWith('http') ? urls[0] : `${IMAGE_BASE_URL}${urls[0]}`;
          setter(fullUrl);
        }
        Alert.alert('提示', '文件上传成功');
      }
    } catch (e: any) {
      Alert.alert('错误', e.message || '文件上传失败');
    }
  };

  const validateDate = (dateStr: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

  const openForm = (type: CertType) => {
    setActiveType(type);
    setShowModal(true);
  };

  const handleSubmitUOM = async () => {
    if (!uomRegNo.trim()) return Alert.alert('提示', '请输入 UOM 登记号');
    if (!uomDoc) return Alert.alert('提示', '请上传登记证明');
    setSubmitting(true);
    try {
      await api.post(`/drone/${droneId}/uom`, { registration_no: uomRegNo.trim(), registration_doc: uomDoc });
      Alert.alert('成功', '登记信息已提交存证');
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert('提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitInsurance = async () => {
    if (!insurancePolicyNo.trim()) return Alert.alert('提示', '请输入保单号');
    if (!insuranceExpireDate || !validateDate(insuranceExpireDate)) return Alert.alert('提示', '请输入日期 (YYYY-MM-DD)');
    if (!insuranceDoc) return Alert.alert('提示', '请上传保单');
    setSubmitting(true);
    try {
      await api.post(`/drone/${droneId}/insurance`, {
        policy_no: insurancePolicyNo.trim(),
        company: insuranceCompany.trim(),
        coverage: Math.round(parseFloat(insuranceCoverage) * 10000 * 100),
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
    if (!airworthinessCertNo.trim()) return Alert.alert('提示', '请输入证书编号');
    if (!airworthinessExpire || !validateDate(airworthinessExpire)) return Alert.alert('提示', '请输入日期 (YYYY-MM-DD)');
    if (!airworthinessDoc) return Alert.alert('提示', '请上传证书照片');
    setSubmitting(true);
    try {
      await api.post(`/drone/${droneId}/airworthiness`, {
        cert_no: airworthinessCertNo.trim(),
        expire_date: airworthinessExpire,
        doc: airworthinessDoc,
      });
      Alert.alert('成功', '适航证明已提交');
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert('提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (activeType === 'uom') handleSubmitUOM();
    else if (activeType === 'insurance') handleSubmitInsurance();
    else handleSubmitAirworthiness();
  };

  const getVerifyStatus = (status: string) => {
    const entry = VERIFY_MAP[status] || {label: '未备案', colorKey: 'textHint' as const};
    return {label: entry.label, color: theme[entry.colorKey]};
  };

  if (loading || !drone) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{loading ? '加载中...' : '资产不存在'}</Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnHeader}>
          <Text style={styles.backText}>˂ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>资产资质管理</Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }>

        <View style={styles.droneAssetCard}>
          <View style={styles.droneAssetIcon}>
            <Text style={styles.droneAssetEmoji}>🚁</Text>
          </View>
          <View style={styles.droneAssetInfo}>
            <Text style={styles.droneAssetName}>{drone.brand} {drone.model}</Text>
            <Text style={styles.droneAssetSn}>设备识别码: {drone.serial_number || '-'}</Text>
          </View>
          <View style={[styles.statusTag, {backgroundColor: overallStatus.color + '15'}]}>
            <Text style={[styles.statusTagText, {color: overallStatus.color}]}>{overallStatus.label}</Text>
          </View>
        </View>

        <View style={styles.checklistSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>主市场准入清单</Text>
            <Text style={styles.sectionSubtitle}>完成以下核心合规备案即可正式上架服务</Text>
          </View>

          <CertItem
            title="UOM 平台实名登记"
            desc="根据民航法规，所有重载无人机均需完成实名登记。"
            status={uomStatus}
            emoji="📋"
            dataLabel="登记编号"
            dataValue={drone.uom_registration_no}
            onPress={() => openForm('uom')}
            theme={theme}
          />

          <CertItem
            title="第三方责任保险"
            desc="必须具备足额的三者险及机身险，保障飞行与吊装安全。"
            status={insuranceStatus}
            emoji="🛡️"
            dataLabel="到期日期"
            dataValue={drone.insurance_expire_date?.substring(0, 10)}
            onPress={() => openForm('insurance')}
            theme={theme}
          />

          <CertItem
            title="适航证/登记证"
            desc="重载资产需具备民航局颁发的标准适航证书。"
            status={airworthinessStatus}
            emoji="✈️"
            dataLabel="证书编号"
            dataValue={drone.airworthiness_cert_no}
            onPress={() => openForm('airworthiness')}
            theme={theme}
          />
        </View>

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>💡 资质审核通常在 1-2 个工作日内完成。资质齐备后，您的服务将获得“已核验”标识并提升排名。</Text>
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent={true} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeType === 'uom' ? 'UOM 平台备案' : activeType === 'insurance' ? '保险资料' : '适航证照片'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {activeType === 'uom' && (
                <View style={styles.formGroupContainer}>
                  <FormInput label="UOM 登记号 *" placeholder="请输入登记编号" value={uomRegNo} onChange={setUomRegNo} theme={theme} />
                  <FormUpload label="登记证明文件 *" value={uomDoc} onPress={() => pickImage(setUomDoc)} theme={theme} />
                </View>
              )}
              {activeType === 'insurance' && (
                <View style={styles.formGroupContainer}>
                  <FormInput label="保险单号 *" placeholder="请输入保单号" value={insurancePolicyNo} onChange={setInsurancePolicyNo} theme={theme} />
                  <FormInput label="承保公司 *" placeholder="如：中国人保" value={insuranceCompany} onChange={setInsuranceCompany} theme={theme} />
                  <View style={styles.rowInputs}>
                    <View style={{flex: 1}}><FormInput label="保额 (万) *" placeholder="500" value={insuranceCoverage} onChange={setInsuranceCoverage} keyboardType="numeric" theme={theme} /></View>
                    <View style={{flex: 1}}><FormInput label="到期日期 *" placeholder="YYYY-MM-DD" value={insuranceExpireDate} onChange={setInsuranceExpireDate} theme={theme} /></View>
                  </View>
                  <FormUpload label="保单扫描件 *" value={insuranceDoc} onPress={() => pickImage(setInsuranceDoc)} theme={theme} />
                </View>
              )}
              {activeType === 'airworthiness' && (
                <View style={styles.formGroupContainer}>
                  <FormInput label="证书编号 *" placeholder="请输入证书编号" value={airworthinessCertNo} onChange={setAirworthinessCertNo} theme={theme} />
                  <FormInput label="有效期至 *" placeholder="YYYY-MM-DD" value={airworthinessExpire} onChange={setAirworthinessExpire} theme={theme} />
                  <FormUpload label="证书照片 *" value={airworthinessDoc} onPress={() => pickImage(setAirworthinessDoc)} theme={theme} />
                </View>
              )}
              <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
                <Text style={styles.submitBtnText}>{submitting ? '提交中...' : '确认并提交资料'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CertItem({title, desc, status, emoji, dataLabel, dataValue, onPress, theme}: any) {
  const styles = getStyles(theme);
  return (
    <View style={styles.certCheckCard}>
      <View style={styles.certCheckHeader}>
        <View style={styles.certCheckTitleRow}><Text style={styles.certCheckEmoji}>{emoji}</Text><Text style={styles.certCheckTitle}>{title}</Text></View>
        <View style={[styles.miniBadge, {backgroundColor: status.color + '15'}]}><Text style={[styles.miniBadgeText, {color: status.color}]}>{status.label}</Text></View>
      </View>
      <Text style={styles.certCheckDesc}>{desc}</Text>
      {dataValue && (
        <View style={styles.certDataRow}><Text style={styles.certDataLabel}>{dataLabel}</Text><Text style={styles.certDataValue}>{dataValue}</Text></View>
      )}
      <TouchableOpacity style={styles.certActionBtn} onPress={onPress}><Text style={styles.certActionBtnText}>{dataValue ? '更新信息' : '立即备案'}</Text></TouchableOpacity>
    </View>
  );
}

function FormInput({label, placeholder, value, onChange, theme, ...props}: any) {
  const styles = getStyles(theme);
  return (
    <View style={styles.formItem}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={theme.textHint} value={value} onChangeText={onChange} {...props} />
    </View>
  );
}

function FormUpload({label, value, onPress, theme}: any) {
  const styles = getStyles(theme);
  return (
    <View style={styles.formItem}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity activeOpacity={0.7} style={styles.imageUpload} onPress={onPress}>
        {value ? <Image source={{uri: value}} style={styles.uploadedImage} /> : (
          <View style={styles.uploadPlaceholder}><Text style={styles.uploadIcon}>+</Text><Text style={styles.uploadText}>上传文件</Text></View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.bg, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.divider},
  backBtnHeader: {width: 60},
  backText: {fontSize: 16, color: theme.primaryText, fontWeight: '600'},
  headerTitle: {fontSize: 17, fontWeight: '800', color: theme.text},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {fontSize: 15, color: theme.textSub},
  scrollContent: {padding: 16, paddingBottom: 40},
  droneAssetCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: theme.divider, gap: 16, marginBottom: 20},
  droneAssetIcon: {width: 52, height: 52, borderRadius: 16, backgroundColor: theme.bgSecondary, justifyContent: 'center', alignItems: 'center'},
  droneAssetEmoji: {fontSize: 24},
  droneAssetInfo: {flex: 1, gap: 2},
  droneAssetName: {fontSize: 17, fontWeight: '800', color: theme.text},
  droneAssetSn: {fontSize: 11, color: theme.textHint, fontWeight: '600'},
  statusTag: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8},
  statusTagText: {fontSize: 12, fontWeight: '800'},
  checklistSection: {gap: 16},
  sectionHeader: {marginBottom: 4},
  sectionTitle: {fontSize: 18, fontWeight: '800', color: theme.text},
  sectionSubtitle: {fontSize: 13, color: theme.textSub, marginTop: 4},
  certCheckCard: {backgroundColor: theme.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.divider},
  certCheckHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  certCheckTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  certCheckEmoji: {fontSize: 18},
  certCheckTitle: {fontSize: 15, fontWeight: '800', color: theme.text},
  miniBadge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6},
  miniBadgeText: {fontSize: 11, fontWeight: '800'},
  certCheckDesc: {fontSize: 12, color: theme.textSub, lineHeight: 18, marginBottom: 16},
  certDataRow: {marginBottom: 16, backgroundColor: theme.bgSecondary, padding: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  certDataLabel: {fontSize: 11, color: theme.textHint, fontWeight: '600'},
  certDataValue: {fontSize: 13, color: theme.text, fontWeight: '700'},
  certActionBtn: {backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.divider, paddingVertical: 12, borderRadius: 14, alignItems: 'center'},
  certActionBtnText: {fontSize: 14, color: theme.primaryText, fontWeight: '700'},
  infoBanner: {marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: theme.primaryBg},
  infoBannerText: {fontSize: 12, color: theme.primaryText, lineHeight: 18, opacity: 0.8},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  modalContent: {backgroundColor: theme.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: theme.divider},
  modalTitle: {fontSize: 18, fontWeight: '800', color: theme.text},
  modalClose: {fontSize: 20, color: theme.textHint, fontWeight: '300'},
  modalBody: {paddingHorizontal: 24},
  modalScrollContent: {paddingBottom: 40},
  formGroupContainer: {gap: 20, marginTop: 20},
  formItem: {gap: 8},
  rowInputs: {flexDirection: 'row', gap: 12},
  label: {fontSize: 13, fontWeight: '700', color: theme.textSub},
  input: {backgroundColor: theme.bgSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.divider},
  imageUpload: {minHeight: 160, borderWidth: 1.5, borderColor: theme.divider, borderStyle: 'dashed', borderRadius: 16, overflow: 'hidden', backgroundColor: theme.bgSecondary},
  uploadPlaceholder: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8},
  uploadIcon: {fontSize: 32, color: theme.textHint},
  uploadText: {fontSize: 13, color: theme.textSub, fontWeight: '600'},
  uploadedImage: {width: '100%', height: '100%', resizeMode: 'cover'},
  submitBtn: {height: 54, backgroundColor: theme.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 24, shadowColor: theme.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4},
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
});
