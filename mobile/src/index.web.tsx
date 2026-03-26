import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { store } from './store/store';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { markMeInitialized, setCredentials, setMeSummary, logout } from './store/slices/authSlice';
import { API_BASE_URL } from './constants';
import { sessionService } from './services/session';

// Import screens directly
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import HomeScreen from './screens/home/HomeScreen';
import MarketHubScreen from './screens/market/MarketHubScreen';
import FulfillmentHubScreen from './screens/fulfillment/FulfillmentHubScreen';
import OrderListScreen from './screens/order/OrderListScreen';
import OrderDetailScreen from './screens/order/OrderDetailScreen';
import PaymentScreen from './screens/order/PaymentScreen';
import ReviewScreen from './screens/order/ReviewScreen';
import OrderAfterSaleScreen from './screens/order/OrderAfterSaleScreen';
import ChatScreen from './screens/message/ChatScreen';
import ConversationListScreen from './screens/message/ConversationListScreen';
import ProfileScreen from './screens/profile/ProfileScreen';
import OwnerProfileScreen from './screens/owner/OwnerProfileScreen';
import OwnerPilotBindingsScreen from './screens/owner/OwnerPilotBindingsScreen';

// Import profile screens
import EditProfileScreen from './screens/profile/EditProfileScreen';
import MyDemandsScreen from './screens/profile/MyDemandsScreen';
import MyOffersScreen from './screens/profile/MyOffersScreen';
import MyQuotesScreen from './screens/profile/MyQuotesScreen';
import SettingsScreen from './screens/profile/SettingsScreen';
import VerificationScreen from './screens/profile/VerificationScreen';
import PilotRegisterScreen from './screens/pilot/PilotRegisterScreen';
import PilotProfileScreen from './screens/pilot/PilotProfileScreen';
import PilotOwnerBindingsScreen from './screens/pilot/PilotOwnerBindingsScreen';
import ClientProfileScreen from './screens/client/ClientProfileScreen';
import DispatchTaskListScreen from './screens/dispatch/DispatchTaskListScreen';
import DispatchTaskDetailScreen from './screens/dispatch/DispatchTaskDetailScreen';
import PilotTaskListScreen from './screens/dispatch/PilotTaskListScreen';
import CreateDispatchTaskScreen from './screens/dispatch/CreateDispatchTaskScreen';
import FlightMonitoringScreen from './screens/flight/FlightMonitoringScreen';
import TrajectoryScreen from './screens/flight/TrajectoryScreen';

// Import additional screens for navigation
import DroneDetailScreen from './screens/drone/DroneDetailScreen';
import NearbyDronesScreen from './screens/drone/NearbyDronesScreen';
import AddDroneScreen from './screens/drone/AddDroneScreen';
import MyDronesScreen from './screens/drone/MyDronesScreen';
import DemandListScreen from './screens/demand/DemandListScreen';
import DemandDetailScreen from './screens/demand/DemandDetailScreen';
import DemandQuoteComposeScreen from './screens/demand/DemandQuoteComposeScreen';
import OfferListScreen from './screens/demand/OfferListScreen';
import OfferDetailScreen from './screens/demand/OfferDetailScreen';
import PublishDemandScreen from './screens/publish/PublishDemandScreen';
import PublishOfferScreen from './screens/publish/PublishOfferScreen';
import PublishCargoScreen from './screens/publish/PublishCargoScreen';

// Create React Router compatible navigation wrapper
function createRouterNavigation(navigate: any) {
  return {
    navigate: (screen: string, params?: any) => {
      console.log('[Router] Navigate called:', { screen, params });
      
      // Helper to get ID from params
      const getId = (paramObj: any, ...keys: string[]): string => {
        for (const key of keys) {
          const val = paramObj?.[key];
          if (val !== undefined && val !== null) {
            return String(val);
          }
        }
        // If no valid ID found, return empty string to indicate error
        console.error('[Router] No valid ID found in params:', paramObj);
        return '';
      };
      
      // Convert screen name to route path
      let path: string | null = null;
      
      switch (screen) {
        case 'OrderDetail': {
          const id = getId(params, 'orderId', 'id');
          path = id ? `/order/${id}` : null;
          break;
        }
        case 'Payment': {
          const id = getId(params, 'orderId', 'id');
          path = id ? `/order/${id}/payment` : null;
          break;
        }
        case 'Review': {
          const id = getId(params, 'orderId', 'id');
          path = id ? `/order/${id}/review` : null;
          break;
        }
        case 'OrderAfterSale': {
          const id = getId(params, 'orderId', 'id');
          path = id ? `/order/${id}/after-sale` : null;
          break;
        }
        case 'DroneDetail': {
          const id = getId(params, 'droneId', 'id');
          path = id ? `/drone/${id}` : null;
          break;
        }
        case 'OfferDetail': {
          const id = getId(params, 'offerId', 'id');
          path = id ? `/offer/${id}` : null;
          break;
        }
        case 'DemandDetail': {
          const id = getId(params, 'demandId', 'id');
          path = id ? `/demand/${id}` : null;
          break;
        }
        case 'DemandQuoteCompose': {
          const id = getId(params, 'demandId', 'id');
          path = id ? `/demand/${id}/quote` : null;
          break;
        }
        case 'DispatchTaskDetail': {
          const id = getId(params, 'dispatchId', 'id');
          path = id ? `/dispatch-tasks/${id}` : null;
          break;
        }
        case 'CreateDispatchTask': {
          const dispatchId = getId(params, 'dispatchId');
          const orderId = getId(params, 'orderId', 'id');
          if (dispatchId) {
            path = `/dispatch-tasks/${dispatchId}/reassign`;
          } else {
            path = orderId ? `/order/${orderId}/dispatch` : null;
          }
          break;
        }
        case 'FlightMonitoring': {
          const orderId = getId(params, 'orderId', 'id');
          path = orderId ? `/order/${orderId}/monitor` : null;
          break;
        }
        case 'TrajectoryRecord': {
          const orderId = getId(params, 'orderId', 'id');
          path = orderId ? `/order/${orderId}/trajectory` : null;
          break;
        }
        case 'OfferDetailPage': {
          const id = getId(params, 'offerId', 'id');
          path = id ? `/offer/${id}` : null;
          break;
        }
        case 'Chat':
        case 'ChatScreen': {
          const id = getId(params, 'peerId', 'id');
          path = id ? `/chat/${id}` : null;
          break;
        }
        case 'ConversationList':
          path = '/messages';
          break;
        case 'NearbyDrones':
          path = '/nearby-drones';
          break;
        case 'MyDrones':
          path = '/my-drones';
          break;
        case 'AddDrone':
        case 'PublishDrone':
          path = '/add-drone';
          break;
        case 'PublishOffer':
          path = '/publish-offer';
          break;
        case 'PublishDemand':
          path = '/publish-demand';
          break;
        case 'PublishCargo':
          path = '/publish-cargo';
          break;
        case 'DemandList':
          path = '/demands';
          break;
        case 'OfferList':
          path = '/offers';
          break;
        // Profile pages
        case 'MyOrders':
          path = '/my-orders';
          break;
        case 'MyOffers':
          path = '/my-offers';
          break;
        case 'MyQuotes':
          path = '/my-quotes';
          break;
        case 'MyDemands':
          path = '/my-demands';
          break;
        case 'OwnerProfile':
          path = '/owner-profile';
          break;
        case 'OwnerPilotBindings':
          path = '/owner-pilot-bindings';
          break;
        case 'PilotRegister':
          path = '/pilot-register';
          break;
        case 'PilotProfile':
          path = '/pilot-profile';
          break;
        case 'PilotOwnerBindings':
          path = '/pilot-owner-bindings';
          break;
        case 'ClientProfile':
          path = '/client-profile';
          break;
        case 'DispatchTaskList':
          path = '/dispatch-tasks';
          break;
        case 'PilotTaskList':
          path = '/pilot-dispatch-tasks';
          break;
        case 'Verification':
          path = '/verification';
          break;
        case 'Settings':
          path = '/settings';
          break;
        case 'EditProfile':
          path = '/edit-profile';
          break;
        default:
          console.warn(`[Router] Unknown screen: ${screen}`);
      }
      
      console.log('[Router] Resolved path:', path);
      
      if (path) {
        navigate(path, { state: params });
      } else {
        console.error(`[Router] Failed to navigate to ${screen} - invalid params or unknown route`);
      }
    },
    goBack: () => navigate(-1),
    setOptions: () => {},
    addListener: (event: string, callback: () => void) => {
      // Web 版本不需要真正监听 focus 事件
      // 因为组件挂载时已经在 useEffect 中调用了数据加载
      // 返回一个空的取消订阅函数
      return () => {};
    },
  };
}

function createMockRoute(params: any = {}) {
  return { params };
}

const mainStyles = StyleSheet.create({
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    overflow: 'scroll',
    minHeight: 0,
  },
});
function TabBar({ activeTab, onTabPress }: { activeTab: string; onTabPress: (tab: string) => void }) {
  const tabs = [
    { key: 'Home', label: '首页', icon: '🏠' },
    { key: 'Market', label: '市场', icon: '🧭' },
    { key: 'Orders', label: '进度', icon: '🛫' },
    { key: 'Messages', label: '消息', icon: '💬' },
    { key: 'Profile', label: '我的', icon: '👤' },
  ];

  return (
    <View style={tabStyles.container}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={tabStyles.tab}
          onPress={() => onTabPress(tab.key)}
        >
          <Text style={[tabStyles.icon, activeTab === tab.key && tabStyles.iconActive]}>
            {tab.icon}
          </Text>
          <Text style={[tabStyles.label, activeTab === tab.key && tabStyles.labelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  icon: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  labelActive: {
    color: '#1890ff',
    fontWeight: '600',
  },
});

// Auth screens wrapper
function AuthView({ onLogin }: { onLogin: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Routes>
        <Route path="/register" element={<RegisterScreen navigation={{ navigate: () => {}, goBack: () => window.history.back() }} />} />
        <Route path="/*" element={<LoginScreen navigation={{ navigate: (s: string) => {
          if (s === 'Register') window.history.pushState({}, '', '/register');
        }, goBack: () => {} }} />} />
      </Routes>
      {/* Quick demo login button */}
      {/* <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 40,
          alignSelf: 'center',
          backgroundColor: '#52c41a',
          paddingHorizontal: 24,
          paddingVertical: 10,
          borderRadius: 20,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
        onPress={onLogin}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
          演示模式 - 快速进入
        </Text>
      </TouchableOpacity> */}
    </View>
  );
}

// Wrapper components for route params
function OrderDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <OrderDetailScreen route={createMockRoute({ id, orderId: id })} navigation={nav} />;
}

function PaymentWrapper() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <PaymentScreen route={createMockRoute({ orderId, id: orderId, ...(location.state || {}) })} navigation={nav} />;
}

function ReviewWrapper() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <ReviewScreen route={createMockRoute({ orderId, id: orderId, ...(location.state || {}) })} navigation={nav} />;
}

function AfterSaleWrapper() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <OrderAfterSaleScreen route={createMockRoute({ orderId, id: orderId, ...(location.state || {}) })} navigation={nav} />;
}

function DroneDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <DroneDetailScreen route={createMockRoute({ id, droneId: id, offerId: id })} navigation={nav} />;
}

function DemandDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = createRouterNavigation(navigate);
  return <DemandDetailScreen route={createMockRoute({ id, demandId: id, ...(location.state || {}) })} navigation={nav} />;
}

function DemandQuoteComposeWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = createRouterNavigation(navigate);
  return <DemandQuoteComposeScreen route={createMockRoute({ id, demandId: id, ...(location.state || {}) })} navigation={nav} />;
}

function OfferDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = createRouterNavigation(navigate);
  return <OfferDetailScreen route={createMockRoute({ id, offerId: id, ...(location.state || {}) })} navigation={nav} />;
}

function ChatWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <ChatScreen route={createMockRoute({ peerId: id, id })} navigation={nav} />;
}

function DispatchTaskDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <DispatchTaskDetailScreen route={createMockRoute({ id, dispatchId: id })} navigation={nav} />;
}

function CreateDispatchTaskWrapper() {
  const { orderId, dispatchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = createRouterNavigation(navigate);
  return (
    <CreateDispatchTaskScreen
      route={createMockRoute({ orderId, id: orderId, dispatchId, ...(location.state || {}) })}
      navigation={nav}
    />
  );
}

function FlightMonitoringWrapper() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = createRouterNavigation(navigate);
  return <FlightMonitoringScreen route={createMockRoute({ orderId, id: orderId, ...(location.state || {}) })} navigation={nav} />;
}

function TrajectoryWrapper() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nav = createRouterNavigation(navigate);
  return <TrajectoryScreen route={createMockRoute({ orderId, id: orderId, ...(location.state || {}) })} navigation={nav} />;
}

// Screen wrappers with navigation
function ScreenWrapper({ Component }: { Component: any }) {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = createRouterNavigation(navigate);
  return <Component navigation={nav} route={createMockRoute(location.state || {})} />;
}

// Main app with tabs and routes
function MainView({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('Home');
  
  const nav = createRouterNavigation(navigate);

  useEffect(() => {
    const path = location.pathname;
    if (
      path.startsWith('/market') ||
      path.startsWith('/demands') ||
      path.startsWith('/offers') ||
      path.startsWith('/publish-offer') ||
      path.startsWith('/publish-demand') ||
      path.startsWith('/publish-cargo') ||
      path.startsWith('/my-offers') ||
      path.startsWith('/my-demands') ||
      path.startsWith('/my-cargo')
    ) {
      setActiveTab('Market');
      return;
    }
    if (
      path.startsWith('/fulfillment') ||
      path.startsWith('/order/') ||
      path.startsWith('/my-orders') ||
      path.startsWith('/dispatch-tasks') ||
      path.startsWith('/pilot-dispatch-tasks')
    ) {
      setActiveTab('Orders');
      return;
    }
    if (path.startsWith('/messages') || path.startsWith('/chat/')) {
      setActiveTab('Messages');
      return;
    }
    if (
      path.startsWith('/profile') ||
      path.startsWith('/edit-profile') ||
      path.startsWith('/settings') ||
      path.startsWith('/verification') ||
      path.startsWith('/my-drones') ||
      path.startsWith('/add-drone')
    ) {
      setActiveTab('Profile');
      return;
    }
    setActiveTab('Home');
  }, [location.pathname]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen navigation={nav} />;
      case 'Market':
        return <MarketHubScreen navigation={nav} />;
      case 'Orders':
        return <OrderListScreen navigation={nav} route={{params: {}}} />;
      case 'Messages':
        return <ConversationListScreen navigation={nav} />;
      case 'Profile':
        return <ProfileScreen navigation={nav} />;
      default:
        return <HomeScreen navigation={nav} />;
    }
  };

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    const basePath =
      tab === 'Home'
        ? '/'
        : tab === 'Market'
          ? '/market'
          : tab === 'Orders'
            ? '/fulfillment'
            : tab === 'Messages'
              ? '/messages'
              : '/profile';
    navigate(basePath);
  };

  return (
    <View style={mainStyles.container}>
      <View style={mainStyles.content}>
        <Routes>
          {/* Detail pages */}
          <Route path="/order/:id" element={<OrderDetailWrapper />} />
          <Route path="/order/:orderId/payment" element={<PaymentWrapper />} />
          <Route path="/order/:orderId/review" element={<ReviewWrapper />} />
          <Route path="/order/:orderId/after-sale" element={<AfterSaleWrapper />} />
          <Route path="/drone/:id" element={<DroneDetailWrapper />} />
          <Route path="/demand/:id" element={<DemandDetailWrapper />} />
          <Route path="/demand/:id/quote" element={<DemandQuoteComposeWrapper />} />
          <Route path="/offer/:id" element={<OfferDetailWrapper />} />
          
          {/* Message pages */}
          <Route path="/chat/:id" element={<ChatWrapper />} />
          <Route path="/messages" element={<ScreenWrapper Component={ConversationListScreen} />} />
          <Route path="/market" element={<ScreenWrapper Component={MarketHubScreen} />} />
          <Route path="/fulfillment" element={<ScreenWrapper Component={FulfillmentHubScreen} />} />
          <Route path="/profile" element={<ScreenWrapper Component={ProfileScreen} />} />
          
          {/* List pages */}
          <Route path="/nearby-drones" element={<ScreenWrapper Component={NearbyDronesScreen} />} />
          <Route path="/my-drones" element={<ScreenWrapper Component={MyDronesScreen} />} />
          <Route path="/demands" element={<ScreenWrapper Component={DemandListScreen} />} />
          <Route path="/offers" element={<ScreenWrapper Component={OfferListScreen} />} />
          
          {/* Profile pages */}
          <Route path="/my-orders" element={<ScreenWrapper Component={OrderListScreen} />} />
          <Route path="/my-offers" element={<ScreenWrapper Component={MyOffersScreen} />} />
          <Route path="/my-quotes" element={<ScreenWrapper Component={MyQuotesScreen} />} />
          <Route path="/my-demands" element={<ScreenWrapper Component={MyDemandsScreen} />} />
          <Route path="/owner-profile" element={<ScreenWrapper Component={OwnerProfileScreen} />} />
          <Route path="/owner-pilot-bindings" element={<ScreenWrapper Component={OwnerPilotBindingsScreen} />} />
          <Route path="/pilot-register" element={<ScreenWrapper Component={PilotRegisterScreen} />} />
          <Route path="/pilot-profile" element={<ScreenWrapper Component={PilotProfileScreen} />} />
          <Route path="/pilot-owner-bindings" element={<ScreenWrapper Component={PilotOwnerBindingsScreen} />} />
          <Route path="/client-profile" element={<ScreenWrapper Component={ClientProfileScreen} />} />
          <Route path="/dispatch-tasks" element={<ScreenWrapper Component={DispatchTaskListScreen} />} />
          <Route path="/dispatch-tasks/:id" element={<DispatchTaskDetailWrapper />} />
          <Route path="/dispatch-tasks/:dispatchId/reassign" element={<CreateDispatchTaskWrapper />} />
          <Route path="/pilot-dispatch-tasks" element={<ScreenWrapper Component={PilotTaskListScreen} />} />
          <Route path="/order/:orderId/dispatch" element={<CreateDispatchTaskWrapper />} />
          <Route path="/order/:orderId/monitor" element={<FlightMonitoringWrapper />} />
          <Route path="/order/:orderId/trajectory" element={<TrajectoryWrapper />} />
          <Route path="/verification" element={<ScreenWrapper Component={VerificationScreen} />} />
          <Route path="/settings" element={<ScreenWrapper Component={SettingsScreen} />} />
          <Route path="/edit-profile" element={<ScreenWrapper Component={EditProfileScreen} />} />
          
          {/* Publish pages */}
          <Route path="/add-drone" element={<ScreenWrapper Component={AddDroneScreen} />} />
          <Route path="/publish-offer" element={<ScreenWrapper Component={PublishOfferScreen} />} />
          <Route path="/publish-demand" element={<ScreenWrapper Component={PublishDemandScreen} />} />
          <Route path="/publish-cargo" element={<ScreenWrapper Component={PublishCargoScreen} />} />
          
          {/* Main tabs - default route */}
          <Route path="/" element={<ScreenWrapper Component={HomeScreen} />} />
          <Route path="*" element={renderTabContent()} />
        </Routes>
      </View>
      <TabBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

// Root app inner component (needs to be inside Provider to use useSelector)
function WebAppInner() {
  const authToken = useSelector((state: any) => state.auth.accessToken);
  const meInitialized = useSelector((state: any) => state.auth.meInitialized);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);

  // 根据 Redux 中的 token 判断是否已登录
  const isLoggedIn = !!authToken;

  useEffect(() => {
    let active = true;

    const bootstrapMe = async () => {
      if (!isLoggedIn || meInitialized) {
        return;
      }
      try {
        const res = await sessionService.getMe();
        if (active) {
          dispatch(setMeSummary(res.data));
        }
      } catch {
        if (active) {
          dispatch(markMeInitialized());
        }
      }
    };

    bootstrapMe();

    return () => {
      active = false;
    };
  }, [dispatch, isLoggedIn, meInitialized]);

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      // 使用测试账号登录（王五-租客，有3条订单）
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: '13800138003',
          password: 'password123',
        }),
      });

      const result = await response.json();
      
      if (result.code === 0 && result.data) {
        // 登录成功，保存用户信息和 token（Redux会自动触发重新渲染）
        store.dispatch(setCredentials({
          user: result.data.user,
          token: result.data.token,
          roleSummary: result.data.role_summary || null,
        }));
      } else {
        alert('演示登录失败: ' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('Demo login error:', error);
      alert('演示登录失败，请检查后端服务是否启动');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BrowserRouter>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {isLoggedIn ? (
          <MainView onLogout={() => store.dispatch(logout())} />
        ) : (
          <AuthView onLogin={handleDemoLogin} />
        )}
        {isLoading && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>登录中...</Text>
          </View>
        )}
      </View>
    </BrowserRouter>
  );
}

// Root app wrapper with Provider
function WebApp() {
  return (
    <Provider store={store}>
      <WebAppInner />
    </Provider>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<WebApp />);
}
