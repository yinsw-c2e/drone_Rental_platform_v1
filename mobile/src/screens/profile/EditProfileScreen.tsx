import React, {useState} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {updateUser} from '../../store/slices/authSlice';
import {userService} from '../../services/user';
import {getRoleLabels} from '../../utils/roleSummary';

export default function EditProfileScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const dispatch = useDispatch();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [saving, setSaving] = useState(false);
  const roleLabels = getRoleLabels(roleSummary, user);

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
          <Text style={styles.sectionTitle}>当前身份摘要</Text>
          <Text style={styles.sectionDesc}>身份由后端档案和能力摘要统一判断，不再通过前端直接修改</Text>

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
  roleSummaryBox: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 8},
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e6f4ff',
  },
  roleChipText: {fontSize: 13, color: '#1677ff', fontWeight: '600'},
  roleEmptyText: {fontSize: 13, color: '#999'},
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
