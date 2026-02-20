/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_AMAP_ANDROID_KEY?: string;
  readonly VITE_AMAP_IOS_KEY?: string;
  readonly VITE_JPUSH_APP_KEY?: string;
  readonly VITE_PUSH_ENABLED?: string;
  readonly VITE_WECHAT_APP_ID?: string;
  readonly VITE_QQ_APP_ID?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_DEBUG_MODE?: string;
  readonly VITE_VERSION_CHECK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
