import { V2ApiResponse } from '../types';
import { apiV2 } from './api';

export interface PushTestPayload {
  title?: string;
  content?: string;
}

export interface PushTestResult {
  sent: boolean;
  provider: string;
  user_id: number;
  alias: string;
  title: string;
  content: string;
}

export const pushTestService = {
  send: (payload: PushTestPayload = {}) =>
    apiV2.post<any, V2ApiResponse<PushTestResult>>('/push/test', payload),
};
