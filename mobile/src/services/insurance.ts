import api from './api';

// ============================================================
// 类型定义
// ============================================================

export interface InsuranceProduct {
  id: number;
  product_code: string;
  product_name: string;
  policy_type: 'liability' | 'cargo' | 'hull' | 'accident';
  insurer_code: string;
  insurer_name: string;
  base_premium_rate: number;
  min_premium: number;
  max_coverage: number;
  min_coverage: number;
  deductible_rate: number;
  min_deductible: number;
  coverage_scope: string;
  exclusions: string;
  is_mandatory: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface InsurancePolicy {
  id: number;
  policy_no: string;
  policy_type: 'liability' | 'cargo' | 'hull' | 'accident';
  policy_category: 'mandatory' | 'optional';
  holder_id: number;
  holder_type: string;
  holder_name: string;
  holder_phone: string;
  insured_type: string;
  insured_id: number;
  insured_name: string;
  insured_value: number;
  coverage_amount: number;
  deductible_amount: number;
  premium_rate: number;
  premium: number;
  insurer_code: string;
  insurer_name: string;
  insurance_product: string;
  effective_from: string;
  effective_to: string;
  insurance_days: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled' | 'claimed';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InsuranceClaim {
  id: number;
  claim_no: string;
  policy_id: number;
  policy_no: string;
  order_id?: number;
  claimant_id: number;
  claimant_name: string;
  claimant_phone: string;
  incident_type: 'crash' | 'collision' | 'cargo_damage' | 'cargo_loss' | 'personal_injury' | 'third_party';
  incident_time: string;
  incident_location: string;
  incident_lat?: number;
  incident_lng?: number;
  incident_description: string;
  loss_type: 'property' | 'personal' | 'both';
  estimated_loss: number;
  actual_loss: number;
  claim_amount: number;
  approved_amount: number;
  deducted_amount: number;
  paid_amount: number;
  evidence_files?: string;
  liability_ratio: number;
  liability_party?: string;
  liability_reason?: string;
  status: 'reported' | 'investigating' | 'liability_determined' | 'approved' | 'rejected' | 'paid' | 'closed' | 'disputed';
  current_step: string;
  reported_at: string;
  investigated_at?: string;
  determined_at?: string;
  approved_at?: string;
  paid_at?: string;
  closed_at?: string;
  reject_reason?: string;
  created_at: string;
  updated_at: string;
  policy?: InsurancePolicy;
}

export interface ClaimTimeline {
  id: number;
  claim_id: number;
  action: string;
  description: string;
  operator_id: number;
  operator_type: string;
  operator_name: string;
  attachments?: string;
  remark?: string;
  created_at: string;
}

export interface PurchaseInsuranceRequest {
  product_code: string;
  holder_name: string;
  holder_id_card?: string;
  holder_phone: string;
  insured_type: string;
  insured_id?: number;
  insured_name?: string;
  insured_value?: number;
  coverage_amount: number;
  insurance_days: number;
  special_terms?: string;
}

export interface ReportClaimRequest {
  policy_id: number;
  order_id?: number;
  claimant_name: string;
  claimant_phone: string;
  incident_type: string;
  incident_time: string;
  incident_location: string;
  incident_lat?: number;
  incident_lng?: number;
  incident_description: string;
  loss_type: string;
  estimated_loss: number;
  evidence_files?: string;
}

// ============================================================
// API 方法
// ============================================================

// 保险产品
export const listProducts = (params?: { policy_type?: string; is_mandatory?: boolean }) =>
  api.get<InsuranceProduct[]>('/insurance/products', { params });

export const getMandatoryProducts = () =>
  api.get<InsuranceProduct[]>('/insurance/products/mandatory');

// 保险保单
export const purchaseInsurance = (data: PurchaseInsuranceRequest) =>
  api.post<InsurancePolicy>('/insurance/purchase', data);

export const getMyPolicies = (params?: { page?: number; page_size?: number }) =>
  api.get<{ list: InsurancePolicy[]; total: number }>('/insurance/my-policies', { params });

export const getPolicyDetail = (id: number) =>
  api.get<InsurancePolicy>(`/insurance/policies/${id}`);

export const activatePolicy = (id: number, paymentId: number) =>
  api.post(`/insurance/policies/${id}/activate?payment_id=${paymentId}`);

export const checkMandatoryInsurance = () =>
  api.get<Record<string, boolean>>('/insurance/check-mandatory');

// 理赔
export const reportClaim = (data: ReportClaimRequest) =>
  api.post<InsuranceClaim>('/insurance/claims/report', data);

export const getMyClaims = (params?: { page?: number; page_size?: number }) =>
  api.get<{ list: InsuranceClaim[]; total: number }>('/insurance/my-claims', { params });

export const getClaimDetail = (id: number) =>
  api.get<InsuranceClaim>(`/insurance/claims/${id}`);

export const getClaimTimelines = (id: number) =>
  api.get<ClaimTimeline[]>(`/insurance/claims/${id}/timelines`);

export const uploadEvidence = (claimId: number, evidenceType: string, evidenceFiles: string) =>
  api.post(`/insurance/claims/${claimId}/evidence`, { evidence_type: evidenceType, evidence_files: evidenceFiles });

export const disputeClaim = (claimId: number, reason: string) =>
  api.post(`/insurance/claims/${claimId}/dispute`, { reason });

// ============================================================
// 辅助函数
// ============================================================

export const getPolicyTypeText = (type: string): string => {
  const typeMap: Record<string, string> = {
    liability: '第三者责任险',
    cargo: '货物险',
    hull: '机身险',
    accident: '飞手意外险',
  };
  return typeMap[type] || type;
};

export const getPolicyStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: '待支付',
    active: '生效中',
    expired: '已过期',
    cancelled: '已取消',
    claimed: '已理赔',
  };
  return statusMap[status] || status;
};

export const getPolicyStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: '#faad14',
    active: '#52c41a',
    expired: '#999',
    cancelled: '#f5222d',
    claimed: '#1890ff',
  };
  return colorMap[status] || '#999';
};

export const getIncidentTypeText = (type: string): string => {
  const typeMap: Record<string, string> = {
    crash: '坠机',
    collision: '碰撞',
    cargo_damage: '货物损坏',
    cargo_loss: '货物丢失',
    personal_injury: '人身伤害',
    third_party: '第三方损失',
  };
  return typeMap[type] || type;
};

export const getClaimStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    reported: '已报案',
    investigating: '调查中',
    liability_determined: '责任认定',
    approved: '核赔通过',
    rejected: '已拒赔',
    paid: '已赔付',
    closed: '已结案',
    disputed: '争议中',
  };
  return statusMap[status] || status;
};

export const getClaimStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    reported: '#faad14',
    investigating: '#1890ff',
    liability_determined: '#722ed1',
    approved: '#52c41a',
    rejected: '#f5222d',
    paid: '#52c41a',
    closed: '#999',
    disputed: '#ff7a45',
  };
  return colorMap[status] || '#999';
};

export const formatAmount = (amount: number): string => {
  return '¥' + (amount / 100).toFixed(2);
};
