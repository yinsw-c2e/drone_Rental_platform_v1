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
  DeploymentUnitOutlined,
  InboxOutlined,
  SendOutlined,
  RadarChartOutlined,
  AlertOutlined,
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
import DemandList from './pages/Demand/DemandList';
import SupplyList from './pages/Supply/SupplyList';
import DispatchTaskList from './pages/Dispatch/DispatchTaskList';
import FlightRecordList from './pages/Flight/FlightRecordList';
import MigrationAuditBoard from './pages/Operations/MigrationAuditBoard';

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
    { key: '/demands', icon: <InboxOutlined />, label: '需求管理' },
    { key: '/supplies', icon: <DeploymentUnitOutlined />, label: '供给管理' },
    { key: '/dispatch-tasks', icon: <SendOutlined />, label: '正式派单' },
    { key: '/flight-records', icon: <RadarChartOutlined />, label: '飞行记录' },
    { key: '/migration-audits', icon: <AlertOutlined />, label: '迁移审计/异常' },
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
          <a onClick={() => { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_refresh_token'); window.location.href = '/login'; }}>
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
            <Route path="/demands" element={<DemandList />} />
            <Route path="/supplies" element={<SupplyList />} />
            <Route path="/dispatch-tasks" element={<DispatchTaskList />} />
            <Route path="/flight-records" element={<FlightRecordList />} />
            <Route path="/migration-audits" element={<MigrationAuditBoard />} />
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
