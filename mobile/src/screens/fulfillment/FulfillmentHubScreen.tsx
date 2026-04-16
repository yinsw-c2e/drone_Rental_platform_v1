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
        title: '进度查询',
        desc: '实时查看已成交订单的运输进度、付款与签收状态',
        icon: '📦',
        accent: theme.primary,
        onPress: () => navigation.navigate('MyOrders'),
      },
    ];

    if (effectiveRoleSummary.has_owner_role) {
      actions.push({
        key: 'dispatch',
        title: '执行安排',
        desc: '集中安排飞手团队、处理重派与内部执行响应',
        icon: '📡',
        accent: '#13c2c2',
        onPress: () => navigation.navigate('DispatchTaskList'),
      });
    }

    if (effectiveRoleSummary.has_pilot_role) {
      actions.push(
        {
          key: 'pilot-tasks',
          title: '飞手任务',
          desc: '处理待执行的飞行任务与现场交付确认',
          icon: '🧭',
          accent: '#fa8c16',
          onPress: () => navigation.navigate('PilotTaskList'),
        },
        {
          key: 'flight-log',
          title: '飞行记录',
          desc: '查看由履约产生的真实飞行数据与统计记录',
          icon: '🛫',
          accent: '#722ed1',
          onPress: () => navigation.navigate('FlightLog'),
        },
      );
    }

    actions.push({
      key: 'monitor-tip',
      title: '飞行监控',
      desc: '请从特定订单详情进入，实时追踪当前飞行的位置',
      icon: '📍',
      accent: '#eb2f96',
      onPress: () =>
        Alert.alert('飞行监控入口', '为了提供完整的业务上下文，请在具体订单详情页点击“飞行监控”按钮。'),
    });

    return actions;
  }, [effectiveRoleSummary, navigation, theme]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>履行与追踪</Text>
          <Text style={styles.heroTitle}>任务执行工作台</Text>
          <Text style={styles.heroDesc}>
            实时追踪订单生命周期。从支付、派单到飞行交付，所有进度均在此汇总。
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{getRoleDisplayText(roleSummary, user)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>服务履约看板</Text>
            <Text style={styles.sectionTag}>实时</Text>
          </View>
          <Text style={styles.sectionDesc}>
            客户优先关注“进度查询”，机主与执行团队则需处理下方的执行安排与任务。
          </Text>
          <View style={styles.grid}>
            {fulfillmentActions.map(action => (
              <ActionCard key={action.key} action={action} width={actionCardLayout.itemWidth} />
            ))}
          </View>
        </View>

        <View style={styles.unifiedNotice}>
          <Text style={styles.noticeTitle}>💡 统一进度说明</Text>
          <Text style={styles.noticeText}>
            我们已将“支付”、“派单”、“飞行”和“评价”整合为统一的订单时间线。您无需在多个对象间跳转，只需在订单详情中即可掌握一切。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  content: {padding: 16, paddingBottom: 40},
  hero: {
    backgroundColor: theme.isDark ? '#0D4F4A' : theme.primary,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 10,
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.85)',
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  rolePillText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  section: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    color: theme.text,
    fontWeight: '800',
  },
  sectionTag: {
    fontSize: 10,
    color: theme.primary,
    backgroundColor: theme.primaryBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '800',
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.textSub,
    marginTop: 6,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    minHeight: 156,
    borderRadius: 20,
    backgroundColor: theme.bgSecondary,
    borderWidth: 1,
    padding: 16,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  actionIcon: {fontSize: 22},
  actionTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.textSub,
  },
  unifiedNotice: {
    marginTop: 20,
    borderRadius: 20,
    backgroundColor: theme.primaryBg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  noticeTitle: {
    fontSize: 15,
    color: theme.primaryText,
    fontWeight: '800',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.primaryText,
    opacity: 0.85,
  },
});
