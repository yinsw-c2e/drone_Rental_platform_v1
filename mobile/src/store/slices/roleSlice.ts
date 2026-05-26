import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HaulRoleMode = 'customer' | 'provider';
export const HAUL_ROLE_MODE_STORAGE_KEY = 'haulRoleMode';

interface RoleState {
  selectedMode: HaulRoleMode;
}

const isHaulRoleMode = (value: unknown): value is HaulRoleMode =>
  value === 'provider' || value === 'customer';

function persistRoleMode(mode: HaulRoleMode) {
  AsyncStorage.setItem(HAUL_ROLE_MODE_STORAGE_KEY, mode).catch(() => {
    // 本地存储不可用时仍保持内存态，避免影响主界面切换。
  });
}

const initialState: RoleState = {
  selectedMode: 'customer',
};

const roleSlice = createSlice({
  name: 'role',
  initialState,
  reducers: {
    hydrateHaulRoleMode: (state, action: PayloadAction<unknown>) => {
      if (isHaulRoleMode(action.payload)) {
        state.selectedMode = action.payload;
      }
    },
    setHaulRoleMode: (state, action: PayloadAction<HaulRoleMode>) => {
      state.selectedMode = action.payload;
      persistRoleMode(action.payload);
    },
  },
});

export const {hydrateHaulRoleMode, setHaulRoleMode} = roleSlice.actions;
export default roleSlice.reducer;
