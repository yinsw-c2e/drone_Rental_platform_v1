import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/pro.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677FF',
          borderRadius: 8,
          colorBgLayout: '#f5f7fa',
          fontSize: 14,
          controlHeight: 32,
        },
        components: {
          Table: {
            headerBg: '#f7f9fc',
            rowHoverBg: '#f5f9ff',
          },
          Card: {
            paddingLG: 20,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
