import React from 'react';
import {Image, StyleSheet} from 'react-native';
import {useSelector} from 'react-redux';
import {tabbarAssets} from '../../assets/miniProgramAssets';
import {providerTabAssets} from '../../assets/haul/providerTabs';
import {RootState} from '../../store/store';

type TabGlyphName = 'home' | 'orders' | 'messages' | 'profile';

type TabGlyphProps = {
  name: TabGlyphName;
  focused?: boolean;
  size?: number;
};

const customerIconFrames: Record<TabGlyphName, {width: number; height: number}> = {
  home: {width: 23, height: 24},
  orders: {width: 22, height: 24},
  messages: {width: 23, height: 22},
  profile: {width: 23, height: 24},
};

const providerIconFrames: Record<TabGlyphName, {active: {width: number; height: number}; inactive: {width: number; height: number}}> = {
  home: {
    active: {width: 27, height: 22},
    inactive: {width: 28, height: 23},
  },
  orders: {
    active: {width: 36, height: 25},
    inactive: {width: 31, height: 22},
  },
  messages: {
    active: {width: 31, height: 22},
    inactive: {width: 31, height: 22},
  },
  profile: {
    active: {width: 29, height: 24},
    inactive: {width: 29, height: 24},
  },
};

export default function TabGlyph({name, focused = false, size = 24}: TabGlyphProps) {
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const isProviderMode = selectedMode === 'provider';
  const sourceMap = {
    home: focused
      ? isProviderMode
        ? providerTabAssets.workbenchActive
        : tabbarAssets.workbenchActive
      : isProviderMode
        ? providerTabAssets.workbenchInactive
        : tabbarAssets.workbenchInactive,
    orders: focused
      ? isProviderMode
        ? providerTabAssets.acceptOrderActive
        : tabbarAssets.orderActive
      : isProviderMode
        ? providerTabAssets.acceptOrderInactive
        : tabbarAssets.orderInactive,
    messages: focused
      ? isProviderMode
        ? providerTabAssets.messageActive
        : tabbarAssets.messageActive
      : isProviderMode
        ? providerTabAssets.messageInactive
        : tabbarAssets.messageInactive,
    profile: focused
      ? isProviderMode
        ? providerTabAssets.profileActive
        : tabbarAssets.mineActive
      : isProviderMode
        ? providerTabAssets.profileInactive
        : tabbarAssets.mineInactive,
  };
  const frame = isProviderMode
    ? providerIconFrames[name][focused ? 'active' : 'inactive']
    : customerIconFrames[name] || {width: size, height: size};

  return (
    <Image
      source={sourceMap[name]}
      style={[styles.icon, frame]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    display: 'flex',
  },
});
