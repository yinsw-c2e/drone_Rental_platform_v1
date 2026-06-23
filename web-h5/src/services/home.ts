import { HomeDashboard } from '../types';
import { apiV2 } from './api';

export const homeService = {
  getDashboard: () => apiV2.get<HomeDashboard>('/home/dashboard'),
};
