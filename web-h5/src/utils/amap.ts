// 高德地图 JS API 加载器（基础实现，供非 H5 平台解析导入）。
// 真实实现见 amap.h5.ts —— 仅 H5 会注入高德 JS 脚本。

export function isAMapConfigured(): boolean {
  return false;
}

export function loadAMap(): Promise<any> {
  return Promise.reject(new Error('AMap JS API 仅在 H5 可用'));
}
