import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import DateOnlyField from '../../components/DateOnlyField';
import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import { API_ROOT_URL } from '../../constants';
import { apiV2 } from '../../services/api';
import { submitCriminalCheck, submitHealthCheck } from '../../services/pilot';
import { pilotV2Service } from '../../services/pilotV2';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/index';

const CAAC_TYPES = [
  { label: 'VLOS（视距内）', value: 'VLOS' },
  { label: 'BVLOS（超视距）', value: 'BVLOS' },
  { label: '教员证', value: 'instructor' },
];

const skillOptions = [
  '电网吊运',
  '山区运输',
  '应急救援',
  '海岛补给',
  '高原补给',
];

const resolveImageUrl = (url?: string) => {
  const raw = (url || '').trim();
  if (!raw) {
    return '';
  }
  if (/^(https?:|file:|content:|data:|blob:)/i.test(raw)) {
    return raw;
  }
  return `${API_ROOT_URL}${raw.startsWith('/') ? raw : `/${raw}`}`;
};

const pickLocationCity = (...values: any[]) =>
  values
    .map(value => String(value || '').trim())
    .find(Boolean) || '';

const formatServiceBaseSubtitle = (lat: number, lng: number) => {
  if (!lat || !lng) {
    return '后续派单会以该地点和服务半径计算覆盖范围';
  }
  return `坐标 ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
};

export default function PilotRegisterScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [licenseType, setLicenseType] = useState('VLOS');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpireDate, setLicenseExpireDate] = useState('');
  const [licenseImage, setLicenseImage] = useState('');
  const [serviceRadius, setServiceRadius] = useState('50');
  const [currentCity, setCurrentCity] = useState('');
  const [serviceBaseAddress, setServiceBaseAddress] = useState('');
  const [serviceBaseLatitude, setServiceBaseLatitude] = useState(0);
  const [serviceBaseLongitude, setServiceBaseLongitude] = useState(0);
  const [specialSkills, setSpecialSkills] = useState<string[]>(['电网吊运']);
  const [criminalDoc, setCriminalDoc] = useState('');
  const [healthDoc, setHealthDoc] = useState('');
  const [healthExpireDate, setHealthExpireDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  const progress = useMemo(() => {
    return [
      licenseNo,
      licenseExpireDate,
      licenseImage,
      serviceBaseAddress,
    ].filter(Boolean).length;
  }, [licenseExpireDate, licenseImage, licenseNo, serviceBaseAddress]);

  const uploadImage = async (setter: (url: string) => void, label: string) => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      if (!result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];
      setUploading(true);
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'cert.jpg',
      } as any);
      const uploadRes: any = await apiV2.post('/pilot/upload-cert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedUrl = uploadRes.data?.url || uploadRes.url || '';
      if (!uploadedUrl) {
        throw new Error('上传成功但未返回文件地址，请重试');
      }
      setter(uploadedUrl);
      Alert.alert('上传成功', `${label}已上传。`);
    } catch (e: any) {
      Alert.alert('上传失败', e?.message || '请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSpecialSkills(prev =>
      prev.includes(skill)
        ? prev.filter(item => item !== skill)
        : [...prev, skill],
    );
  };

  const chooseServiceBase = () => {
    navigation.navigate('MapPicker', {
      latitude: serviceBaseLatitude || undefined,
      longitude: serviceBaseLongitude || undefined,
      onSelect: (addr: any) => {
        setCurrentCity(pickLocationCity(addr.city, addr.district, addr.province));
        setServiceBaseAddress(addr.address || addr.name || '');
        setServiceBaseLatitude(Number(addr.latitude || 0));
        setServiceBaseLongitude(Number(addr.longitude || 0));
      },
    });
  };

  const handleSubmit = async () => {
    if (!licenseNo.trim()) {
      Alert.alert('请补充信息', '请输入 CAAC 执照编号');
      return;
    }
    if (!licenseExpireDate.trim()) {
      Alert.alert('请补充信息', '请输入执照有效期');
      return;
    }
    if (!licenseImage) {
      Alert.alert('请补充信息', '请上传 CAAC 执照照片');
      return;
    }
    if (!serviceBaseLatitude || !serviceBaseLongitude) {
      Alert.alert('请补充信息', '请选择服务基准地点');
      return;
    }

    setLoading(true);
    try {
      await pilotV2Service.upsertProfile({
        caac_license_no: licenseNo.trim(),
        caac_license_type: licenseType,
        caac_license_expire_date: `${licenseExpireDate.trim()}T00:00:00Z`,
        caac_license_image: licenseImage,
        service_radius: Number(serviceRadius) || 50,
        current_city: currentCity.trim(),
        service_base_address: serviceBaseAddress.trim(),
        service_base_latitude: serviceBaseLatitude,
        service_base_longitude: serviceBaseLongitude,
        special_skills: specialSkills,
      });

      if (criminalDoc) {
        try {
          await submitCriminalCheck(criminalDoc);
        } catch {}
      }
      if (healthDoc && healthExpireDate.trim()) {
        try {
          await submitHealthCheck({
            doc_url: healthDoc,
            expire_date: `${healthExpireDate.trim()}T00:00:00Z`,
          });
        } catch {}
      }

      Alert.alert(
        '提交成功',
        '飞手认证资料已提交，后续可在飞手中心继续管理接单状态和服务范围。',
        [
          {
            text: '去飞手中心',
            onPress: () => navigation.replace('PilotProfile'),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('提交失败', e?.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const ImageUploadBlock = ({
    label,
    value,
    onPick,
    onClear,
    required,
  }: {
    label: string;
    value: string;
    onPick: () => void;
    onClear: () => void;
    required?: boolean;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View
        style={[styles.imageUpload, value ? styles.imageUploadFilled : null]}
      >
        {value ? (
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.uploadPreview}
            onPress={() => setPreviewImage(resolveImageUrl(value))}
          >
            <Image
              source={{ uri: resolveImageUrl(value) }}
              style={styles.uploadedImage}
            />
            <View style={styles.uploadMask}>
              <Text style={styles.uploadStatus}>已上传</Text>
              <Text style={styles.uploadHint}>点击图片可查看大图</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.uploadPlaceholder}
            onPress={onPick}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                <Text style={styles.uploadIcon}>+</Text>
                <Text style={styles.uploadText}>点击上传{label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
      {value ? (
        <View style={styles.uploadActions}>
          <TouchableOpacity
            style={styles.uploadAction}
            onPress={() => setPreviewImage(resolveImageUrl(value))}
          >
            <Text style={styles.uploadActionText}>查看</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadAction}
            onPress={onPick}
            disabled={uploading}
          >
            <Text style={styles.uploadActionText}>更换</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.uploadAction, styles.uploadActionDanger]}
            onPress={onClear}
          >
            <Text style={styles.uploadActionDangerText}>删除</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.bgSecondary }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ObjectCard style={[styles.heroCard, { marginBottom: 0 }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>飞手认证与能力设置</Text>
              <Text style={styles.heroSubtitle}>
                这里负责建立飞手档案。后续在线状态、服务城市和技能标签都围绕这份档案展开。
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <StatusBadge label={`进度 ${progress}/4`} tone="blue" />
            </View>
          </View>
        </ObjectCard>

        <ObjectCard style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>执照信息</Text>
          <View style={styles.sectionBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CAAC 执照类型 *</Text>
              <View style={styles.typeContainer}>
                {CAAC_TYPES.map(type => {
                  const active = licenseType === type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeOption,
                        active && styles.typeOptionActive,
                      ]}
                      onPress={() => setLicenseType(type.value)}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          active && styles.typeOptionTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CAAC 执照编号 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入 CAAC 执照编号"
                value={licenseNo}
                onChangeText={setLicenseNo}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <DateOnlyField
                label="执照有效期"
                value={licenseExpireDate}
                onChange={setLicenseExpireDate}
                theme={theme}
                required
              />
            </View>

            <ImageUploadBlock
              label="CAAC 执照照片"
              value={licenseImage}
              onPick={() => uploadImage(setLicenseImage, 'CAAC 执照照片')}
              onClear={() => setLicenseImage('')}
              required
            />
          </View>
        </ObjectCard>

        <ObjectCard style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>接单能力设置</Text>
          <View style={styles.sectionBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>服务基准地点 *</Text>
              <TouchableOpacity
                style={styles.locationCard}
                onPress={chooseServiceBase}
                activeOpacity={0.85}
              >
                <View style={styles.locationMain}>
                  <Text style={styles.locationTitle} numberOfLines={2}>
                    {serviceBaseAddress || '请选择服务半径的中心地点'}
                  </Text>
                  <Text style={styles.locationSub} numberOfLines={2}>
                    {formatServiceBaseSubtitle(
                      serviceBaseLatitude,
                      serviceBaseLongitude,
                    )}
                  </Text>
                </View>
                <Text style={styles.locationAction}>选择</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>服务半径（公里）</Text>
              <TextInput
                style={styles.input}
                placeholder="默认 50"
                value={serviceRadius}
                onChangeText={setServiceRadius}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>技能标签</Text>
              <View style={styles.skillRow}>
                {skillOptions.map(skill => {
                  const active = specialSkills.includes(skill);
                  return (
                    <TouchableOpacity
                      key={skill}
                      style={[
                        styles.skillChip,
                        active && styles.skillChipActive,
                      ]}
                      onPress={() => toggleSkill(skill)}
                    >
                      <Text
                        style={[
                          styles.skillChipText,
                          active && styles.skillChipTextActive,
                        ]}
                      >
                        {skill}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </ObjectCard>

        <ObjectCard style={[styles.sectionCard, { marginBottom: 0 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>补充材料</Text>
            <Text style={styles.sectionDesc}>
              这些材料用来补充核验信息，不影响飞手主档案提交。
            </Text>
          </View>
          <View style={styles.sectionBody}>
            <ImageUploadBlock
              label="无犯罪记录证明"
              value={criminalDoc}
              onPick={() => uploadImage(setCriminalDoc, '无犯罪记录证明')}
              onClear={() => setCriminalDoc('')}
            />
            <ImageUploadBlock
              label="健康证明"
              value={healthDoc}
              onPick={() => uploadImage(setHealthDoc, '健康证明')}
              onClear={() => setHealthDoc('')}
            />
            <View style={styles.fieldGroup}>
              <DateOnlyField
                label="健康证明有效期"
                value={healthExpireDate}
                onChange={setHealthExpireDate}
                theme={theme}
              />
            </View>
          </View>
        </ObjectCard>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (loading || uploading) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || uploading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? '提交中...' : '提交飞手认证'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage('')}
      >
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage('')}
        >
          <Image
            source={{ uri: previewImage }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgSecondary },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
      gap: 24,
    },
    heroCard: {
      padding: 24,
      backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroContent: { flex: 1, minWidth: 0, gap: 12 },
    heroBadge: { flexShrink: 0, alignSelf: 'flex-start', marginTop: 4 },
    heroTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: theme.isDark ? theme.text : '#FFFFFF',
      letterSpacing: 0,
    },
    heroSubtitle: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.9)',
    },
    sectionCard: { padding: 24, gap: 24 },
    sectionHeader: { gap: 12 },
    sectionBody: { gap: 24 },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: theme.text,
      letterSpacing: 0,
    },
    sectionDesc: { fontSize: 14, lineHeight: 20, color: theme.textSub },
    fieldGroup: { gap: 12 },
    label: { fontSize: 14, fontWeight: '800', color: theme.text, opacity: 0.9 },
    input: {
      borderWidth: 1.5,
      borderColor: theme.cardBorder,
      borderRadius: 16,
      backgroundColor: theme.bgSecondary,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.text,
    },
    locationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1.5,
      borderColor: theme.primary + '35',
      borderRadius: 16,
      backgroundColor: theme.primary + '08',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    locationMain: { flex: 1 },
    locationTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '800',
      color: theme.text,
    },
    locationSub: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 17,
      color: theme.textSub,
    },
    locationAction: { fontSize: 14, fontWeight: '800', color: theme.primary },
    typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    typeOption: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1.5,
      borderColor: theme.cardBorder,
    },
    typeOptionActive: {
      backgroundColor: theme.primary + '15',
      borderColor: theme.primary,
    },
    typeOptionText: { fontSize: 14, fontWeight: '700', color: theme.textSub },
    typeOptionTextActive: { color: theme.primary },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    skillChip: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.bgSecondary,
      borderWidth: 1.5,
      borderColor: theme.cardBorder,
    },
    skillChipActive: {
      backgroundColor: theme.success + '15',
      borderColor: theme.success,
    },
    skillChipText: { fontSize: 14, fontWeight: '700', color: theme.textSub },
    skillChipTextActive: { color: theme.success },
    imageUpload: {
      minHeight: 200,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: theme.cardBorder,
      borderStyle: 'dashed',
      overflow: 'hidden',
      backgroundColor: theme.bgSecondary,
    },
    imageUploadFilled: {
      borderStyle: 'solid',
      borderColor: theme.primary + '35',
    },
    uploadPreview: { minHeight: 200, position: 'relative' },
    uploadPlaceholder: {
      minHeight: 200,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    uploadIcon: { fontSize: 40, color: theme.textHint, fontWeight: '300' },
    uploadText: { fontSize: 15, color: theme.textSub, fontWeight: '600' },
    uploadedImage: { width: '100%', height: 240, resizeMode: 'cover' },
    uploadMask: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: 'rgba(15,23,42,0.68)',
    },
    uploadStatus: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
    uploadHint: { fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
    uploadActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    uploadAction: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.primary + '35',
      backgroundColor: theme.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadActionText: { fontSize: 13, fontWeight: '800', color: theme.primary },
    uploadActionDanger: {
      borderColor: theme.danger + '35',
      backgroundColor: theme.danger + '10',
    },
    uploadActionDangerText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.danger,
    },
    previewOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.86)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    previewImage: { width: '100%', height: '82%' },
    submitButton: {
      borderRadius: 18,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    submitButtonText: {
      fontSize: 17,
      fontWeight: '900',
      color: theme.btnPrimaryText,
    },
    buttonDisabled: { opacity: 0.6, shadowOpacity: 0 },
  });
