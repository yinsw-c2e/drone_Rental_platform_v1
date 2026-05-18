import dayjs from 'dayjs';

export type StatusMeta = { text: string; color: string };

export const STATUS_META: Record<string, StatusMeta> = {
  draft: { text: '草稿', color: 'default' },
  published: { text: '询价中', color: 'processing' },
  quoting: { text: '询价中', color: 'processing' },
  selected: { text: '已选定', color: 'gold' },
  converted_to_order: { text: '已转订单', color: 'purple' },
  active: { text: '上架中', color: 'green' },
  paused: { text: '已暂停', color: 'orange' },
  closed: { text: '已关闭', color: 'default' },
  created: { text: '待确认', color: 'default' },
  accepted: { text: '待支付', color: 'gold' },
  pending_provider_confirmation: { text: '待承接', color: 'processing' },
  pending_payment: { text: '待支付', color: 'gold' },
  paid: { text: '已支付', color: 'green' },
  pending_dispatch: { text: '待派单', color: 'cyan' },
  assigned: { text: '已分配', color: 'blue' },
  airspace_applying: { text: '申请空域中', color: 'processing' },
  airspace_approved: { text: '空域已批准', color: 'green' },
  loading: { text: '装货中', color: 'processing' },
  in_transit: { text: '运输中', color: 'processing' },
  in_progress: { text: '运输中', color: 'processing' },
  delivered: { text: '待签收', color: 'gold' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
  refunded: { text: '已退款', color: 'purple' },
  rejected: { text: '已拒绝', color: 'red' },
  provider_rejected: { text: '已拒绝', color: 'red' },
  pending: { text: '待处理', color: 'gold' },
  pending_review: { text: '待审核', color: 'gold' },
  pending_response: { text: '待响应', color: 'gold' },
  processing: { text: '处理中', color: 'processing' },
  success: { text: '已完成', color: 'green' },
  failed: { text: '异常', color: 'red' },
  calculated: { text: '已计算', color: 'blue' },
  confirmed: { text: '待执行', color: 'gold' },
  settled: { text: '已结算', color: 'green' },
  disputed: { text: '争议中', color: 'orange' },
  executing: { text: '执行中', color: 'processing' },
  finished: { text: '已完成', color: 'green' },
  timeout: { text: '已超时', color: 'red' },
  reported: { text: '已报案', color: 'gold' },
  investigating: { text: '调查中', color: 'processing' },
  liability_determined: { text: '责任已认定', color: 'blue' },
  approved: { text: '已通过', color: 'green' },
  submitted_to_uom: { text: '已提交UOM', color: 'blue' },
  open: { text: '处理中', color: 'processing' },
  resolved: { text: '已解决', color: 'green' },
  blocked: { text: '已拦截', color: 'red' },
  ignored: { text: '已忽略', color: 'default' },
  excellent: { text: '优秀', color: 'green' },
  good: { text: '良好', color: 'blue' },
  normal: { text: '正常', color: 'default' },
  poor: { text: '较差', color: 'orange' },
  bad: { text: '风险', color: 'red' },
  verified: { text: '已认证', color: 'green' },
  unverified: { text: '未认证', color: 'default' },
  warning: { text: '预警', color: 'orange' },
  critical: { text: '严重', color: 'red' },
};

export const SCENE_LABELS: Record<string, string> = {
  power_grid: '电网巡检',
  mountain_agriculture: '山区农运',
  plateau_supply: '高原补给',
  island_supply: '海岛运输',
  emergency: '应急救援',
  cargo_delivery: '货运吊运',
  agriculture: '农业作业',
  mapping: '测绘巡检',
  inspection: '巡检作业',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  mock: '测试通道',
  balance: '余额支付',
  bank_card: '银行卡',
};

export const getStatusMeta = (status?: string): StatusMeta => {
  if (!status) return { text: '-', color: 'default' };
  return STATUS_META[status] || { text: status, color: 'default' };
};

export const formatMoney = (value?: number | string | null) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `¥${(n / 100).toFixed(2)}`;
};

export const formatTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : value;
};

export const formatBool = (value?: boolean | null) => {
  if (value === true) return '是';
  if (value === false) return '否';
  return '-';
};

export const formatValue = (value: any): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return formatBool(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) || /^\d{4}-\d{2}-\d{2} /.test(value)) {
      return formatTime(value);
    }
    return value;
  }
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(' / ') : '-';
  if (typeof value === 'object') {
    return value.text || value.address || value.name || value.title || value.order_no || value.demand_no || value.supply_no || JSON.stringify(value);
  }
  return String(value);
};

export const exportCsv = (filename: string, rows: any[]) => {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).filter(key => typeof rows[0][key] !== 'object');
  const escape = (value: any) => `"${String(formatValue(value)).replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
