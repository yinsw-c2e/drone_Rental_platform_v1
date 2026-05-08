import { MeSummary } from '../types';
import { apiV2 } from './api';

export const sessionService = {
  getMe: () => apiV2.get<MeSummary>('/me'),
};
