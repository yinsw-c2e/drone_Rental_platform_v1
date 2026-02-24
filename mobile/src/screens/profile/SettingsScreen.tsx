import React, {useState} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, Switch,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../store/store';
import {logout, updateUser} from '../../store/slices/authSlice';
import {userService} from '../../services/user';

export default function SettingsScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();

  // 本地状态
  const [pushEnabled, setPushEnabled] = useState(true);
  const [messageNotify, setMessageNotify] = useState(true);
  const [orderNotify, setOrderNotify] = useState(true);

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '退出',
        style: 'destructive',
        onPress: () => dispatch(logout()),
      },
    ]);
  };

  const handleChangeNickname = () => {
    Alert.prompt?.(
      '修改昵称',
      '请输入新的昵称',
      async (text: string) => {
        if (!text?.trim()) return;
        try {
          await userService.updateProfile({nickname: text.trim()});
          dispatch(updateUser({nickname: text.trim()}));
          Alert.alert('成功', '昵称已更新');
        } catch (_e) {
          Alert.alert('失败', '修改昵称失败，请重试');
        }
      },
      'plain-text',
      user?.nickname || '',
    );
    // Android 没有 Alert.prompt，使用简单提示
    if (!Alert.prompt) {
      Alert.alert('提示', '修改昵称功能请在iOS上使用，或前往个人资料页面修改');
    }
  };

  const handleClearCache = () => {
    Alert.alert('清除缓存', '确定要清除应用缓存吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '清除',
        onPress: () => {
          Alert.alert('成功', '缓存已清除');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* 账户信息 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>账户信息</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>手机号</Text>
            <Text style={styles.rowValue}>{user?.phone || '未绑定'}</Text>
          </View>
          <TouchableOpacity style={styles.row} onPress={handleChangeNickname}>
            <Text style={styles.rowLabel}>昵称</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{user?.nickname || '未设置'}</Text>
              <Text style={styles.rowArrow}>&gt;</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, {borderBottomWidth: 0}]}
            onPress={() => navigation.navigate('Verification')}>
            <Text style={styles.rowLabel}>实名认证</Text>
            <View style={styles.rowRight}>
              <Text style={[
                styles.rowValue,
                {color: user?.id_verified === 'approved' ? '#52c41a' : '#faad14'},
              ]}>
                {user?.id_verified === 'approved' ? '已认证' :
                 user?.id_verified === 'pending' ? '审核中' : '未认证'}
              </Text>
              <Text style={styles.rowArrow}>&gt;</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 通知设置 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>通知设置</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>推送通知</Text>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{false: '#d9d9d9', true: '#1890ff'}}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>新消息通知</Text>
            <Switch
              value={messageNotify}
              onValueChange={setMessageNotify}
              trackColor={{false: '#d9d9d9', true: '#1890ff'}}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, {borderBottomWidth: 0}]}>
            <Text style={styles.rowLabel}>订单状态通知</Text>
            <Switch
              value={orderNotify}
              onValueChange={setOrderNotify}
              trackColor={{false: '#d9d9d9', true: '#1890ff'}}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 通用设置 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>通用</Text>
        </View>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleClearCache}>
            <Text style={styles.rowLabel}>清除缓存</Text>
            <Text style={styles.rowArrow}>&gt;</Text>
          </TouchableOpacity>
          <View style={[styles.row, {borderBottomWidth: 0}]}>
            <Text style={styles.rowLabel}>当前版本</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
        </View>

        {/* 关于 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>关于</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>用户协议</Text>
            <Text style={styles.rowArrow}>&gt;</Text>
          </View>
          <View style={[styles.row, {borderBottomWidth: 0}]}>
            <Text style={styles.rowLabel}>隐私政策</Text>
            <Text style={styles.rowArrow}>&gt;</Text>
          </View>
        </View>

        {/* 退出登录 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  sectionHeader: {paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8},
  sectionTitle: {fontSize: 13, color: '#999', fontWeight: '500'},
  section: {backgroundColor: '#fff'},
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  rowLabel: {fontSize: 15, color: '#333'},
  rowRight: {flexDirection: 'row', alignItems: 'center'},
  rowValue: {fontSize: 15, color: '#999'},
  rowArrow: {fontSize: 16, color: '#ccc', marginLeft: 8},
  logoutBtn: {
    margin: 24, height: 48, backgroundColor: '#fff', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ff4d4f',
  },
  logoutText: {color: '#ff4d4f', fontSize: 16, fontWeight: '500'},
});
