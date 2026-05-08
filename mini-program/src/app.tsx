import { PropsWithChildren, useEffect, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import Taro, { useDidShow } from '@tarojs/taro';
import { store, RootState } from './store/store';
import './app.scss';

const AUTH_FREE_ROUTES = new Set([
  'pages/auth/login/index',
  'pages/auth/register/index',
]);

function AuthGate({ children }: PropsWithChildren) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const pages = Taro.getCurrentPages();
    const currentRoute = (pages[pages.length - 1]?.route || '').replace(/^\//, '');
    if (!currentRoute) return;
    if (!isAuthenticated && checked && !AUTH_FREE_ROUTES.has(currentRoute)) {
      Taro.reLaunch({ url: '/pages/auth/login/index' });
    }
  }, [isAuthenticated, checked]);

  useDidShow(() => {
    if (!checked) setChecked(true);
  });

  return <>{children}</>;
}

function App({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <AuthGate>
        {children}
      </AuthGate>
    </Provider>
  );
}

export default App;
