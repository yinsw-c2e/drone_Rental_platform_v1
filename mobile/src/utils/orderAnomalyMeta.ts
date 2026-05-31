import {V2OrderAnomaly} from '../types';

export const getAnomalySeverityTone = (severity?: string) => {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    default:
      return 'blue';
  }
};

export const getAnomalySeverityLabel = (severity?: string) => {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return '严重异常';
    case 'warning':
      return '异常提醒';
    default:
      return '信息提示';
  }
};

export const getAnomalyTypeLabel = (anomalyType?: string) => {
  switch (String(anomalyType || '').toLowerCase()) {
    case 'payment_overdue':
      return '支付逾期';
    case 'provider_confirmation_overdue':
      return '服务商确认超时';
    case 'dispatch_overdue':
      return '履约开始超时';
    case 'dispatch_response_overdue':
      return '履约确认超时';
    case 'execution_stalled':
      return '履约停滞';
    case 'airspace_blocked':
      return '空域受阻';
    case 'compliance_risk':
      return '合规风险';
    case 'refund_requested':
      return '退款申请';
    case 'dispute_open':
      return '售后争议';
    case 'abnormal_track':
      return '轨迹异常';
    case 'stalled_pending_dispatch':
      return '派单停滞';
    case 'execution_without_dispatch_task':
      return '缺少执行安排';
    case 'provider_rejected_missing_reason':
      return '拒单原因缺失';
    case 'missing_source_supply':
      return '直达来源缺失';
    case 'missing_demand_source':
      return '需求来源缺失';
    case 'completed_missing_timestamp':
      return '完成时间缺失';
    default:
      return anomalyType || '订单异常';
  }
};

export const buildOrderAnomalyLookup = (items?: V2OrderAnomaly[] | null) => {
  const lookup: Record<number, V2OrderAnomaly> = {};
  (items || []).forEach(item => {
    if (!item?.order_id) {
      return;
    }
    const existing = lookup[item.order_id];
    if (!existing) {
      lookup[item.order_id] = item;
      return;
    }
    const currentWeight = item.severity === 'critical' ? 3 : item.severity === 'warning' ? 2 : 1;
    const existingWeight = existing.severity === 'critical' ? 3 : existing.severity === 'warning' ? 2 : 1;
    if (currentWeight > existingWeight) {
      lookup[item.order_id] = item;
    }
  });
  return lookup;
};
