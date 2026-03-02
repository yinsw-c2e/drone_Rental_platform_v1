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
  Image,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {
  registerIndividual,
  registerEnterprise,
  RegisterEnterpriseRequest,
} from '../../services/client';
import api from '../../services/api';

export default function ClientRegisterScreen({navigation}: any) {
  const [clientType, setClientType] = useState<'individual' | 'enterprise'>('individual');
  const [loading, setLoading] = useState(false);

  // 企业表单
  const [companyName, setCompanyName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseDoc, setLicenseDoc] = useState('');
  const [legalRep, setLegalRep] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

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
          name: asset.fileName || 'license.jpg',
        } as any);

        const uploadRes: any = await api.post('/pilot/upload-cert', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        setLicenseDoc(uploadRes.data.url);
        Alert.alert('提示', '图片上传成功');
      }
    } catch (e: any) {
      Alert.alert('错误', e.message || '图片上传失败');
    }
  };

  const handleSubmitIndividual = async () => {
    setLoading(true);
    try {
      await registerIndividual();
      Alert.alert('成功', '个人客户注册成功', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('注册失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEnterprise = async () => {
    if (!companyName.trim()) {
      Alert.alert('提示', '请输入企业名称');
      return;
    }
    if (!licenseNo.trim()) {
      Alert.alert('提示', '请输入统一社会信用代码');
      return;
    }
    if (!licenseDoc) {
      Alert.alert('提示', '请上传营业执照');
      return;
    }

    setLoading(true);
    try {
      const data: RegisterEnterpriseRequest = {
        company_name: companyName.trim(),
        business_license_no: licenseNo.trim(),
        business_license_doc: licenseDoc,
        legal_representative: legalRep.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
      };
      await registerEnterprise(data);
      Alert.alert('成功', '企业客户注册申请已提交，请等待审核', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('注册失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (clientType === 'individual') {
      handleSubmitIndividual();
    } else {
      handleSubmitEnterprise();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>客户注册</Text>
        <Text style={styles.subtitle}>注册后可以发布货运需求和下单</Text>

        {/* 客户类型 */}
        <Text style={styles.label}>客户类型</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeCard, clientType === 'individual' && styles.typeCardActive]}
            onPress={() => setClientType('individual')}>
            <Text style={[styles.typeCardTitle, clientType === 'individual' && styles.typeCardTitleActive]}>
              个人客户
            </Text>
            <Text style={[styles.typeCardDesc, clientType === 'individual' && styles.typeCardDescActive]}>
              快速注册，适合个人用户
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeCard, clientType === 'enterprise' && styles.typeCardActive]}
            onPress={() => setClientType('enterprise')}>
            <Text style={[styles.typeCardTitle, clientType === 'enterprise' && styles.typeCardTitleActive]}>
              企业客户
            </Text>
            <Text style={[styles.typeCardDesc, clientType === 'enterprise' && styles.typeCardDescActive]}>
              需提交营业执照审核
            </Text>
          </TouchableOpacity>
        </View>

        {/* 企业客户表单 */}
        {clientType === 'enterprise' && (
          <View>
            <Text style={styles.label}>企业名称 *</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入企业全称"
              value={companyName}
              onChangeText={setCompanyName}
            />

            <Text style={styles.label}>统一社会信用代码 *</Text>
            <TextInput
              style={styles.input}
              placeholder="18位统一社会信用代码"
              value={licenseNo}
              onChangeText={setLicenseNo}
            />

            <Text style={styles.label}>法定代表人</Text>
            <TextInput
              style={styles.input}
              placeholder="选填"
              value={legalRep}
              onChangeText={setLegalRep}
            />

            <Text style={styles.label}>联系人</Text>
            <TextInput
              style={styles.input}
              placeholder="选填"
              value={contactPerson}
              onChangeText={setContactPerson}
            />

            <Text style={styles.label}>联系电话</Text>
            <TextInput
              style={styles.input}
              placeholder="选填"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>联系邮箱</Text>
            <TextInput
              style={styles.input}
              placeholder="选填"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
            />

            <Text style={styles.label}>营业执照 *</Text>
            <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
              {licenseDoc ? (
                <Image source={{uri: licenseDoc}} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Text style={styles.uploadIcon}>+</Text>
                  <Text style={styles.uploadText}>点击上传营业执照</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {clientType === 'individual' && (
          <View style={styles.individualNote}>
            <Text style={styles.noteTitle}>个人客户说明</Text>
            <Text style={styles.noteText}>
              1. 个人客户注册无需提交额外资料{'\n'}
              2. 系统会自动创建您的客户档案{'\n'}
              3. 注册后即可发布货运需求{'\n'}
              4. 首次下单可能需要通过征信审核
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          <Text style={styles.submitBtnText}>
            {loading ? '提交中...' : clientType === 'individual' ? '立即注册' : '提交审核'}
          </Text>
        </TouchableOpacity>
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
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    padding: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    alignItems: 'center',
  },
  typeCardActive: {
    borderColor: '#1890ff',
    backgroundColor: '#e6f7ff',
  },
  typeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  typeCardTitleActive: {
    color: '#1890ff',
  },
  typeCardDesc: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  typeCardDescActive: {
    color: '#1890ff',
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
  individualNote: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
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
});
