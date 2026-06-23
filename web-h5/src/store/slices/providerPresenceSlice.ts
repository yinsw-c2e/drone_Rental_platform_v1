import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { V2ProviderPresence } from '../../types';

export interface ProviderPresenceState {
  online: boolean;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastHeartbeatAt: string | null;
  acceptedServiceClasses: string[];
  maxRadiusKM: number;
  lastError: string | null;
  heartbeatFailureCount: number;
  status: string | null;
}

const initialState: ProviderPresenceState = {
  online: false,
  lastLatitude: null,
  lastLongitude: null,
  lastHeartbeatAt: null,
  acceptedServiceClasses: [],
  maxRadiusKM: 30,
  lastError: null,
  heartbeatFailureCount: 0,
  status: null,
};

type PresenceLocation = {
  latitude?: number | null;
  longitude?: number | null;
};

type PresencePayload = {
  presence?: V2ProviderPresence | null;
  location?: PresenceLocation | null;
};

type PresenceConfigPayload = {
  maxRadiusKM?: number;
  acceptedServiceClasses?: string[];
};

function applyPresence(state: ProviderPresenceState, payload: PresencePayload) {
  const { presence, location } = payload;
  if (presence) {
    state.online = Boolean(presence.online);
    state.lastLatitude = Number(presence.last_latitude ?? location?.latitude ?? state.lastLatitude ?? 0);
    state.lastLongitude = Number(presence.last_longitude ?? location?.longitude ?? state.lastLongitude ?? 0);
    state.lastHeartbeatAt = presence.last_heartbeat_at || null;
    state.acceptedServiceClasses = Array.isArray(presence.accepted_service_classes)
      ? presence.accepted_service_classes
      : [];
    state.maxRadiusKM = Number(presence.max_radius_km || state.maxRadiusKM || 30);
    state.status = presence.status || null;
  } else if (location) {
    state.lastLatitude = Number(location.latitude ?? state.lastLatitude ?? 0);
    state.lastLongitude = Number(location.longitude ?? state.lastLongitude ?? 0);
  }
}

const providerPresenceSlice = createSlice({
  name: 'providerPresence',
  initialState,
  reducers: {
    presenceUpdated: (state, action: PayloadAction<PresencePayload>) => {
      applyPresence(state, action.payload);
    },
    presenceConfigUpdated: (state, action: PayloadAction<PresenceConfigPayload>) => {
      if (action.payload.maxRadiusKM !== undefined) {
        state.maxRadiusKM = action.payload.maxRadiusKM;
      }
      if (action.payload.acceptedServiceClasses !== undefined) {
        state.acceptedServiceClasses = action.payload.acceptedServiceClasses;
      }
    },
    heartbeatSucceeded: (state, action: PayloadAction<PresencePayload>) => {
      applyPresence(state, action.payload);
      state.online = true;
      state.lastError = null;
      state.heartbeatFailureCount = 0;
    },
    heartbeatFailed: (state, action: PayloadAction<string | undefined>) => {
      state.heartbeatFailureCount += 1;
      if (action.payload) {
        state.lastError = action.payload;
      }
    },
    wentOnline: (state, action: PayloadAction<PresencePayload>) => {
      applyPresence(state, action.payload);
      state.online = true;
      state.lastError = null;
      state.heartbeatFailureCount = 0;
    },
    wentOffline: (state) => {
      state.online = false;
      state.lastHeartbeatAt = null;
      state.lastError = null;
      state.heartbeatFailureCount = 0;
      state.status = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.lastError = action.payload;
    },
    clearError: (state) => {
      state.lastError = null;
    },
  },
});

export const {
  presenceUpdated,
  presenceConfigUpdated,
  heartbeatSucceeded,
  heartbeatFailed,
  wentOnline,
  wentOffline,
  setError,
  clearError,
} = providerPresenceSlice.actions;

export default providerPresenceSlice.reducer;
