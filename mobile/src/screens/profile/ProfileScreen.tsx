import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../store/store';
import {logout} from '../../store/slices/authSlice';

export default function ProfileScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();

  const menuItems = [
    {title: '我的无人机', screen: 'MyDrones'},
    {title: '我的订单', screen: 'MyOrders'},
    {title: '我的供给', screen: 'MyOffers'},
    {title: '我的需求', screen: 'MyDemands'},
    {title: '我的货运', screen: 'MyCargo'},
    {title: '实名认证', screen: 'Verification'},
    {title: '设置', screen: 'Settings'},
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.nickname?.charAt(0) || 'U'}</Text>
          </View>
          <Text style={styles.name}>{user?.nickname || '未设置昵称'}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, {backgroundColor: user?.id_verified === 'approved' ? '#52c41a' : '#faad14'}]}>
              <Text style={styles.badgeText}>
                {user?.id_verified === 'approved' ? '已认证' : '未认证'}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>信用分: {user?.credit_score || 100}</Text>
            </View>
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}>
              <Text style={styles.menuText}>{item.title}</Text>
              <Text style={styles.menuArrow}>&gt;</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {backgroundColor: '#1890ff', padding: 24, alignItems: 'center'},
  avatar: {width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center'},
  avatarText: {fontSize: 28, color: '#fff', fontWeight: 'bold'},
  name: {fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 12},
  phone: {fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4},
  badges: {flexDirection: 'row', marginTop: 12},
  badge: {backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginHorizontal: 4},
  badgeText: {color: '#fff', fontSize: 12},
  menu: {backgroundColor: '#fff', marginTop: 12},
  menuItem: {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0'},
  menuText: {fontSize: 16, color: '#333'},
  menuArrow: {fontSize: 16, color: '#ccc'},
  logoutBtn: {margin: 24, height: 48, backgroundColor: '#fff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ff4d4f'},
  logoutText: {color: '#ff4d4f', fontSize: 16},
});
