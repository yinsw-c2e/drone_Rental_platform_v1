import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
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
import api from '../../services/api';
import {submitCriminalCheck, submitHealthCheck} from '../../services/pilot';
import {pilotV2Service} from '../../services/pilotV2';

const CAAC_TYPES = [
  {label: 'VLOS（视距内）', value: 'VLOS'},
  {label: 'BVLOS（超视距）', value: 'BVLOS'},
  {label: '教员证', value: 'instructor'},
];

const skillOptions = ['电网吊运', '山区运输', '应急救援', '海岛补给', '高原补给'];

export default function PilotRegisterScreen({navigation}: any) {
  const [licenseType, setLicenseType] = useState('VLOS');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpireDate, setLicenseExpireDate] = useState('');
  const [licenseImage, setLicenseImage] = useState('');
  const [serviceRadius, setServiceRadius] = useState('50');
  const [currentCity, setCurrentCity] = useState('');
  const [specialSkills, setSpecialSkills] = useState<string[]>(['电网吊运']);
  const [criminalDoc, setCriminalDoc] = useState('');
  const [healthDoc, setHealthDoc] = useState('');
  const [healthExpireDate, setHealthExpireDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const progress = useMemo(() => {
    return [licenseNo, licenseExpireDate, licenseImage, currentCity].filter(Boolean).length;
  }, [currentCity, licenseExpireDate, licenseImage, licenseNo]);

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
      const uploadRes: any = await api.post('/pilot/upload-cert', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      setter(uploadRes.data?.url || '');
      Alert.alert('上传成功', `${label}已上传。`);
    } catch (e: any) {
      Alert.alert('上传失败', e?.message || '请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSpecialSkills(prev => prev.includes(skill) ? prev.filter(item => item !== skill) : [...prev, skill]);
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
    if (!currentCity.trim()) {
      Alert.alert('请补充信息', '请填写当前服务城市');
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

      Alert.alert('提交成功', '飞手认证资料已提交，后续可在飞手中心继续管理接单状态和服务范围。', [
        {text: '去飞手中心', onPress: () => navigation.replace('PilotProfile')},
      ]);
    } catch (e: any) {
      Alert.alert('提交失败', e?.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const ImageUploadBlock = ({label, value, onPick, required}: {label: string; value: string; onPick: () => void; required?: boolean}) => (
    <View>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TouchableOpacity style={styles.imageUpload} onPress={onPick} disabled={uploading}>
        {value ? (
          <Image source={{uri: value}} style={styles.uploadedImage} />
        ) : (
          <View style={styles.uploadPlaceholder}>
            {uploading ? <ActivityIndicator color="#0f5cab" /> : <>
              <Text style={styles.uploadIcon}>+</Text>
              <Text style={styles.uploadText}>点击上传{label}</Text>
            </>}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ObjectCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroTitle}>飞手认证与能力设置</Text>
              <Text style={styles.heroSubtitle}>这里负责建立飞手档案。后续在线状态、服务城市和技能标签都围绕这份档案展开。</Text>
            </View>
            <StatusBadge label={`进度 ${progress}/4`} tone="blue" />
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>执照信息</Text>
          <Text style={styles.label}>CAAC 执照类型 *</Text>
          <View style={styles.typeContainer}>
            {CAAC_TYPES.map(type => {
              const active = licenseType === type.value;
              return (
                <TouchableOpacity key={type.value} style={[styles.typeOption, active && styles.typeOptionActive]} onPress={() => setLicenseType(type.value)}>
                  <Text style={[styles.typeOptionText, active && styles.typeOptionTextActive]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>CAAC 执照编号 *</Text>
          <TextInput style={styles.input} placeholder="请输入 CAAC 执照编号" value={licenseNo} onChangeText={setLicenseNo} autoCapitalize="none" />

          <Text style={styles.label}>执照有效期 *</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={licenseExpireDate} onChangeText={setLicenseExpireDate} />

          <ImageUploadBlock label="CAAC 执照照片" value={licenseImage} onPick={() => uploadImage(setLicenseImage, 'CAAC 执照照片')} required />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>接单能力设置</Text>
          <Text style={styles.label}>当前服务城市 *</Text>
          <TextInput style={styles.input} placeholder="例如：佛山" value={currentCity} onChangeText={setCurrentCity} />

          <Text style={styles.label}>服务半径（公里）</Text>
          <TextInput style={styles.input} placeholder="默认 50" value={serviceRadius} onChangeText={setServiceRadius} keyboardType="number-pad" />

          <Text style={styles.label}>技能标签</Text>
          <View style={styles.skillRow}>
            {skillOptions.map(skill => {
              const active = specialSkills.includes(skill);
              return (
                <TouchableOpacity key={skill} style={[styles.skillChip, active && styles.skillChipActive]} onPress={() => toggleSkill(skill)}>
                  <Text style={[styles.skillChipText, active && styles.skillChipTextActive]}>{skill}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>补充材料</Text>
          <Text style={styles.sectionDesc}>这些材料当前仍走补充提交流程，用来提高审核通过率，不影响飞手主档案的 v2 建立。</Text>
          <ImageUploadBlock label="无犯罪记录证明" value={criminalDoc} onPick={() => uploadImage(setCriminalDoc, '无犯罪记录证明')} />
          <ImageUploadBlock label="健康证明" value={healthDoc} onPick={() => uploadImage(setHealthDoc, '健康证明')} />
          <Text style={styles.label}>健康证明有效期</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={healthExpireDate} onChangeText={setHealthExpireDate} />
        </ObjectCard>

        <TouchableOpacity style={[styles.submitButton, (loading || uploading) && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading || uploading}>
          <Text style={styles.submitButtonText}>{loading ? '提交中...' : '提交飞手认证'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#eef3f8'},
  content: {padding: 16, paddingBottom: 32, gap: 14},
  heroCard: {backgroundColor: '#0f5cab'},
  heroHeader: {flexDirection: 'row', justifyContent: 'space-between', gap: 12},
  heroTitle: {fontSize: 24, fontWeight: '800', color: '#fff'},
  heroSubtitle: {marginTop: 6, fontSize: 13, lineHeight: 20, color: '#dbeafe'},
  sectionCard: {gap: 12},
  sectionTitle: {fontSize: 20, fontWeight: '800', color: '#102a43'},
  sectionDesc: {fontSize: 13, lineHeight: 20, color: '#64748b'},
  label: {fontSize: 13, fontWeight: '700', color: '#334e68'},
  input: {borderWidth: 1, borderColor: '#d8e1eb', borderRadius: 12, backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#102a43'},
  typeContainer: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  typeOption: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#edf2f7'},
  typeOptionActive: {backgroundColor: '#dbeafe'},
  typeOptionText: {fontSize: 13, fontWeight: '600', color: '#52606d'},
  typeOptionTextActive: {color: '#1d4ed8'},
  skillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  skillChip: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#edf2f7'},
  skillChipActive: {backgroundColor: '#d1fae5'},
  skillChipText: {fontSize: 13, fontWeight: '600', color: '#52606d'},
  skillChipTextActive: {color: '#047857'},
  imageUpload: {minHeight: 180, borderRadius: 14, borderWidth: 1, borderColor: '#d8e1eb', overflow: 'hidden', backgroundColor: '#f8fafc'},
  uploadPlaceholder: {minHeight: 180, alignItems: 'center', justifyContent: 'center'},
  uploadIcon: {fontSize: 36, color: '#94a3b8'},
  uploadText: {marginTop: 8, fontSize: 14, color: '#64748b'},
  uploadedImage: {width: '100%', height: 220, resizeMode: 'cover'},
  submitButton: {borderRadius: 14, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center', paddingVertical: 15},
  submitButtonText: {fontSize: 15, fontWeight: '800', color: '#fff'},
  buttonDisabled: {opacity: 0.6},
});
