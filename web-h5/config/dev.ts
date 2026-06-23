import { defineConfig } from '@tarojs/cli';

export default defineConfig(({}) => {
  // H5 dev 默认走同源相对路径 /api/v2，由 devServer 代理（见 config/index.ts）转发到本地后端，
  // 规避 localhost:3000 → 127.0.0.1:8080 的浏览器跨域。weapp 仍直连 :8080。
  // 需要时可用 MINI_PROGRAM_API_BASE 环境变量临时覆盖。仅 dev 生效，不影响 build-h5（prod）。
  const isH5 = process.env.TARO_ENV === 'h5';
  const apiBase =
    process.env.MINI_PROGRAM_API_BASE ||
    (isH5 ? '/api/v2' : 'http://127.0.0.1:8080/api/v2');
  return {
    defineConstants: {
      __API_BASE__: JSON.stringify(apiBase),
      __PRESENCE_DEBUG__: JSON.stringify(true),
    },
  };
});
