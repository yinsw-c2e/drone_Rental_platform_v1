// ── API 配置 ──

// __API_BASE__ 由 Taro defineConstants 注入（config/dev.ts / config/prod.ts）
const BASE = (typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : '') as string;
const DEFAULT_API_BASE = 'https://v1.swvictory.com/api/v2';

export const API_BASE_URL = BASE || DEFAULT_API_BASE;
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/v[12]$/, '');
export const API_V2_BASE_URL = API_ROOT_URL + '/api/v2';
export const API_TIMEOUT = 15000;

// ── 业务常量 ──

export const ORDER_STATUS: Record<string, string> = {
  created: '待确认',
  accepted: '已接受',
  rejected: '服务商已拒绝',
  paid: '已支付',
  in_progress: '正在运输',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
};

export const SERVICE_TYPES: Record<string, string> = {
  heavy_cargo_lift_transport: '重载吊运',
  drone_rental: '无人机租赁',
  rental: '无人机租赁',
  aerial_photo: '专业航拍',
  logistics: '重载运输',
  agriculture: '农林植保',
};

export const CARGO_TYPES: Record<string, string> = {
  package: '包裹快递',
  equipment: '设备器材',
  material: '物资材料',
  other: '其他货物',
};

export const DRONE_STATUS: Record<string, string> = {
  available: '可用',
  rented: '已出租',
  maintenance: '维护中',
  offline: '离线',
};

export const PAYMENT_METHODS: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
};

export const VERIFY_STATUS: Record<string, string> = {
  unverified: '未认证',
  pending: '审核中',
  verified: '已认证',
  rejected: '已拒绝',
};
