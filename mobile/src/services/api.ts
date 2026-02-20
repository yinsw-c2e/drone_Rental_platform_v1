import axios, {AxiosInstance, InternalAxiosRequestConfig, AxiosError} from 'axios';
import {API_BASE_URL} from '../constants';
import {store} from '../store/store';
import {setTokens, logout} from '../store/slices/authSlice';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = store.getState();
    const token = state.auth.accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// Track token refresh state to avoid concurrent refreshes
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

function onTokenRefreshed(newToken: string) {
  pendingRequests.forEach(cb => cb(newToken));
  pendingRequests = [];
}

// Response interceptor
api.interceptors.response.use(
  response => {
    const data = response.data;
    if (data.code !== 0) {
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {_retry?: boolean};

    // Handle 401 - try token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const state = store.getState();
      const refreshToken = state.auth.refreshToken;

      if (!refreshToken) {
        store.dispatch(logout());
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the ongoing refresh to complete
        return new Promise(resolve => {
          pendingRequests.push((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refresh_token: refreshToken,
        });

        if (res.data.code === 0) {
          const newTokens = res.data.data;
          store.dispatch(setTokens(newTokens));
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
          }
          onTokenRefreshed(newTokens.access_token);
          return api(originalRequest);
        } else {
          store.dispatch(logout());
          return Promise.reject(error);
        }
      } catch {
        store.dispatch(logout());
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // Extract meaningful error message
    const responseData = error.response?.data as any;
    const message = responseData?.message || error.message || '网络请求失败';
    return Promise.reject(new Error(message));
  },
);

export default api;
