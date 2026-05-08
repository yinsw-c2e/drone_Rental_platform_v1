import { defineConfig } from '@tarojs/cli';

export default defineConfig(({}) => {
  return {
    defineConstants: {
      __API_BASE__: JSON.stringify('https://dronerentalplat.cpolar.top/api/v2'),
    },
    mini: {
      minifyWXML: {
        collapseWhitespace: true,
        keepClosingSlash: true,
      },
    },
  };
});
