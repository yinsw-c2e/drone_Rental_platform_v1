import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        'react-native': 'react-native-web',
        'react-native$': 'react-native-web',
        'react-native-config': path.resolve(__dirname, 'src/utils/config.web.ts'),
        'react-native-linear-gradient': path.resolve(__dirname, 'src/components/LinearGradient.web.tsx'),
        '@react-navigation/native': path.resolve(__dirname, 'src/utils/navigation.web.ts'),
      },
      extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
    define: {
      __DEV__: JSON.stringify(true),
      global: 'window',
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-native-web', 'react-redux', '@reduxjs/toolkit'],
      exclude: ['react-native-config', 'react-native-linear-gradient', 'react-native-image-picker'],
    },
    server: {
      port: 3100,
      open: false,
      host: true, // 允许外部访问
      strictPort: false, // 端口被占用时自动尝试下一个,
      allowedHosts: ["3217b6d9.r7.cpolar.top"]
    },
  };
});