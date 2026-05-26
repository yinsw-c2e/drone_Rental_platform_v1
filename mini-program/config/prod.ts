import { defineConfig } from '@tarojs/cli';

export default defineConfig(({}) => {
  const apiBase = process.env.MINI_PROGRAM_API_BASE || 'https://dronerentalplat.cpolar.top/api/v2';
  return {
    defineConstants: {
      __API_BASE__: JSON.stringify(apiBase),
    },
    mini: {
      minifyWXML: {
        collapseWhitespace: true,
        keepClosingSlash: true,
      },
    },
  };
});
