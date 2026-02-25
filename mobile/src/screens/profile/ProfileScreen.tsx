import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  Alert, Image, Platform, ActionSheetIOS, RefreshControl,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import * as ImagePicker from 'react-native-image-picker';
import type {ImagePickerResponse} from 'react-native-image-picker';
import {RootState} from '../../store/store';
import {logout, updateUser} from '../../store/slices/authSlice';
import {userService} from '../../services/user';
import {orderService} from '../../services/order';
import {droneService} from '../../services/drone';
import {demandService} from '../../services/demand';

const USER_TYPE_MAP: Record<string, string> = {
  drone_owner: '无人机机主',
  renter: '租客',
  cargo_owner: '货主',
  admin: '管理员',
};

const VERIFY_STATUS_MAP: Record<string, {label: string; color: string}> = {
  approved: {label: '已认证', color: '#52c41a'},
  pending: {label: '审核中', color: '#faad14'},
  rejected: {label: '未通过', color: '#ff4d4f'},
  unverified: {label: '未认证', color: '#999'},
};

export default function ProfileScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({orders: 0, drones: 0, offers: 0});

  const fetchStats = async () => {
    try {
      // 并行请求三个统计数据
      const [ordersRes, dronesRes, offersRes] = await Promise.all([
        orderService.list({page: 1, page_size: 1, role: 'all'}).catch(() => ({data: {total: 0}})),
        droneService.myDrones().catch(() => ({data: {list: []}})),
        demandService.myOffers().catch(() => ({data: {list: []}})),
      ]);
      setStats({
        orders: ordersRes.data?.total || 0,
        drones: dronesRes.data?.list?.length || 0,
        offers: offersRes.data?.list?.length || 0,
      });
    } catch (_e) {
      // ignore
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await userService.getProfile();
      if (res.data) {
        dispatch(updateUser(res.data));
      }
      await fetchStats();
    } catch (_e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  // 初始加载统计数据
  React.useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarPress = () => {
    const options = ['拍照', '从相册选择', '取消'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {options, cancelButtonIndex: 2},
        (index) => {
          if (index === 0) pickImage('camera');
          else if (index === 1) pickImage('library');
        },
      );
    } else {
      Alert.alert('更换头像', '选择头像来源', [
        {text: '拍照', onPress: () => pickImage('camera')},
        {text: '从相册选择', onPress: () => pickImage('library')},
        {text: '取消', style: 'cancel'},
      ]);
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
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
        if (res.data?.url) {
          dispatch(updateUser({avatar_url: res.data.url}));
          Alert.alert('成功', '头像已更新');
        }
      } catch (_e) {
        Alert.alert('失败', '头像上传失败，请重试');
      } finally {
        setUploading(false);
      }
    };

    try {
      if (source === 'camera') {
        if (ImagePicker.launchCamera) {
          ImagePicker.launchCamera(options, callback);
        } else {
          Alert.alert('错误', '相机功能暂不可用');
        }
      } else {
        if (ImagePicker.launchImageLibrary) {
          ImagePicker.launchImageLibrary(options, callback);
        } else {
          Alert.alert('错误', '相册功能暂不可用');
        }
      }
    } catch (error) {
      Alert.alert('错误', '图片选择功能初始化失败');
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const verifyInfo = VERIFY_STATUS_MAP[user?.id_verified || 'unverified'] || VERIFY_STATUS_MAP.unverified;

  const menuItems = [
    {title: '我的无人机', screen: 'MyDrones', icon: '🛩️'},
    {title: '我的订单', screen: 'MyOrders', icon: '📋'},
    {title: '我的供给', screen: 'MyOffers', icon: '📦'},
    {title: '我的需求', screen: 'MyDemands', icon: '📝'},
    {title: '我的货运', screen: 'MyCargo', icon: '🚚'},
    {title: '实名认证', screen: 'Verification', icon: '🔒'},
    {title: '设置', screen: 'Settings', icon: '⚙️'},
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAvatarPress} disabled={uploading}>
            {user?.avatar_url ? (
              <Image source={{uri: user.avatar_url}} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.nickname?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditText}>
                {uploading ? '...' : '编辑'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleEditProfile}>
            <Text style={styles.name}>{user?.nickname || '未设置昵称'}</Text>
          </TouchableOpacity>
          <Text style={styles.phone}>{user?.phone}</Text>
          <Text style={styles.userType}>
            {USER_TYPE_MAP[user?.user_type || 'renter'] || '租客'}
          </Text>

          <View style={styles.badges}>
            <TouchableOpacity
              style={[styles.badge, {backgroundColor: verifyInfo.color + '33'}]}
              onPress={() => navigation.navigate('Verification')}>
              <View style={[styles.badgeDot, {backgroundColor: verifyInfo.color}]} />
              <Text style={[styles.badgeText, {color: '#fff'}]}>{verifyInfo.label}</Text>
            </TouchableOpacity>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>信用分: {user?.credit_score || 100}</Text>
            </View>
          </View>
        </View>

        {/* 统计卡片 */}
        <View style={styles.statsCard}>
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('MyOrders')}>
            <Text style={styles.statValue}>{stats.orders}</Text>
            <Text style={styles.statLabel}>订单</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('MyDrones')}>
            <Text style={styles.statValue}>{stats.drones}</Text>
            <Text style={styles.statLabel}>无人机</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('MyOffers')}>
            <Text style={styles.statValue}>{stats.offers}</Text>
            <Text style={styles.statLabel}>供给</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}>
              <View style={styles.menuLeft}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuText}>{item.title}</Text>
              </View>
              <Text style={styles.menuArrow}>{'>'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert('退出登录', '确定要退出当前账号吗？', [
              {text: '取消', style: 'cancel'},
              {text: '退出', style: 'destructive', onPress: () => dispatch(logout())},
            ]);
          }}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
        <View style={{height: 20}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {backgroundColor: '#1890ff', padding: 24, alignItems: 'center', paddingTop: 40},
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {fontSize: 32, color: '#fff', fontWeight: 'bold'},
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: -4,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  avatarEditText: {color: '#fff', fontSize: 10},
  name: {fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 12},
  phone: {fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4},
  userType: {fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4},
  badges: {flexDirection: 'row', marginTop: 12},
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center',
  },
  badgeDot: {width: 6, height: 6, borderRadius: 3, marginRight: 6},
  badgeText: {color: '#fff', fontSize: 12},

  statsCard: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 12,
    marginTop: -20, borderRadius: 12, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  statItem: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 20, fontWeight: 'bold', color: '#333'},
  statLabel: {fontSize: 12, color: '#999', marginTop: 4},
  statDivider: {width: 1, backgroundColor: '#f0f0f0', marginVertical: 4},

  menu: {backgroundColor: '#fff', marginTop: 12, borderRadius: 0},
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  menuLeft: {flexDirection: 'row', alignItems: 'center'},
  menuIcon: {fontSize: 18, marginRight: 12},
  menuText: {fontSize: 16, color: '#333'},
  menuArrow: {fontSize: 16, color: '#ccc'},
  logoutBtn: {
    margin: 24, height: 48, backgroundColor: '#fff', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ff4d4f',
  },
  logoutText: {color: '#ff4d4f', fontSize: 16},
});
