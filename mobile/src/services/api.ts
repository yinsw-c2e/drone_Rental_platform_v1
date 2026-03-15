import axios, {AxiosInstance, InternalAxiosRequestConfig, AxiosError} from 'axios';
import {API_V1_BASE_URL, API_V2_BASE_URL} from '../constants';
import {store} from '../store/store';
import {setTokens, logout} from '../store/slices/authSlice';

const buildClient = (baseURL: string): AxiosInstance =>
  axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const api = buildClient(API_V1_BASE_URL);
export const apiV2 = buildClient(API_V2_BASE_URL);

const attachAuthHeader = (client: AxiosInstance) => {
  client.interceptors.request.use(
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
};

// Track token refresh state to avoid concurrent refreshes
let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

function onTokenRefreshed(newToken: string) {
  pendingRequests.forEach(({resolve}) => resolve(newToken));
  pendingRequests = [];
}

function onTokenRefreshFailed(error: Error) {
  pendingRequests.forEach(({reject}) => reject(error));
  pendingRequests = [];
}

const isV1SuccessCode = (code: unknown) => code === 0;
const isV2SuccessCode = (code: unknown) => code === 'OK';
const isSuccessCode = (code: unknown) => isV1SuccessCode(code) || isV2SuccessCode(code);

const extractRefreshTokenPair = (payload: any) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if (payload.access_token && payload.refresh_token) {
    return payload;
  }
  if (payload.token?.access_token && payload.token?.refresh_token) {
    return payload.token;
  }
  return null;
};

const attachBusinessInterceptor = (client: AxiosInstance, version: 'v1' | 'v2') => {
  client.interceptors.response.use(
    response => {
      const data = response.data;
      if (data !== null && typeof data === 'object' && 'code' in data) {
        const success = version === 'v1' ? isV1SuccessCode((data as any).code) : isV2SuccessCode((data as any).code);
        if (!success) {
          return Promise.reject(new Error((data as any).message || '请求失败'));
        }
        return data;
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {_retry?: boolean};

      if (error.response?.status === 401 && !originalRequest._retry) {
        const state = store.getState();
        const refreshToken = state.auth.refreshToken;

        if (!refreshToken) {
          store.dispatch(logout());
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingRequests.push({
              resolve: (newToken: string) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                }
                resolve(client(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshBaseURL = version === 'v2' ? API_V2_BASE_URL : API_V1_BASE_URL;
          const res = await axios.post(`${refreshBaseURL}/auth/refresh-token`, {
            refresh_token: refreshToken,
          });

          if (isSuccessCode(res.data?.code)) {
            const newTokens = extractRefreshTokenPair(res.data?.data);
            if (!newTokens) {
              store.dispatch(logout());
              return Promise.reject(error);
            }
            store.dispatch(setTokens(newTokens));
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
            }
            onTokenRefreshed(newTokens.access_token);
            return client(originalRequest);
          } else {
            onTokenRefreshFailed(new Error('刷新令牌失败'));
            store.dispatch(logout());
            return Promise.reject(error);
          }
        } catch (refreshError) {
          const resolvedError =
            refreshError instanceof Error ? refreshError : new Error('刷新令牌失败');
          onTokenRefreshFailed(resolvedError);
          store.dispatch(logout());
          return Promise.reject(resolvedError);
        } finally {
          isRefreshing = false;
        }
      }

      const responseData = error.response?.data as any;
      const message = responseData?.message || responseData?.error || error.message || '网络请求失败';
      return Promise.reject(new Error(message));
    },
  );
};

attachAuthHeader(api);
attachAuthHeader(apiV2);
attachBusinessInterceptor(api, 'v1');
attachBusinessInterceptor(apiV2, 'v2');

export default api;
