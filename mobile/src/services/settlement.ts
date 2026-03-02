import api from './api';

// ==================== 类型定义 ====================

export interface OrderSettlement {
  id: number;
  settlement_no: string;
  order_id: number;
  order_no: string;
  total_amount: number;
  base_fee: number;
  mileage_fee: number;
  duration_fee: number;
  weight_fee: number;
  difficulty_fee: number;
  insurance_fee: number;
  surge_pricing: number;
  coupon_discount: number;
  final_amount: number;
  platform_fee_rate: number;
  platform_fee: number;
  pilot_fee_rate: number;
  pilot_fee: number;
  owner_fee_rate: number;
  owner_fee: number;
  insurance_deduction: number;
  pilot_user_id: number;
  owner_user_id: number;
  payer_user_id: number;
  flight_distance: number;
  flight_duration: number;
  cargo_weight: number;
  difficulty_factor: number;
  cargo_value: number;
  insurance_rate: number;
  status: string;
  calculated_at: string;
  confirmed_at: string;
  settled_at: string;
  settled_by: string;
  notes: string;
  created_at: string;
  order?: any;
}

export interface UserWallet {
  id: number;
  user_id: number;
  wallet_type: string;
  available_balance: number;
  frozen_balance: number;
  total_income: number;
  total_withdrawn: number;
  total_frozen: number;
  status: string;
  created_at: string;
}

export interface WalletTransaction {
  id: number;
  transaction_no: string;
  wallet_id: number;
  user_id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  related_order_id: number;
  related_settlement_id: number;
  description: string;
  created_at: string;
}

export interface WithdrawalRecord {
  id: number;
  withdrawal_no: string;
  user_id: number;
  wallet_id: number;
  amount: number;
  service_fee: number;
  actual_amount: number;
  withdraw_method: string;
  bank_name: string;
  account_name: string;
  status: string;
  review_notes: string;
  completed_at: string;
  created_at: string;
}

export interface PricingResult {
  base_fee: number;
  mileage_fee: number;
  duration_fee: number;
  weight_fee: number;
  difficulty_fee: number;
  insurance_fee: number;
  sub_total: number;
  surge_pricing: number;
  total_amount: number;
  difficulty_factor: number;
  insurance_rate: number;
}

export interface PricingConfig {
  id: number;
  config_key: string;
  config_value: number;
  unit: string;
  description: string;
  category: string;
  is_active: boolean;
}

// ==================== 请求类型 ====================

export interface CalculatePriceRequest {
  flight_distance: number;
  flight_duration: number;
  cargo_weight: number;
  cargo_value?: number;
  cargo_type?: string;
  task_type?: string;
  is_night_flight?: boolean;
  is_peak_hour?: boolean;
  is_holiday?: boolean;
}

export interface WithdrawalRequest {
  amount: number;
  method: string;
  bank_name?: string;
  bank_branch?: string;
  account_no?: string;
  account_name?: string;
  alipay_account?: string;
  wechat_account?: string;
}

// ==================== 定价 API ====================

export const calculatePrice = async (data: CalculatePriceRequest): Promise<PricingResult> => {
  const res: any = await api.post('/settlement/calculate-price', data);
  return res.data;
};

// ==================== 结算 API ====================

export const getSettlement = async (id: number): Promise<OrderSettlement> => {
  const res: any = await api.get(`/settlement/${id}`);
  return res.data;
};

export const getSettlementByOrder = async (orderId: number): Promise<OrderSettlement> => {
  const res: any = await api.get(`/settlement/order/${orderId}`);
  return res.data;
};

export const listMySettlements = async (params?: {role?: string; page?: number; page_size?: number}): Promise<{data: OrderSettlement[]; total: number}> => {
  const res: any = await api.get('/settlement/my', {params});
  return {data: res.data, total: res.total};
};

// ==================== 钱包 API ====================

export const getWallet = async (): Promise<UserWallet> => {
  const res: any = await api.get('/settlement/wallet');
  return res.data;
};

export const getWalletTransactions = async (params?: {type?: string; page?: number; page_size?: number}): Promise<{data: WalletTransaction[]; total: number}> => {
  const res: any = await api.get('/settlement/wallet/transactions', {params});
  return {data: res.data, total: res.total};
};

// ==================== 提现 API ====================

export const requestWithdrawal = async (data: WithdrawalRequest): Promise<WithdrawalRecord> => {
  const res: any = await api.post('/settlement/withdrawal', data);
  return res.data;
};

export const listMyWithdrawals = async (page = 1, pageSize = 20): Promise<{data: WithdrawalRecord[]; total: number}> => {
  const res: any = await api.get('/settlement/withdrawals', {params: {page, page_size: pageSize}});
  return {data: res.data, total: res.total};
};
