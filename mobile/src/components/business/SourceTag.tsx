import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {BusinessSourceKind, getSourceMeta, getTonePalette} from './visuals';

type Props = {
  source: BusinessSourceKind;
};

export default function SourceTag({source}: Props) {
  const meta = getSourceMeta(source);
  const palette = getTonePalette(meta.tone);

  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}>
      <Text style={[styles.text, {color: palette.text}]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
