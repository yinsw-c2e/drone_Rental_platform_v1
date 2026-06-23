import Taro from '@tarojs/taro';
import { store } from '../store/store';
import { setTokens, logout } from '../store/slices/authSlice';
import { API_V2_BASE_URL, API_TIMEOUT } from '../constants';
import { V2ApiResponse } from '../types';

// ── 请求封装 ──

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  url: string;
  method?: HttpMethod;
  data?: any;
  params?: Record<string, any>;
}

type ApiEnvelope<T = any> = Partial<V2ApiResponse<T>> & {
  code: number | string;
  message?: string;
  error?: string;
  data?: T;
};

type RequestError = Error & {
  code?: number | string;
  statusCode?: number;
  errno?: number;
  body?: any;
};

let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

function onTokenRefreshed(newToken: string) {
  pendingRequests.forEach(({ resolve }) => resolve(newToken));
  pendingRequests = [];
}

function onTokenRefreshFailed(err: Error) {
  pendingRequests.forEach(({ reject }) => reject(err));
  pendingRequests = [];
}

function buildRequestUrl(url: string, params?: Record<string, any>) {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const searchParams = Object.entries(params).reduce((sp, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return sp;
    }
    sp.append(key, String(value));
    return sp;
  }, new URLSearchParams());

  const query = searchParams.toString();
  if (!query) {
    return url;
  }

  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`;
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object';
}

function hasOwn(value: Record<string, any>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function createRequestError(message: string, statusCode?: number, code?: number | string, body?: any): RequestError {
  const error = new Error(message) as RequestError;
  if (code !== undefined) {
    error.code = code;
  }
  if (statusCode) {
    error.statusCode = statusCode;
    error.errno = statusCode;
  }
  if (body !== undefined) {
    error.body = body;
  }
  return error;
}

function getResponseMessage(body: any, fallback: string) {
  if (isRecord(body)) {
    return String(body.message || body.error || fallback);
  }
  return fallback;
}

function unwrapResponseBody<T = any>(body: any): T {
  if (isRecord(body) && hasOwn(body, 'code')) {
    const envelope = body as ApiEnvelope<T>;
    const code = envelope.code as string | number;
    if (code === 'OK' || code === 0) {
      if (hasOwn(body, 'data')) {
        const payload = envelope.data;
        if (isRecord(payload) && hasOwn(body, 'meta')) {
          return { ...payload, meta: body.meta } as T;
        }
        return payload as T;
      }
      return body as T;
    }
    const numericCode = typeof envelope.code === 'number' ? envelope.code : undefined;
    throw createRequestError(envelope.message || envelope.error || '请求失败', numericCode, envelope.code, body);
  }

  // 兼容部分旧形态响应：HTTP 2xx 已成功，但响应体没有 code，只包了一层 data。
  return (isRecord(body) && hasOwn(body, 'data') ? body.data : body) as T;
}

function taroRequest(options: Taro.request.Option<any, any>) {
  return new Promise<Taro.request.SuccessCallbackResult<any>>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback();
    };

    const task = Taro.request({
      ...options,
      success: (res) => finish(() => resolve(res as Taro.request.SuccessCallbackResult<any>)),
      fail: (err) => finish(() => reject(err)),
    });

    timer = setTimeout(() => {
      task?.abort?.();
      finish(() => reject(new Error('请求超时，请检查网络连接后重试')));
    }, API_TIMEOUT + 1000);
  });
}

async function request<T = any>(opts: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, params } = opts;
  const baseURL = API_V2_BASE_URL;
  const token = store.getState().auth.accessToken;

  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  try {
    const fullUrl = buildRequestUrl(baseURL + url, params);
    console.warn('[API]', method, fullUrl);

    const res = await taroRequest({
      url: fullUrl,
      method,
      data,
      header,
      timeout: API_TIMEOUT,
    });

    console.warn('[API] response status:', res.statusCode);
    const body = res.data as any;

    if (res.statusCode === 401) {
      throw createRequestError(getResponseMessage(body, '登录已过期，请重新登录'), 401, undefined, body);
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw createRequestError(getResponseMessage(body, `请求失败(${res.statusCode})`), res.statusCode, isRecord(body) ? body.code : undefined, body);
    }

    return unwrapResponseBody<T>(body);
  } catch (error: any) {
    // 401 — 尝试刷新 token
    if (error?.statusCode === 401 || error?.errno === 401) {
      const refreshToken = store.getState().auth.refreshToken;

      if (!refreshToken) {
        store.dispatch(logout());
        throw error;
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (newToken: string) => {
              header['Authorization'] = `Bearer ${newToken}`;
              resolve(request<T>(opts));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await taroRequest({
          url: `${API_V2_BASE_URL}/auth/refresh-token`,
          method: 'POST',
          data: { refresh_token: refreshToken },
          header: { 'Content-Type': 'application/json' },
          timeout: API_TIMEOUT,
        });

        const refreshBody = refreshRes.data as any;
        const newTokens = refreshBody?.data?.token || refreshBody?.data;

        if (newTokens?.access_token) {
          store.dispatch(setTokens(newTokens));
          onTokenRefreshed(newTokens.access_token);
          header['Authorization'] = `Bearer ${newTokens.access_token}`;
          return request<T>(opts);
        }

        onTokenRefreshFailed(new Error('刷新令牌失败'));
        store.dispatch(logout());
        throw new Error('登录已过期，请重新登录');
      } catch (refreshError) {
        onTokenRefreshFailed(refreshError as Error);
        store.dispatch(logout());
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    // 网络错误
    if (error?.statusCode || error?.errno) {
      throw error;
    }
    const msg = error?.errMsg || error?.message || '网络请求失败';
    throw new Error(msg);
  }
}

// ── 简写方法 ──

export const apiV2 = {
  get: <T = any>(url: string, params?: Record<string, any>) =>
    request<T>({ url, method: 'GET', params }),

  post: <T = any>(url: string, data?: any) =>
    request<T>({ url, method: 'POST', data }),

  put: <T = any>(url: string, data?: any) =>
    request<T>({ url, method: 'PUT', data }),

  patch: <T = any>(url: string, data?: any) =>
    request<T>({ url, method: 'PATCH', data }),

  del: <T = any>(url: string) =>
    request<T>({ url, method: 'DELETE' }),

  delete: <T = any>(url: string) =>
    request<T>({ url, method: 'DELETE' }),
};

export default request;
