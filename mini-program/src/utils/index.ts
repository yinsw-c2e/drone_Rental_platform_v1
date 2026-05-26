// 工具函数 — 从 mobile/src/utils/demandMeta 和 supplyMeta 迁移

const isBackendEnumLike = (value?: string | null): boolean => {
  const text = String(value || '').trim();
  return /^[a-z0-9_:-]+$/i.test(text) && /[a-z]/i.test(text);
};

export const formatUnknownEnumLabel = (value?: string | null, fallback = '状态未知'): string => {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return isBackendEnumLike(text) ? fallback : text;
};

export const CARGO_SCENE_LABELS: Record<string, string> = {
  power_grid: '电网建设',
  grid_power_material_transport: '电网物资运输',
  power_grid_material: '电网物资',
  power_grid_material_transport: '电网物资运输',
  mountain_agriculture: '山区农副产品',
  mountain_agri: '山区吊运',
  plateau_supply: '高原给养',
  island_supply: '海岛补给',
  emergency: '应急救援',
  emergency_relief: '应急救援',
  other_heavy_lift: '其他重载',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  heavy_cargo_lift_transport: '重载吊运',
  rental: '无人机租赁',
  drone_rental: '无人机租赁',
  aerial_photo: '专业航拍',
  logistics: '重载运输',
  agriculture: '农林植保',
};

export const formatDemandBudget = (budgetMin?: number, budgetMax?: number): string => {
  if (!budgetMin && !budgetMax) return '-';
  if (budgetMin && budgetMax) return `¥${(budgetMin / 100).toFixed(0)} ~ ¥${(budgetMax / 100).toFixed(0)}`;
  const val = budgetMin || budgetMax;
  return `¥${(val! / 100).toFixed(0)}`;
};

export const resolveDemandPrimaryAddress = (demand: any): string => {
  return demand?.departure_address?.text || demand?.service_address_text || demand?.service_address?.text || '-';
};

export const formatDemandSchedule = (start?: string, end?: string): string => {
  if (!start) return '-';
  const fmt = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return end ? `${fmt(start)} ~ ${fmt(end)}` : fmt(start);
};

export const formatTripCount = (count?: number): string => {
  if (!count || count <= 0) return '待确认';
  return `${count} 架次`;
};

export const getDemandSceneLabel = (scene?: string): string => {
  const key = String(scene || '').trim();
  if (!key) return '重载吊运';
  return CARGO_SCENE_LABELS[key] || formatUnknownEnumLabel(key, '其它场景');
};

export const formatAmountYuan = (amount?: number): string => {
  if (!amount) return '¥0.00';
  return `¥${(amount / 100).toFixed(2)}`;
};

export const summarizeFlexibleValue = (val?: any, fallback = '-'): string => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  return fallback;
};

export const getSupplySceneLabel = (scene?: string): string => {
  return getDemandSceneLabel(scene);
};

export const getServiceTypeLabel = (serviceType?: string): string => {
  const key = String(serviceType || '').trim();
  if (!key) return '服务类型待确认';
  return SERVICE_TYPE_LABELS[key] || formatUnknownEnumLabel(key, '其它服务');
};

export const summarizeServiceArea = (snapshot?: any): string => {
  if (!snapshot) return '-';
  return snapshot.region || snapshot.text || '-';
};

export const formatSupplyPricing = (amount?: number, unit?: string): string => {
  const unitMap: Record<string, string> = {
    per_trip: '/架次',
    per_km: '/公里',
    per_hour: '/小时',
    per_kg: '/公斤',
  };
  return `¥${((amount || 0) / 100).toFixed(2)}${unitMap[unit || ''] || ''}`;
};

export const getObjectStatusMeta = (objectType: string, status?: string): { label: string; color?: string; tone?: string } => {
  const statusStr = String(status || '').toLowerCase();
  const orderLabels: Record<string, string> = {
    created: '待确认',
    accepted: '已承接',
    confirmed: '已确认',
    pending_provider_confirmation: '待确认',
    pending_payment: '待付款',
    paid: '已支付',
    pending_dispatch: '待开始履约',
    assigned: '服务商已接单',
    preparing: '准备中',
    airspace_applying: '空域申请中',
    airspace_approved: '空域已通过',
    loading: '装载中',
    in_transit: '运输中',
    delivered: '已投送',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
    provider_rejected: '服务商已拒绝',
  };
  const demandLabels: Record<string, string> = {
    draft: '草稿',
    open: '招募中',
    published: '已发布',
    quoting: '询价中',
    selected: '已选定',
    converted_to_order: '已转订单',
    cancelled: '已撤销',
    expired: '已过期',
    closed: '已结束',
  };
  const supplyLabels: Record<string, string> = {
    draft: '草稿',
    active: '生效中',
    paused: '已暂停',
    closed: '已关闭',
  };
  const dispatchLabels: Record<string, string> = {
    pending_response: '待响应',
    accepted: '已接单',
    rejected: '已拒绝',
    expired: '已过期',
    executing: '执行中',
    finished: '已完成',
  };
  const orderTones: Record<string, string> = {
    created: 'orange',
    accepted: 'blue',
    confirmed: 'blue',
    pending_provider_confirmation: 'orange',
    pending_payment: 'orange',
    paid: 'blue',
    pending_dispatch: 'orange',
    assigned: 'blue',
    preparing: 'blue',
    airspace_applying: 'blue',
    airspace_approved: 'blue',
    loading: 'blue',
    in_transit: 'teal',
    delivered: 'green',
    completed: 'green',
    cancelled: 'gray',
    refunded: 'gray',
    provider_rejected: 'red',
  };
  const demandTones: Record<string, string> = {
    draft: 'gray',
    open: 'blue',
    published: 'blue',
    quoting: 'orange',
    selected: 'green',
    converted_to_order: 'green',
    cancelled: 'gray',
    expired: 'gray',
    closed: 'gray',
  };
  const supplyTones: Record<string, string> = {
    draft: 'gray',
    active: 'green',
    paused: 'orange',
    closed: 'gray',
  };
  const dispatchTones: Record<string, string> = {
    pending_response: 'orange',
    accepted: 'blue',
    rejected: 'gray',
    expired: 'gray',
    executing: 'teal',
    finished: 'green',
  };

  let label: string;
  let tone: string | undefined;
  switch (objectType) {
    case 'order':
      label = orderLabels[statusStr] || formatUnknownEnumLabel(status, '状态未知');
      tone = orderTones[statusStr] || 'gray';
      break;
    case 'demand':
      label = demandLabels[statusStr] || formatUnknownEnumLabel(status, '状态未知');
      tone = demandTones[statusStr] || 'gray';
      break;
    case 'supply':
      label = supplyLabels[statusStr] || formatUnknownEnumLabel(status, '状态未知');
      tone = supplyTones[statusStr] || 'gray';
      break;
    case 'dispatch':
    case 'dispatch_task':
      label = dispatchLabels[statusStr] || formatUnknownEnumLabel(status, '状态未知');
      tone = dispatchTones[statusStr] || 'gray';
      break;
    default:
      label = formatUnknownEnumLabel(status, '状态未知');
      tone = 'gray';
  }
  return { label, tone };
};

export { getObjectStatusMeta as getObjectStatusMetaFn };

export {
  buildFallbackRoleSummary,
  canEnterMode,
  canUseProviderWorkbench,
  getEffectiveRoleSummary,
  resolveProviderCapabilities,
} from './roleSummary';
