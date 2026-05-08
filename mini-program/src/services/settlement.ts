import { apiV1 } from './api';

// ==================== 定价 API ====================

export const calculatePrice = async (data: any): Promise<any> => {
  const res: any = await apiV1.post('/settlement/calculate-price', data);
  return res.data || res;
};

// ==================== 结算 API ====================

export const getSettlement = async (id: number): Promise<any> => {
  const res: any = await apiV1.get(`/settlement/${id}`);
  return res.data || res;
};

export const getSettlementByOrder = async (orderId: number): Promise<any> => {
  const res: any = await apiV1.get(`/settlement/order/${orderId}`);
  return res.data || res;
};

export const listMySettlements = async (params?: {role?: string; page?: number; page_size?: number}): Promise<{data: any[]; total: number}> => {
  const res: any = await apiV1.get('/settlement/my', params);
  return {data: res.data?.list || res.list || res.data || [], total: res.data?.total || res.total || 0};
};

// ==================== 钱包 API ====================

export const getWallet = async (): Promise<any> => {
  const res: any = await apiV1.get('/settlement/wallet');
  return res.data || res;
};

export const getWalletTransactions = async (params?: {type?: string; page?: number; page_size?: number}): Promise<{data: any[]; total: number}> => {
  const res: any = await apiV1.get('/settlement/wallet/transactions', params);
  return {data: res.data?.list || res.list || res.data || [], total: res.data?.total || res.total || 0};
};

// ==================== 提现 API ====================

export const requestWithdrawal = async (data: any): Promise<any> => {
  const res: any = await apiV1.post('/settlement/withdrawal', data);
  return res.data || res;
};

export const listMyWithdrawals = async (page = 1, pageSize = 20): Promise<{data: any[]; total: number}> => {
  const res: any = await apiV1.get('/settlement/withdrawals', {page, page_size: pageSize});
  return {data: res.data?.list || res.list || res.data || [], total: res.data?.total || res.total || 0};
};
