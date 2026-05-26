import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { addressHistoryService } from '../../services/addressHistory';
import { locationService } from '../../services/location';
import { store } from '../../store/store';
import { AddressData } from '../../types';
import './index.scss';

export default function AddressPickerPage() {
  const [savedAddresses, setSavedAddresses] = useState<AddressData[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<AddressData[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [locating, setLocating] = useState(false);

  const fetchSavedAddresses = async () => {
    if (!store.getState().auth.isAuthenticated) {
      setSavedAddresses([]);
      setLoadingSaved(false);
      return;
    }
    setLoadingSaved(true);
    try {
      const res = await locationService.getAddressList();
      setSavedAddresses((res as any).data || []);
    } catch {
      setSavedAddresses([]);
    } finally {
      setLoadingSaved(false);
    }
  };

  const fetchRecentAddresses = async () => {
    setLoadingRecent(true);
    try {
      const items = await addressHistoryService.loadAddressHistory();
      setRecentAddresses(items);
    } catch {
      setRecentAddresses([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  useDidShow(() => {
    fetchSavedAddresses();
    fetchRecentAddresses();
  });

  const notifyAddressSelected = useCallback(async (addr: AddressData) => {
    const nextHistory = await addressHistoryService.addAddressHistory(addr).catch(() => null);
    if (nextHistory) {
      setRecentAddresses(nextHistory);
    }
    // Use event center or storage to pass data back
    Taro.setStorageSync('selectedAddress', JSON.stringify(addr));
    Taro.eventCenter.trigger('addressSelected', addr);
    Taro.navigateBack();
  }, []);

  const handleSelectAddress = useCallback((addr: AddressData) => {
    notifyAddressSelected(addr).catch(() => null);
  }, [notifyAddressSelected]);

  const handleCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const pos = await Taro.getLocation({ type: 'gcj02' });
      const res = await locationService.reverseGeoCode(pos.longitude, pos.latitude);
      if ((res as any).data) {
        const addrData = (res as any).data;
        handleSelectAddress({
          name: addrData.formatted_address,
          address: addrData.formatted_address,
          province: addrData.province,
          city: addrData.city,
          district: addrData.district,
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
      }
    } catch (e: any) {
      Taro.showToast({ title: '定位失败', icon: 'none' });
    } finally {
      setLocating(false);
    }
  };

  const handleMapPicker = async () => {
    try {
      const res = await Taro.chooseLocation({});
      if (res && res.name && res.address) {
        handleSelectAddress({
          name: res.name,
          address: res.address,
          latitude: res.latitude,
          longitude: res.longitude,
          province: '', // chooseLocation does not return province/city directly sometimes
          city: '',
          district: '',
        });
      }
    } catch (err) {
      console.log('取消选择', err);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    const res = await Taro.showModal({ title: '删除地址', content: '确定删除该常用地址吗？' });
    if (res.confirm) {
      try {
        await locationService.deleteAddress(id);
        setSavedAddresses(prev => prev.filter(a => a.id !== id));
      } catch (e: any) {
        Taro.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  };

  const handleClearHistory = useCallback(async () => {
    await addressHistoryService.clearAddressHistory().catch(() => null);
    setRecentAddresses([]);
  }, []);

  return (
    <ScrollView scrollY className="address-picker-wrap" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      {/* ── 操作入口区 ── */}
      <View className="action-section" style={{ backgroundColor: '#fff', marginBottom: '10px' }}>
        <View className="search-bar" onClick={handleMapPicker} style={{ flexDirection: 'row', alignItems: 'center', margin: '12px 16px 8px', backgroundColor: '#F3F4F6', borderRadius: '8px', padding: '0 12px', height: '40px' }}>
          <Text style={{ fontSize: '16px', color: '#9CA3AF', marginRight: '8px' }}>🔍</Text>
          <Text style={{ fontSize: '14px', color: '#9CA3AF' }}>搜索地址、小区、写字楼</Text>
        </View>

        <View className="action-item" onClick={handleCurrentLocation} style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid #E5E7EB' }}>
          <View style={{ width: '36px', height: '36px', borderRadius: '18px', justifyContent: 'center', alignItems: 'center', marginRight: '12px', backgroundColor: '#EFF6FF' }}>
            <Text style={{ fontSize: '18px', color: '#1677FF' }}>◎</Text>
          </View>
          <Text style={{ fontSize: '15px', color: '#1A1D26', fontWeight: '500' }}>使用当前位置</Text>
          {locating && <Text style={{ marginLeft: '8px', fontSize: '12px', color: '#1677FF' }}>定位中...</Text>}
        </View>

        <View className="action-item" onClick={handleMapPicker} style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid #E5E7EB' }}>
          <View style={{ width: '36px', height: '36px', borderRadius: '18px', justifyContent: 'center', alignItems: 'center', marginRight: '12px', backgroundColor: 'rgba(245,158,11,0.1)' }}>
            <Text style={{ fontSize: '18px' }}>📍</Text>
          </View>
          <Text style={{ fontSize: '15px', color: '#1A1D26', fontWeight: '500' }}>地图选点</Text>
        </View>
      </View>

      {/* ── 最近搜索区 ── */}
      <View className="saved-section" style={{ backgroundColor: '#fff', marginBottom: '10px' }}>
        <View className="section-header" style={{ padding: '12px 16px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB' }}>
          <Text style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>最近搜索</Text>
          {recentAddresses.length > 0 && (
            <View onClick={() => handleClearHistory()}>
              <Text style={{ fontSize: '13px', color: '#1677FF', fontWeight: '500' }}>清空</Text>
            </View>
          )}
        </View>

        {loadingRecent ? (
          <View style={{ padding: '24px', alignItems: 'center' }}><Text style={{ fontSize: '14px', color: '#9CA3AF' }}>加载中...</Text></View>
        ) : recentAddresses.length === 0 ? (
          <View style={{ alignItems: 'center', padding: '40px 0' }}>
            <Text style={{ fontSize: '14px', color: '#6B7280' }}>暂无最近搜索</Text>
            <Text style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>搜索并选择过地址后，这里会自动出现历史记录</Text>
          </View>
        ) : (
          recentAddresses.map((item, index) => (
            <View key={`recent-${index}`} onClick={() => handleSelectAddress(item)} style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #E5E7EB' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: '15px', color: '#1A1D26', fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>{item.name || item.address}</Text>
                  <View style={{ marginLeft: '8px', padding: '1px 6px', backgroundColor: '#EFF6FF', borderRadius: '3px' }}>
                    <Text style={{ fontSize: '11px', color: '#1677FF' }}>最近</Text>
                  </View>
                </View>
                <Text style={{ fontSize: '13px', color: '#6B7280', marginTop: '3px' }} numberOfLines={1}>{item.address}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── 常用地址区 ── */}
      <View className="saved-section" style={{ backgroundColor: '#fff' }}>
        <View className="section-header" style={{ padding: '12px 16px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB' }}>
          <Text style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>常用地址</Text>
        </View>

        {loadingSaved ? (
          <View style={{ padding: '30px', alignItems: 'center' }}><Text style={{ fontSize: '14px', color: '#9CA3AF' }}>加载中...</Text></View>
        ) : savedAddresses.length === 0 ? (
          <View style={{ alignItems: 'center', padding: '40px 0' }}>
            <Text style={{ fontSize: '14px', color: '#6B7280' }}>暂无常用地址</Text>
            <Text style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>选择地址后可保存为常用地址</Text>
          </View>
        ) : (
          savedAddresses.map(item => (
            <View key={item.id} onClick={() => handleSelectAddress(item)} style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #E5E7EB' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: '15px', color: '#1A1D26', fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>{item.name || item.address}</Text>
                  {item.is_default && (
                    <View style={{ marginLeft: '8px', padding: '1px 6px', backgroundColor: '#EFF6FF', borderRadius: '3px' }}>
                      <Text style={{ fontSize: '11px', color: '#1677FF' }}>默认</Text>
                    </View>
                  )}
                  {item.label && (
                    <View style={{ marginLeft: '6px', padding: '1px 6px', backgroundColor: '#F3F4F6', borderRadius: '3px' }}>
                      <Text style={{ fontSize: '11px', color: '#6B7280' }}>{item.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: '13px', color: '#6B7280', marginTop: '3px' }} numberOfLines={1}>{item.address}</Text>
              </View>
              <View onClick={(e) => { e.stopPropagation(); item.id && handleDeleteAddress(item.id); }} style={{ paddingLeft: '12px' }}>
                <Text style={{ fontSize: '14px', color: '#D1D5DB' }}>✕</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
