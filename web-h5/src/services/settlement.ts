import { apiV2 } from './api';

const normalizeListResponse = (res: any): { data: any[]; total: number } => {
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }

  const list =
    (Array.isArray(res?.list) && res.list) ||
    (Array.isArray(res?.data?.list) && res.data.list) ||
    (Array.isArray(res?.data) && res.data) ||
    [];

  return {
    data: list,
    total: Number(res?.total ?? res?.data?.total ?? list.length),
  };
};

// ==================== 定价 API ====================

export const calculatePrice = async (data: any): Promise<any> => {
  const res: any = await apiV2.post('/settlement/calculate-price', data);
  return res.data || res;
};

// ==================== 结算 API ====================

export const getSettlement = async (id: number): Promise<any> => {
  const res: any = await apiV2.get(`/settlement/${id}`);
  return res.data || res;
};

export const getSettlementByOrder = async (orderId: number): Promise<any> => {
  const res: any = await apiV2.get(`/settlement/order/${orderId}`);
  return res.data || res;
};

export const listMySettlements = async (params?: {role?: string; page?: number; page_size?: number}): Promise<{data: any[]; total: number}> => {
  const res: any = await apiV2.get('/settlement/my', params);
  return normalizeListResponse(res);
};

// ==================== 钱包 API ====================

export const getWallet = async (): Promise<any> => {
  const res: any = await apiV2.get('/settlement/wallet');
  return res.data || res;
};

export const getWalletTransactions = async (params?: {type?: string; page?: number; page_size?: number}): Promise<{data: any[]; total: number}> => {
  const res: any = await apiV2.get('/settlement/wallet/transactions', params);
  return normalizeListResponse(res);
};

// ==================== 提现 API ====================

export const requestWithdrawal = async (data: any): Promise<any> => {
  const res: any = await apiV2.post('/settlement/withdrawal', data);
  return res.data || res;
};

export const listMyWithdrawals = async (page = 1, pageSize = 20): Promise<{data: any[]; total: number}> => {
  const res: any = await apiV2.get('/settlement/withdrawals', {page, page_size: pageSize});
  return normalizeListResponse(res);
};
