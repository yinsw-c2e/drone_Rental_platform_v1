import React, {useMemo} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary, getRoleDisplayText} from '../../utils/roleSummary';
import {getResponsiveTwoColumnLayout} from '../../utils/responsiveGrid';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type FulfillmentAction = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  accent: string;
  onPress: () => void;
};

function ActionCard({action, width}: {action: FulfillmentAction; width: number}) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.actionCard, {width, borderColor: action.accent}]}
      onPress={action.onPress}
      activeOpacity={0.88}>
      <View style={[styles.actionIconWrap, {backgroundColor: `${action.accent}18`}]}>
        <Text style={styles.actionIcon}>{action.icon}</Text>
      </View>
      <Text style={styles.actionTitle}>{action.title}</Text>
      <Text style={styles.actionDesc}>{action.desc}</Text>
    </TouchableOpacity>
  );
}

export default function FulfillmentHubScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const {width: viewportWidth} = useWindowDimensions();
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary, user), [roleSummary, user]);
  const actionCardLayout = useMemo(
    () =>
      getResponsiveTwoColumnLayout({
        viewportWidth,
        totalHorizontalPadding: 64,
        gap: 12,
        minItemWidth: 120,
      }),
    [viewportWidth],
  );

  const fulfillmentActions = useMemo<FulfillmentAction[]>(() => {
    const actions: FulfillmentAction[] = [
      {
        key: 'orders',
        title: '我的订单',
        desc: '查看已成交订单、付款、执行与完成状态',
        icon: '📦',
        accent: '#1677ff',
        onPress: () => navigation.navigate('MyOrders'),
      },
    ];

    if (effectiveRoleSummary.has_owner_role) {
      actions.push({
        key: 'dispatch',
        title: '执行安排',
        desc: '集中安排飞手、处理重派和执行响应',
        icon: '📡',
        accent: '#13c2c2',
        onPress: () => navigation.navigate('DispatchTaskList'),
      });
    }

    if (effectiveRoleSummary.has_pilot_role) {
      actions.push(
        {
          key: 'pilot-tasks',
          title: '接单任务',
          desc: '集中处理待响应、待执行的飞手任务',
          icon: '🧭',
          accent: '#fa8c16',
          onPress: () => navigation.navigate('PilotTaskList'),
        },
        {
          key: 'flight-log',
          title: '飞行记录',
          desc: '查看真实履约产生的飞行记录与统计',
          icon: '🛫',
          accent: '#722ed1',
          onPress: () => navigation.navigate('FlightLog'),
        },
      );
    }

    actions.push({
      key: 'monitor-tip',
      title: '飞行监控',
      desc: '从订单详情或执行安排详情进入，避免脱离上下文',
      icon: '📍',
      accent: '#eb2f96',
      onPress: () =>
        Alert.alert('飞行监控入口', '请从订单详情或执行安排详情进入飞行监控。'),
    });

    return actions;
  }, [effectiveRoleSummary, navigation]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>进度</Text>
          <Text style={styles.heroTitle}>成交后的履约工作台</Text>
          <Text style={styles.heroDesc}>
            这里专门处理订单、执行安排、飞行监控和飞行记录，不再混市场撮合信息。
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{getRoleDisplayText(roleSummary, user)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>核心履约动作</Text>
          <Text style={styles.sectionDesc}>
            对客户来说主要看订单进度；对机主和飞手来说，再在这里处理执行安排和飞行留痕。
          </Text>
          <View style={styles.grid}>
            {fulfillmentActions.map(action => (
              <ActionCard key={action.key} action={action} width={actionCardLayout.itemWidth} />
            ))}
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>履约规则提醒</Text>
          <Text style={styles.tipText}>
            订单页负责对外说明进度，执行安排页负责机主和飞手的内部协作，飞行记录只保留真实执行留痕。这样客户不会被内部对象打断，运营和执行也能保持清晰分工。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  content: {padding: 16, paddingBottom: 28},
  hero: {
    backgroundColor: theme.isDark ? '#0D4F4A' : '#0f766e',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 13,
    color: theme.isDark ? '#A7F3D0' : '#ccfbf1',
    marginBottom: 8,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: theme.btnPrimaryText,
    fontWeight: '700',
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.isDark ? '#A7F3D0' : '#ccfbf1',
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  rolePillText: {
    fontSize: 13,
    color: theme.btnPrimaryText,
    fontWeight: '600',
  },
  section: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    color: theme.text,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
    marginTop: 6,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    minHeight: 148,
    borderRadius: 18,
    backgroundColor: theme.card,
    borderWidth: 1,
    padding: 14,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionIcon: {fontSize: 20},
  actionTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '700',
    marginBottom: 6,
  },
  actionDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  tipCard: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: theme.success + '22',
    borderWidth: 1,
    borderColor: theme.success + '55',
    padding: 16,
  },
  tipTitle: {
    fontSize: 15,
    color: theme.success,
    fontWeight: '700',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.success,
  },
});
