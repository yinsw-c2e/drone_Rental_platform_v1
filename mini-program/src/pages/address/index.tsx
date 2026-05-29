import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { addressHistoryService } from '../../services/addressHistory';
import { addressService } from '../../services/address';
import { locationService } from '../../services/location';
import { store } from '../../store/store';
import { AddressData } from '../../types';
import './index.scss';

type AddressTab = 'cloud' | 'recent';

const normalizeAddressResponse = (response: unknown): AddressData[] => {
  const data = response as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const isAddressServiceUnavailable = (error: any) =>
  error?.code === 'AMAP_NOT_CONFIGURED' || String(error?.message || '').includes('地址服务暂不可用');

export default function AddressPickerPage() {
  const [savedAddresses, setSavedAddresses] = useState<AddressData[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<AddressData[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [locating, setLocating] = useState(false);
  const [activeTab, setActiveTab] = useState<AddressTab>('cloud');

  const fetchSavedAddresses = async () => {
    if (!store.getState().auth.isAuthenticated) {
      setSavedAddresses([]);
      setLoadingSaved(false);
      return;
    }
    setLoadingSaved(true);
    try {
      const res = await addressService.list();
      setSavedAddresses(normalizeAddressResponse(res));
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
      Taro.showToast({ title: isAddressServiceUnavailable(e) ? '地址服务暂不可用，请联系平台' : '定位失败', icon: 'none' });
    } finally {
      setLocating(false);
    }
  };

  const handleMapPicker = async () => {
    try {
      const res = await Taro.chooseLocation({});
      if (!res || !res.name || !res.address) return;
      let province = '';
      let city = '';
      let district = '';
      try {
        const reverse: any = await locationService.reverseGeoCode(res.longitude, res.latitude);
        const data = reverse?.data || reverse;
        province = String(data?.province || '');
        city = String(data?.city || '');
        district = String(data?.district || '');
      } catch (error: any) {
        if (isAddressServiceUnavailable(error)) {
          Taro.showToast({ title: '地址服务暂不可用，请联系平台', icon: 'none' });
        }
        // 逆地理失败时从 address 文本兜底
      }
      if (!city) {
        const match = String(res.address || '').match(/([一-龥]{2,}?)市/);
        if (match) city = `${match[1]}市`;
      }
      handleSelectAddress({
        name: res.name,
        address: res.address,
        latitude: res.latitude,
        longitude: res.longitude,
        province,
        city,
        district,
      });
    } catch (err) {
      console.log('取消选择', err);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    const res = await Taro.showModal({ title: '删除地址', content: '确定删除该常用地址吗？' });
    if (res.confirm) {
      try {
        await addressService.remove(id);
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

  const renderEmpty = (title: string, hint: string) => (
    <View className='addr-empty'>
      <View className='addr-empty-illus' />
      <Text className='addr-empty-title'>{title}</Text>
      <Text className='addr-empty-hint'>{hint}</Text>
    </View>
  );

  const renderAddressRow = (
    item: AddressData,
    key: string,
    badges: Array<{ text: string; tone: 'primary' | 'neutral' }>,
    onDelete?: () => void,
  ) => (
    <View key={key} className='addr-row' onClick={() => handleSelectAddress(item)}>
      <View className='addr-row-icon'><View className='addr-row-icon-pin' /></View>
      <View className='addr-row-body'>
        <View className='addr-row-line'>
          <Text className='addr-row-title'>{item.name || item.address}</Text>
          {badges.map(b => (
            <View key={b.text} className={`addr-tag addr-tag-${b.tone}`}>
              <Text>{b.text}</Text>
            </View>
          ))}
        </View>
        <Text className='addr-row-sub'>{item.address}</Text>
      </View>
      {onDelete ? (
        <View
          className='addr-row-delete'
          onClick={(e: any) => { e.stopPropagation && e.stopPropagation(); onDelete(); }}
        >
          <Text>删除</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScrollView scrollY className='addr-page'>
      <View
        className='addr-search'
        onClick={handleMapPicker}
      >
        <View className='addr-search-icon'>
          <View className='addr-search-icon-glass' />
          <View className='addr-search-icon-handle' />
        </View>
        <Text className='addr-search-placeholder'>点此用地图选点 · 暂不支持关键字搜索</Text>
      </View>

      <View className='addr-action-card'>
        <View className='addr-action' onClick={handleCurrentLocation}>
          <View className='addr-action-icon addr-action-icon-locate'>
            <View className='addr-action-icon-ring' />
            <View className='addr-action-icon-dot' />
          </View>
          <View className='addr-action-text'>
            <Text className='addr-action-title'>使用当前位置</Text>
            <Text className='addr-action-sub'>{locating ? '定位中…' : '基于 GPS 自动识别当前地点'}</Text>
          </View>
          <View className='addr-action-arrow' />
        </View>
        <View className='addr-action-divider' />
        <View className='addr-action' onClick={handleMapPicker}>
          <View className='addr-action-icon addr-action-icon-pin'>
            <View className='addr-action-icon-pin-body' />
            <View className='addr-action-icon-pin-dot' />
          </View>
          <View className='addr-action-text'>
            <Text className='addr-action-title'>地图选点</Text>
            <Text className='addr-action-sub'>在地图上长按或点击挑选精确位置</Text>
          </View>
          <View className='addr-action-arrow' />
        </View>
      </View>

      <View className='addr-tabs'>
        <View
          className={`addr-tab ${activeTab === 'cloud' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('cloud')}
        >
          <Text>云端地址簿</Text>
        </View>
        <View
          className={`addr-tab ${activeTab === 'recent' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          <Text>最近使用</Text>
        </View>
      </View>

      {activeTab === 'cloud' ? (
        <View className='addr-list-card'>
          <View className='addr-list-head'>
            <Text className='addr-list-title'>常用地址</Text>
            <Text
              className='addr-list-link'
              onClick={() => Taro.navigateTo({ url: '/pages/address/book/index' })}
            >管理云端地址</Text>
          </View>
          {loadingSaved ? (
            <View className='addr-loading'><Text>加载中…</Text></View>
          ) : savedAddresses.length === 0 ? (
            renderEmpty('暂无常用地址', '选择地址后可保存为常用地址')
          ) : (
            savedAddresses.map(item => {
              const badges: Array<{ text: string; tone: 'primary' | 'neutral' }> = [];
              if (item.is_default) badges.push({ text: '默认', tone: 'primary' });
              if (item.label) badges.push({ text: item.label, tone: 'neutral' });
              return renderAddressRow(
                item,
                `cloud-${item.id}`,
                badges,
                item.id ? () => handleDeleteAddress(item.id as number) : undefined,
              );
            })
          )}
        </View>
      ) : (
        <View className='addr-list-card'>
          <View className='addr-list-head'>
            <Text className='addr-list-title'>最近搜索</Text>
            {recentAddresses.length > 0 ? (
              <Text className='addr-list-link' onClick={() => handleClearHistory()}>清空</Text>
            ) : null}
          </View>
          {loadingRecent ? (
            <View className='addr-loading'><Text>加载中…</Text></View>
          ) : recentAddresses.length === 0 ? (
            renderEmpty('暂无最近搜索', '搜索并选择过地址后，这里会出现历史记录')
          ) : (
            recentAddresses.map((item, index) =>
              renderAddressRow(
                item,
                `recent-${index}`,
                [{ text: '最近', tone: 'primary' }],
              )
            )
          )}
        </View>
      )}

      <View className='addr-page-spacer' />
    </ScrollView>
  );
}
