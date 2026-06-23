import Taro from '@tarojs/taro';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type HaulRoleMode = 'customer' | 'provider';
export const HAUL_ROLE_MODE_STORAGE_KEY = 'haulRoleMode';

interface RoleState {
  selectedMode: HaulRoleMode;
}

export function readStoredRoleMode(): HaulRoleMode {
  try {
    const value = Taro.getStorageSync(HAUL_ROLE_MODE_STORAGE_KEY);
    return value === 'provider' || value === 'customer' ? value : 'customer';
  } catch {
    return 'customer';
  }
}

function persistRoleMode(mode: HaulRoleMode) {
  try {
    Taro.setStorageSync(HAUL_ROLE_MODE_STORAGE_KEY, mode);
  } catch {
    // 本地存储不可用时仍保持内存态，避免影响页面渲染。
  }
}

const initialState: RoleState = {
  selectedMode: readStoredRoleMode(),
};

const roleSlice = createSlice({
  name: 'role',
  initialState,
  reducers: {
    setHaulRoleMode: (state, action: PayloadAction<HaulRoleMode>) => {
      state.selectedMode = action.payload;
      persistRoleMode(action.payload);
    },
  },
});

export const { setHaulRoleMode } = roleSlice.actions;
export default roleSlice.reducer;
