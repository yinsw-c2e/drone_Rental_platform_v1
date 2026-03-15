import {MeSummary, V2ApiResponse} from '../types';
import {apiV2} from './api';

export const sessionService = {
  getMe: () => apiV2.get<any, V2ApiResponse<MeSummary>>('/me'),
};
