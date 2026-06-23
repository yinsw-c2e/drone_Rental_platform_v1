import { defineConfig } from '@tarojs/cli';

export default defineConfig(({}) => {
  const apiBase = process.env.MINI_PROGRAM_API_BASE || 'https://v1.swvictory.com/api/v2';
  return {
    defineConstants: {
      __API_BASE__: JSON.stringify(apiBase),
      __PRESENCE_DEBUG__: JSON.stringify(false),
    },
    mini: {
      minifyWXML: {
        collapseWhitespace: true,
        keepClosingSlash: true,
      },
    },
  };
});
