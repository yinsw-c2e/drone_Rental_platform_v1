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
  home: {width: 29, height: 30},
  orders: {width: 28, height: 30},
  messages: {width: 29, height: 28},
  profile: {width: 29, height: 30},
};

const providerIconFrames: Record<TabGlyphName, {active: {width: number; height: number}; inactive: {width: number; height: number}}> = {
  home: {
    active: {width: 28.5, height: 26.5},
    inactive: {width: 27, height: 29.5},
  },
  orders: {
    active: {width: 35, height: 30},
    inactive: {width: 28, height: 25.5},
  },
  messages: {
    active: {width: 29, height: 28},
    inactive: {width: 29, height: 28},
  },
  profile: {
    active: {width: 27, height: 30.5},
    inactive: {width: 27, height: 30.5},
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
