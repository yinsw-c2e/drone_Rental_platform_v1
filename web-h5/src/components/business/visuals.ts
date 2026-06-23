// 色调调色板 — 复刻 RN visuals.ts
export type VisualTone = 'blue' | 'green' | 'red' | 'orange' | 'teal' | 'purple' | 'muted';

type TonePalette = { bg: string; border: string; text: string };

export const getTonePalette = (tone: VisualTone, isDark: boolean): TonePalette => {
  switch (tone) {
    case 'blue':
      return { bg: '#E6F4FF', border: '#91CAFF', text: '#1677FF' };
    case 'green':
      return { bg: '#F6FFED', border: '#B7EB8F', text: '#52C41A' };
    case 'red':
      return { bg: '#FFF1F0', border: '#FFA39E', text: '#F5222D' };
    case 'orange':
      return { bg: '#FFF7E6', border: '#FFD591', text: '#FA8C16' };
    case 'teal':
      return { bg: '#E6FFFB', border: '#87E8DE', text: '#13C2C2' };
    case 'purple':
      return { bg: '#F9F0FF', border: '#D3ADF7', text: '#722ED1' };
    case 'muted':
    default:
      return { bg: '#F5F5F5', border: '#D9D9D9', text: '#8C8C8C' };
  }
};

export interface BadgeMeta {
  label: string;
  tone: VisualTone;
}

const formatFallbackLabel = (key?: string) => {
  const text = String(key || '').trim();
  if (!text) return '状态未知';
  return /^[a-z0-9_:-]+$/i.test(text) ? '状态未知' : text;
};

const DEMAND_STATUS: Record<string, BadgeMeta> = {
  draft: { label: '草稿', tone: 'muted' },
  published: { label: '询价中', tone: 'blue' },
  quoting: { label: '询价中', tone: 'blue' },
  selected: { label: '已选定', tone: 'green' },
  converted_to_order: { label: '已转订单', tone: 'green' },
  cancelled: { label: '已撤销', tone: 'muted' },
  expired: { label: '已过期', tone: 'muted' },
  closed: { label: '已关闭', tone: 'muted' },
};

const ORDER_STATUS: Record<string, BadgeMeta> = {
  pending_provider_confirmation: { label: '待承接', tone: 'orange' },
  pending_payment: { label: '待支付', tone: 'orange' },
  confirmed: { label: '已确认', tone: 'blue' },
  in_transit: { label: '运输中', tone: 'teal' },
  delivered: { label: '待签收', tone: 'purple' },
  completed: { label: '已完成', tone: 'green' },
  cancelled: { label: '已取消', tone: 'muted' },
  provider_rejected: { label: '已拒绝', tone: 'red' },
};

const DISPATCH_STATUS: Record<string, BadgeMeta> = {
  pending: { label: '待派发', tone: 'muted' },
  pending_response: { label: '待确认', tone: 'orange' },
  accepted: { label: '已接受', tone: 'green' },
  rejected: { label: '已拒绝', tone: 'red' },
  in_progress: { label: '执行中', tone: 'blue' },
  completed: { label: '已完成', tone: 'green' },
  cancelled: { label: '已取消', tone: 'muted' },
};

export const getObjectStatusMeta = (kind: 'demand' | 'order' | 'dispatch' | string, key: string): BadgeMeta => {
  const fallback = { label: formatFallbackLabel(key), tone: 'muted' as const };
  if (kind === 'demand') return DEMAND_STATUS[key] || fallback;
  if (kind === 'order') return ORDER_STATUS[key] || fallback;
  if (kind === 'dispatch') return DISPATCH_STATUS[key] || fallback;
  return fallback;
};
