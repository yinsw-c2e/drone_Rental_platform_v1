import { configureStore } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import authReducer from './slices/authSlice';
import roleReducer from './slices/roleSlice';
import providerPresenceReducer from './slices/providerPresenceSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    role: roleReducer,
    providerPresence: providerPresenceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
