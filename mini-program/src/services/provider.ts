import { apiV2 } from './api';
import type {
  V2OrderDetail,
  V2ProviderAssignmentView,
  V2ProviderBroadcastView,
  V2ProviderStats,
} from '../types';

export const providerService = {
  getStats: () => apiV2.get<V2ProviderStats>('/provider/me/stats'),

  listBroadcasts: (limit = 20) =>
    apiV2.get<{ items: V2ProviderBroadcastView[] }>('/provider/broadcasts', { limit }),

  grabBroadcast: (broadcastId: number) =>
    apiV2.post<{ order: V2OrderDetail }>(`/provider/broadcasts/${broadcastId}/grab`, {}),

  listAssignments: (limit = 20) =>
    apiV2.get<{ items: V2ProviderAssignmentView[] }>('/provider/broadcast-assignments', { limit }),

  acceptAssignment: (assignmentId: number) =>
    apiV2.post<{ order: V2OrderDetail }>(`/provider/broadcast-assignments/${assignmentId}/accept`, {}),

  declineAssignment: (assignmentId: number, reason?: string) =>
    apiV2.post<{ declined: boolean }>(`/provider/broadcast-assignments/${assignmentId}/decline`, { reason }),
};

export default providerService;
