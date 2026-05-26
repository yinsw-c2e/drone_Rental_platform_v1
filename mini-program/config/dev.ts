import { defineConfig } from '@tarojs/cli';

export default defineConfig(({}) => {
  const apiBase = process.env.MINI_PROGRAM_API_BASE || 'http://127.0.0.1:8080/api/v2';
  return {
    defineConstants: {
      __API_BASE__: JSON.stringify(apiBase),
    },
  };
});
