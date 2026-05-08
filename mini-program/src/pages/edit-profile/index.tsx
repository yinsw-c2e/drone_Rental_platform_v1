import Taro, { useDidShow } from '@tarojs/taro';
import React, { useMemo, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';
import { useDispatch, useSelector } from 'react-redux';

import { userService } from '../../services/user';
import { updateUser } from '../../store/slices/authSlice';
import { RootState } from '../../store/store';
import { getRoleLabels } from '../../utils/roleSummary';
import './index.scss';

const getVerifyText = (status?: string) => {
  if (status === 'approved') return '已认证';
  if (status === 'pending') return '审核中';
  return '未认证';
};

export default function EditProfilePage() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [saving, setSaving] = useState(false);

  useDidShow(() => {
    setNickname(user?.nickname || '');
  });

  const roleLabels = useMemo(() => getRoleLabels(roleSummary, user), [roleSummary, user]);

  const handleSave = async () => {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (nickname.trim().length > 20) {
      Taro.showToast({ title: '昵称不能超过20个字符', icon: 'none' });
      return;
    }

    const nextNickname = nickname.trim();
    if (nextNickname === (user?.nickname || '')) {
      Taro.navigateBack();
      return;
    }

    setSaving(true);
    try {
      await userService.updateProfile({ nickname: nextNickname });
      dispatch(updateUser({ nickname: nextNickname }));
      Taro.showToast({ title: '资料已更新', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className='edit-profile-page'>
      <ScrollView scrollY className='edit-profile-scroll'>
        <View className='edit-profile-content'>
          <View className='ep-section'>
            <Text className='ep-section-title'>基本信息</Text>

            <View className='ep-row'>
              <Text className='ep-label'>手机号</Text>
              <Text className='ep-value'>{user?.phone || '--'}</Text>
            </View>

            <View className='ep-row ep-row-last'>
              <Text className='ep-label'>昵称</Text>
              <Input
                className='ep-input'
                value={nickname}
                onInput={(e) => setNickname(e.detail.value)}
                placeholder='请输入昵称'
                maxlength={20}
              />
            </View>
          </View>

          <View className='ep-section'>
            <Text className='ep-section-title'>当前身份摘要</Text>
            <Text className='ep-section-desc'>
              你的可用身份会根据已完成的资料和当前能力自动更新。
            </Text>

            <View className='ep-role-box'>
              {roleLabels.length ? (
                roleLabels.map((label) => (
                  <View key={label} className='ep-role-chip'>
                    <Text className='ep-role-chip-text'>{label}</Text>
                  </View>
                ))
              ) : (
                <Text className='ep-empty-role'>当前暂无可识别身份</Text>
              )}
            </View>
          </View>

          <View className='ep-section'>
            <Text className='ep-section-title'>账户状态</Text>

            <View className='ep-row'>
              <Text className='ep-label'>实名认证</Text>
              <Text
                className={`ep-value ${
                  user?.id_verified === 'approved' ? 'ep-value-success' : 'ep-value-warning'
                }`}
              >
                {getVerifyText(user?.id_verified)}
              </Text>
            </View>

            <View className='ep-row'>
              <Text className='ep-label'>信用分</Text>
              <Text className='ep-value'>{user?.credit_score || 100}</Text>
            </View>

            <View className='ep-row ep-row-last'>
              <Text className='ep-label'>注册时间</Text>
              <Text className='ep-value'>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '--'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className='ep-footer'>
        <View
          className={`ep-save-btn ${saving ? 'ep-save-disabled' : ''}`}
          onClick={handleSave}
        >
          <Text className='ep-save-text'>{saving ? '保存中...' : '保存修改'}</Text>
        </View>
      </View>
    </View>
  );
}
