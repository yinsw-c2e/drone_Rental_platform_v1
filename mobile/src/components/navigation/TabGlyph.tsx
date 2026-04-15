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
          <View style={styles.homeDoor} />
        </View>
      );
    case 'discover':
      return (
        <View style={styles.canvas}>
          <View style={styles.discoverRing} />
          <View style={styles.discoverNeedle} />
          <View style={styles.discoverDot} />
        </View>
      );
    case 'orders':
      return (
        <View style={styles.canvas}>
          <View style={styles.ordersSheet} />
          <View style={styles.ordersClip} />
          <View style={styles.ordersLineTop} />
          <View style={styles.ordersLineBottom} />
          <View style={styles.ordersCheckLeft} />
          <View style={styles.ordersCheckRight} />
        </View>
      );
    case 'messages':
      return (
        <View style={styles.canvas}>
          <View style={styles.messageBubble} />
          <View style={styles.messageTail} />
          <View style={styles.messageLineTop} />
          <View style={styles.messageLineBottom} />
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
  const stroke = Math.max(1.6, size * 0.08);

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
      top: size * 0.12,
      width: size * 0.46,
      height: size * 0.46,
      borderTopWidth: stroke,
      borderLeftWidth: stroke,
      borderColor: color,
      transform: [{rotate: '45deg'}],
      borderTopLeftRadius: size * 0.04,
    },
    homeBody: {
      position: 'absolute',
      bottom: size * 0.08,
      width: size * 0.5,
      height: size * 0.42,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.12,
      backgroundColor: 'transparent',
    },
    homeDoor: {
      position: 'absolute',
      bottom: size * 0.08,
      width: size * 0.14,
      height: size * 0.2,
      borderWidth: stroke * 0.85,
      borderBottomWidth: 0,
      borderColor: color,
      borderTopLeftRadius: size * 0.08,
      borderTopRightRadius: size * 0.08,
    },
    discoverRing: {
      position: 'absolute',
      width: size * 0.72,
      height: size * 0.72,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.36,
    },
    discoverNeedle: {
      position: 'absolute',
      width: stroke,
      height: size * 0.36,
      backgroundColor: color,
      borderRadius: stroke,
      transform: [{rotate: '40deg'}],
    },
    discoverDot: {
      position: 'absolute',
      width: size * 0.12,
      height: size * 0.12,
      borderRadius: size * 0.06,
      backgroundColor: color,
    },
    ordersSheet: {
      position: 'absolute',
      width: size * 0.6,
      height: size * 0.74,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.12,
      backgroundColor: 'transparent',
    },
    ordersClip: {
      position: 'absolute',
      top: size * 0.08,
      width: size * 0.26,
      height: size * 0.1,
      borderWidth: stroke,
      borderBottomWidth: 0,
      borderColor: color,
      borderTopLeftRadius: size * 0.08,
      borderTopRightRadius: size * 0.08,
      backgroundColor: 'transparent',
    },
    ordersLineTop: {
      position: 'absolute',
      top: size * 0.56,
      width: size * 0.22,
      height: stroke * 0.9,
      borderRadius: stroke,
      backgroundColor: color,
      right: size * 0.16,
    },
    ordersLineBottom: {
      position: 'absolute',
      top: size * 0.72,
      width: size * 0.22,
      height: stroke * 0.9,
      borderRadius: stroke,
      backgroundColor: color,
      right: size * 0.16,
    },
    ordersCheckLeft: {
      position: 'absolute',
      left: size * 0.18,
      top: size * 0.56,
      width: stroke,
      height: size * 0.1,
      borderRadius: stroke,
      backgroundColor: color,
      transform: [{rotate: '-35deg'}],
    },
    ordersCheckRight: {
      position: 'absolute',
      left: size * 0.25,
      top: size * 0.5,
      width: stroke,
      height: size * 0.18,
      borderRadius: stroke,
      backgroundColor: color,
      transform: [{rotate: '35deg'}],
    },
    messageBubble: {
      position: 'absolute',
      top: size * 0.16,
      width: size * 0.68,
      height: size * 0.52,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.2,
      backgroundColor: 'transparent',
    },
    messageTail: {
      position: 'absolute',
      bottom: size * 0.16,
      left: size * 0.3,
      width: size * 0.18,
      height: size * 0.18,
      borderLeftWidth: stroke,
      borderBottomWidth: stroke,
      borderColor: color,
      transform: [{rotate: '-20deg'}],
      backgroundColor: 'transparent',
    },
    messageLineTop: {
      position: 'absolute',
      top: size * 0.34,
      width: size * 0.28,
      height: stroke * 0.9,
      borderRadius: stroke,
      backgroundColor: color,
    },
    messageLineBottom: {
      position: 'absolute',
      top: size * 0.5,
      width: size * 0.2,
      height: stroke * 0.9,
      borderRadius: stroke,
      backgroundColor: color,
    },
    profileHead: {
      position: 'absolute',
      top: size * 0.08,
      width: size * 0.3,
      height: size * 0.3,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.15,
      backgroundColor: 'transparent',
    },
    profileShoulder: {
      position: 'absolute',
      bottom: size * 0.08,
      width: size * 0.6,
      height: size * 0.34,
      borderWidth: stroke,
      borderColor: color,
      borderRadius: size * 0.22,
      backgroundColor: 'transparent',
    },
  });
};
