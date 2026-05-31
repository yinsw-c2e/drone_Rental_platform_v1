import React, {useState} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator, Image,
  PermissionsAndroid, Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import * as ImagePicker from 'react-native-image-picker';
import type {ImagePickerResponse} from 'react-native-image-picker';
import {useDispatch, useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {updateUser} from '../../store/slices/authSlice';
import {userService} from '../../services/user';
import {getRoleLabels} from '../../utils/roleSummary';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {friendlyErrorMessage} from '../../utils/errorMessage';
import {API_ROOT_URL} from '../../constants';

const assetUrlOf = (url?: string) => {
  if (!url) return '';
  if (/^(https?:|file:|content:)/.test(url)) return url;
  return `${API_ROOT_URL}${url}`;
};

export default function EditProfileScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const dispatch = useDispatch();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const roleLabels = getRoleLabels(roleSummary, user);

  useFocusEffect(
    React.useCallback(() => {
      setNickname(user?.nickname || '');
    }, [user?.nickname]),
  );

  const uploadAvatar = async (source: 'camera' | 'library') => {
    if (uploading) return;
    if (source === 'camera' && Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('权限不足', '请在设置中允许使用相机');
        return;
      }
    }
    const options = {
      mediaType: 'photo' as const,
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.8 as const,
    };
    const callback = async (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (!asset?.uri) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'avatar.jpg',
        } as any);
        const res = await userService.uploadAvatar(formData);
        const url = res.data?.url;
        if (!url) {
          throw new Error('头像上传后暂时无法获取文件地址，请重试');
        }
        dispatch(updateUser({avatar_url: url}));
        Alert.alert('成功', '头像已更新');
      } catch (error: any) {
        Alert.alert('上传失败', friendlyErrorMessage(error, '头像上传失败，请重试'));
      } finally {
        setUploading(false);
      }
    };

    if (source === 'camera') {
      ImagePicker.launchCamera?.(options, callback);
      return;
    }
    ImagePicker.launchImageLibrary?.(options, callback);
  };

  const chooseAvatar = () => {
    Alert.alert('更新头像', undefined, [
      {text: '拍照', onPress: () => uploadAvatar('camera')},
      {text: '从相册选择', onPress: () => uploadAvatar('library')},
      {text: '取消', style: 'cancel'},
    ]);
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      Alert.alert('提示', '请输入昵称');
      return;
    }
    if (nickname.trim().length > 20) {
      Alert.alert('提示', '昵称不能超过20个字符');
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (nickname.trim() !== user?.nickname) {
        updates.nickname = nickname.trim();
      }

      if (Object.keys(updates).length === 0) {
        navigation.goBack();
        return;
      }

      await userService.updateProfile(updates);
      dispatch(updateUser(updates as any));
      Alert.alert('成功', '资料已更新', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (e: any) {
      Alert.alert('失败', friendlyErrorMessage(e, '保存失败，请重试'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>

          <TouchableOpacity style={styles.avatarRow} onPress={chooseAvatar} activeOpacity={0.78}>
            {user?.avatar_url ? (
              <Image source={{uri: assetUrlOf(user.avatar_url)}} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{(user?.nickname || user?.phone || '我').slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.avatarTextWrap}>
              <Text style={styles.avatarTitle}>头像</Text>
              <Text style={styles.avatarDesc}>{uploading ? '上传中...' : '点击更新头像'}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={styles.label}>手机号</Text>
            <Text style={styles.readOnly}>{user?.phone || '--'}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>昵称</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="请输入昵称"
              placeholderTextColor="#bbb"
              maxLength={20}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>当前身份摘要</Text>
          <Text style={styles.sectionDesc}>你的可用身份会根据已完成的资料和当前能力自动更新。</Text>

          <View style={styles.roleSummaryBox}>
            {roleLabels.length > 0 ? (
              roleLabels.map(label => (
                <View key={label} style={styles.roleChip}>
                  <Text style={styles.roleChipText}>{label}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.roleEmptyText}>当前暂无可识别身份</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>账户状态</Text>
          <View style={styles.field}>
            <Text style={styles.label}>实名认证</Text>
            <Text style={[styles.readOnly, {
              color: user?.id_verified === 'approved' ? '#52c41a' : '#faad14',
            }]}>
              {user?.id_verified === 'approved' ? '已认证' :
               user?.id_verified === 'pending' ? '审核中' : '未认证'}
            </Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>信用分</Text>
            <Text style={styles.readOnly}>{user?.credit_score || 100}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>注册时间</Text>
            <Text style={styles.readOnly}>
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '--'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color={theme.btnPrimaryText} />
          ) : (
            <Text style={styles.saveBtnText}>保存修改</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bgSecondary},
  section: {backgroundColor: theme.card, marginTop: 12, padding: 16},
  sectionTitle: {fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 4},
  sectionDesc: {fontSize: 13, color: theme.textSub, marginBottom: 12},
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
    gap: 14,
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.bgTertiary,
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  avatarFallbackText: {
    color: theme.primaryText,
    fontSize: 24,
    fontWeight: '900',
  },
  avatarTextWrap: {
    flex: 1,
  },
  avatarTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  avatarDesc: {
    marginTop: 4,
    color: theme.textHint,
    fontSize: 13,
  },
  field: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  label: {fontSize: 15, color: theme.text},
  readOnly: {fontSize: 15, color: theme.textSub},
  input: {
    flex: 1, textAlign: 'right', fontSize: 15, color: theme.text,
    paddingVertical: 0, marginLeft: 16,
  },
  roleSummaryBox: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 8},
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.primaryBg,
  },
  roleChipText: {fontSize: 13, color: theme.primaryText, fontWeight: '600'},
  roleEmptyText: {fontSize: 13, color: theme.textSub},
  footer: {
    backgroundColor: theme.card, padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: theme.divider,
  },
  saveBtn: {
    height: 48, backgroundColor: theme.primary, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtnDisabled: {backgroundColor: theme.primaryBorder},
  saveBtnText: {color: theme.btnPrimaryText, fontSize: 17, fontWeight: '600'},
});
