import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';
import { useDispatch, useSelector } from 'react-redux';

import { userService } from '../../services/user';
import { updateUser } from '../../store/slices/authSlice';
import { RootState } from '../../store/store';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import './index.scss';

type VerifyStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export default function VerificationPage() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<VerifyStatus>('unverified');
  const [realName, setRealName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userService.getIDVerifyStatus();
      const nextStatus = (data?.id_verified as VerifyStatus) || 'unverified';
      setStatus(nextStatus);
      dispatch(updateUser({ id_verified: nextStatus }));
      setRealName(data?.real_name || '');
      setIdNumber(data?.id_number || '');
      setRejectReason(data?.reject_reason || '');
    } catch {
      setStatus((user?.id_verified as VerifyStatus) || 'unverified');
    } finally {
      setLoading(false);
    }
  }, [dispatch, user?.id_verified]);

  useDidShow(() => {
    fetchStatus();
  });

  useEffect(() => {
    if (status !== 'pending') {
      return undefined;
    }
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [fetchStatus, status]);

  const handleSubmit = async () => {
    if (!realName.trim()) {
      Taro.showToast({ title: '请输入真实姓名', icon: 'none' });
      return;
    }
    if (!idNumber.trim()) {
      Taro.showToast({ title: '请输入身份证号码', icon: 'none' });
      return;
    }
    if (!/^\d{17}[\dXx]$/.test(idNumber.trim())) {
      Taro.showToast({ title: '请输入有效的18位身份证号码', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await userService.submitIDVerify({
        real_name: realName.trim(),
        id_number: idNumber.trim(),
        front_image: '',
        back_image: '',
      });
      setStatus('pending');
      dispatch(updateUser({ id_verified: 'pending' }));
      Taro.showToast({ title: '认证信息已提交', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '提交失败，请稍后重试'), icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className='verification-wrap'>
        <View className='verification-loading'>
          <Text className='verification-loading-text'>实名认证加载中...</Text>
        </View>
      </View>
    );
  }

  if (status === 'approved') {
    return (
      <View className='verification-wrap'>
        <View className='verification-result'>
          <View className='verification-result-icon verification-icon-success'>
            <Text className='verification-result-emoji'>✅</Text>
          </View>
          <Text className='verification-result-title'>实名认证已通过</Text>
          <Text className='verification-result-desc'>您的身份信息已通过实名核验</Text>

          <View className='verification-info-card'>
            <View className='verification-detail-row'>
              <Text className='verification-detail-label'>真实姓名</Text>
              <Text className='verification-detail-value'>
                {realName ? `${realName.charAt(0)}**` : '***'}
              </Text>
            </View>
            <View className='verification-detail-row verification-detail-row-last'>
              <Text className='verification-detail-label'>身份证号</Text>
              <Text className='verification-detail-value'>
                {idNumber
                  ? `${idNumber.substring(0, 4)}**********${idNumber.substring(14)}`
                  : '****'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View className='verification-wrap'>
        <View className='verification-result'>
          <View className='verification-result-icon verification-icon-pending'>
            <Text className='verification-result-emoji'>⏳</Text>
          </View>
          <Text className='verification-result-title'>认证审核中</Text>
          <Text className='verification-result-desc'>
            您的实名认证信息已提交，当前为模拟核验，预计 1 分钟内自动完成。
          </Text>

          <View className='verification-info-card'>
            <View className='verification-detail-row'>
              <Text className='verification-detail-label'>真实姓名</Text>
              <Text className='verification-detail-value'>
                {realName ? `${realName.charAt(0)}**` : '已提交'}
              </Text>
            </View>
            <View className='verification-detail-row verification-detail-row-last'>
              <Text className='verification-detail-label'>提交状态</Text>
              <View className='verification-pending-chip'>
                <Text className='verification-pending-chip-text'>审核中</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const isRejected = status === 'rejected';

  return (
    <View className='verification-wrap'>
      <ScrollView scrollY className='verification-scroll'>
        <View className='verification-content'>
          {isRejected ? (
            <View className='verification-reject-banner'>
              <Text className='verification-reject-title'>认证未通过</Text>
              <Text className='verification-reject-reason'>
                {rejectReason || '提交的信息不符合要求，请重新填写。'}
              </Text>
            </View>
          ) : null}

          <View className='verification-section'>
            <Text className='verification-section-title'>身份信息</Text>
            <Text className='verification-section-desc'>
              请填写您的身份信息，用于平台信任验证。
            </Text>

            <Text className='verification-label'>
              真实姓名 <Text className='verification-required'>*</Text>
            </Text>
            <Input
              className='verification-input'
              placeholder='请输入身份证上的姓名'
              value={realName}
              onInput={(e) => setRealName(e.detail.value)}
              maxlength={20}
            />

            <Text className='verification-label'>
              身份证号 <Text className='verification-required'>*</Text>
            </Text>
            <Input
              className='verification-input'
              placeholder='请输入18位身份证号码'
              value={idNumber}
              onInput={(e) => setIdNumber(e.detail.value)}
              maxlength={18}
            />
          </View>

          <View className='verification-section verification-tip-section'>
            <Text className='verification-section-title'>认证说明</Text>
            <Text className='verification-tip-text'>1. 实名认证后可提升信用等级，获得更多平台权限。</Text>
            <Text className='verification-tip-text'>2. 您的信息将被严格保密，仅用于身份验证。</Text>
            <Text className='verification-tip-text'>3. 认证结果以实名核验返回为准，完成后权限将自动更新。</Text>
          </View>
        </View>
      </ScrollView>

      <View className='verification-footer'>
        <View
          className={`verification-submit-btn ${submitting ? 'verification-submit-disabled' : ''}`}
          onClick={handleSubmit}
        >
          <Text className='verification-submit-text'>
            {submitting ? '提交中...' : isRejected ? '重新提交' : '提交认证'}
          </Text>
        </View>
      </View>
    </View>
  );
}
