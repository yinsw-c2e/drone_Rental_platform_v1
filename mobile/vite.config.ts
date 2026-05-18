import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [react()],
    resolve: {
      alias: [
        {find: /^react-native$/, replacement: path.resolve(__dirname, 'src/utils/react-native.web.ts')},
        {find: /^react-native-config$/, replacement: path.resolve(__dirname, 'src/utils/config.web.ts')},
        {find: /^react-native-wechat-lib$/, replacement: path.resolve(__dirname, 'src/utils/wechat.web.ts')},
        {find: /^react-native-linear-gradient$/, replacement: path.resolve(__dirname, 'src/components/LinearGradient.web.tsx')},
        {find: /^(\.{1,2}\/)+assets\/miniProgramAssets$/, replacement: path.resolve(__dirname, 'src/assets/miniProgramAssets.web.ts')},
        {
          find: /^react-native\/Libraries\/Utilities\/codegenNativeComponent$/,
          replacement: path.resolve(__dirname, 'src/utils/codegenNativeComponent.web.tsx'),
        },
        {
          find: /^react-native\/Libraries\/ReactNative\/AppContainer$/,
          replacement: path.resolve(__dirname, 'src/utils/AppContainer.web.tsx'),
        },
        {find: /^@react-navigation\/native$/, replacement: path.resolve(__dirname, 'src/utils/navigation.web.ts')},
        {find: /^@react-native-community\/datetimepicker$/, replacement: path.resolve(__dirname, 'src/utils/DateTimePicker.web.tsx')},
      ],
      extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
    define: {
      __DEV__: JSON.stringify(!isProduction),
      global: 'window',
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-native-web', 'react-redux', '@reduxjs/toolkit'],
      exclude: ['react-native-config', 'react-native-linear-gradient', 'react-native-image-picker', 'react-native-wechat-lib'],
    },
    server: {
      port: 3100,
      open: false,
      host: true, // 允许外部访问
      strictPort: false, // 端口被占用时自动尝试下一个,
      allowedHosts: true,
    },
  };
});
