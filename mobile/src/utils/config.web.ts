/**
 * react-native-config Web 端替代实现
 * 从环境变量或默认值中读取配置
 */

// 从 import.meta.env 读取 Vite 环境变量
const Config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws',
  API_TIMEOUT: import.meta.env.VITE_API_TIMEOUT || '15000',
  AMAP_ANDROID_KEY: import.meta.env.VITE_AMAP_ANDROID_KEY || '',
  AMAP_IOS_KEY: import.meta.env.VITE_AMAP_IOS_KEY || '',
  JPUSH_APP_KEY: import.meta.env.VITE_JPUSH_APP_KEY || '',
  PUSH_ENABLED: import.meta.env.VITE_PUSH_ENABLED || 'false',
  WECHAT_APP_ID: import.meta.env.VITE_WECHAT_APP_ID || '',
  QQ_APP_ID: import.meta.env.VITE_QQ_APP_ID || '',
  APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE || 'true',
  VERSION_CHECK_URL: import.meta.env.VITE_VERSION_CHECK_URL || '',
};

export default Config;
