import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {MeSummary, RoleSummary, TokenPair, User} from '../../types';

interface AuthState {
  user: User | null;
  roleSummary: RoleSummary | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  meInitialized: boolean;
}

export const AUTH_TOKEN_STORAGE_KEY = 'haul_auth_token';
export const AUTH_USER_STORAGE_KEY = 'haul_auth_user';

type StoredAuthUser = {
  user?: User | null;
  roleSummary?: RoleSummary | null;
};

async function readStoredValue<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {
    // Storage failures should not block in-memory auth state.
  });
}

function removeStoredValue(key: string) {
  AsyncStorage.removeItem(key).catch(() => {
    // Ignore cleanup failures; subsequent login will overwrite.
  });
}

const initialState: AuthState = {
  user: null,
  roleSummary: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  meInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{user: User; token: TokenPair; roleSummary?: RoleSummary | null}>) => {
      state.user = action.payload.user;
      state.roleSummary = action.payload.roleSummary || null;
      state.accessToken = action.payload.token.access_token;
      state.refreshToken = action.payload.token.refresh_token;
      state.isAuthenticated = true;
      state.meInitialized = !!action.payload.roleSummary;
      writeStoredValue(AUTH_TOKEN_STORAGE_KEY, action.payload.token);
      writeStoredValue(AUTH_USER_STORAGE_KEY, {
        user: action.payload.user,
        roleSummary: action.payload.roleSummary || null,
      });
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = {...state.user, ...action.payload};
        writeStoredValue(AUTH_USER_STORAGE_KEY, {
          user: state.user,
          roleSummary: state.roleSummary,
        });
      }
    },
    setMeSummary: (state, action: PayloadAction<MeSummary>) => {
      state.user = {...(state.user || {}), ...action.payload.user} as User;
      state.roleSummary = action.payload.role_summary;
      state.isAuthenticated = true;
      state.meInitialized = true;
      writeStoredValue(AUTH_USER_STORAGE_KEY, {
        user: state.user,
        roleSummary: state.roleSummary,
      });
    },
    markMeInitialized: state => {
      state.meInitialized = true;
    },
    setTokens: (state, action: PayloadAction<TokenPair>) => {
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      writeStoredValue(AUTH_TOKEN_STORAGE_KEY, action.payload);
    },
    logout: state => {
      state.user = null;
      state.roleSummary = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.meInitialized = false;
      removeStoredValue(AUTH_TOKEN_STORAGE_KEY);
      removeStoredValue(AUTH_USER_STORAGE_KEY);
    },
  },
});

export const {setCredentials, updateUser, setMeSummary, markMeInitialized, setTokens, logout} = authSlice.actions;

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_, {dispatch}) => {
  const [storedToken, storedUser] = await Promise.all([
    readStoredValue<TokenPair>(AUTH_TOKEN_STORAGE_KEY),
    readStoredValue<StoredAuthUser>(AUTH_USER_STORAGE_KEY),
  ]);

  if (storedToken?.access_token && storedUser?.user) {
    dispatch(setCredentials({
      user: storedUser.user,
      token: storedToken,
      roleSummary: storedUser.roleSummary || null,
    }));
    return true;
  }

  return false;
});

export default authSlice.reducer;
