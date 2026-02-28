import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import {locationService} from '../../services/location';
import {AddressData} from '../../types';
import {getCurrentPosition} from '../../utils/LocationService';

export default function AddressPickerScreen({navigation, route}: any) {
  const onSelect: ((addr: AddressData) => void) | undefined = route.params?.onSelect;

  const [savedAddresses, setSavedAddresses] = useState<AddressData[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [locating, setLocating] = useState(false);
  const [currentCity, setCurrentCity] = useState('');

  useEffect(() => {
    fetchSavedAddresses();
    // 后台获取当前城市，用于搜索时限定范围
    detectCurrentCity();
  }, []);

  const detectCurrentCity = async () => {
    try {
      const pos = await getCurrentPosition();
      const res = await locationService.reverseGeoCode(pos.longitude, pos.latitude);
      if (res.data?.city) {
        setCurrentCity(res.data.city);
      }
    } catch {
      // 获取失败不影响使用，搜索时将不限定城市
    }
  };

  const fetchSavedAddresses = async () => {
    setLoadingSaved(true);
    try {
      const res = await locationService.getAddressList();
      setSavedAddresses(res.data || []);
    } catch {
      setSavedAddresses([]);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleSelectAddress = useCallback((addr: AddressData) => {
    if (onSelect) {
      onSelect(addr);
    }
    navigation.goBack();
  }, [onSelect, navigation]);

  const handleCurrentLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      const res = await locationService.reverseGeoCode(pos.longitude, pos.latitude);
      if (res.data) {
        handleSelectAddress({
          name: res.data.formatted_address,
          address: res.data.formatted_address,
          province: res.data.province,
          city: res.data.city,
          district: res.data.district,
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
      }
    } catch (e: any) {
      Alert.alert('定位失败', e.message);
    } finally {
      setLocating(false);
    }
  };

  const handleMapPicker = () => {
    navigation.navigate('MapPicker', {
      onSelect: handleSelectAddress,
    });
  };

  const handleSearch = () => {
    navigation.navigate('AddressSearch', {
      onSelect: handleSelectAddress,
      city: currentCity,
    });
  };

  const handleDeleteAddress = async (id: number) => {
    Alert.alert('删除地址', '确定删除该常用地址吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await locationService.deleteAddress(id);
            setSavedAddresses(prev => prev.filter(a => a.id !== id));
          } catch (e: any) {
            Alert.alert('删除失败', e.message);
          }
        },
      },
    ]);
  };

  const renderSavedItem = ({item}: {item: AddressData}) => (
    <TouchableOpacity
      style={styles.addressItem}
      onPress={() => handleSelectAddress(item)}
      activeOpacity={0.6}>
      <View style={styles.addressInfo}>
        <View style={styles.addressNameRow}>
          <Text style={styles.addressName} numberOfLines={1}>
            {item.name || item.address}
          </Text>
          {item.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>默认</Text>
            </View>
          )}
          {item.label ? (
            <View style={styles.labelBadge}>
              <Text style={styles.labelText}>{item.label}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.addressDetail} numberOfLines={1}>{item.address}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => item.id && handleDeleteAddress(item.id)}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <Text style={styles.deleteBtnText}>&#10005;</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 操作入口区 */}
      <View style={styles.actionSection}>
        {/* 搜索入口 */}
        <TouchableOpacity style={styles.searchBar} onPress={handleSearch} activeOpacity={0.7}>
          <Text style={styles.searchIcon}>&#128269;</Text>
          <Text style={styles.searchPlaceholder}>搜索地址、小区、写字楼</Text>
        </TouchableOpacity>

        {/* 当前位置 */}
        <TouchableOpacity style={styles.actionItem} onPress={handleCurrentLocation} activeOpacity={0.7}>
          <View style={[styles.actionIcon, {backgroundColor: '#e6f7ff'}]}>
            <Text style={{fontSize: 18, color: '#1890ff'}}>&#9678;</Text>
          </View>
          <Text style={styles.actionText}>使用当前位置</Text>
          {locating && <ActivityIndicator size="small" color="#1890ff" style={{marginLeft: 8}} />}
        </TouchableOpacity>

        {/* 地图选点 */}
        <TouchableOpacity style={styles.actionItem} onPress={handleMapPicker} activeOpacity={0.7}>
          <View style={[styles.actionIcon, {backgroundColor: '#fff7e6'}]}>
            <Text style={{fontSize: 18}}>&#128205;</Text>
          </View>
          <Text style={styles.actionText}>地图选点</Text>
        </TouchableOpacity>
      </View>

      {/* 常用地址区 */}
      <View style={styles.savedSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>常用地址</Text>
        </View>

        {loadingSaved ? (
          <ActivityIndicator size="small" color="#1890ff" style={{paddingVertical: 30}} />
        ) : savedAddresses.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>暂无常用地址</Text>
            <Text style={styles.emptyHint}>选择地址后可保存为常用地址</Text>
          </View>
        ) : (
          <FlatList
            data={savedAddresses}
            keyExtractor={item => String(item.id)}
            renderItem={renderSavedItem}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  actionSection: {backgroundColor: '#fff', marginBottom: 10},
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: '#f5f5f5', borderRadius: 8,
    paddingHorizontal: 12, height: 40,
  },
  searchIcon: {fontSize: 16, color: '#999', marginRight: 8},
  searchPlaceholder: {fontSize: 14, color: '#bbb'},
  actionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f0f0f0',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  actionText: {fontSize: 15, color: '#333', fontWeight: '500'},
  savedSection: {flex: 1, backgroundColor: '#fff'},
  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {fontSize: 14, color: '#999', fontWeight: '500'},
  addressItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0',
  },
  addressInfo: {flex: 1},
  addressNameRow: {flexDirection: 'row', alignItems: 'center'},
  addressName: {fontSize: 15, color: '#333', fontWeight: '500', flexShrink: 1},
  defaultBadge: {
    marginLeft: 8, paddingHorizontal: 6, paddingVertical: 1,
    backgroundColor: '#e6f7ff', borderRadius: 3,
  },
  defaultText: {fontSize: 11, color: '#1890ff'},
  labelBadge: {
    marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1,
    backgroundColor: '#f0f0f0', borderRadius: 3,
  },
  labelText: {fontSize: 11, color: '#666'},
  addressDetail: {fontSize: 13, color: '#999', marginTop: 3},
  deleteBtn: {paddingLeft: 12},
  deleteBtnText: {fontSize: 14, color: '#ccc'},
  emptyWrap: {alignItems: 'center', paddingVertical: 40},
  emptyText: {fontSize: 14, color: '#999'},
  emptyHint: {fontSize: 12, color: '#ccc', marginTop: 6},
});
