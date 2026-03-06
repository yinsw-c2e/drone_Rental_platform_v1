import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {registerPilot, submitCriminalCheck, submitHealthCheck} from '../../services/pilot';
import api from '../../services/api';
import {API_BASE_URL} from '../../constants';

const IMAGE_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, '');

const CAAC_TYPES = [
  {label: 'VLOS （视距内）', value: 'VLOS'},
  {label: 'BVLOS （超视距）', value: 'BVLOS'},
  {label: '教员证', value: 'instructor'},
];

export default function PilotRegisterScreen({navigation}: any) {
  // CAAC执照信息
  const [licenseType, setLicenseType] = useState('VLOS');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpireDate, setLicenseExpireDate] = useState('');
  const [licenseImage, setLicenseImage] = useState(''); // 存储完整URL
  const [serviceRadius, setServiceRadius] = useState('50');

  // 无犯罪记录证明
  const [criminalDoc, setCriminalDoc] = useState('');   // 完整URL
  const [criminalExpireDate, setCriminalExpireDate] = useState('');

  // 健康体检证明
  const [healthDoc, setHealthDoc] = useState('');       // 完整URL
  const [healthExpireDate, setHealthExpireDate] = useState('');

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // 通用图片上传函数
  const uploadImage = async (setter: (url: string) => void, label: string) => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      if (!result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'cert.jpg',
      } as any);
      const uploadRes: any = await api.post('/pilot/upload-cert', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      const relUrl: string = uploadRes.data?.url || '';
      const fullUrl = relUrl.startsWith('http') ? relUrl : `${IMAGE_BASE_URL}${relUrl}`;
      setter(fullUrl);
      Alert.alert('提示', `${label}上传成功`);
    } catch (e: any) {
      Alert.alert('错误', e.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const validateDate = (dateStr: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

  const handleSubmit = async () => {
    if (!licenseNo.trim()) {
      Alert.alert('提示', '请输入CAAC执照编号');
      return;
    }
    if (!licenseExpireDate || !validateDate(licenseExpireDate)) {
      Alert.alert('提示', '请输入正确的执照有效期 (格式: YYYY-MM-DD)');
      return;
    }
    if (!licenseImage) {
      Alert.alert('提示', '请上传CAAC执照照片');
      return;
    }

    setLoading(true);
    try {
      // 第一步：注册飞手
      await registerPilot({
        caac_license_no: licenseNo.trim(),
        caac_license_type: licenseType,
        caac_license_expire_date: licenseExpireDate
          ? `${licenseExpireDate}T00:00:00Z`
          : undefined,
        caac_license_image: licenseImage,
        service_radius: parseInt(serviceRadius, 10) || 50,
      });

      // 第二步：提交无犯罪记录（如果已上传）
      if (criminalDoc) {
        try {
          await submitCriminalCheck(criminalDoc);
        } catch (_) {}
      }

      // 第三步：提交健康体检证明（如果已上传）
      if (healthDoc) {
        try {
          await submitHealthCheck({
            doc_url: healthDoc,
            expire_date: healthExpireDate
              ? `${healthExpireDate}T00:00:00Z`
              : '',
          });
        } catch (_) {}
      }

      Alert.alert('成功', '飞手注册申请已提交，请等待审核', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('注册失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  const ImageUploadBlock = ({
    label,
    value,
    required,
    onPick,
  }: {
    label: string;
    value: string;
    required?: boolean;
    onPick: () => void;
  }) => (
    <View>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TouchableOpacity style={styles.imageUpload} onPress={onPick} disabled={uploading}>
        {value ? (
          <Image source={{uri: value}} style={styles.uploadedImage} />
        ) : (
          <View style={styles.uploadPlaceholder}>
            {uploading ? (
              <ActivityIndicator color="#1890ff" />
            ) : (
              <>
                <Text style={styles.uploadIcon}>+</Text>
                <Text style={styles.uploadText}>点击上传{label}</Text>
              </>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>飞手资质认证</Text>
        <Text style={styles.subtitle}>请填写您的执照信息及相关证明</Text>

        {/* CAAC执照类型 */}
        <Text style={styles.label}>CAAC执照类型 *</Text>
        <View style={styles.typeContainer}>
          {CAAC_TYPES.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeOption,
                licenseType === type.value && styles.typeOptionActive,
              ]}
              onPress={() => setLicenseType(type.value)}>
              <Text
                style={[
                  styles.typeOptionText,
                  licenseType === type.value && styles.typeOptionTextActive,
                ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CAAC执照编号 */}
        <Text style={styles.label}>CAAC执照编号 *</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入CAAC执照编号"
          value={licenseNo}
          onChangeText={setLicenseNo}
          autoCapitalize="none"
        />

        {/* 执照有效期 */}
        <Text style={styles.label}>执照有效期 *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={licenseExpireDate}
          onChangeText={setLicenseExpireDate}
        />

        {/* 服务半径 */}
        <Text style={styles.label}>服务半径 (公里)</Text>
        <TextInput
          style={styles.input}
          placeholder="默认 50 公里"
          value={serviceRadius}
          onChangeText={setServiceRadius}
          keyboardType="number-pad"
        />

        {/* CAAC执照照片 */}
        <ImageUploadBlock
          label="CAAC执照照片"
          value={licenseImage}
          required
          onPick={() => uploadImage(setLicenseImage, 'CAAC执照照片')}
        />

        {/* 分割线 */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>补充材料（建议提交，提高审核通过率）</Text>

        {/* 无犯罪记录证明 */}
        <ImageUploadBlock
          label="无犯罪记录证明"
          value={criminalDoc}
          onPick={() => uploadImage(setCriminalDoc, '无犯罪记录证明')}
        />
        <Text style={styles.label}>无犯罪记录有效期</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={criminalExpireDate}
          onChangeText={setCriminalExpireDate}
        />

        {/* 健康体检证明 */}
        <ImageUploadBlock
          label="健康体检证明"
          value={healthDoc}
          onPick={() => uploadImage(setHealthDoc, '健康体检证明')}
        />
        <Text style={styles.label}>健康证明有效期</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={healthExpireDate}
          onChangeText={setHealthExpireDate}
        />

        {/* 提交按钮 */}
        <TouchableOpacity
          style={[styles.submitBtn, (loading || uploading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || uploading}>
          <Text style={styles.submitBtnText}>
            {loading ? '提交中...' : '提交认证申请'}
          </Text>
        </TouchableOpacity>

        {/* 提示信息 */}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>认证说明</Text>
          <Text style={styles.noticeText}>
            1. CAAC执照编号为必填项，请确保执照在有效期内{'\n'}
            2. 补充无犯罪记录和健康证明可提高审核通过率{'\n'}
            3. 审核通常需要 1-3 个工作日{'\n'}
            4. 审核通过后即可开始接单
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  typeOptionActive: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#666',
  },
  typeOptionTextActive: {
    color: '#fff',
  },
  imageUpload: {
    height: 180,
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
    fontSize: 48,
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
    marginTop: 32,
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  notice: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1890ff',
    marginBottom: 8,
  },
});
