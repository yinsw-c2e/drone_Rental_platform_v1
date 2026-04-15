export type VisualTone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'gray'
  | 'teal'
  | 'purple';

export type BusinessObjectKind =
  | 'demand'
  | 'quote'
  | 'supply'
  | 'order'
  | 'dispatch_task'
  | 'flight_record';

export type BusinessSourceKind =
  | 'demand'
  | 'quote'
  | 'supply'
  | 'order'
  | 'dispatch_task'
  | 'flight_record'
  | 'pilot_task'
  | 'client_task';

export type BadgeMeta = {
  label: string;
  tone: VisualTone;
};

type TonePalette = {
  bg: string;
  border: string;
  text: string;
};

const DARK_TONE_MAP: Record<VisualTone, TonePalette> = {
  blue:   {bg: 'rgba(0,132,255,0.12)',   border: 'rgba(0,132,255,0.3)',   text: '#4DA8FF'},
  green:  {bg: 'rgba(0,200,100,0.12)',   border: 'rgba(0,200,100,0.3)',   text: '#00E57A'},
  orange: {bg: 'rgba(255,160,0,0.12)',   border: 'rgba(255,160,0,0.3)',   text: '#FFB340'},
  red:    {bg: 'rgba(255,80,80,0.12)',    border: 'rgba(255,80,80,0.3)',    text: '#FF6B6B'},
  gray:   {bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)', text: '#8A9BC0'},
  teal:   {bg: 'rgba(0,212,255,0.10)',   border: 'rgba(0,212,255,0.28)',   text: '#00D4FF'},
  purple: {bg: 'rgba(123,97,255,0.12)',  border: 'rgba(123,97,255,0.3)',   text: '#A78BFF'},
};

const LIGHT_TONE_MAP: Record<VisualTone, TonePalette> = {
  blue:   {bg: '#e6f4ff', border: '#91caff', text: '#0958d9'},
  green:  {bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d'},
  orange: {bg: '#fff7e6', border: '#ffd591', text: '#d46b08'},
  red:    {bg: '#fff1f0', border: '#ffccc7', text: '#cf1322'},
  gray:   {bg: '#f5f5f5', border: '#d9d9d9', text: '#595959'},
  teal:   {bg: '#e6fffb', border: '#87e8de', text: '#08979c'},
  purple: {bg: '#f9f0ff', border: '#d3adf7', text: '#722ed1'},
};

export const getTonePalette = (tone: VisualTone, isDark = true): TonePalette =>
  isDark ? DARK_TONE_MAP[tone] : LIGHT_TONE_MAP[tone];

const DEMAND_STATUS: Record<string, BadgeMeta> = {
  draft: {label: '草稿', tone: 'gray'},
  published: {label: '已发布', tone: 'blue'},
  quoting: {label: '报价中', tone: 'orange'},
  selected: {label: '已选方案', tone: 'green'},
  converted_to_order: {label: '已转订单', tone: 'green'},
  matched: {label: '已匹配', tone: 'green'},
  cancelled: {label: '已取消', tone: 'gray'},
  expired: {label: '已过期', tone: 'red'},
  closed: {label: '已关闭', tone: 'gray'},
};

const SUPPLY_STATUS: Record<string, BadgeMeta> = {
  draft: {label: '草稿', tone: 'gray'},
  active: {label: '上架中', tone: 'green'},
  paused: {label: '已暂停', tone: 'orange'},
  closed: {label: '已关闭', tone: 'gray'},
};

const QUOTE_STATUS: Record<string, BadgeMeta> = {
  submitted: {label: '已提交', tone: 'blue'},
  selected: {label: '已选中', tone: 'green'},
  rejected: {label: '未中选', tone: 'red'},
  expired: {label: '已过期', tone: 'gray'},
  cancelled: {label: '已撤回', tone: 'gray'},
};

const ORDER_STATUS: Record<string, BadgeMeta> = {
  created: {label: '待确认', tone: 'orange'},
  accepted: {label: '待支付', tone: 'blue'},
  pending_provider_confirmation: {label: '待机主确认', tone: 'orange'},
  provider_rejected: {label: '机主已拒绝', tone: 'red'},
  pending_payment: {label: '待支付', tone: 'blue'},
  paid: {label: '已支付', tone: 'green'},
  pending_dispatch: {label: '待派单', tone: 'orange'},
  assigned: {label: '已分配', tone: 'green'},
  confirmed: {label: '已确认接单', tone: 'green'},
  airspace_applying: {label: '申请空域中', tone: 'blue'},
  airspace_approved: {label: '空域已批准', tone: 'green'},
  loading: {label: '装货中', tone: 'blue'},
  in_transit: {label: '运输中', tone: 'blue'},
  delivered: {label: '已送达', tone: 'green'},
  completed: {label: '已完成', tone: 'green'},
  cancelled: {label: '已取消', tone: 'gray'},
  refunded: {label: '已退款', tone: 'gray'},
  rejected: {label: '已拒绝', tone: 'red'},
};

const DISPATCH_STATUS: Record<string, BadgeMeta> = {
  pending: {label: '待响应', tone: 'orange'},
  pending_response: {label: '待响应', tone: 'orange'},
  notified: {label: '请确认接单', tone: 'orange'},
  matching: {label: '匹配中', tone: 'blue'},
  dispatching: {label: '派单中', tone: 'blue'},
  assigned: {label: '已指派', tone: 'green'},
  accepted: {label: '已接单', tone: 'green'},
  confirmed: {label: '已确认接单', tone: 'green'},
  executing: {label: '执行中', tone: 'blue'},
  in_progress: {label: '执行中', tone: 'blue'},
  rejected: {label: '已拒绝', tone: 'red'},
  expired: {label: '已过期', tone: 'gray'},
  exception: {label: '异常回退', tone: 'red'},
  completed: {label: '已完成', tone: 'green'},
  finished: {label: '已完成', tone: 'green'},
};

const FLIGHT_RECORD_STATUS: Record<string, BadgeMeta> = {
  pending: {label: '待起飞', tone: 'orange'},
  created: {label: '待起飞', tone: 'orange'},
  executing: {label: '执行中', tone: 'blue'},
  in_progress: {label: '执行中', tone: 'blue'},
  completed: {label: '已完成', tone: 'green'},
  finished: {label: '已完成', tone: 'green'},
  failed: {label: '异常结束', tone: 'red'},
};

const SOURCE_META: Record<BusinessSourceKind, BadgeMeta> = {
  demand: {label: '任务', tone: 'blue'},
  quote: {label: '报价', tone: 'purple'},
  supply: {label: '服务', tone: 'teal'},
  order: {label: '订单', tone: 'blue'},
  dispatch_task: {label: '执行安排', tone: 'green'},
  flight_record: {label: '飞行记录', tone: 'purple'},
  pilot_task: {label: '飞手任务', tone: 'orange'},
  client_task: {label: '执行任务', tone: 'green'},
};

export const getObjectStatusMeta = (
  kind: BusinessObjectKind,
  status?: string | null,
): BadgeMeta => {
  const key = String(status || '').toLowerCase();
  const fallback: BadgeMeta = {label: key || '未知状态', tone: 'gray'};
  if (kind === 'demand') return DEMAND_STATUS[key] || fallback;
  if (kind === 'quote') return QUOTE_STATUS[key] || fallback;
  if (kind === 'supply') return SUPPLY_STATUS[key] || fallback;
  if (kind === 'order') return ORDER_STATUS[key] || fallback;
  if (kind === 'dispatch_task') return DISPATCH_STATUS[key] || fallback;
  if (kind === 'flight_record') return FLIGHT_RECORD_STATUS[key] || {label: key || '飞行记录', tone: 'purple'};
  return {label: '已留痕', tone: 'purple'};
};

export const getSourceMeta = (source: BusinessSourceKind): BadgeMeta =>
  SOURCE_META[source];

export const getDemandUrgencyMeta = (urgency?: string | null): BadgeMeta | null => {
  const key = String(urgency || '').toLowerCase();
  if (key === 'urgent' || key === 'high') {
    return {label: '紧急', tone: 'red'};
  }
  if (key === 'normal' || key === 'medium') {
    return {label: '普通', tone: 'gray'};
  }
  return null;
};

export const getFlightRecordPurposeMeta = (purpose?: string | null): BadgeMeta => {
  const key = String(purpose || '').toLowerCase();
  if (key === 'cargo_delivery') return {label: '货运履约', tone: 'purple'};
  if (key === 'inspection') return {label: '巡检', tone: 'teal'};
  if (key === 'mapping') return {label: '测绘', tone: 'blue'};
  return {label: '飞行记录', tone: 'purple'};
};
