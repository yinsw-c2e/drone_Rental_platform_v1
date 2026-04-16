import { V2ApiResponse } from '../types';
import { apiV2 } from './api';

export interface PushDeviceRegisterPayload {
  registration_id: string;
  platform?: string;
}

export interface PushDeviceRegisterResult {
  bound: boolean;
  provider: string;
  user_id: number;
  registration_id: string;
  platform: string;
  alias: string;
}

export const pushDeviceService = {
  register: (payload: PushDeviceRegisterPayload) =>
    apiV2.post<any, V2ApiResponse<PushDeviceRegisterResult>>('/push/device', payload),
};
