import {apiV2} from './api';
import type {
  V2ApiResponse,
  V2OrderDetail,
  V2ProviderAssignmentView,
  V2ProviderBroadcastView,
  V2ProviderStats,
} from '../types';

export const providerService = {
  getStats: () =>
    apiV2.get<any, V2ApiResponse<V2ProviderStats>>('/provider/me/stats'),

  listBroadcasts: (limit = 20) =>
    apiV2.get<any, V2ApiResponse<{items: V2ProviderBroadcastView[]}>>(
      '/provider/broadcasts',
      {params: {limit}},
    ),

  grabBroadcast: (broadcastId: number) =>
    apiV2.post<any, V2ApiResponse<{order: V2OrderDetail}>>(
      `/provider/broadcasts/${broadcastId}/grab`,
      {},
    ),

  listAssignments: (limit = 20) =>
    apiV2.get<any, V2ApiResponse<{items: V2ProviderAssignmentView[]}>>(
      '/provider/broadcast-assignments',
      {params: {limit}},
    ),

  acceptAssignment: (assignmentId: number) =>
    apiV2.post<any, V2ApiResponse<{order: V2OrderDetail}>>(
      `/provider/broadcast-assignments/${assignmentId}/accept`,
      {},
    ),

  declineAssignment: (assignmentId: number, reason?: string) =>
    apiV2.post<any, V2ApiResponse<{declined: boolean}>>(
      `/provider/broadcast-assignments/${assignmentId}/decline`,
      {reason},
    ),
};

export default providerService;
