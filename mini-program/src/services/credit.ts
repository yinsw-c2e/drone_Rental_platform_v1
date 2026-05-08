import { apiV1 as api } from './api';
import { formatUnknownEnumLabel } from '../utils';

export const creditService = {
  getMyCreditScore: () => api.get<any>('/credit/my-score'),
  getMyViolations: (params?: any) => api.get<any>('/credit/my-violations', params),
  getMyDeposit: () => api.get<any>('/credit/my-deposit'),
};

export const getScoreLevelText = (level: string): string => {
  const map: Record<string, string> = { excellent: '优秀', good: '良好', normal: '正常', poor: '较差', bad: '极差' };
  return map[level] || formatUnknownEnumLabel(level, '等级未知');
};
export const getScoreLevelColor = (level: string): string => {
  const map: Record<string, string> = { excellent: '#52c41a', good: '#1890ff', normal: '#faad14', poor: '#ff7a45', bad: '#f5222d' };
  return map[level] || '#999';
};
export const getViolationLevelText = (level: string) => {
  const map: Record<string, string> = { minor: '轻微', moderate: '中等', serious: '严重', critical: '重大' };
  return map[level] || formatUnknownEnumLabel(level, '级别未知');
};
export const getViolationTypeText = (type: string) => {
  const map: Record<string, string> = { cancel_abuse: '恶意取消', no_show: '爽约', delay: '延误', damage: '损坏', fraud: '欺诈', unsafe_flight: '不安全飞行', policy_violation: '违反政策' };
  return map[type] || formatUnknownEnumLabel(type, '其它违规');
};
