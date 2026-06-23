import Taro from '@tarojs/taro';
import {
  HAUL_ROLE_MODE_STORAGE_KEY,
  type HaulRoleMode,
} from '../store/slices/roleSlice';

export const PROVIDER_ORDERS_SEGMENT_KEY = 'provider_orders_default_segment';
export const CUSTOMER_ORDERS_SEGMENT_KEY = 'customer_orders_default_segment';
export const ORDERS_ROLE_ENTRY_MODE_KEY = 'orders_role_entry_mode';

export function setOrdersEntryMode(mode: HaulRoleMode) {
  try {
    Taro.setStorageSync(ORDERS_ROLE_ENTRY_MODE_KEY, mode);
    Taro.setStorageSync(HAUL_ROLE_MODE_STORAGE_KEY, mode);
    Taro.removeStorageSync(PROVIDER_ORDERS_SEGMENT_KEY);
    Taro.removeStorageSync(CUSTOMER_ORDERS_SEGMENT_KEY);
  } catch {
    // 存储不可用时仍允许页面跳转，订单页会按 customer 兜底。
  }
}

export function readOrdersEntryMode(): HaulRoleMode | null {
  try {
    const value = Taro.getStorageSync(ORDERS_ROLE_ENTRY_MODE_KEY);
    return value === 'provider' || value === 'customer' ? value : null;
  } catch {
    return null;
  }
}

export function consumeOrdersEntryMode(): HaulRoleMode | null {
  const value = readOrdersEntryMode();
  try {
    Taro.removeStorageSync(ORDERS_ROLE_ENTRY_MODE_KEY);
  } catch {
    // 入口角色只用于本次进入，清理失败时不影响主流程。
  }
  return value;
}

export function switchToOrdersTab(mode: HaulRoleMode) {
  setOrdersEntryMode(mode);
  return Taro.switchTab({
    url: mode === 'provider' ? '/pages/provider-demand/index' : '/pages/orders/index',
  });
}
