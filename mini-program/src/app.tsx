import { PropsWithChildren, useEffect, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import Taro, { useDidShow } from '@tarojs/taro';
import { store, RootState } from './store/store';
import './app.scss';

const AUTH_FREE_ROUTES = new Set([
  'pages/auth/mode-selection/index',
  'pages/auth/login/index',
  'pages/auth/register/index',
]);

const VERIFICATION_PROMPT_FREE_ROUTES = new Set([
  'pages/auth/mode-selection/index',
  'pages/auth/login/index',
  'pages/auth/register/index',
  'pages/verification/index',
]);

let hasPromptedVerificationThisSession = false;

const VERIFICATION_PROMPT_STATUSES = new Set([
  '',
  'unverified',
  'not_verified',
  'not_submitted',
  'rejected',
  'failed',
]);

const shouldPromptVerification = (status?: string | null) =>
  VERIFICATION_PROMPT_STATUSES.has(String(status || '').trim().toLowerCase());

const isRolePreviewRoute = (route: string, options?: Record<string, unknown>) =>
  (route === 'pages/home/index' || route === 'pages/orders/index') &&
  (options?.mode === 'customer' || options?.mode === 'provider');

function AuthGate({ children }: PropsWithChildren) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const meInitialized = useSelector((state: RootState) => state.auth.meInitialized);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const pages = Taro.getCurrentPages();
    const currentPage = pages[pages.length - 1] as { route?: string; options?: Record<string, unknown> } | undefined;
    const currentRoute = (currentPage?.route || '').replace(/^\//, '');
    if (!currentRoute) return;
    if (
      !isAuthenticated &&
      checked &&
      !AUTH_FREE_ROUTES.has(currentRoute) &&
      !isRolePreviewRoute(currentRoute, currentPage?.options)
    ) {
      Taro.reLaunch({ url: '/pages/auth/mode-selection/index' });
    }
  }, [isAuthenticated, checked]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasPromptedVerificationThisSession = false;
      return;
    }
    if (
      !checked ||
      !meInitialized ||
      !user ||
      !shouldPromptVerification(user.id_verified) ||
      hasPromptedVerificationThisSession
    ) {
      return;
    }
    const pages = Taro.getCurrentPages();
    const currentRoute = (pages[pages.length - 1]?.route || '').replace(/^\//, '');
    if (!currentRoute || VERIFICATION_PROMPT_FREE_ROUTES.has(currentRoute)) {
      return;
    }
    hasPromptedVerificationThisSession = true;
    Taro.showModal({
      title: '完成实名认证',
      content: '完成实名认证后可发布需求、直达下单并提升账号可信度。是否现在去认证？',
      confirmText: '去认证',
      cancelText: '稍后',
    }).then((res) => {
      if (res.confirm) {
        Taro.navigateTo({ url: '/pages/verification/index' });
      }
    });
  }, [checked, isAuthenticated, meInitialized, user]);

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
