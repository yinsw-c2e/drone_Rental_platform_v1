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
  Platform,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {registerPilot, RegisterPilotRequest} from '../../services/pilot';
import api from '../../services/api';

const LICENSE_TYPES = [
  {label: 'CAAC 无人机驾驶员执照', value: 'caac_pilot'},
  {label: 'AOPA 无人机驾驶员合格证', value: 'aopa'},
  {label: 'UTC 无人机操控师证', value: 'utc'},
  {label: '其他资质', value: 'other'},
];

export default function PilotRegisterScreen({navigation}: any) {
  const [licenseType, setLicenseType] = useState('caac_pilot');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseIssuer, setLicenseIssuer] = useState('');
  const [licenseIssueDate, setLicenseIssueDate] = useState('');
  const [licenseExpireDate, setLicenseExpireDate] = useState('');
  const [licenseImage, setLicenseImage] = useState('');
  const [serviceRadius, setServiceRadius] = useState('50');
  const [loading, setLoading] = useState(false);

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
        // 上传图片
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'license.jpg',
        } as any);

        const uploadRes: any = await api.post('/pilot/upload-cert', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        setLicenseImage(uploadRes.data.url);
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
    // 验证必填项
    if (!licenseNo.trim()) {
      Alert.alert('提示', '请输入执照编号');
      return;
    }
    if (!licenseIssuer.trim()) {
      Alert.alert('提示', '请输入发证机关');
      return;
    }
    if (!licenseIssueDate || !validateDate(licenseIssueDate)) {
      Alert.alert('提示', '请输入正确的发证日期 (格式: YYYY-MM-DD)');
      return;
    }
    if (!licenseExpireDate || !validateDate(licenseExpireDate)) {
      Alert.alert('提示', '请输入正确的有效期 (格式: YYYY-MM-DD)');
      return;
    }
    if (!licenseImage) {
      Alert.alert('提示', '请上传执照照片');
      return;
    }

    const data: RegisterPilotRequest = {
      license_type: licenseType,
      license_no: licenseNo.trim(),
      license_issuer: licenseIssuer.trim(),
      license_issue_date: licenseIssueDate,
      license_expire_date: licenseExpireDate,
      license_image: licenseImage,
      service_radius_km: parseInt(serviceRadius, 10) || 50,
    };

    setLoading(true);
    try {
      await registerPilot(data);
      Alert.alert('成功', '飞手注册申请已提交，请等待审核', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('注册失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>飞手资质认证</Text>
        <Text style={styles.subtitle}>请填写您的飞行执照信息</Text>

        {/* 执照类型 */}
        <Text style={styles.label}>执照类型</Text>
        <View style={styles.typeContainer}>
          {LICENSE_TYPES.map(type => (
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

        {/* 执照编号 */}
        <Text style={styles.label}>执照编号 *</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入执照编号"
          value={licenseNo}
          onChangeText={setLicenseNo}
        />

        {/* 发证机关 */}
        <Text style={styles.label}>发证机关 *</Text>
        <TextInput
          style={styles.input}
          placeholder="如: 中国民用航空局"
          value={licenseIssuer}
          onChangeText={setLicenseIssuer}
        />

        {/* 发证日期 */}
        <Text style={styles.label}>发证日期 *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={licenseIssueDate}
          onChangeText={setLicenseIssueDate}
          keyboardType={Platform.OS === 'ios' ? 'default' : 'default'}
        />

        {/* 有效期至 */}
        <Text style={styles.label}>有效期至 *</Text>
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

        {/* 执照照片 */}
        <Text style={styles.label}>执照照片 *</Text>
        <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
          {licenseImage ? (
            <Image source={{uri: licenseImage}} style={styles.uploadedImage} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>+</Text>
              <Text style={styles.uploadText}>点击上传执照照片</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 提交按钮 */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          <Text style={styles.submitBtnText}>
            {loading ? '提交中...' : '提交认证申请'}
          </Text>
        </TouchableOpacity>

        {/* 提示信息 */}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>认证说明</Text>
          <Text style={styles.noticeText}>
            1. 请确保上传的执照照片清晰可辨{'\n'}
            2. 执照必须在有效期内{'\n'}
            3. 审核通常需要1-3个工作日{'\n'}
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
});
