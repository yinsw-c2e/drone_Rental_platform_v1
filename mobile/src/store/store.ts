import {configureStore} from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import providerPresenceReducer from './slices/providerPresenceSlice';
import roleReducer from './slices/roleSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    providerPresence: providerPresenceReducer,
    role: roleReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
