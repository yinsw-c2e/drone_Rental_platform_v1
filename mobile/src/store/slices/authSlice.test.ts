import AsyncStorage from '@react-native-async-storage/async-storage';
import {configureStore} from '@reduxjs/toolkit';
import authReducer, {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  bootstrapAuth,
  setMeSummary,
} from './authSlice';
import type {RoleSummary} from '../../types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const mockRoleSummary: RoleSummary = {
  has_client_role: true,
  has_owner_role: true,
  has_pilot_role: false,
  can_publish_supply: true,
  can_accept_dispatch: false,
  can_self_execute: false,
  provider: {
    status: 'approved',
    asset_status: 'approved',
    executor_status: 'none',
    can_use_workbench: true,
    can_quote: true,
    can_arrange_dispatch: true,
    can_accept_dispatch: false,
    can_self_execute: false,
    next_action: 'open_workbench',
  },
};

const createAuthStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
    },
  });

describe('authSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores roleSummary from a successful /me response', () => {
    const store = createAuthStore();

    store.dispatch(setMeSummary({
      user: {
        id: 7,
        phone: '13800000007',
        nickname: '服务商样本',
        avatar_url: '',
        id_verified: 'approved',
      },
      role_summary: mockRoleSummary,
    }));

    expect(store.getState().auth.roleSummary).toEqual(mockRoleSummary);
    expect(store.getState().auth.meInitialized).toBe(true);
    expect(store.getState().auth.isAuthenticated).toBe(true);
  });

  it('bootstraps credentials from AsyncStorage', async () => {
    const store = createAuthStore();
    const token = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 7200,
    };
    const user = {
      id: 7,
      phone: '13800000007',
      nickname: '服务商样本',
    };

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === AUTH_TOKEN_STORAGE_KEY) {
        return Promise.resolve(JSON.stringify(token));
      }
      if (key === AUTH_USER_STORAGE_KEY) {
        return Promise.resolve(JSON.stringify({user, roleSummary: mockRoleSummary}));
      }
      return Promise.resolve(null);
    });

    await store.dispatch(bootstrapAuth() as any);

    expect(store.getState().auth.accessToken).toBe(token.access_token);
    expect(store.getState().auth.user).toEqual(user);
    expect(store.getState().auth.roleSummary).toEqual(mockRoleSummary);
  });
});
