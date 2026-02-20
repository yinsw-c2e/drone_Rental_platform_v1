import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  // 获取API配置
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:8080';
  
  return {
    plugins: [react()],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    server: {
      // 开发服务器端口
      port: parseInt(env.VITE_DEV_PORT || '3000', 10),
      
      // 代理配置
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // 可选：重写路径
          // rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
        // WebSocket代理
        '/ws': {
          target: apiTarget.replace('http', 'ws'),
          ws: true,
          changeOrigin: true,
        },
      },
    },
    
    // 构建配置
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // 分包策略
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            antd: ['antd', '@ant-design/icons'],
          },
        },
      },
    },
    
    // 定义全局常量
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    },
  };
});
