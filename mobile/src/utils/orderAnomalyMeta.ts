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
    case 'stalled_pending_dispatch':
      return '派单停滞';
    case 'execution_without_dispatch_task':
      return '缺少正式派单';
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
