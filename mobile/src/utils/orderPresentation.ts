import {getObjectStatusMeta} from '../components/business/visuals';

export const formatOrderStatusLabel = (status?: string | null): string =>
  getObjectStatusMeta('order', status).label;

export const formatContractStatusLabel = (status?: string | null): string => {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return '待签署';
    case 'client_signed':
      return '甲方已签署';
    case 'provider_signed':
      return '乙方已签署';
    case 'fully_signed':
      return '双方已签署';
    default:
      return '合同处理中';
  }
};

export const formatOrderCancelReason = (reason?: string | null): string => {
  const normalized = String(reason || '').trim().toLowerCase();
  switch (normalized) {
    case '':
      return '未填写';
    case 'duplicate direct order cleanup':
      return '系统已自动取消重复下单的订单';
    case 'phase10 prepare reset':
    case 'codex verification cleanup':
      return '系统已清理测试订单';
    default:
      return String(reason || '').trim();
  }
};

export const formatRefundStatusLabel = (status?: string | null): string => {
  switch (String(status || '').toLowerCase()) {
    case 'success':
    case 'completed':
      return '已退款';
    case 'processing':
      return '退款处理中';
    case 'pending':
      return '待处理';
    case 'failed':
      return '退款失败';
    default:
      return '处理中';
  }
};

export const formatDisputeStatusLabel = (status?: string | null): string => {
  switch (String(status || '').toLowerCase()) {
    case 'open':
      return '待处理';
    case 'processing':
      return '处理中';
    case 'resolved':
      return '已解决';
    case 'closed':
      return '已关闭';
    case 'rejected':
      return '已驳回';
    default:
      return '处理中';
  }
};
