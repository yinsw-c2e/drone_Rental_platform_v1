import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { store } from './store/store';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { setCredentials, logout } from './store/slices/authSlice';
import { API_BASE_URL } from './constants';

// Import screens directly
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import HomeScreen from './screens/home/HomeScreen';
import OrderListScreen from './screens/order/OrderListScreen';
import OrderDetailScreen from './screens/order/OrderDetailScreen';
import ChatScreen from './screens/message/ChatScreen';
import ConversationListScreen from './screens/message/ConversationListScreen';
import ProfileScreen from './screens/profile/ProfileScreen';

// Import profile screens
import EditProfileScreen from './screens/profile/EditProfileScreen';
import MyCargoScreen from './screens/profile/MyCargoScreen';
import MyDemandsScreen from './screens/profile/MyDemandsScreen';
import MyOffersScreen from './screens/profile/MyOffersScreen';
import SettingsScreen from './screens/profile/SettingsScreen';
import VerificationScreen from './screens/profile/VerificationScreen';

// Import additional screens for navigation
import DroneDetailScreen from './screens/drone/DroneDetailScreen';
import NearbyDronesScreen from './screens/drone/NearbyDronesScreen';
import AddDroneScreen from './screens/drone/AddDroneScreen';
import MyDronesScreen from './screens/drone/MyDronesScreen';
import DemandListScreen from './screens/demand/DemandListScreen';
import DemandDetailScreen from './screens/demand/DemandDetailScreen';
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
        case 'DroneDetail':
        case 'OfferDetail': {
          const id = getId(params, 'droneId', 'offerId', 'id');
          path = id ? `/drone/${id}` : null;
          break;
        }
        case 'DemandDetail': {
          const id = getId(params, 'demandId', 'id');
          path = id ? `/demand/${id}` : null;
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
        case 'MyDemands':
          path = '/my-demands';
          break;
        case 'MyCargo':
          path = '/my-cargo';
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
    { key: 'Orders', label: '订单', icon: '📋' },
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

function DroneDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <DroneDetailScreen route={createMockRoute({ id, droneId: id, offerId: id })} navigation={nav} />;
}

function DemandDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <DemandDetailScreen route={createMockRoute({ id, demandId: id })} navigation={nav} />;
}

function OfferDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <OfferDetailScreen route={createMockRoute({ id, offerId: id })} navigation={nav} />;
}

function ChatWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <ChatScreen route={createMockRoute({ peerId: id, id })} navigation={nav} />;
}

// Screen wrappers with navigation
function ScreenWrapper({ Component }: { Component: any }) {
  const navigate = useNavigate();
  const nav = createRouterNavigation(navigate);
  return <Component navigation={nav} />;
}

// Main app with tabs and routes
function MainView({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Home');
  
  const nav = createRouterNavigation(navigate);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen navigation={nav} />;
      case 'Orders':
        return <OrderListScreen navigation={nav} />;
      case 'Messages':
        return <ConversationListScreen navigation={nav} />;
      case 'Profile':
        return <ProfileScreen navigation={nav} />;
      default:
        return <HomeScreen navigation={nav} />;
    }
  };

  return (
    <View style={mainStyles.container}>
      <View style={mainStyles.content}>
        <Routes>
          {/* Detail pages */}
          <Route path="/order/:id" element={<OrderDetailWrapper />} />
          <Route path="/drone/:id" element={<DroneDetailWrapper />} />
          <Route path="/demand/:id" element={<DemandDetailWrapper />} />
          <Route path="/offer/:id" element={<OfferDetailWrapper />} />
          
          {/* Message pages */}
          <Route path="/chat/:id" element={<ChatWrapper />} />
          <Route path="/messages" element={<ScreenWrapper Component={ConversationListScreen} />} />
          
          {/* List pages */}
          <Route path="/nearby-drones" element={<ScreenWrapper Component={NearbyDronesScreen} />} />
          <Route path="/my-drones" element={<ScreenWrapper Component={MyDronesScreen} />} />
          <Route path="/demands" element={<ScreenWrapper Component={DemandListScreen} />} />
          <Route path="/offers" element={<ScreenWrapper Component={OfferListScreen} />} />
          
          {/* Profile pages */}
          <Route path="/my-orders" element={<ScreenWrapper Component={OrderListScreen} />} />
          <Route path="/my-offers" element={<ScreenWrapper Component={MyOffersScreen} />} />
          <Route path="/my-demands" element={<ScreenWrapper Component={MyDemandsScreen} />} />
          <Route path="/my-cargo" element={<ScreenWrapper Component={MyCargoScreen} />} />
          <Route path="/verification" element={<ScreenWrapper Component={VerificationScreen} />} />
          <Route path="/settings" element={<ScreenWrapper Component={SettingsScreen} />} />
          <Route path="/edit-profile" element={<ScreenWrapper Component={EditProfileScreen} />} />
          
          {/* Publish pages */}
          <Route path="/add-drone" element={<ScreenWrapper Component={AddDroneScreen} />} />
          <Route path="/publish-offer" element={<ScreenWrapper Component={PublishOfferScreen} />} />
          <Route path="/publish-demand" element={<ScreenWrapper Component={PublishDemandScreen} />} />
          <Route path="/publish-cargo" element={<ScreenWrapper Component={PublishCargoScreen} />} />
          
          {/* Main tabs - default route */}
          <Route path="/*" element={renderTabContent()} />
        </Routes>
      </View>
      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}

// Root app inner component (needs to be inside Provider to use useSelector)
function WebAppInner() {
  const authToken = useSelector((state: any) => state.auth.accessToken);
  const [isLoading, setIsLoading] = useState(false);

  // 根据 Redux 中的 token 判断是否已登录
  const isLoggedIn = !!authToken;

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
