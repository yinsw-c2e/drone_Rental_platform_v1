import {HomeDashboard, V2ApiResponse} from '../types';
import {apiV2} from './api';

export const homeService = {
  getDashboard: () =>
    apiV2.get<any, V2ApiResponse<HomeDashboard>>('/home/dashboard'),
};
