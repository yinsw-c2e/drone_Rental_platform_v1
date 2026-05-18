import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Layout, Menu, Spin, Typography } from 'antd';
import {
  AlertOutlined,
  AreaChartOutlined,
  AuditOutlined,
  BankOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  DollarOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  IdcardOutlined,
  InsuranceOutlined,
  MessageOutlined,
  OrderedListOutlined,
  RadarChartOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AnalyticsDashboard = lazy(() => import('./pages/Analytics/AnalyticsDashboard'));
const ReportList = lazy(() => import('./pages/Analytics/ReportList'));
const UserList = lazy(() => import('./pages/User/UserList'));
const DroneList = lazy(() => import('./pages/Drone/DroneList'));
const OrderList = lazy(() => import('./pages/Order/OrderList'));
const PilotList = lazy(() => import('./pages/Pilot/PilotList'));
const ClientList = lazy(() => import('./pages/Client/ClientList'));
const CargoDeclarationList = lazy(() => import('./pages/Cargo/CargoDeclarationList'));
const DemandList = lazy(() => import('./pages/Demand/DemandList'));
const SupplyList = lazy(() => import('./pages/Supply/SupplyList'));
const DispatchTaskList = lazy(() => import('./pages/Dispatch/DispatchTaskList'));
const FlightRecordList = lazy(() => import('./pages/Flight/FlightRecordList'));
const MigrationAuditBoard = lazy(() => import('./pages/Operations/MigrationAuditBoard'));
const lazyNamed = (name: string) =>
  lazy(() => import('./pages/LongTail/AdminResourcePages').then(module => ({
    default: (module as Record<string, React.ComponentType<any>>)[name],
  })));

const PaymentLedgerPage = lazyNamed('PaymentLedgerPage');
const RefundListPage = lazyNamed('RefundListPage');
const SettlementListPage = lazyNamed('SettlementListPage');
const WithdrawalListPage = lazyNamed('WithdrawalListPage');
const PricingConfigPage = lazyNamed('PricingConfigPage');
const AirspaceApplicationPage = lazyNamed('AirspaceApplicationPage');
const NoFlyZonePage = lazyNamed('NoFlyZonePage');
const ComplianceCheckPage = lazyNamed('ComplianceCheckPage');
const CreditScorePage = lazyNamed('CreditScorePage');
const ViolationPage = lazyNamed('ViolationPage');
const RiskControlPage = lazyNamed('RiskControlPage');
const BlacklistPage = lazyNamed('BlacklistPage');
const DepositPage = lazyNamed('DepositPage');
const InsuranceProductPage = lazyNamed('InsuranceProductPage');
const InsurancePolicyPage = lazyNamed('InsurancePolicyPage');
const InsuranceClaimPage = lazyNamed('InsuranceClaimPage');
const ContractPage = lazyNamed('ContractPage');
const ReviewPage = lazyNamed('ReviewPage');
const DisputePage = lazyNamed('DisputePage');
const AdminLogPage = lazyNamed('AdminLogPage');

type MenuEntry = {
  key: string;
  label: string;
};

const menuGroups = [
  {
    key: 'overview',
    icon: <DashboardOutlined />,
    label: '总览',
    children: [
      { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
      { key: '/analytics', icon: <AreaChartOutlined />, label: '运营看板' },
      { key: '/reports', icon: <FileTextOutlined />, label: '智能报表' },
    ],
  },
  {
    key: 'market',
    icon: <ShoppingCartOutlined />,
    label: '市场运营',
    children: [
      { key: '/demands', icon: <OrderedListOutlined />, label: '需求管理' },
      { key: '/supplies', icon: <DeploymentUnitOutlined />, label: '供给管理' },
      { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单中心' },
      { key: '/cargo-declarations', icon: <FileDoneOutlined />, label: '货物申报' },
    ],
  },
  {
    key: 'dispatch',
    icon: <SendOutlined />,
    label: '履约调度',
    children: [
      { key: '/dispatch-tasks', icon: <SendOutlined />, label: '正式派单' },
      { key: '/flight-records', icon: <RadarChartOutlined />, label: '飞行记录' },
    ],
  },
  {
    key: 'finance',
    icon: <DollarOutlined />,
    label: '财务售后',
    children: [
      { key: '/finance/payments', icon: <DollarOutlined />, label: '支付流水' },
      { key: '/finance/refunds', icon: <WalletOutlined />, label: '退款审核' },
      { key: '/finance/settlements', icon: <BankOutlined />, label: '结算执行' },
      { key: '/finance/withdrawals', icon: <WalletOutlined />, label: '提现审核' },
      { key: '/finance/pricing', icon: <AuditOutlined />, label: '定价配置' },
      { key: '/finance/disputes', icon: <MessageOutlined />, label: '争议处理' },
      { key: '/insurance/products', icon: <InsuranceOutlined />, label: '保险产品' },
      { key: '/insurance/policies', icon: <InsuranceOutlined />, label: '保单列表' },
      { key: '/insurance/claims', icon: <InsuranceOutlined />, label: '理赔处理' },
    ],
  },
  {
    key: 'qualification',
    icon: <SafetyCertificateOutlined />,
    label: '资质审核',
    children: [
      { key: '/users', icon: <UserOutlined />, label: '用户实名' },
      { key: '/clients', icon: <IdcardOutlined />, label: '客户认证' },
      { key: '/pilots', icon: <TeamOutlined />, label: '飞手认证' },
      { key: '/drones', icon: <RocketOutlined />, label: '无人机认证' },
    ],
  },
  {
    key: 'risk',
    icon: <AlertOutlined />,
    label: '风控合规',
    children: [
      { key: '/risk/credit-scores', icon: <SafetyCertificateOutlined />, label: '信用分' },
      { key: '/risk/violations', icon: <AlertOutlined />, label: '违规记录' },
      { key: '/risk/controls', icon: <AuditOutlined />, label: '风控记录' },
      { key: '/risk/blacklists', icon: <FileSearchOutlined />, label: '黑名单' },
      { key: '/risk/deposits', icon: <WalletOutlined />, label: '保证金' },
    ],
  },
  {
    key: 'airspace',
    icon: <RadarChartOutlined />,
    label: '空域飞行',
    children: [
      { key: '/airspace/applications', icon: <RadarChartOutlined />, label: '空域申请' },
      { key: '/airspace/no-fly-zones', icon: <AlertOutlined />, label: '禁飞区' },
      { key: '/airspace/compliance', icon: <AuditOutlined />, label: '合规检查' },
    ],
  },
  {
    key: 'system',
    icon: <CloudServerOutlined />,
    label: '数据系统',
    children: [
      { key: '/contracts', icon: <FileTextOutlined />, label: '合同列表' },
      { key: '/reviews', icon: <MessageOutlined />, label: '评价列表' },
      { key: '/migration-audits', icon: <AlertOutlined />, label: '迁移审计' },
      { key: '/system/admin-logs', icon: <CloudServerOutlined />, label: '操作日志' },
    ],
  },
];

const flattenMenu = (groups: typeof menuGroups): MenuEntry[] =>
  groups.flatMap(group => group.children.map(item => ({ key: item.key, label: item.label })));

function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const flatItems = useMemo(() => flattenMenu(menuGroups), []);
  const active = flatItems
    .slice()
    .sort((a, b) => b.key.length - a.key.length)
    .find(item => location.pathname === item.key || (item.key !== '/' && location.pathname.startsWith(item.key)));
  const selectedKey = active?.key || '/';
  const title = active?.label || '数据概览';

  return (
    <Layout className="pro-shell">
      <Sider
        className="pro-sider"
        theme="dark"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
      >
        <div className="pro-logo">
          <span className="pro-logo-mark">U</span>
          {!collapsed ? <span>无人机运营后台</span> : null}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={menuGroups.map(group => group.key)}
          items={menuGroups}
          onClick={({ key }) => navigate(String(key))}
        />
      </Sider>
      <Layout className="pro-main" style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header className="pro-header">
          <Text strong>{title}</Text>
          <a onClick={onLogout}>退出登录</a>
        </Header>
        <Content className="pro-content">
          <Suspense fallback={<Spin style={{ marginTop: 80, width: '100%' }} />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<AnalyticsDashboard />} />
              <Route path="/reports" element={<ReportList />} />
              <Route path="/demands" element={<DemandList />} />
              <Route path="/supplies" element={<SupplyList />} />
              <Route path="/orders" element={<OrderList />} />
              <Route path="/cargo-declarations" element={<CargoDeclarationList />} />
              <Route path="/dispatch-tasks" element={<DispatchTaskList />} />
              <Route path="/flight-records" element={<FlightRecordList />} />
              <Route path="/finance" element={<Navigate to="/finance/payments" replace />} />
              <Route path="/finance/payments" element={<PaymentLedgerPage />} />
              <Route path="/finance/refunds" element={<RefundListPage />} />
              <Route path="/finance/settlements" element={<SettlementListPage />} />
              <Route path="/finance/withdrawals" element={<WithdrawalListPage />} />
              <Route path="/finance/pricing" element={<PricingConfigPage />} />
              <Route path="/finance/disputes" element={<DisputePage />} />
              <Route path="/insurance/products" element={<InsuranceProductPage />} />
              <Route path="/insurance/policies" element={<InsurancePolicyPage />} />
              <Route path="/insurance/claims" element={<InsuranceClaimPage />} />
              <Route path="/users" element={<UserList />} />
              <Route path="/clients" element={<ClientList />} />
              <Route path="/pilots" element={<PilotList />} />
              <Route path="/drones" element={<DroneList />} />
              <Route path="/risk/credit-scores" element={<CreditScorePage />} />
              <Route path="/risk/violations" element={<ViolationPage />} />
              <Route path="/risk/controls" element={<RiskControlPage />} />
              <Route path="/risk/blacklists" element={<BlacklistPage />} />
              <Route path="/risk/deposits" element={<DepositPage />} />
              <Route path="/airspace/applications" element={<AirspaceApplicationPage />} />
              <Route path="/airspace/no-fly-zones" element={<NoFlyZonePage />} />
              <Route path="/airspace/compliance" element={<ComplianceCheckPage />} />
              <Route path="/contracts" element={<ContractPage />} />
              <Route path="/reviews" element={<ReviewPage />} />
              <Route path="/migration-audits" element={<MigrationAuditBoard />} />
              <Route path="/system/admin-logs" element={<AdminLogPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}

const App: React.FC = () => {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    setToken(null);
  };

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
      <AdminLayout onLogout={logout} />
    </BrowserRouter>
  );
};

export default App;
