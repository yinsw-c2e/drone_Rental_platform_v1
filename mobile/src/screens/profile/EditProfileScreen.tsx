import React, {useState} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../store/store';
import {updateUser} from '../../store/slices/authSlice';
import {userService} from '../../services/user';

const USER_TYPES: {key: 'renter' | 'drone_owner' | 'cargo_owner'; label: string; desc: string}[] = [
  {key: 'renter', label: '租客', desc: '租用无人机进行各类作业'},
  {key: 'drone_owner', label: '无人机机主', desc: '出租自有无人机提供服务'},
  {key: 'cargo_owner', label: '货主', desc: '发布货运需求使用物流服务'},
];

export default function EditProfileScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [userType, setUserType] = useState(user?.user_type || 'renter');
  const [saving, setSaving] = useState(false);

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
      if (userType !== user?.user_type) {
        updates.user_type = userType;
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
      Alert.alert('失败', e?.response?.data?.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>

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
          <Text style={styles.sectionTitle}>用户身份</Text>
          <Text style={styles.sectionDesc}>选择您的主要身份，可随时更改</Text>

          {USER_TYPES.map(type => (
            <TouchableOpacity
              key={type.key}
              style={[styles.typeItem, userType === type.key && styles.typeItemActive]}
              onPress={() => setUserType(type.key)}>
              <View style={{flex: 1}}>
                <Text style={[styles.typeLabel, userType === type.key && styles.typeLabelActive]}>
                  {type.label}
                </Text>
                <Text style={styles.typeDesc}>{type.desc}</Text>
              </View>
              <View style={[styles.radio, userType === type.key && styles.radioActive]}>
                {userType === type.key && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>保存修改</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  section: {backgroundColor: '#fff', marginTop: 12, padding: 16},
  sectionTitle: {fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4},
  sectionDesc: {fontSize: 13, color: '#999', marginBottom: 12},
  field: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  label: {fontSize: 15, color: '#333'},
  readOnly: {fontSize: 15, color: '#999'},
  input: {
    flex: 1, textAlign: 'right', fontSize: 15, color: '#333',
    paddingVertical: 0, marginLeft: 16,
  },
  typeItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
    paddingHorizontal: 4,
  },
  typeItemActive: {backgroundColor: '#f0f8ff', borderRadius: 8, marginHorizontal: -4, paddingHorizontal: 8},
  typeLabel: {fontSize: 15, fontWeight: '500', color: '#333'},
  typeLabelActive: {color: '#1890ff'},
  typeDesc: {fontSize: 12, color: '#999', marginTop: 2},
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#d9d9d9', justifyContent: 'center', alignItems: 'center',
    marginLeft: 12,
  },
  radioActive: {borderColor: '#1890ff'},
  radioInner: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#1890ff'},
  footer: {
    backgroundColor: '#fff', padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#e8e8e8',
  },
  saveBtn: {
    height: 48, backgroundColor: '#1890ff', borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtnDisabled: {backgroundColor: '#91caff'},
  saveBtnText: {color: '#fff', fontSize: 17, fontWeight: '600'},
});
