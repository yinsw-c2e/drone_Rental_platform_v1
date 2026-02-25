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
    console.log('[Config] Using API_BASE_URL from .env:', apiBaseUrl);
    return apiBaseUrl;
  }

  // 开发环境默认配置
  if (__DEV__) {
    // 远程测试：使用 cpolar 内网穿透（用于远程用户测试）
    const HARDCODED_CPOLAR_URL = 'https://77e3f1d8.r3.cpolar.cn/api/v1';
    const USE_CPOLAR = true; // 改为false使用局域网
    
    if (USE_CPOLAR && HARDCODED_CPOLAR_URL) {
      console.log('[Config] Using cpolar URL for remote testing:', HARDCODED_CPOLAR_URL);
      return HARDCODED_CPOLAR_URL;
    }
    
    // 本地真机测试：使用电脑局域网IP（手机和电脑在同一WiFi）
    const LOCAL_NETWORK_IP = '192.168.3.173';
    if (LOCAL_NETWORK_IP) {
      const localUrl = `http://${LOCAL_NETWORK_IP}:8080/api/v1`;
      console.log('[Config] Using local network IP for real device testing:', localUrl);
      return localUrl;
    }
    
    // Android模拟器使用10.0.2.2访问宿主机localhost
    // iOS模拟器和Web直接使用localhost
    const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    const devUrl = `http://${devHost}:8080/api/v1`;
    console.log('[Config] Using DEV default:', devUrl);
    return devUrl;
  }

  // 生产环境默认地址
  console.log('[Config] Using production default');
  return 'https://api.wurenji.com/api/v1';
};

/**
 * 获取WebSocket连接地址
 * 优先使用环境变量配置，否则使用默认值
 */
const getWsBaseUrl = (): string => {
  // 优先使用环境变量（最高优先级）
  const wsBaseUrl = getConfig('WS_BASE_URL');
  if (wsBaseUrl) {
    console.log('[Config] Using WS_BASE_URL from .env:', wsBaseUrl);
    return wsBaseUrl;
  }

  // 开发环境默认配置
  if (__DEV__) {
    // 远程测试：使用 cpolar 内网穿透
    const HARDCODED_CPOLAR_WS_URL = 'wss://68aa0ac9.r3.cpolar.cn/ws';
    const USE_CPOLAR = true; // 改为false使用局域网
    
    if (USE_CPOLAR && HARDCODED_CPOLAR_WS_URL) {
      console.log('[Config] Using cpolar WS URL for remote testing:', HARDCODED_CPOLAR_WS_URL);
      return HARDCODED_CPOLAR_WS_URL;
    }
    
    // 本地真机测试：使用电脑局域网IP
    const LOCAL_NETWORK_IP = '192.168.3.173';
    if (LOCAL_NETWORK_IP) {
      const localWsUrl = `ws://${LOCAL_NETWORK_IP}:8080/ws`;
      console.log('[Config] Using local network IP for WS:', localWsUrl);
      return localWsUrl;
    }
    
    const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    const devWsUrl = `ws://${devHost}:8080/ws`;
    console.log('[Config] Using WS DEV default:', devWsUrl);
    return devWsUrl;
  }

  // 生产环境默认地址
  console.log('[Config] Using WS production default');
  return 'wss://api.wurenji.com/ws';
};

// 导出配置常量
export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();
export const API_TIMEOUT = parseInt(getConfig('API_TIMEOUT') || '15000', 10);

// 启动时打印最终配置（方便调试）
console.log('='.repeat(60));
console.log('📱 APP Configuration Loaded:');
console.log('API_BASE_URL:', API_BASE_URL);
console.log('WS_BASE_URL:', WS_BASE_URL);
console.log('API_TIMEOUT:', API_TIMEOUT);
console.log('='.repeat(60));

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
  appKey: getConfig('JPUSH_APP_KEY') || '',
  // 是否启用推送
  enabled: getConfig('PUSH_ENABLED') === 'true',
};

// ============================================================
// 第三方登录配置
// ============================================================
export const THIRD_PARTY_LOGIN = {
  // 微信登录AppID
  wechatAppId: getConfig('WECHAT_APP_ID') || '',
  // QQ登录AppID
  qqAppId: getConfig('QQ_APP_ID') || '',
};

// ============================================================
// 应用配置
// ============================================================
export const APP_CONFIG = {
  // 应用环境
  env: getConfig('APP_ENV') || (__DEV__ ? 'development' : 'production'),
  // 是否调试模式
  debugMode: getConfig('DEBUG_MODE') === 'true' || __DEV__,
  // 版本检查地址
  versionCheckUrl: getConfig('VERSION_CHECK_URL') || '',
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
