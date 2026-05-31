import {apiV2} from './api';
import type {V2ApiResponse, V2ProviderPresence} from '../types';

export interface ProviderPresenceUpsertPayload {
  latitude: number;
  longitude: number;
  accepted_service_classes?: string[];
  max_radius_km?: number;
}

export const providerPresenceService = {
  online: (payload: ProviderPresenceUpsertPayload) =>
    apiV2.post<any, V2ApiResponse<V2ProviderPresence>>('/provider/presence/online', payload),

  heartbeat: (payload: ProviderPresenceUpsertPayload) =>
    apiV2.post<any, V2ApiResponse<V2ProviderPresence>>('/provider/presence/heartbeat', payload),

  offline: () =>
    apiV2.post<any, V2ApiResponse<{online: boolean}>>('/provider/presence/offline', {}),
};

export default providerPresenceService;
