import {apiV2} from './api';
import {
  V2ApiResponse,
  V2ListData,
  V2NotificationMeta,
  V2NotificationSummary,
} from '../types';

export type NotificationListParams = {
  page?: number;
  page_size?: number;
};

export const notificationV2Service = {
  list: (params?: NotificationListParams) =>
    apiV2.get<any, V2ApiResponse<V2ListData<V2NotificationSummary>, V2NotificationMeta>>('/notifications', {
      params,
    }),

  markRead: (notificationId: number) =>
    apiV2.post<any, V2ApiResponse<{notification_id: number; is_read: boolean}>>(
      `/notifications/${notificationId}/read`,
      {},
    ),
};
