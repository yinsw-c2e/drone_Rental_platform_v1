import React from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {AirspaceCheckResult} from '../../services/airspace';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {
  getAirspaceDescription,
  getAirspaceRestrictionSummary,
  getAirspaceTitle,
  hasAirspaceRisk,
  isAirspaceHardBlocked,
} from '../../utils/airspaceRisk';

type Props = {
  label: string;
  result?: AirspaceCheckResult | null;
  checking?: boolean;
  onOpenDetails?: () => void;
};

export default function AirspaceRiskNotice({label, result, checking = false, onOpenDetails}: Props) {
  const {theme} = useTheme();
  const styles = getStyles(theme);

  if (!checking && !result) {
    return null;
  }

  const blocked = isAirspaceHardBlocked(result);
  const warning = !blocked && hasAirspaceRisk(result);
  const tone = blocked ? 'danger' : warning ? 'warning' : 'success';
  const accent = tone === 'danger' ? theme.danger : tone === 'warning' ? theme.warning : theme.success;
  const restrictionSummary = getAirspaceRestrictionSummary(result);

  return (
    <View style={[styles.container, {borderColor: `${accent}45`, backgroundColor: `${accent}12`}]}>
      <View style={styles.header}>
        <View style={[styles.pill, {backgroundColor: `${accent}20`}]}>
          <Text style={[styles.pillText, {color: accent}]}>
            {checking ? '检测中' : blocked ? '禁飞拦截' : warning ? '限飞提醒' : '检测通过'}
          </Text>
        </View>
        {checking ? <ActivityIndicator size="small" color={accent} /> : null}
      </View>

      <Text style={styles.title}>{getAirspaceTitle(label, result, checking)}</Text>
      <Text style={styles.desc}>{getAirspaceDescription(label, result, checking)}</Text>

      {restrictionSummary ? <Text style={styles.meta}>命中区域：{restrictionSummary}</Text> : null}

      {onOpenDetails && (checking || blocked || warning) ? (
        <TouchableOpacity style={styles.linkBtn} onPress={onOpenDetails}>
          <Text style={[styles.linkText, {color: accent}]}>查看附近飞行限制</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 10,
      gap: 6,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    pill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pillText: {
      fontSize: 11,
      fontWeight: '800',
    },
    title: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
    },
    desc: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.textSub,
    },
    meta: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textHint,
    },
    linkBtn: {
      alignSelf: 'flex-start',
      paddingTop: 2,
    },
    linkText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });
