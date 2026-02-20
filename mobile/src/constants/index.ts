import {Platform} from 'react-native';
import Config from 'react-native-config';

// ============================================================
// API 配置
// ============================================================

/**
 * 获取API基础地址
 * 优先使用环境变量配置，否则使用默认值
 */
const getApiBaseUrl = (): string => {
  // 优先使用环境变量
  if (Config.API_BASE_URL) {
    return Config.API_BASE_URL;
  }

  // 开发环境默认配置
  if (__DEV__) {
    // Android模拟器使用10.0.2.2访问宿主机localhost
    // iOS模拟器和Web直接使用localhost
    const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${devHost}:8080/api/v1`;
  }

  // 生产环境默认地址
  return 'https://api.wurenji.com/api/v1';
};

/**
 * 获取WebSocket连接地址
 * 优先使用环境变量配置，否则使用默认值
 */
const getWsBaseUrl = (): string => {
  // 优先使用环境变量
  if (Config.WS_BASE_URL) {
    return Config.WS_BASE_URL;
  }

  // 开发环境默认配置
  if (__DEV__) {
    const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `ws://${devHost}:8080/ws`;
  }

  // 生产环境默认地址
  return 'wss://api.wurenji.com/ws';
};

// 导出配置常量
export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();
export const API_TIMEOUT = parseInt(Config.API_TIMEOUT || '15000', 10);

// ============================================================
// 高德地图配置
// ============================================================
export const AMAP_CONFIG = {
  // Android SDK Key
  androidKey: Config.AMAP_ANDROID_KEY || '',
  // iOS SDK Key
  iosKey: Config.AMAP_IOS_KEY || '',
};

// ============================================================
// 推送服务配置
// ============================================================
export const PUSH_CONFIG = {
  // 极光推送AppKey
  appKey: Config.JPUSH_APP_KEY || '',
  // 是否启用推送
  enabled: Config.PUSH_ENABLED === 'true',
};

// ============================================================
// 第三方登录配置
// ============================================================
export const THIRD_PARTY_LOGIN = {
  // 微信登录AppID
  wechatAppId: Config.WECHAT_APP_ID || '',
  // QQ登录AppID
  qqAppId: Config.QQ_APP_ID || '',
};

// ============================================================
// 应用配置
// ============================================================
export const APP_CONFIG = {
  // 应用环境
  env: Config.APP_ENV || (__DEV__ ? 'development' : 'production'),
  // 是否调试模式
  debugMode: Config.DEBUG_MODE === 'true' || __DEV__,
  // 版本检查地址
  versionCheckUrl: Config.VERSION_CHECK_URL || '',
};

// ============================================================
// 业务常量
// ============================================================

// 订单状态枚举
export const ORDER_STATUS = {
  created: '待接单',
  accepted: '已接单',
  rejected: '已拒绝',
  paid: '已支付',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
} as const;

// 服务类型枚举
export const SERVICE_TYPES = {
  rental: '整机租赁',
  aerial_photo: '航拍服务',
  logistics: '物流运输',
  agriculture: '农业植保',
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
