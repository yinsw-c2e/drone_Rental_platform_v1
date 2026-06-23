/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.scss';
declare module '*.sass';

declare const __API_BASE__: string;
declare const __H5_AMAP_KEY__: string;
declare const __H5_AMAP_SECURITY_CODE__: string;

// 高德地图 JS API 在 H5 运行时注入到 window 上。
interface Window {
  AMap?: any;
  _AMapSecurityConfig?: { securityJsCode?: string };
}
