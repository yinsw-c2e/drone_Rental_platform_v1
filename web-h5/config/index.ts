import { defineConfig } from '@tarojs/cli';
import path from 'path';

const resolveNodeModule = (pkg: string) => path.resolve(__dirname, '..', 'node_modules', pkg);
const isProductionBuild =
  process.env.MINI_PROGRAM_BUILD_ENV === 'production' ||
  process.argv.some((arg) => arg === 'production' || arg === '--mode=production');
const isH5 = process.env.TARO_ENV === 'h5';
const apiBase =
  process.env.MINI_PROGRAM_API_BASE ||
  (isProductionBuild ? 'https://swvictory.top/api/v2' : 'http://127.0.0.1:8080/api/v2');

// 高德地图 Web 端 JS API 凭证（仅 H5 使用，通过环境变量注入，不写死在源码）。
const amapKey = process.env.H5_AMAP_KEY || '';
const amapSecurityCode = process.env.H5_AMAP_SECURITY_CODE || '';

export default defineConfig({
  projectName: 'wurenji-mini',
  date: '2026-5-6',
  designWidth: 375,
  deviceRatio: {
    375: 2 / 1,
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: isH5 ? 'dist-h5' : 'dist',
  plugins: [
    '@tarojs/plugin-framework-react',
    ...(isH5 ? ['@tarojs/plugin-platform-h5'] : ['@tarojs/plugin-platform-weapp']),
  ],
  defineConstants: {
    __API_BASE__: JSON.stringify(apiBase),
    __PRESENCE_DEBUG__: JSON.stringify(!isProductionBuild),
    __H5_AMAP_KEY__: JSON.stringify(amapKey),
    __H5_AMAP_SECURITY_CODE__: JSON.stringify(amapSecurityCode),
  },
  copy: {
    // 原生自定义 TabBar 仅微信小程序使用；H5 用 src/custom-tab-bar/index.h5.tsx。
    patterns: isH5 ? [] : [
      { from: 'src/custom-tab-bar', to: 'dist/custom-tab-bar' },
    ],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: false,
  },
  mini: {
    compile: {
      include: [
        resolveNodeModule('@reduxjs/toolkit'),
        resolveNodeModule('immer'),
        resolveNodeModule('react-redux'),
        resolveNodeModule('redux'),
        resolveNodeModule('redux-thunk'),
        resolveNodeModule('reselect'),
        resolveNodeModule('use-sync-external-store'),
      ],
    },
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    // 用 hash 路由：静态托管/本地演示无需服务端 rewrite。
    router: {
      mode: 'hash',
    },
    devServer: {
      port: 3000,
      host: '0.0.0.0',
      open: false,
      // H5 dev 同源代理：前端走相对路径 /api、/uploads（同源），devServer 转发到本地后端 :8080，
      // 规避 localhost:3000 → 127.0.0.1:8080 的浏览器跨域（dev API base 在 config/dev.ts 设为 /api/v2）。
      proxy: {
        '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
        '/uploads': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      },
      // 关闭"编译告警"浮层（Sass @import 弃用告警等噪音），仅保留真正的错误浮层。
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
    },
    esbuild: {
      minify: {
        enable: isProductionBuild,
      },
    },
    postcss: {
      autoprefixer: {
        enable: true,
      },
      // 关闭 Taro 默认 pxtransform：它用同一 rootValue 同时换算 px(375基准) 与 rpx(750基准)，
      // 无法区分本项目混用的两套设计稿基准，导致 rpx 页面在 H5 被放大 2 倍。
      // 注意：禁用后自适应根字号脚本仍会注入（H5Combination 按名字读取该 option，不看 enable）。
      pxtransform: {
        enable: false,
      },
      // 自定义双单位换算：px→(N/20)rem、rpx→(N/40)rem，与小程序端渲染一致。
      './config/postcss-rpx-dual': {
        enable: true,
        config: { pxRoot: 20, rpxRoot: 40 },
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
});
