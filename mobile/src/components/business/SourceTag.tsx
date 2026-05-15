import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {BusinessSourceKind, getSourceMeta, getTonePalette} from './visuals';
import {useTheme} from '../../theme/ThemeContext';

type Props = {
  source: BusinessSourceKind;
};

export default function SourceTag({source}: Props) {
  const {theme} = useTheme();
  const meta = getSourceMeta(source);
  const palette = getTonePalette(meta.tone, theme.isDark);

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
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
