import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

/**
 * Web 版本的 useFocusEffect polyfill
 * 在 Web 环境下，直接使用 useEffect 替代
 * 因为 Web 应用没有"页面焦点"的概念（除非使用 visibility API）
 */
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(() => {
    return effect();
  }, [effect]);
}

function resolveWebPath(screen: string, params?: any): string | null {
  const getId = (paramObj: any, ...keys: string[]): string => {
    for (const key of keys) {
      const value = paramObj?.[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
    return '';
  };

  switch (screen) {
    case 'OrderDetail': {
      const id = getId(params, 'orderId', 'id');
      return id ? `/order/${id}` : null;
    }
    case 'Payment': {
      const id = getId(params, 'orderId', 'id');
      return id ? `/order/${id}/payment` : null;
    }
    case 'Review': {
      const id = getId(params, 'orderId', 'id');
      return id ? `/order/${id}/review` : null;
    }
    case 'OrderAfterSale': {
      const id = getId(params, 'orderId', 'id');
      return id ? `/order/${id}/after-sale` : null;
    }
    case 'DroneDetail': {
      const id = getId(params, 'droneId', 'id');
      return id ? `/drone/${id}` : null;
    }
    case 'OfferDetail': {
      const id = getId(params, 'offerId', 'id');
      return id ? `/offer/${id}` : null;
    }
    case 'DemandDetail': {
      const id = getId(params, 'demandId', 'id');
      return id ? `/demand/${id}` : null;
    }
    case 'DemandQuoteCompose': {
      const id = getId(params, 'demandId', 'id');
      return id ? `/demand/${id}/quote` : null;
    }
    case 'DispatchTaskDetail': {
      const id = getId(params, 'dispatchId', 'id');
      return id ? `/dispatch-tasks/${id}` : null;
    }
    case 'CreateDispatchTask': {
      const dispatchId = getId(params, 'dispatchId');
      const orderId = getId(params, 'orderId', 'id');
      if (dispatchId) {
        return `/dispatch-tasks/${dispatchId}/reassign`;
      }
      return orderId ? `/order/${orderId}/dispatch` : null;
    }
    case 'FlightMonitoring': {
      const orderId = getId(params, 'orderId', 'id');
      return orderId ? `/order/${orderId}/monitor` : null;
    }
    case 'TrajectoryRecord': {
      const orderId = getId(params, 'orderId', 'id');
      return orderId ? `/order/${orderId}/trajectory` : null;
    }
    case 'OfferDetailPage': {
      const id = getId(params, 'offerId', 'id');
      return id ? `/offer/${id}` : null;
    }
    case 'Chat':
    case 'ChatScreen': {
      const id = getId(params, 'peerId', 'id');
      return id ? `/chat/${id}` : null;
    }
    case 'ConversationList':
      return '/messages';
    case 'NearbyDrones':
      return '/nearby-drones';
    case 'MyDrones':
      return '/my-drones';
    case 'AddDrone':
    case 'PublishDrone':
      return '/add-drone';
    case 'PublishOffer':
      return '/publish-offer';
    case 'PublishDemand':
      return '/publish-demand';
    case 'PublishCargo':
      return '/publish-cargo';
    case 'DemandList':
      return '/demands';
    case 'OfferList':
      return '/offers';
    case 'MyOrders':
      return '/my-orders';
    case 'MyOffers':
      return '/my-offers';
    case 'MyQuotes':
      return '/my-quotes';
    case 'MyDemands':
      return '/my-demands';
    case 'PilotRegister':
      return '/pilot-register';
    case 'PilotProfile':
      return '/pilot-profile';
    case 'ClientProfile':
      return '/client-profile';
    case 'DispatchTaskList':
      return '/dispatch-tasks';
    case 'PilotTaskList':
      return '/pilot-dispatch-tasks';
    case 'Verification':
      return '/verification';
    case 'Settings':
      return '/settings';
    case 'EditProfile':
      return '/edit-profile';
    default:
      return null;
  }
}

export function useNavigation<T = any>() {
  const navigate = useNavigate();

  return {
    navigate: (screen: string, params?: any) => {
      const path = resolveWebPath(screen, params);
      if (path) {
        navigate(path, {state: params});
        return;
      }

      console.warn(`[navigation.web] Unsupported screen on web: ${screen}`);
    },
    goBack: () => navigate(-1),
    setOptions: () => {},
    addListener: () => () => {},
  } as T;
}

export function NavigationContainer({children}: {children: React.ReactNode}) {
  return React.createElement(React.Fragment, null, children);
}

// --- React Navigation web shims ---
// These no-op exports satisfy @react-navigation/elements and @react-navigation/bottom-tabs
// imports when aliased via vite to this file.

const defaultNavTheme = {
  dark: true,
  colors: {
    primary: '#6C63FF',
    background: '#0A0A1A',
    card: '#16162A',
    text: '#FFFFFF',
    border: '#2A2A4A',
    notification: '#FF6B6B',
  },
};

export function useTheme() {
  return defaultNavTheme;
}

export const NavigationContext = React.createContext<any>(undefined);
export const NavigationRouteContext = React.createContext<any>(undefined);
export const NavigationMetaContext = React.createContext<any>(undefined);
export const usePreventRemoveContext = React.createContext<any>(undefined);

export function useLocale() {
  return {direction: 'ltr' as const};
}

export function useLinkProps(_: any) {
  return {onPress: () => {}, href: undefined};
}

export function useLinkBuilder() {
  return {buildHref: () => '', buildAction: () => ({})};
}

export function useNavigationBuilder(_: any, config: any) {
  return {state: {routes: [], index: 0}, navigation: {}, descriptors: {}, NavigationContent: ({children}: any) => children, ...config};
}

export function createNavigatorFactory(_: any) {
  return () => ({Navigator: (_: any) => null, Screen: (_: any) => null, Group: (_: any) => null});
}

export const CommonActions = {navigate: () => ({}), reset: () => ({}), goBack: () => ({})};
export const StackActions = {push: () => ({}), pop: () => ({}), replace: () => ({})};
export const TabRouter = {};
export const StackRouter = {};

// 为了保持 API 兼容性，也导出一个默认对象
export default {
  useFocusEffect,
  useNavigation,
  useTheme,
  NavigationContainer,
};
