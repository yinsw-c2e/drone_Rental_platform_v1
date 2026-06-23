// 高德地图 Web 端 JS API 按需加载器（H5）。
// Key / 安全密钥由构建期通过 defineConstants 注入（见 config/index.ts）。

const AMAP_KEY = typeof __H5_AMAP_KEY__ !== 'undefined' ? __H5_AMAP_KEY__ : '';
const AMAP_SECURITY_CODE = typeof __H5_AMAP_SECURITY_CODE__ !== 'undefined' ? __H5_AMAP_SECURITY_CODE__ : '';
const AMAP_VERSION = '2.0';
const AMAP_PLUGINS = ['AMap.PlaceSearch', 'AMap.Geocoder', 'AMap.Geolocation', 'AMap.ToolBar'];

let amapPromise: Promise<any> | null = null;

export function isAMapConfigured(): boolean {
  return Boolean(AMAP_KEY);
}

export function loadAMap(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window 不可用'));
  }
  if ((window as any).AMap) {
    return Promise.resolve((window as any).AMap);
  }
  if (amapPromise) {
    return amapPromise;
  }
  if (!AMAP_KEY) {
    return Promise.reject(new Error('AMAP_KEY_MISSING'));
  }

  // JS API 2.0 需要在脚本加载前配置安全密钥。
  if (AMAP_SECURITY_CODE) {
    (window as any)._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
  }

  amapPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=${AMAP_VERSION}&key=${AMAP_KEY}&plugin=${AMAP_PLUGINS.join(',')}`;
    script.onload = () => {
      if ((window as any).AMap) {
        resolve((window as any).AMap);
      } else {
        amapPromise = null;
        reject(new Error('AMAP_LOAD_FAILED'));
      }
    };
    script.onerror = () => {
      amapPromise = null;
      reject(new Error('AMAP_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return amapPromise;
}
