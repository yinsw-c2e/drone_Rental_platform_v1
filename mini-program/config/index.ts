import { defineConfig } from '@tarojs/cli';
import path from 'path';

const resolveNodeModule = (pkg: string) => path.resolve(__dirname, '..', 'node_modules', pkg);
const isProductionBuild =
  process.env.MINI_PROGRAM_BUILD_ENV === 'production' ||
  process.argv.some((arg) => arg === 'production' || arg === '--mode=production');
const apiBase =
  process.env.MINI_PROGRAM_API_BASE ||
  (isProductionBuild ? 'https://dronerentalplat.cpolar.top/api/v2' : 'http://127.0.0.1:8080/api/v2');

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
  outputRoot: 'dist',
  plugins: [
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-platform-weapp',
  ],
  defineConstants: {
    __API_BASE__: JSON.stringify(apiBase),
    __PRESENCE_DEBUG__: JSON.stringify(!isProductionBuild),
  },
  copy: {
    patterns: [
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
});
