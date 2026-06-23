import { useCallback, useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Image, Text } from '@tarojs/components';
import { readStoredRoleMode, HAUL_ROLE_MODE_STORAGE_KEY, type HaulRoleMode } from '../../store/slices/roleSlice';
import { TAB_LABELS, TAB_PATHS } from '../../utils/tabBar';

import homeInactive from '../../custom-tab-bar/assets/icon_tab_home_inactive.png';
import homeActive from '../../custom-tab-bar/assets/icon_tab_home_active.png';
import orderInactive from '../../custom-tab-bar/assets/icon_tab_order_inactive.png';
import orderActive from '../../custom-tab-bar/assets/icon_tab_order_active.png';
import messageInactive from '../../custom-tab-bar/assets/icon_tab_message_inactive.png';
import messageActive from '../../custom-tab-bar/assets/icon_tab_message_active.png';
import profileInactive from '../../custom-tab-bar/assets/icon_tab_profile_inactive.png';
import profileActive from '../../custom-tab-bar/assets/icon_tab_profile_active.png';
import workbenchInactive from '../../custom-tab-bar/assets/provider_tab_workbench_inactive.png';
import workbenchActive from '../../custom-tab-bar/assets/provider_tab_workbench_active.png';
import acceptInactive from '../../custom-tab-bar/assets/provider_tab_accept_order_inactive.png';
import acceptActive from '../../custom-tab-bar/assets/provider_tab_accept_order_active.png';
import providerProfileInactive from '../../custom-tab-bar/assets/provider_tab_profile_inactive.png';
import providerProfileActive from '../../custom-tab-bar/assets/provider_tab_profile_active.png';

import './index.scss';

const ORDERS_ROLE_ENTRY_MODE_KEY = 'orders_role_entry_mode';
const PROVIDER_ORDERS_SEGMENT_KEY = 'provider_orders_default_segment';
const CUSTOMER_ORDERS_SEGMENT_KEY = 'customer_orders_default_segment';

interface TabIcon {
  icon: string;
  activeIcon: string;
  width: number;
  height: number;
  activeWidth: number;
  activeHeight: number;
}

// 图标尺寸与 src/utils/tabBar.ts 中 CUSTOMER_TAB_ICONS / PROVIDER_TAB_ICONS 保持一致。
const CUSTOMER_ICONS: TabIcon[] = [
  { icon: homeInactive, activeIcon: homeActive, width: 58, height: 60, activeWidth: 58, activeHeight: 60 },
  { icon: orderInactive, activeIcon: orderActive, width: 56, height: 60, activeWidth: 56, activeHeight: 60 },
  { icon: messageInactive, activeIcon: messageActive, width: 58, height: 56, activeWidth: 58, activeHeight: 56 },
  { icon: profileInactive, activeIcon: profileActive, width: 58, height: 60, activeWidth: 58, activeHeight: 60 },
];

const PROVIDER_ICONS: TabIcon[] = [
  { icon: workbenchInactive, activeIcon: workbenchActive, width: 54, height: 59, activeWidth: 57, activeHeight: 53 },
  { icon: acceptInactive, activeIcon: acceptActive, width: 56, height: 51, activeWidth: 70, activeHeight: 60 },
  { icon: messageInactive, activeIcon: messageActive, width: 58, height: 56, activeWidth: 58, activeHeight: 56 },
  { icon: providerProfileInactive, activeIcon: providerProfileActive, width: 54, height: 61, activeWidth: 54, activeHeight: 61 },
];

// 出现 TabBar 的全部路由（两套角色合并）。
const TAB_ROUTES = new Set<string>([...TAB_PATHS.customer, ...TAB_PATHS.provider]);

function normalizeRoute(route?: string) {
  return `/${String(route || '').replace(/^\//, '').split('?')[0]}`;
}

function readCurrentPath() {
  // hash 路由下，location.hash 是最可靠的当前路由来源
  // （Taro 用 pushState/replaceState 导航，不触发 hashchange）。
  if (typeof location !== 'undefined' && location.hash) {
    return normalizeRoute(location.hash.replace(/^#/, ''));
  }
  const inst = Taro.getCurrentInstance?.();
  const fromRouter = inst?.router?.path;
  if (fromRouter) return normalizeRoute(fromRouter);
  const pages = Taro.getCurrentPages?.() || [];
  const last = pages[pages.length - 1] as { route?: string } | undefined;
  return normalizeRoute(last?.route || '');
}

export default function H5TabBar() {
  const [path, setPath] = useState(readCurrentPath());
  const [mode, setMode] = useState<HaulRoleMode>(readStoredRoleMode());

  const sync = useCallback(() => {
    setPath(readCurrentPath());
    setMode(readStoredRoleMode());
  }, []);

  useEffect(() => {
    sync();
    // Taro 路由用 pushState/replaceState，靠 eventCenter 的路由事件感知切换。
    Taro.eventCenter.on('__afterTaroRouterChange', sync);
    Taro.eventCenter.on('__taroRouterChange', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('focus', sync);
    return () => {
      Taro.eventCenter.off('__afterTaroRouterChange', sync);
      Taro.eventCenter.off('__taroRouterChange', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      window.removeEventListener('focus', sync);
    };
  }, [sync]);

  const visible = TAB_ROUTES.has(path);

  useEffect(() => {
    document.body.classList.toggle('has-h5-tabbar', visible);
    return () => {
      document.body.classList.remove('has-h5-tabbar');
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  const paths = mode === 'provider' ? TAB_PATHS.provider : TAB_PATHS.customer;
  const labels = mode === 'provider' ? TAB_LABELS.provider : TAB_LABELS.customer;
  const icons = mode === 'provider' ? PROVIDER_ICONS : CUSTOMER_ICONS;
  // 当前页若不在该角色的标签里（例如 customer 在 orders、provider 在 provider-demand），按路径回退判断。
  let selected = paths.indexOf(path);
  if (selected < 0) {
    selected = TAB_PATHS.customer.indexOf(path) >= 0 ? TAB_PATHS.customer.indexOf(path) : TAB_PATHS.provider.indexOf(path);
  }

  const handleTap = (index: number, targetPath: string) => {
    if (targetPath === '/pages/orders/index' || targetPath === '/pages/provider-demand/index') {
      const entryMode: HaulRoleMode = targetPath === '/pages/provider-demand/index' ? 'provider' : 'customer';
      Taro.setStorageSync(ORDERS_ROLE_ENTRY_MODE_KEY, entryMode);
      Taro.setStorageSync(HAUL_ROLE_MODE_STORAGE_KEY, entryMode);
      Taro.removeStorageSync(PROVIDER_ORDERS_SEGMENT_KEY);
      Taro.removeStorageSync(CUSTOMER_ORDERS_SEGMENT_KEY);
      setMode(entryMode);
    }
    if (index === selected && targetPath !== '/pages/orders/index' && targetPath !== '/pages/provider-demand/index') {
      return;
    }
    Taro.switchTab({ url: targetPath }).catch(() => {
      Taro.reLaunch({ url: targetPath }).catch(() => null);
    });
  };

  return (
    <View className="h5-tabbar">
      <View className="h5-tabbar-inner">
        {paths.map((tabPath, index) => {
          const isActive = index === selected;
          const iconConf = icons[index];
          const src = isActive ? iconConf.activeIcon : iconConf.icon;
          const w = isActive ? iconConf.activeWidth : iconConf.width;
          const h = isActive ? iconConf.activeHeight : iconConf.height;
          return (
            <View
              key={tabPath}
              className={`h5-tabbar-item ${isActive ? 'h5-tabbar-item-active' : ''}`}
              onClick={() => handleTap(index, tabPath)}
            >
              <View className="h5-tabbar-icon-shell">
                <Image
                  className="h5-tabbar-icon-img"
                  src={src}
                  mode="aspectFit"
                  style={{ width: `${w / 2}px`, height: `${h / 2}px` }}
                />
              </View>
              <Text className="h5-tabbar-label">{labels[index]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
