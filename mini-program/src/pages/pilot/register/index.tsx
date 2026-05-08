// @ts-nocheck
import Taro from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { Image, Input, ScrollView, Text, View } from '@tarojs/components';

import StatusBadge from '../../../components/business/StatusBadge';
import { submitCriminalCheck, submitHealthCheck } from '../../../services/pilot';
import { pilotV2Service } from '../../../services/pilotV2';
import { uploadFileToEndpoint } from '../../../services/user';
import './index.scss';

const CAAC_TYPES = [
  { label: 'VLOS（视距内）', value: 'VLOS' },
  { label: 'BVLOS（超视距）', value: 'BVLOS' },
  { label: '教员证', value: 'instructor' },
];

const skillOptions = ['电网吊运', '山区运输', '应急救援', '海岛补给', '高原补给'];

export default function PilotRegisterPage() {
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

  const progress = useMemo(
    () => [licenseNo, licenseExpireDate, licenseImage, currentCity].filter(Boolean).length,
    [currentCity, licenseExpireDate, licenseImage, licenseNo],
  );

  const chooseAndUpload = async (setter: (url: string) => void, label: string) => {
    try {
      const action = await Taro.showActionSheet({
        itemList: ['拍照', '从相册选择'],
      });
      const sourceType = action.tapIndex === 0 ? ['camera'] : ['album'];
      const chooseRes = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType,
      });
      const filePath = chooseRes.tempFilePaths?.[0];
      if (!filePath) {
        return;
      }

      setUploading(true);
      const result = await uploadFileToEndpoint('/pilot/upload-cert', filePath);
      setter(result?.url || '');
      Taro.showToast({ title: `${label}已上传`, icon: 'success' });
    } catch (error: any) {
      if (error?.errMsg?.includes('cancel')) {
        return;
      }
      Taro.showToast({ title: error?.message || '上传失败', icon: 'none' });
    } finally {
      setUploading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSpecialSkills((prev) =>
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill],
    );
  };

  const handleSubmit = async () => {
    if (!licenseNo.trim()) {
      Taro.showToast({ title: '请输入 CAAC 执照编号', icon: 'none' });
      return;
    }
    if (!licenseExpireDate.trim()) {
      Taro.showToast({ title: '请输入执照有效期', icon: 'none' });
      return;
    }
    if (!licenseImage) {
      Taro.showToast({ title: '请上传 CAAC 执照照片', icon: 'none' });
      return;
    }
    if (!currentCity.trim()) {
      Taro.showToast({ title: '请填写当前服务城市', icon: 'none' });
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

      Taro.showModal({
        title: '提交成功',
        content: '飞手认证资料已提交，后续可在飞手中心继续管理接单状态和服务范围。',
        showCancel: false,
        success: () => {
          Taro.redirectTo({ url: '/pages/profile/pilot/index' });
        },
      });
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败，请稍后重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const UploadBlock = ({
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
    <View className='pilot-register-field'>
      <Text className='pilot-register-label'>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View className='pilot-register-upload' onClick={onPick}>
        {value ? (
          <Image src={value} className='pilot-register-uploaded-image' mode='aspectFill' />
        ) : (
          <View className='pilot-register-upload-placeholder'>
            <Text className='pilot-register-upload-plus'>{uploading ? '...' : '+'}</Text>
            <Text className='pilot-register-upload-text'>点击上传{label}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View className='pilot-register-page'>
      <ScrollView scrollY className='pilot-register-scroll'>
        <View className='pilot-register-content'>
          <View className='pilot-register-hero'>
            <View className='pilot-register-hero-top'>
              <View className='pilot-register-hero-main'>
                <Text className='pilot-register-hero-title'>飞手认证与能力设置</Text>
                <Text className='pilot-register-hero-subtitle'>
                  这里负责建立飞手档案。后续在线状态、服务城市和技能标签都围绕这份档案展开。
                </Text>
              </View>
              <StatusBadge label={`进度 ${progress}/4`} tone='blue' />
            </View>
          </View>

          <View className='pilot-register-section'>
            <Text className='pilot-register-section-title'>执照信息</Text>

            <View className='pilot-register-field'>
              <Text className='pilot-register-label'>CAAC 执照类型 *</Text>
              <View className='pilot-register-type-row'>
                {CAAC_TYPES.map((type) => {
                  const active = licenseType === type.value;
                  return (
                    <View
                      key={type.value}
                      className={`pilot-register-type-chip ${
                        active ? 'pilot-register-type-chip-active' : ''
                      }`}
                      onClick={() => setLicenseType(type.value)}
                    >
                      <Text
                        className={`pilot-register-type-text ${
                          active ? 'pilot-register-type-text-active' : ''
                        }`}
                      >
                        {type.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View className='pilot-register-field'>
              <Text className='pilot-register-label'>CAAC 执照编号 *</Text>
              <Input
                className='pilot-register-input'
                placeholder='请输入 CAAC 执照编号'
                value={licenseNo}
                onInput={(e) => setLicenseNo(e.detail.value)}
              />
            </View>

            <View className='pilot-register-field'>
              <Text className='pilot-register-label'>执照有效期 *</Text>
              <Input
                className='pilot-register-input'
                placeholder='YYYY-MM-DD'
                value={licenseExpireDate}
                onInput={(e) => setLicenseExpireDate(e.detail.value)}
              />
            </View>

            <UploadBlock
              label='CAAC 执照照片'
              value={licenseImage}
              required
              onPick={() => chooseAndUpload(setLicenseImage, 'CAAC 执照照片')}
            />
          </View>

          <View className='pilot-register-section'>
            <Text className='pilot-register-section-title'>接单能力设置</Text>

            <View className='pilot-register-field'>
              <Text className='pilot-register-label'>当前服务城市 *</Text>
              <Input
                className='pilot-register-input'
                placeholder='例如：佛山'
                value={currentCity}
                onInput={(e) => setCurrentCity(e.detail.value)}
              />
            </View>

            <View className='pilot-register-field'>
              <Text className='pilot-register-label'>服务半径（公里）</Text>
              <Input
                className='pilot-register-input'
                type='number'
                placeholder='默认 50'
                value={serviceRadius}
                onInput={(e) => setServiceRadius(e.detail.value)}
              />
            </View>

            <View className='pilot-register-field'>
              <Text className='pilot-register-label'>技能标签</Text>
              <View className='pilot-register-skill-row'>
                {skillOptions.map((skill) => {
                  const active = specialSkills.includes(skill);
                  return (
                    <View
                      key={skill}
                      className={`pilot-register-skill-chip ${
                        active ? 'pilot-register-skill-chip-active' : ''
                      }`}
                      onClick={() => toggleSkill(skill)}
                    >
                      <Text
                        className={`pilot-register-skill-text ${
                          active ? 'pilot-register-skill-text-active' : ''
                        }`}
                      >
                        {skill}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View className='pilot-register-section'>
            <View className='pilot-register-section-header'>
              <Text className='pilot-register-section-title'>补充材料</Text>
              <Text className='pilot-register-section-desc'>
                这些材料有助于提高审核通过率。
              </Text>
            </View>

            <UploadBlock
              label='无犯罪记录证明'
              value={criminalDoc}
              onPick={() => chooseAndUpload(setCriminalDoc, '无犯罪记录证明')}
            />
            <UploadBlock
              label='健康证明'
              value={healthDoc}
              onPick={() => chooseAndUpload(setHealthDoc, '健康证明')}
            />
            <View className='pilot-register-field'>
              <Text className='pilot-register-label'>健康证明有效期</Text>
              <Input
                className='pilot-register-input'
                placeholder='YYYY-MM-DD'
                value={healthExpireDate}
                onInput={(e) => setHealthExpireDate(e.detail.value)}
              />
            </View>
          </View>

          <View
            className={`pilot-register-submit-btn ${
              loading || uploading ? 'pilot-register-submit-btn-disabled' : ''
            }`}
            onClick={handleSubmit}
          >
            <Text className='pilot-register-submit-text'>
              {loading ? '提交中...' : '提交飞手认证'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
