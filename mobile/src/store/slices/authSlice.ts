import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {MeSummary, RoleSummary, TokenPair, User} from '../../types';

interface AuthState {
  user: User | null;
  roleSummary: RoleSummary | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  meInitialized: boolean;
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
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = {...state.user, ...action.payload};
      }
    },
    setMeSummary: (state, action: PayloadAction<MeSummary>) => {
      state.user = {...(state.user || {}), ...action.payload.user} as User;
      state.roleSummary = action.payload.role_summary;
      state.isAuthenticated = true;
      state.meInitialized = true;
    },
    markMeInitialized: state => {
      state.meInitialized = true;
    },
    setTokens: (state, action: PayloadAction<TokenPair>) => {
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
    },
    logout: state => {
      state.user = null;
      state.roleSummary = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.meInitialized = false;
    },
  },
});

export const {setCredentials, updateUser, setMeSummary, markMeInitialized, setTokens, logout} = authSlice.actions;
export default authSlice.reducer;
