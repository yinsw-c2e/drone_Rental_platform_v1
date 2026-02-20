import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { setCredentials } from './store/slices/authSlice';
import { API_BASE_URL } from './constants';

// Import screens directly
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import HomeScreen from './screens/home/HomeScreen';
import OrderListScreen from './screens/order/OrderListScreen';
import OrderDetailScreen from './screens/order/OrderDetailScreen';
import ChatScreen from './screens/message/ChatScreen';
import ProfileScreen from './screens/profile/ProfileScreen';

// Simple mock navigation for web preview
function createMockNavigation(setScreen: (name: string, params?: any) => void) {
  return {
    navigate: (screen: string, params?: any) => {
      setScreen(screen, params);
    },
    goBack: () => {
      console.log('Go back');
    },
    setOptions: () => {},
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
  const [screen, setScreen] = useState<'Login' | 'Register'>('Login');
  const nav = createMockNavigation((s) => setScreen(s as any));

  return (
    <View style={{ flex: 1 }}>
      {screen === 'Login' ? (
        <LoginScreen navigation={{ ...nav, navigate: (s: string) => {
          if (s === 'Register') setScreen('Register');
        }}} />
      ) : (
        <RegisterScreen navigation={{ ...nav, goBack: () => setScreen('Login') }} />
      )}
      {/* Quick demo login button */}
      <TouchableOpacity
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
      </TouchableOpacity>
    </View>
  );
}

// Main app with tabs
function MainView({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('Home');
  const [currentScreen, setCurrentScreen] = useState<{ name: string; params?: any } | null>(null);
  
  const nav = createMockNavigation((screenName, params) => {
    console.log(`Navigate to: ${screenName}`, params);
    setCurrentScreen({ name: screenName, params });
  });

  // 如果有详情页，显示详情页
  if (currentScreen) {
    const goBack = () => setCurrentScreen(null);
    
    if (currentScreen.name === 'OrderDetail') {
      return (
        <View style={mainStyles.container}>
          <View style={mainStyles.content}>
            <OrderDetailScreen 
              route={createMockRoute(currentScreen.params)} 
              navigation={{ ...nav, goBack }}
            />
          </View>
        </View>
      );
    }
    
    // 可以添加其他详情页
    // if (currentScreen.name === 'OfferDetail') { ... }
    
    // 未知屏幕，返回主页
    setCurrentScreen(null);
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen navigation={nav} />;
      case 'Orders':
        return <OrderListScreen navigation={nav} />;
      case 'Messages':
        return <ChatScreen route={createMockRoute({ conversationId: 'demo', peerId: 0 })} />;
      case 'Profile':
        return <ProfileScreen navigation={nav} />;
      default:
        return <HomeScreen navigation={nav} />;
    }
  };

  return (
    <View style={mainStyles.container}>
      <View style={mainStyles.content}>
        {renderScreen()}
      </View>
      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}

// Root app
function WebApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
        // 登录成功，保存用户信息和 token
        store.dispatch(setCredentials({
          user: result.data.user,
          token: result.data.token,
        }));
        setIsLoggedIn(true);
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
    <Provider store={store}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {isLoggedIn ? (
          <MainView onLogout={() => setIsLoggedIn(false)} />
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
    </Provider>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<WebApp />);
}
