import type {AddressData} from '../types';

const MAX_HISTORY_ITEMS = 8;
let memoryAddressHistory: AddressData[] = [];

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
  return [...memoryAddressHistory];
}

export async function addAddressHistory(item: AddressData): Promise<AddressData[]> {
  const nextItem = sanitizeAddress(item);
  const current = await loadAddressHistory();
  const next = [nextItem, ...current.filter(entry => buildHistoryKey(entry) !== buildHistoryKey(nextItem))]
    .slice(0, MAX_HISTORY_ITEMS);
  memoryAddressHistory = next;
  return next;
}

export async function clearAddressHistory(): Promise<void> {
  memoryAddressHistory = [];
}

export const addressHistoryService = {
  loadAddressHistory,
  addAddressHistory,
  clearAddressHistory,
};

export default addressHistoryService;
