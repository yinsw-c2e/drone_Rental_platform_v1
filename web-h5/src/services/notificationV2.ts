import { apiV2 } from './api';
import {
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
    apiV2.get<V2ListData<V2NotificationSummary> & { meta: V2NotificationMeta }>('/notifications', params),

  markRead: (notificationId: number) =>
    apiV2.post<{ notification_id: number; is_read: boolean }>(`/notifications/${notificationId}/read`),
};
