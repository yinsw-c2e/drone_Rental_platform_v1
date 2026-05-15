import React from 'react';
import {Image, StyleSheet} from 'react-native';
import {tabbarAssets} from '../../assets/miniProgramAssets';

type TabGlyphName = 'home' | 'messages' | 'profile';

type TabGlyphProps = {
  name: TabGlyphName;
  focused?: boolean;
  size?: number;
};

export default function TabGlyph({name, focused = false, size = 27}: TabGlyphProps) {
  const sourceMap = {
    home: focused ? tabbarAssets.workbenchActive : tabbarAssets.workbenchInactive,
    messages: focused ? tabbarAssets.messageActive : tabbarAssets.messageInactive,
    profile: focused ? tabbarAssets.mineActive : tabbarAssets.mineInactive,
  };

  return (
    <Image
      source={sourceMap[name]}
      style={[styles.icon, {width: size, height: size}]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    display: 'flex',
  },
});
