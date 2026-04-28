import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';
import {V2OrderAnomaly} from '../../types';
import {getAnomalySeverityLabel, getAnomalySeverityTone, getAnomalyTypeLabel} from '../../utils/orderAnomalyMeta';

type Props = {
  anomaly?: V2OrderAnomaly | null;
  compact?: boolean;
  onPress?: () => void;
};

export default function OrderAnomalyBanner({anomaly, compact = false, onPress}: Props) {
  const {theme} = useTheme();
  const styles = getStyles(theme);

  if (!anomaly) {
    return null;
  }

  const tone = getAnomalySeverityTone(anomaly.severity);
  const accent = tone === 'red' ? theme.danger : tone === 'orange' ? theme.warning : theme.primary;
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[styles.container, {borderColor: `${accent}45`, backgroundColor: `${accent}12`}]}>
      <View style={styles.header}>
        <View style={[styles.pill, {backgroundColor: `${accent}20`}]}>
          <Text style={[styles.pillText, {color: accent}]}>{getAnomalySeverityLabel(anomaly.severity)}</Text>
        </View>
        <Text style={[styles.typeText, {color: accent}]} numberOfLines={1}>
          {getAnomalyTypeLabel(anomaly.anomaly_type)}
        </Text>
      </View>
      <Text style={styles.messageText} numberOfLines={compact ? 2 : 3}>
        {anomaly.message}
      </Text>
      {anomaly.recommended_action ? (
        <Text style={styles.actionText} numberOfLines={compact ? 2 : 3}>
          建议动作：{anomaly.recommended_action}
        </Text>
      ) : null}
      {anomaly.stalled_text ? <Text style={styles.metaText}>{anomaly.stalled_text}</Text> : null}
    </Container>
  );
}

const getStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    typeText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
    },
    messageText: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
    },
    actionText: {
      color: theme.textSub,
      fontSize: 13,
      lineHeight: 19,
    },
    metaText: {
      color: theme.textHint,
      fontSize: 12,
    },
  });
