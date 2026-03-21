import React, {useMemo, useState} from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {registerEnterprise, RegisterEnterpriseRequest} from '../../services/client';
import api from '../../services/api';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

export default function ClientRegisterScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseDoc, setLicenseDoc] = useState('');
  const [legalRep, setLegalRep] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const completedCount = useMemo(() => {
    return [companyName, licenseNo, licenseDoc, contactPerson || contactPhone || contactEmail || legalRep]
      .filter(Boolean).length;
  }, [companyName, contactEmail, contactPerson, contactPhone, legalRep, licenseDoc, licenseNo]);

  const pickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.assets?.[0]) {
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'business-license.jpg',
        } as any);

        const uploadRes: any = await api.post('/pilot/upload-cert', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        setLicenseDoc(uploadRes.data.url);
        Alert.alert('上传成功', '营业执照图片已上传。');
      }
    } catch (e: any) {
      Alert.alert('上传失败', e?.message || '请稍后重试');
    }
  };

  const handleSubmitEnterprise = async () => {
    if (!companyName.trim()) {
      Alert.alert('请补充信息', '请输入企业名称');
      return;
    }
    if (!licenseNo.trim()) {
      Alert.alert('请补充信息', '请输入统一社会信用代码');
      return;
    }
    if (!licenseDoc) {
      Alert.alert('请补充信息', '请上传营业执照');
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
      Alert.alert('提交成功', '企业客户升级申请已提交，请等待审核。', [
        {text: '返回客户档案', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      const errMsg: string = e?.response?.data?.error || e?.message || '提交失败';
      if (errMsg.includes('已存在')) {
        Alert.alert('已处理', '当前账号已经提交过企业客户资料，可回到客户档案查看状态。', [
          {text: '返回客户档案', onPress: () => navigation.goBack()},
        ]);
      } else {
        Alert.alert('提交失败', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ObjectCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroTitle}>企业客户升级</Text>
              <Text style={styles.heroSubtitle}>个人客户档案已默认开通。这里仅用于升级企业资质，不再做重复“客户注册”。</Text>
            </View>
            <StatusBadge label={`进度 ${completedCount}/4`} tone="blue" />
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>升级后你会得到什么</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>1. 以企业主体发布需求和沉淀信用档案</Text>
            <Text style={styles.bulletItem}>2. 对公联系人、企业名称、营业资质集中管理</Text>
            <Text style={styles.bulletItem}>3. 后续便于拓展企业结算、审计和运营能力</Text>
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>企业资料</Text>

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
            placeholder="18 位统一社会信用代码"
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
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>企业联系人</Text>

          <Text style={styles.label}>联系人</Text>
          <TextInput
            style={styles.input}
            placeholder="建议填写后续业务联系人"
            value={contactPerson}
            onChangeText={setContactPerson}
          />

          <Text style={styles.label}>联系电话</Text>
          <TextInput
            style={styles.input}
            placeholder="选填"
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={setContactPhone}
          />

          <Text style={styles.label}>联系邮箱</Text>
          <TextInput
            style={styles.input}
            placeholder="选填"
            keyboardType="email-address"
            autoCapitalize="none"
            value={contactEmail}
            onChangeText={setContactEmail}
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>营业执照</Text>
          <Text style={styles.sectionDesc}>上传清晰完整的营业执照照片，用于企业主体审核。</Text>
          <TouchableOpacity style={styles.imageUpload} onPress={pickImage} activeOpacity={0.85}>
            {licenseDoc ? (
              <Image source={{uri: licenseDoc}} style={styles.uploadedImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Text style={styles.uploadIcon}>+</Text>
                <Text style={styles.uploadText}>点击上传营业执照</Text>
              </View>
            )}
          </TouchableOpacity>
        </ObjectCard>

        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>先不升级</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmitEnterprise}
            disabled={loading}>
            <Text style={styles.submitText}>{loading ? '提交中...' : '提交企业升级'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bgSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  heroCard: {
    backgroundColor: theme.primary,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.btnPrimaryText,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
  },
  bulletList: {
    gap: 10,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
  },
  imageUpload: {
    minHeight: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
    backgroundColor: theme.bgSecondary,
  },
  uploadPlaceholder: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    fontSize: 36,
    color: theme.textHint,
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.textSub,
  },
  uploadedImage: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    minWidth: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  submitButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.btnPrimaryText,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
