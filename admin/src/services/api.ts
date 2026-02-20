import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ============================================================
// API 配置
// ============================================================

// 从环境变量获取API配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const API_PREFIX = import.meta.env.VITE_API_PREFIX || '/api/v1';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '15000', 10);

// 开发环境使用代理，生产环境直接请求
const baseURL = import.meta.env.DEV ? API_PREFIX : `${API_BASE_URL}${API_PREFIX}`;

// 创建Axios实例
const api = axios.create({
  baseURL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token刷新状态管理
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

// 处理等待中的请求
const processPendingRequests = (token: string) => {
  pendingRequests.forEach(callback => callback(token));
  pendingRequests = [];
};

// 请求拦截器：添加认证Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('admin_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理响应和错误
api.interceptors.response.use(
  response => {
    const data = response.data;
    // 业务错误（code !== 0）
    if (data.code !== 0) {
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401错误处理
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 如果正在刷新token，将请求加入等待队列
      if (isRefreshing) {
        return new Promise(resolve => {
          pendingRequests.push((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('admin_refresh_token');
        if (refreshToken) {
          // 尝试刷新token
          const response = await axios.post(`${baseURL}/auth/refresh-token`, {
            refresh_token: refreshToken,
          });

          if (response.data.code === 0) {
            const { access_token, refresh_token: newRefreshToken } = response.data.data;
            localStorage.setItem('admin_token', access_token);
            if (newRefreshToken) {
              localStorage.setItem('admin_refresh_token', newRefreshToken);
            }

            // 处理等待中的请求
            processPendingRequests(access_token);

            // 重试原请求
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
            }
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      } finally {
        isRefreshing = false;
      }

      // 刷新失败，清除token并跳转登录页
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;

// ============================================================
// Admin API 接口封装
// ============================================================
export const adminApi = {
  // 认证相关
  login: (phone: string, password: string) =>
    api.post('/auth/login', { phone, password }),
  
  logout: () =>
    api.post('/auth/logout'),

  // 仪表盘
  dashboard: () => api.get('/admin/dashboard'),

  // ========== 用户管理 ==========
  getUsers: (params?: {
    page?: number;
    page_size?: number;
    keyword?: string;
    status?: string;
  }) => api.get('/admin/users', { params }),
  
  getUserDetail: (id: number) =>
    api.get(`/admin/users/${id}`),
  
  updateUserStatus: (id: number, status: string) =>
    api.put(`/admin/users/${id}/status`, { status }),
  
  approveIDVerify: (id: number, approved: boolean, reason?: string) =>
    api.put(`/admin/users/${id}/verify`, { approved, reason }),

  // ========== 无人机管理 ==========
  getDrones: (params?: {
    page?: number;
    page_size?: number;
    keyword?: string;
    status?: string;
  }) => api.get('/admin/drones', { params }),
  
  getDroneDetail: (id: number) =>
    api.get(`/admin/drones/${id}`),
  
  approveCertification: (id: number, approved: boolean, reason?: string) =>
    api.put(`/admin/drones/${id}/certification`, { approved, reason }),
  
  updateDroneStatus: (id: number, status: string) =>
    api.put(`/admin/drones/${id}/status`, { status }),

  // ========== 订单管理 ==========
  getOrders: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/admin/orders', { params }),
  
  getOrderDetail: (id: number) =>
    api.get(`/admin/orders/${id}`),

  // ========== 支付管理 ==========
  getPayments: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/admin/payments', { params }),
  
  getPaymentDetail: (id: number) =>
    api.get(`/admin/payments/${id}`),
  
  processRefund: (id: number, approved: boolean, reason?: string) =>
    api.post(`/admin/payments/${id}/refund`, { approved, reason }),

  // ========== 系统配置 ==========
  getSystemConfig: () =>
    api.get('/admin/config'),
  
  updateSystemConfig: (config: Record<string, unknown>) =>
    api.put('/admin/config', config),

  // ========== 统计报表 ==========
  getStatistics: (params?: {
    type: 'daily' | 'weekly' | 'monthly';
    start_date?: string;
    end_date?: string;
  }) => api.get('/admin/statistics', { params }),
};

// ============================================================
// 导出配置常量供其他模块使用
// ============================================================
export const CONFIG = {
  API_BASE_URL,
  API_PREFIX,
  API_TIMEOUT,
  // 高德地图配置
  AMAP_WEB_KEY: import.meta.env.VITE_AMAP_WEB_KEY || '',
  AMAP_SECURITY_CODE: import.meta.env.VITE_AMAP_SECURITY_CODE || '',
  // 上传配置
  UPLOAD_MAX_SIZE: parseInt(import.meta.env.VITE_UPLOAD_MAX_SIZE || '10', 10),
  UPLOAD_ACCEPT: import.meta.env.VITE_UPLOAD_ACCEPT || '.jpg,.jpeg,.png,.gif,.pdf',
  // 应用配置
  APP_TITLE: import.meta.env.VITE_APP_TITLE || '无人机租赁平台管理后台',
  APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
  ENABLE_MOCK: import.meta.env.VITE_ENABLE_MOCK === 'true',
};
