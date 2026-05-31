import {Platform} from 'react-native';
import Config from 'react-native-config';

// 安全获取 Config 值，防止 react-native-config 未正确初始化
const getConfig = (key: string): string | undefined => {
  try {
    return (Config as any)?.[key];
  } catch {
    return undefined;
  }
};

const shouldLogConfig = () => getConfig('DEBUG_MODE') === 'true' && getConfig('APP_ENV') !== 'production';

const logConfig = (...args: unknown[]) => {
  if (shouldLogConfig()) {
    console.log(...args);
  }
};

// ============================================================
// API 配置
// ============================================================

/**
 * 获取API基础地址
 * 优先使用环境变量配置，否则使用默认值
 */
const getApiBaseUrl = (): string => {
  // 优先使用环境变量（最高优先级）
  const apiBaseUrl = getConfig('API_BASE_URL');
  if (apiBaseUrl) {
    logConfig('[Config] Using API_BASE_URL from .env:', apiBaseUrl);
    return apiBaseUrl;
  }

  // 开发环境默认配置
  if (__DEV__) {
    // Android模拟器使用10.0.2.2访问宿主机localhost
    // iOS模拟器和Web直接使用localhost
    const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    const devUrl = `http://${devHost}:8080/api`;
    logConfig('[Config] Using DEV default:', devUrl);
    return devUrl;
  }

  // 生产环境默认地址
  return 'https://api.wurenji.com/api';
};

const toApiV2BaseUrl = (baseUrl: string): string => {
  const normalized = (baseUrl || '').replace(/\/+$/, '');
  if (/\/api\/v[12]$/.test(normalized)) {
    return normalized.replace(/\/api\/v[12]$/, '/api/v2');
  }
  if (/\/api$/.test(normalized)) {
    return `${normalized}/v2`;
  }
  return `${normalized}/api/v2`;
};

/**
 * 获取WebSocket连接地址
 * 优先使用环境变量配置，否则使用默认值
 */
const getWsBaseUrl = (): string => {
  // 优先使用环境变量（最高优先级）
  const wsBaseUrl = getConfig('WS_BASE_URL');
  if (wsBaseUrl) {
    logConfig('[Config] Using WS_BASE_URL from .env:', wsBaseUrl);
    return wsBaseUrl;
  }

  // 开发环境默认配置
  if (__DEV__) {
    const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    const devWsUrl = `ws://${devHost}:8080/ws`;
    logConfig('[Config] Using WS DEV default:', devWsUrl);
    return devWsUrl;
  }

  // 生产环境默认地址
  return 'wss://api.wurenji.com/ws';
};

// 导出配置常量
export const API_BASE_URL = getApiBaseUrl();
export const API_ROOT_URL = API_BASE_URL.replace(/\/api(?:\/v[12])?$/, '');
export const API_V2_BASE_URL = toApiV2BaseUrl(API_BASE_URL);
export const WS_BASE_URL = getWsBaseUrl();
export const API_TIMEOUT = parseInt(getConfig('API_TIMEOUT') || '15000', 10);

// 启动时打印最终配置（仅调试模式）
logConfig('='.repeat(60));
logConfig('[Config] APP Configuration Loaded');
logConfig('API_BASE_URL:', API_BASE_URL);
logConfig('API_ROOT_URL:', API_ROOT_URL);
logConfig('API_V2_BASE_URL:', API_V2_BASE_URL);
logConfig('WS_BASE_URL:', WS_BASE_URL);
logConfig('API_TIMEOUT:', API_TIMEOUT);
logConfig('Platform:', Platform.OS);
logConfig('__DEV__:', __DEV__);
logConfig('='.repeat(60));

// ============================================================
// 高德地图配置
// ============================================================
export const AMAP_CONFIG = {
  // Android SDK Key
  androidKey: getConfig('AMAP_ANDROID_KEY') || '',
  // iOS SDK Key
  iosKey: getConfig('AMAP_IOS_KEY') || '',
};

// ============================================================
// 推送服务配置
// ============================================================
export const PUSH_CONFIG = {
  // 极光推送AppKey
  appKey: getConfig('JPUSH_APP_KEY') || getConfig('JPUSH_APPKEY') || '',
  // 是否启用推送
  enabled: getConfig('PUSH_ENABLED') !== 'false',
};

// ============================================================
// 第三方登录配置
// ============================================================
export const THIRD_PARTY_LOGIN = {
  // 微信登录AppID
  wechatAppId: getConfig('WECHAT_APP_ID') || '',
  // iOS 微信登录 Universal Link，按环境从 .env 注入
  wechatUniversalLink: getConfig('WECHAT_UNIVERSAL_LINK') || '',
  // QQ登录AppID
  qqAppId: getConfig('QQ_APP_ID') || '',
};

// ============================================================
// 应用配置
// ============================================================
const APP_ENV = getConfig('APP_ENV') || (__DEV__ ? 'development' : 'production');
const IS_PRODUCTION_RUNTIME = APP_ENV === 'production' && !__DEV__;

export const APP_CONFIG = {
  // 应用环境
  env: APP_ENV,
  // 是否生产运行时
  isProductionRuntime: IS_PRODUCTION_RUNTIME,
  // 是否调试模式
  debugMode: !IS_PRODUCTION_RUNTIME && (getConfig('DEBUG_MODE') === 'true' || __DEV__),
  // 是否显示开发样本账号和诊断入口
  devToolsEnabled: !IS_PRODUCTION_RUNTIME && getConfig('DEV_TOOLS_ENABLED') !== 'false',
  // 是否允许模拟支付推进订单
  mockPaymentEnabled: !IS_PRODUCTION_RUNTIME && getConfig('MOCK_PAYMENT_ENABLED') !== 'false',
  // 是否显示推送验收/诊断工具，默认关闭，避免影响真实用户路径
  pushDebugToolsEnabled: getConfig('PUSH_DEBUG_TOOLS_ENABLED') === 'true',
  // 版本检查地址
  versionCheckUrl: getConfig('VERSION_CHECK_URL') || '',
};

// ============================================================
// 业务常量
// ============================================================

// 订单状态枚举
export const ORDER_STATUS = {
  created: '待确认',
  accepted: '已接受',
  rejected: '服务商已拒绝',
  paid: '已支付',
  in_progress: '正在运输',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
} as const;

// 服务类型枚举
export const SERVICE_TYPES = {
  rental: '无人机租赁',
  aerial_photo: '专业航拍',
  logistics: '重载运输',
  agriculture: '农林植保',
} as const;

// 货物类型枚举
export const CARGO_TYPES = {
  package: '包裹快递',
  equipment: '设备器材',
  material: '物资材料',
  other: '其他货物',
} as const;

// 无人机状态枚举
export const DRONE_STATUS = {
  available: '可用',
  rented: '已出租',
  maintenance: '维护中',
  offline: '离线',
} as const;

// 支付方式枚举
export const PAYMENT_METHODS = {
  wechat: '微信支付',
  alipay: '支付宝',
} as const;

// 用户认证状态
export const VERIFY_STATUS = {
  unverified: '未认证',
  pending: '审核中',
  verified: '已认证',
  rejected: '已拒绝',
} as const;
