import { apiV1 as api } from './api';
import { formatUnknownEnumLabel } from '../utils';

export const insuranceService = {
  getMyPolicies: (params?: any) => api.get<any>('/insurance/my-policies', params),
  getMyClaims: (params?: any) => api.get<any>('/insurance/my-claims', params),
};

export const getPolicyTypeText = (type: string) => {
  const map: Record<string, string> = { liability: '第三者责任险', cargo: '货物险', hull: '机身险', accident: '飞手意外险' };
  return map[type] || formatUnknownEnumLabel(type, '其它险种');
};
export const getPolicyStatusText = (status: string) => {
  const map: Record<string, string> = { pending: '待支付', active: '生效中', expired: '已过期', cancelled: '已取消', claimed: '已理赔' };
  return map[status] || formatUnknownEnumLabel(status, '状态未知');
};
export const getClaimStatusText = (status: string) => {
  const map: Record<string, string> = { reported: '已报案', investigating: '调查中', liability_determined: '责任认定', approved: '核赔通过', rejected: '已拒赔', paid: '已赔付', closed: '已结案', disputed: '争议中' };
  return map[status] || formatUnknownEnumLabel(status, '状态未知');
};
