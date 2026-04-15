import React from 'react';
import {StyleSheet, View} from 'react-native';

type TabGlyphName = 'home' | 'discover' | 'orders' | 'messages' | 'profile';

type TabGlyphProps = {
  name: TabGlyphName;
  color: string;
  size?: number;
};

export default function TabGlyph({name, color, size = 22}: TabGlyphProps) {
  const styles = getStyles(size, color);

  switch (name) {
    case 'home':
      return (
        <View style={styles.canvas}>
          <View style={styles.homeRoof} />
          <View style={styles.homeBody} />
        </View>
      );
    case 'discover':
      return (
        <View style={styles.canvas}>
          <View style={styles.discoverRing} />
          <View style={styles.discoverNeedle} />
        </View>
      );
    case 'orders':
      return (
        <View style={styles.canvas}>
          <View style={styles.ordersSheet} />
          <View style={styles.ordersLines} />
        </View>
      );
    case 'messages':
      return (
        <View style={styles.canvas}>
          <View style={styles.messageBubble} />
          <View style={styles.messageDot} />
        </View>
      );
    case 'profile':
      return (
        <View style={styles.canvas}>
          <View style={styles.profileHead} />
          <View style={styles.profileShoulder} />
        </View>
      );
    default:
      return <View style={styles.canvas} />;
  }
}

const getStyles = (size: number, color: string) => {
  const stroke = Math.max(1.8, size * 0.08);

  return StyleSheet.create({
    canvas: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    homeRoof: {
      position: 'absolute',
      top: size * 0.1,
      width: size * 0.5,
      height: size * 0.5,
      borderTopWidth: stroke,
      borderLeftWidth: stroke,
      borderColor: color,
      transform: [{rotate: '45deg'}],
      borderTopLeftRadius: size * 0.08,
    },
    homeBody: {
      position: 'absolute',
      bottom: size * 0.1,
      width: size * 0.52,
      height: size * 0.44,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.08,
      backgroundColor: 'transparent',
    },
    discoverRing: {
      position: 'absolute',
      width: size * 0.76,
      height: size * 0.76,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.38,
    },
    discoverNeedle: {
      position: 'absolute',
      width: stroke,
      height: size * 0.4,
      backgroundColor: color,
      borderRadius: stroke,
      transform: [{rotate: '45deg'}],
    },
    ordersSheet: {
      position: 'absolute',
      width: size * 0.64,
      height: size * 0.78,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.1,
    },
    ordersLines: {
      position: 'absolute',
      width: size * 0.3,
      height: stroke * 2.5,
      borderTopWidth: stroke,
      borderBottomWidth: stroke,
      borderColor: color,
    },
    messageBubble: {
      position: 'absolute',
      width: size * 0.72,
      height: size * 0.6,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.12,
    },
    messageDot: {
      position: 'absolute',
      bottom: size * 0.1,
      left: size * 0.2,
      width: size * 0.2,
      height: size * 0.2,
      backgroundColor: color,
      borderRadius: size * 0.1,
      transform: [{rotate: '45deg'}],
    },
    profileHead: {
      position: 'absolute',
      top: size * 0.1,
      width: size * 0.32,
      height: size * 0.32,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.16,
    },
    profileShoulder: {
      position: 'absolute',
      bottom: size * 0.1,
      width: size * 0.68,
      height: size * 0.32,
      borderWidth: stroke,
      borderColor: color,
      borderTopLeftRadius: size * 0.2,
      borderTopRightRadius: size * 0.2,
      borderBottomLeftRadius: size * 0.08,
      borderBottomRightRadius: size * 0.08,
    },
  });
};
