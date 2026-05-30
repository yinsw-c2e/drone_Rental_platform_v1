import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { Input, ScrollView, Switch, Text, View } from '@tarojs/components';
import { addressService } from '../../../services/address';
import type { V2UserAddress } from '../../../types';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

type AddressForm = {
  id?: number;
  label: string;
  name: string;
  address: string;
  province: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
};

const EMPTY_FORM: AddressForm = {
  label: '家',
  name: '',
  address: '',
  province: '',
  city: '',
  district: '',
  latitude: 0,
  longitude: 0,
  is_default: false,
};

const normalizeAddressList = (response: unknown): V2UserAddress[] => {
  const data = response as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const toForm = (item?: V2UserAddress | null): AddressForm => {
  if (!item) return { ...EMPTY_FORM };
  return {
    id: item.id,
    label: item.label || '家',
    name: item.name || '',
    address: item.address || '',
    province: item.province || '',
    city: item.city || '',
    district: item.district || '',
    latitude: Number(item.latitude || 0),
    longitude: Number(item.longitude || 0),
    is_default: Boolean(item.is_default),
  };
};

const buildPayload = (form: AddressForm): Partial<V2UserAddress> => ({
  label: form.label,
  name: form.name || form.address,
  address: form.address,
  province: form.province,
  city: form.city,
  district: form.district,
  latitude: form.latitude,
  longitude: form.longitude,
  is_default: form.is_default,
});

const getAddressTitle = (item: V2UserAddress) =>
  String(item.name || item.address || '').trim() || '未命名地址';

const getAddressDetail = (item: V2UserAddress) => {
  const title = getAddressTitle(item);
  const detail = String(item.address || '').trim();
  if (detail && detail !== title) return detail;
  return [item.district, item.city].filter(Boolean).join('') || '已保存地址';
};

export default function AddressBookPage() {
  const [addresses, setAddresses] = useState<V2UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState<AddressForm>({ ...EMPTY_FORM });

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);

  const refreshAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await addressService.list();
      const list = normalizeAddressList(response)
        .slice()
        .sort((a, b) => Number(b.is_default) - Number(a.is_default));
      setAddresses(list);
    } catch (error: any) {
      setAddresses([]);
      Taro.showToast({ title: friendlyErrorMessage(error, '地址簿加载失败'), icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    refreshAddresses();
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setShowEditor(true);
  };

  const openEdit = (item: V2UserAddress) => {
    setForm(toForm(item));
    setShowEditor(true);
  };

  const chooseLabel = async () => {
    const options = ['家', '公司', '其他'];
    const res = await Taro.showActionSheet({ itemList: options }).catch(() => null);
    if (!res || typeof res.tapIndex !== 'number') return;
    setForm(prev => ({ ...prev, label: options[res.tapIndex] || '其他' }));
  };

  const chooseAddress = async () => {
    try {
      const result = await Taro.chooseLocation({});
      if (!result) return;
      const name = String((result as any).name || '').trim();
      const address = String((result as any).address || name).trim();
      setForm(prev => ({
        ...prev,
        name: name || prev.name,
        address: address || prev.address,
        latitude: Number((result as any).latitude || 0),
        longitude: Number((result as any).longitude || 0),
      }));
    } catch {
      // 用户取消选点时不打扰。
    }
  };

  const submit = async () => {
    if (saving) return;
    if (!form.address || !form.latitude || !form.longitude) {
      Taro.showToast({ title: '请选择地址', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (form.id) {
        await addressService.update(form.id, payload);
      } else {
        await addressService.create(payload);
      }
      Taro.showToast({ title: isEditing ? '已保存' : '已添加', icon: 'success' });
      setShowEditor(false);
      await refreshAddresses();
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '保存失败'), icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (item: V2UserAddress) => {
    const res = await Taro.showModal({
      title: '删除地址',
      content: `确定删除「${getAddressTitle(item)}」吗？`,
      confirmText: '删除',
      confirmColor: '#e5484d',
    });
    if (!res.confirm) return;
    try {
      await addressService.remove(item.id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setAddresses(prev => prev.filter(entry => entry.id !== item.id));
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '删除失败'), icon: 'none' });
    }
  };

  const setDefault = async (item: V2UserAddress) => {
    if (item.is_default) return;
    try {
      await addressService.setDefault(item.id);
      setAddresses(prev => prev.map(entry => ({
        ...entry,
        is_default: entry.id === item.id,
      })).sort((a, b) => Number(b.is_default) - Number(a.is_default)));
      Taro.showToast({ title: '已设为默认', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '设置失败'), icon: 'none' });
    }
  };

  const openAddressMenu = async (item: V2UserAddress) => {
    const actions = item.is_default ? ['编辑', '删除'] : ['编辑', '设为默认', '删除'];
    const res = await Taro.showActionSheet({ itemList: actions }).catch(() => null);
    if (!res || typeof res.tapIndex !== 'number') return;
    const action = actions[res.tapIndex];
    if (action === '编辑') openEdit(item);
    if (action === '设为默认') setDefault(item);
    if (action === '删除') removeAddress(item);
  };

  return (
    <View className='address-book-page'>
      <ScrollView scrollY className='address-book-scroll'>
        <View className='address-book-add' onClick={openCreate}>
          <Text className='address-book-add-icon'>+</Text>
          <Text className='address-book-add-text'>添加新地址</Text>
        </View>

        {loading ? (
          <View className='address-book-state'>
            <Text>加载中...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View className='address-book-empty'>
            <View className='address-book-empty-icon'>⌖</View>
            <Text className='address-book-empty-title'>还没有保存的地址</Text>
            <Text className='address-book-empty-desc'>添加一个常用地址，下次下单更快</Text>
            <View className='address-book-empty-button' onClick={openCreate}>添加地址</View>
          </View>
        ) : (
          <View className='address-book-list'>
            {addresses.map(item => (
              <View key={item.id} className='address-book-card'>
                <View className='address-book-card-main'>
                  <View className='address-book-card-title-row'>
                    <Text className='address-book-card-title' numberOfLines={1}>{getAddressTitle(item)}</Text>
                    {item.label ? <Text className='address-book-tag'>{item.label}</Text> : null}
                    {item.is_default ? <Text className='address-book-default'>默认</Text> : null}
                  </View>
                  <Text className='address-book-card-address' numberOfLines={2}>{getAddressDetail(item)}</Text>
                </View>
                <View className='address-book-menu' onClick={() => openAddressMenu(item)}>•••</View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showEditor ? (
        <View className='address-book-modal'>
          <View className='address-book-mask' onClick={() => setShowEditor(false)} />
          <View className='address-book-panel'>
            <View className='address-book-panel-head'>
              <Text className='address-book-panel-title'>{isEditing ? '编辑地址' : '添加地址'}</Text>
              <Text className='address-book-panel-close' onClick={() => setShowEditor(false)}>取消</Text>
            </View>

            <View className='address-book-field' onClick={chooseLabel}>
              <Text className='address-book-field-label'>标签</Text>
              <Text className='address-book-field-value'>{form.label}</Text>
            </View>

            <View className='address-book-field' onClick={chooseAddress}>
              <Text className='address-book-field-label'>地址</Text>
              <View className='address-book-field-content'>
                <Text className={`address-book-field-main ${form.address ? '' : 'is-placeholder'}`} numberOfLines={1}>
                  {form.name || form.address || '选择地图位置'}
                </Text>
                {form.address ? (
                  <Text className='address-book-field-sub' numberOfLines={1}>{form.address}</Text>
                ) : null}
              </View>
              <Text className='address-book-field-arrow'>›</Text>
            </View>

            <View className='address-book-input-field'>
              <Text className='address-book-field-label'>名称</Text>
              <Input
                className='address-book-input'
                value={form.name}
                placeholder='如公司北门、仓库 A 区'
                onInput={event => setForm(prev => ({ ...prev, name: String(event.detail.value || '') }))}
              />
            </View>

            <View className='address-book-switch-field'>
              <View>
                <Text className='address-book-switch-title'>设为默认地址</Text>
                <Text className='address-book-switch-desc'>下次进入首页优先展示</Text>
              </View>
              <Switch
                color='#005bea'
                checked={form.is_default}
                onChange={event => setForm(prev => ({ ...prev, is_default: Boolean(event.detail.value) }))}
              />
            </View>

            <View className={`address-book-submit ${saving ? 'is-saving' : ''}`} onClick={submit}>
              {saving ? '保存中...' : '保存地址'}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
