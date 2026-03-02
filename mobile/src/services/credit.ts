import api from './api';

// ============================================================
// 类型定义
// ============================================================

export interface CreditScore {
  id: number;
  user_id: number;
  user_type: 'pilot' | 'owner' | 'client';
  total_score: number;
  score_level: 'excellent' | 'good' | 'normal' | 'poor' | 'bad';
  // 飞手维度
  pilot_qualification: number;
  pilot_service: number;
  pilot_safety: number;
  pilot_activity: number;
  // 机主维度
  owner_compliance: number;
  owner_service: number;
  owner_fulfillment: number;
  owner_attitude: number;
  // 业主维度
  client_identity: number;
  client_payment: number;
  client_attitude: number;
  client_order_quality: number;
  // 统计
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  dispute_orders: number;
  average_rating: number;
  total_reviews: number;
  positive_reviews: number;
  negative_reviews: number;
  violation_count: number;
  last_violation_at?: string;
  // 状态
  is_frozen: boolean;
  frozen_reason?: string;
  frozen_at?: string;
  is_blacklisted: boolean;
  blacklisted_reason?: string;
  blacklisted_at?: string;
  last_calculated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditScoreLog {
  id: number;
  user_id: number;
  change_type: 'order_complete' | 'review_received' | 'violation' | 'bonus' | 'penalty' | 'recalculate';
  change_reason: string;
  dimension: string;
  score_before: number;
  score_after: number;
  score_change: number;
  related_order_id?: number;
  related_review_id?: number;
  operator_id: number;
  operator_type: 'system' | 'admin' | 'auto';
  notes?: string;
  created_at: string;
}

export interface Violation {
  id: number;
  violation_no: string;
  user_id: number;
  user_type: string;
  order_id?: number;
  violation_type: 'cancel_abuse' | 'no_show' | 'delay' | 'damage' | 'fraud' | 'unsafe_flight' | 'policy_violation';
  violation_level: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  evidence?: string;
  penalty: 'warning' | 'score_deduct' | 'freeze_temp' | 'freeze_perm' | 'blacklist';
  penalty_detail?: string;
  score_deduction: number;
  freeze_days: number;
  fine_amount: number;
  appeal_status: 'none' | 'pending' | 'approved' | 'rejected';
  appeal_content?: string;
  appeal_at?: string;
  appeal_reviewed_by?: number;
  appeal_reviewed_at?: string;
  appeal_result?: string;
  status: 'pending' | 'confirmed' | 'appealing' | 'revoked';
  confirmed_by?: number;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskControl {
  id: number;
  risk_no: string;
  user_id: number;
  user_type: string;
  order_id?: number;
  risk_phase: 'pre' | 'during' | 'post';
  risk_type: 'identity_fraud' | 'payment_risk' | 'behavior_abnormal' | 'dispute' | 'violation' | 'blacklist';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  trigger_rule?: string;
  trigger_data?: string;
  description: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  action: 'none' | 'warn' | 'freeze' | 'blacklist' | 'block_order' | 'require_deposit';
  action_detail?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  review_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Blacklist {
  id: number;
  user_id: number;
  user_type: string;
  blacklist_type: 'temporary' | 'permanent';
  reason: string;
  related_violation_id?: number;
  expire_at?: string;
  added_by: number;
  added_at: string;
  removed_by?: number;
  removed_at?: string;
  removed_reason?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deposit {
  id: number;
  deposit_no: string;
  user_id: number;
  user_type: string;
  required_amount: number;
  paid_amount: number;
  frozen_amount: number;
  refunded_amount: number;
  status: 'pending' | 'paid' | 'partial' | 'frozen' | 'refunding' | 'refunded';
  paid_at?: string;
  refunded_at?: string;
  payment_id?: number;
  require_reason?: string;
  refund_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditStatistics {
  level_distribution: Array<{ score_level: string; count: number }>;
  frozen_users: number;
  blacklisted_users: number;
  pending_violations: number;
  pending_risks: number;
  pending_appeals: number;
}

export interface RiskCheckResult {
  risk_detected: boolean;
  message?: string;
  risk?: RiskControl;
}

// ============================================================
// API 方法
// ============================================================

// 信用分
export const getMyCreditScore = () => api.get<CreditScore>('/credit/my-score');

export const getUserCreditScore = (userId: number) => 
  api.get<CreditScore>(`/credit/user/${userId}`);

export const getMyCreditLogs = (params?: { change_type?: string; page?: number; page_size?: number }) =>
  api.get<{ list: CreditScoreLog[]; total: number }>('/credit/my-logs', { params });

export const listCreditScores = (params?: { user_type?: string; score_level?: string; page?: number; page_size?: number }) =>
  api.get<{ list: CreditScore[]; total: number }>('/credit/scores', { params });

// 违规
export const getMyViolations = (params?: { status?: string; page?: number; page_size?: number }) =>
  api.get<{ list: Violation[]; total: number }>('/credit/my-violations', { params });

export const listViolations = (params?: { user_id?: number; violation_type?: string; violation_level?: string; status?: string; page?: number; page_size?: number }) =>
  api.get<{ list: Violation[]; total: number }>('/credit/violations', { params });

export const getViolationDetail = (id: number) => api.get<Violation>(`/credit/violations/${id}`);

export const submitAppeal = (violationId: number, content: string) =>
  api.post(`/credit/violations/${violationId}/appeal`, { content });

// 风控
export const preOrderRiskCheck = (userId: number, orderId?: number) =>
  api.get<RiskCheckResult>('/credit/risk-check', { params: { user_id: userId, order_id: orderId } });

export const listRiskControls = (params?: { user_id?: number; risk_phase?: string; risk_type?: string; status?: string; page?: number; page_size?: number }) =>
  api.get<{ list: RiskControl[]; total: number }>('/credit/risks', { params });

export const getRiskControlDetail = (id: number) => api.get<RiskControl>(`/credit/risks/${id}`);

// 黑名单
export const listBlacklists = (params?: { blacklist_type?: string; is_active?: boolean; page?: number; page_size?: number }) =>
  api.get<{ list: Blacklist[]; total: number }>('/credit/blacklists', { params });

// 保证金
export const getMyDeposit = () => api.get<Deposit>('/credit/my-deposit');

export const listDeposits = (params?: { user_type?: string; status?: string; page?: number; page_size?: number }) =>
  api.get<{ list: Deposit[]; total: number }>('/credit/deposits', { params });

// 统计
export const getCreditStatistics = () => api.get<CreditStatistics>('/credit/statistics');

// 辅助函数
export const getScoreLevelText = (level: string): string => {
  const levelMap: Record<string, string> = {
    excellent: '优秀',
    good: '良好',
    normal: '正常',
    poor: '较差',
    bad: '极差',
  };
  return levelMap[level] || level;
};

export const getScoreLevelColor = (level: string): string => {
  const colorMap: Record<string, string> = {
    excellent: '#52c41a',
    good: '#1890ff',
    normal: '#faad14',
    poor: '#ff7a45',
    bad: '#f5222d',
  };
  return colorMap[level] || '#999';
};

export const getViolationTypeText = (type: string): string => {
  const typeMap: Record<string, string> = {
    cancel_abuse: '恶意取消',
    no_show: '爽约',
    delay: '延误',
    damage: '损坏',
    fraud: '欺诈',
    unsafe_flight: '不安全飞行',
    policy_violation: '违反政策',
  };
  return typeMap[type] || type;
};

export const getViolationLevelText = (level: string): string => {
  const levelMap: Record<string, string> = {
    minor: '轻微',
    moderate: '中等',
    serious: '严重',
    critical: '重大',
  };
  return levelMap[level] || level;
};

export const getRiskLevelText = (level: string): string => {
  const levelMap: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '极高风险',
  };
  return levelMap[level] || level;
};

export const getRiskLevelColor = (level: string): string => {
  const colorMap: Record<string, string> = {
    low: '#52c41a',
    medium: '#faad14',
    high: '#ff7a45',
    critical: '#f5222d',
  };
  return colorMap[level] || '#999';
};
