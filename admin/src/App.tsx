import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  RocketOutlined,
  ShoppingCartOutlined,
  IdcardOutlined,
  DollarOutlined,
  AreaChartOutlined,
  FileTextOutlined,
  TeamOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UserList from './pages/User/UserList';
import DroneList from './pages/Drone/DroneList';
import OrderList from './pages/Order/OrderList';
import TransactionList from './pages/Finance/TransactionList';
import AnalyticsDashboard from './pages/Analytics/AnalyticsDashboard';
import ReportList from './pages/Analytics/ReportList';
import PilotList from './pages/Pilot/PilotList';
import ClientList from './pages/Client/ClientList';
import CargoDeclarationList from './pages/Cargo/CargoDeclarationList';

const { Header, Sider, Content } = Layout;

function AdminLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
    { key: '/analytics', icon: <AreaChartOutlined />, label: '运营看板' },
    { key: '/reports', icon: <FileTextOutlined />, label: '智能报表' },
    { key: '/users', icon: <UserOutlined />, label: '用户管理' },
    { key: '/pilots', icon: <TeamOutlined />, label: '飞手管理' },
    { key: '/clients', icon: <IdcardOutlined />, label: '客户管理' },
    { key: '/cargo-declarations', icon: <FileDoneOutlined />, label: '货物申报审核' },
    { key: '/drones', icon: <RocketOutlined />, label: '无人机管理' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
    { key: '/finance', icon: <DollarOutlined />, label: '财务管理' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: collapsed ? 16 : 18, fontWeight: 'bold' }}>
            {collapsed ? 'WRJ' : '无人机管理后台'}
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <a onClick={() => { localStorage.removeItem('admin_token'); window.location.href = '/login'; }}>
            退出登录
          </a>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/reports" element={<ReportList />} />
            <Route path="/users" element={<UserList />} />
            <Route path="/pilots" element={<PilotList />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/cargo-declarations" element={<CargoDeclarationList />} />
            <Route path="/drones" element={<DroneList />} />
            <Route path="/orders" element={<OrderList />} />
            <Route path="/finance" element={<TransactionList />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

const App: React.FC = () => {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  if (!token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage onLogin={setToken} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AdminLayout />
    </BrowserRouter>
  );
};

export default App;
