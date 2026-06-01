import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ============================================================
// API 配置
// ============================================================

// 从环境变量获取API配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '15000', 10);

const isLocalAdminHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const configuredApiPrefix = import.meta.env.VITE_API_PREFIX || '/api/v2';
const API_PREFIX =
  import.meta.env.DEV && isLocalAdminHost && configuredApiPrefix === '/api/v1'
    ? '/api/v2'
    : configuredApiPrefix;

const localDevApiBaseURL = import.meta.env.VITE_LOCAL_API_BASE_URL || 'http://127.0.0.1:8080';
const resolvedApiBaseURL =
  import.meta.env.DEV && isLocalAdminHost ? localDevApiBaseURL : API_BASE_URL;

// 本地管理端直接连本地后端，避免 localhost:3000 通过 .env 代理到 cpolar 后出现旧部署 500。
const baseURL = import.meta.env.DEV && isLocalAdminHost
  ? `${resolvedApiBaseURL}${API_PREFIX}`
  : import.meta.env.DEV
    ? API_PREFIX
    : `${resolvedApiBaseURL}${API_PREFIX}`;

// 创建Axios实例
const api = axios.create({
  baseURL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isV1SuccessCode = (code: unknown) => code === 0;
const isV2SuccessCode = (code: unknown) => code === 'OK';
const isSuccessCode = (code: unknown) => isV1SuccessCode(code) || isV2SuccessCode(code);

const extractTokenPair = (payload: any) => {
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
    if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'code') && !isSuccessCode(data?.code)) {
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

          if (isSuccessCode(response.data?.code)) {
            const tokens = extractTokenPair(response.data?.data);
            if (!tokens) {
              throw new Error('refresh token response invalid');
            }
            const { access_token, refresh_token: newRefreshToken } = tokens;
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

    const payload = error.response?.data as any;
    const message =
      payload?.message ||
      payload?.error ||
      error.message ||
      '请求失败';

    return Promise.reject(new Error(message));
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
  
  approveCertification: (id: number, approved: boolean, opts?: { force?: boolean; overrideReason?: string }) =>
    api.put(`/admin/drones/${id}/certification`, {
      approved,
      force: opts?.force ?? false,
      override_reason: opts?.overrideReason ?? '',
    }),

  approveUOM: (id: number, approved: boolean) =>
    api.put(`/admin/drones/${id}/uom`, { approved }),

  approveInsurance: (id: number, approved: boolean) =>
    api.put(`/admin/drones/${id}/insurance`, { approved }),

  approveAirworthiness: (id: number, approved: boolean) =>
    api.put(`/admin/drones/${id}/airworthiness`, { approved }),
  
  // ========== 飞手管理 ==========
  getPilots: (params?: {
    page?: number;
    page_size?: number;
    verification_status?: string;
  }) => api.get('/admin/pilots', { params }),

  verifyPilot: (id: number, approved: boolean, note?: string) =>
    api.put(`/admin/pilots/${id}/verify`, { approved, note }),

  approvePilotCriminalCheck: (id: number, approved: boolean) =>
    api.put(`/admin/pilots/${id}/criminal-check`, { approved }),

  approvePilotHealthCheck: (id: number, approved: boolean) =>
    api.put(`/admin/pilots/${id}/health-check`, { approved }),

  // ========== 服务商入驻审核（聚合视图） ==========
  // 与小程序端 role_summary.provider 同口径,一处看到资产(机主)和执行(飞手)两条线的进度。
  getProviders: (params?: { page?: number; page_size?: number }) =>
    api.get('/admin/providers', { params }),

  // ========== 客户管理 ==========
  getClients: (params?: {
    page?: number;
    page_size?: number;
    client_type?: string; // individual / enterprise
    verification_status?: string;     // pending / verified / rejected
  }) => api.get('/admin/clients', { params }),

  verifyClient: (id: number, approved: boolean, note?: string) =>
    api.put(`/admin/clients/${id}/verify`, { approved, note }),

  // ========== 货物申报管理 ==========
  getCargoDeclarations: (params?: {
    page?: number;
    page_size?: number;
    compliance_status?: string; // pending / approved / rejected
  }) => api.get('/client/admin/cargo/pending', { params }),

  approveCargoDeclaration: (id: number, note?: string) =>
    api.post(`/client/admin/cargo/approve/${id}`, { note: note || '' }),

  rejectCargoDeclaration: (id: number, note: string) =>
    api.post(`/client/admin/cargo/reject/${id}`, { note }),

  // ========== 订单管理 ==========
  getOrders: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/admin/orders', { params }),
  
  getOrderDetail: (id: number) =>
    api.get(`/admin/orders/detail/${id}`),

  // ========== 需求管理 ==========
  getDemands: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    cargo_scene?: string;
    keyword?: string;
  }) => api.get('/admin/demands', { params }),

  getDemandDetail: (id: number) =>
    api.get(`/admin/demands/detail/${id}`),

  // ========== 供给管理 ==========
  getSupplies: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    cargo_scene?: string;
    keyword?: string;
  }) => api.get('/admin/supplies', { params }),

  getSupplyDetail: (id: number) =>
    api.get(`/admin/supplies/detail/${id}`),

  // ========== 正式派单管理 ==========
  getDispatchTasks: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    dispatch_source?: string;
    keyword?: string;
  }) => api.get('/admin/dispatch-tasks', { params }),

  getDispatchTaskDetail: (id: number) =>
    api.get(`/admin/dispatch-tasks/detail/${id}`),

  // ========== 飞行记录管理 ==========
  getFlightRecords: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    keyword?: string;
  }) => api.get('/admin/flight-records', { params }),

  getFlightRecordDetail: (id: number) =>
    api.get(`/admin/flight-records/detail/${id}`),

  // ========== 迁移审计与异常订单 ==========
  getMigrationAudits: (params?: {
    page?: number;
    page_size?: number;
    severity?: string;
    resolution_status?: string;
    issue_type?: string;
    audit_stage?: string;
    keyword?: string;
  }) => api.get('/admin/migration-audits', { params }),

  getMigrationAuditSummary: () => api.get('/admin/migration-audits/summary'),

  getOrderAnomalies: (params?: {
    page?: number;
    page_size?: number;
    anomaly_type?: string;
    severity?: string;
    status?: string;
    keyword?: string;
  }) => api.get('/admin/orders/anomalies', { params }),

  getOrderAnomalySummary: () => api.get('/admin/orders/anomalies/summary'),

  // ========== 支付管理 ==========
  getPayments: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/admin/payments', { params }),
  
  getRefunds: (params?: Record<string, unknown>) => api.get('/admin/refunds', { params }),
  getFinanceOverview: () => api.get('/settlement/admin/overview'),
  getSettlements: (params?: Record<string, unknown>) => api.get('/settlement/admin/list', { params }),
  confirmSettlement: (id: number) => api.post(`/settlement/admin/${id}/confirm`),
  executeSettlement: (id: number, note?: string) => api.post(`/settlement/admin/execute/${id}`, { note }),
  markSettlementDisputed: (id: number, reason: string) => api.post(`/settlement/admin/${id}/dispute`, { reason }),
  resolveSettlementDispute: (id: number, payload: {
    resolution: string;
    next_status?: string;
    platform_fee?: number;
    pilot_fee?: number;
    owner_fee?: number;
    insurance_deduction?: number;
  }) => api.post(`/settlement/admin/${id}/resolve-dispute`, payload),
  exportSettlementCsv: (params?: Record<string, unknown>) =>
    api.get('/settlement/admin/export/settlements', { params, responseType: 'blob' }),
  exportWithdrawalCsv: (params?: Record<string, unknown>) =>
    api.get('/settlement/admin/export/withdrawals', { params, responseType: 'blob' }),
  processPendingSettlements: () => api.post('/settlement/admin/process-pending'),
  getWithdrawals: (params?: Record<string, unknown>) => api.get('/settlement/admin/withdrawals', { params }),
  approveWithdrawal: (id: number, note?: string) => api.post(`/settlement/admin/withdrawal/${id}/approve`, { note }),
  rejectWithdrawal: (id: number, reason: string) => api.post(`/settlement/admin/withdrawal/${id}/reject`, { reason }),
  getFinanceAnomalies: (params?: Record<string, unknown>) => api.get('/settlement/admin/anomalies', { params }),
  resolveFinanceAnomaly: (id: number, note: string) => api.post(`/settlement/admin/anomalies/${id}/resolve`, { note }),
  getFinanceManualActions: (params?: Record<string, unknown>) => api.get('/settlement/admin/manual-actions', { params }),
  rollbackFinanceManualAction: (id: number, note: string) => api.post(`/settlement/admin/manual-actions/${id}/rollback`, { note }),
  getPricingConfigs: () => api.get('/admin/pricing-configs'),
  updatePricingConfig: (key: string, value: number, note?: string) => api.put(`/admin/pricing-configs/${key}`, { value, note }),

  // ========== 空域飞行 ==========
  getAirspaceApplications: (params?: Record<string, unknown>) => api.get('/admin/airspace-applications', { params }),
  reviewAirspaceApplication: (id: number, approved: boolean, note?: string) =>
    api.post(`/admin/airspace-applications/${id}/review`, { approved, note }),
  submitAirspaceToUOM: (id: number) => api.post(`/admin/airspace-applications/${id}/submit-uom`),
  getNoFlyZones: (params?: Record<string, unknown>) => api.get('/admin/no-fly-zones', { params }),
  createNoFlyZone: (payload: Record<string, unknown>) => api.post('/admin/no-fly-zones', payload),
  deleteNoFlyZone: (id: number) => api.delete(`/admin/no-fly-zones/${id}`),
  getComplianceChecks: (params?: Record<string, unknown>) => api.get('/admin/compliance-checks', { params }),

  // ========== 风控合规 ==========
  getCreditScores: (params?: Record<string, unknown>) => api.get('/admin/credit-scores', { params }),
  getCreditStatistics: () => api.get('/admin/credit/statistics'),
  getViolations: (params?: Record<string, unknown>) => api.get('/admin/violations', { params }),
  confirmViolation: (id: number) => api.post(`/admin/violations/${id}/confirm`),
  reviewViolationAppeal: (id: number, approved: boolean, result: string) =>
    api.post(`/admin/violations/${id}/review-appeal`, { approved, result }),
  getRiskControls: (params?: Record<string, unknown>) => api.get('/admin/risk-controls', { params }),
  reviewRiskControl: (id: number, action: string, notes?: string) =>
    api.post(`/admin/risk-controls/${id}/review`, { action, notes }),
  getBlacklists: (params?: Record<string, unknown>) => api.get('/admin/blacklists', { params }),
  getDeposits: (params?: Record<string, unknown>) => api.get('/admin/deposits', { params }),

  // ========== 保险合同评价 ==========
  getInsuranceProducts: (params?: Record<string, unknown>) => api.get('/admin/insurance-products', { params }),
  getInsurancePolicies: (params?: Record<string, unknown>) => api.get('/admin/insurance-policies', { params }),
  getInsuranceClaims: (params?: Record<string, unknown>) => api.get('/admin/insurance-claims', { params }),
  getInsuranceClaimTimeline: (id: number) => api.get(`/admin/insurance-claims/${id}/timeline`),
  startInsuranceInvestigation: (id: number) => api.post(`/admin/insurance-claims/${id}/investigate`),
  determineInsuranceLiability: (id: number, payload: Record<string, unknown>) =>
    api.post(`/admin/insurance-claims/${id}/liability`, payload),
  approveInsuranceClaim: (id: number, approvedAmount: number, note?: string) =>
    api.post(`/admin/insurance-claims/${id}/approve`, { approved_amount: approvedAmount, note }),
  rejectInsuranceClaim: (id: number, reason: string) =>
    api.post(`/admin/insurance-claims/${id}/reject`, { reason }),
  payInsuranceClaim: (id: number, paidAmount: number) =>
    api.post(`/admin/insurance-claims/${id}/pay`, { paid_amount: paidAmount }),
  closeInsuranceClaim: (id: number) => api.post(`/admin/insurance-claims/${id}/close`),
  getInsuranceStatistics: () => api.get('/admin/insurance/statistics'),
  getContracts: (params?: Record<string, unknown>) => api.get('/admin/contracts', { params }),
  getReviews: (params?: Record<string, unknown>) => api.get('/admin/reviews', { params }),
  getDisputes: (params?: Record<string, unknown>) => api.get('/admin/disputes', { params }),
  getAdminLogs: (params?: Record<string, unknown>) => api.get('/admin/admin-logs', { params }),

  // ========== 数据分析 ==========
  // 实时看板
  getRealtimeDashboard: () => api.get('/analytics/dashboard/realtime'),
  refreshDashboard: () => api.post('/analytics/dashboard/refresh'),
  getOverview: () => api.get('/analytics/overview'),
  
  // 趋势数据
  getTrendData: (days: number = 7) => api.get(`/analytics/trends?days=${days}`),
  
  // 每日统计
  getDailyStatistics: (date?: string) => api.get('/analytics/daily', { params: { date } }),
  getDailyStatisticsRange: (start: string, end: string) => 
    api.get('/analytics/daily/range', { params: { start, end } }),
  
  // 小时指标
  getHourlyMetrics: (hours: number = 24) => api.get(`/analytics/hourly?hours=${hours}`),
  
  // 热力图
  getHeatmapData: (type: string, date?: string) => 
    api.get('/analytics/heatmap', { params: { type, date } }),
  
  // 区域统计
  getRegionStatistics: (date?: string) => api.get('/analytics/regions', { params: { date } }),
  getTopRegions: (date?: string, limit: number = 10) => 
    api.get('/analytics/regions/top', { params: { date, limit } }),
  
  // 报表管理
  getReportList: (params?: { type?: string; page?: number; page_size?: number }) => 
    api.get('/analytics/reports', { params }),
  getReport: (id: number) => api.get(`/analytics/report/${id}`),
  getReportByNo: (reportNo: string) => api.get(`/analytics/report/no/${reportNo}`),
  getLatestReport: (type: string) => api.get(`/analytics/report/latest/${type}`),
  generateReport: (reportType: string, startDate: string, endDate: string) => 
    api.post('/analytics/report/generate', { 
      report_type: reportType, 
      start_date: startDate, 
      end_date: endDate 
    }),
  deleteReport: (id: number) => api.delete(`/analytics/report/${id}`),
  
  // 管理员任务
  triggerDailyJob: () => api.post('/analytics/admin/job/daily'),
  triggerHourlyJob: () => api.post('/analytics/admin/job/hourly'),
  triggerAutoReportJob: () => api.post('/analytics/admin/job/report'),
};

// ============================================================
// 导出配置常量供其他模块使用
// ============================================================
export const CONFIG = {
  API_BASE_URL,
  RESOLVED_API_BASE_URL: resolvedApiBaseURL,
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
