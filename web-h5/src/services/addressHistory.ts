import type { AddressData } from '../types';

const MAX_HISTORY_ITEMS = 8;
const STORAGE_KEY = 'address_history_v1';
import Taro from '@tarojs/taro';

const buildHistoryKey = (item: AddressData) =>
  [
    String(item.name || '').trim(),
    String(item.address || '').trim(),
    Number(item.latitude || 0).toFixed(6),
    Number(item.longitude || 0).toFixed(6),
  ].join('|');

const sanitizeAddress = (item: AddressData): AddressData => ({
  name: item.name || item.address,
  address: item.address || item.name || '',
  province: item.province,
  city: item.city,
  district: item.district,
  latitude: Number(item.latitude || 0),
  longitude: Number(item.longitude || 0),
  label: item.label,
});

export async function loadAddressHistory(): Promise<AddressData[]> {
  try {
    const data = Taro.getStorageSync(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function addAddressHistory(item: AddressData): Promise<AddressData[]> {
  const nextItem = sanitizeAddress(item);
  const current = await loadAddressHistory();
  const next = [nextItem, ...current.filter(entry => buildHistoryKey(entry) !== buildHistoryKey(nextItem))]
    .slice(0, MAX_HISTORY_ITEMS);
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearAddressHistory(): Promise<void> {
  Taro.removeStorageSync(STORAGE_KEY);
}

export const addressHistoryService = {
  loadAddressHistory,
  addAddressHistory,
  clearAddressHistory,
};

export default addressHistoryService;
