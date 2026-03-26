import React, {useMemo} from 'react';
import {
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

type MarketAction = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  accent: string;
  onPress: () => void;
};

function ActionCard({action, width}: {action: MarketAction; width: number}) {
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

export default function MarketHubScreen({navigation}: any) {
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

  const marketActions = useMemo<MarketAction[]>(() => {
    const actions: MarketAction[] = [
      {
        key: 'demand-market',
        title: '需求市场',
        desc: '查看公开需求，按区域和能力筛选',
        icon: '📋',
        accent: '#1677ff',
        onPress: () => navigation.navigate('DemandList', {mode: 'public'}),
      },
      {
        key: 'supply-market',
        title: '供给市场',
        desc: '浏览可直接下单的重载吊运供给',
        icon: '🛩️',
        accent: '#13c2c2',
        onPress: () => navigation.navigate('OfferList'),
      },
    ];

    if (effectiveRoleSummary.has_client_role) {
      actions.push(
        {
          key: 'publish-demand',
          title: '发布需求',
          desc: '发布重载末端吊运需求',
          icon: '📝',
          accent: '#2f54eb',
          onPress: () => navigation.navigate('PublishDemand'),
        },
        {
          key: 'my-demands',
          title: '我的需求',
          desc: '查看已发布需求与报价进展',
          icon: '🗂️',
          accent: '#1d39c4',
          onPress: () => navigation.navigate('MyDemands'),
        },
      );
    }

    if (effectiveRoleSummary.has_owner_role) {
      actions.push(
        {
          key: 'publish-offer',
          title: '发布供给',
          desc: '上架机型、能力与服务区域',
          icon: '📦',
          accent: '#52c41a',
          onPress: () => navigation.navigate('PublishOffer'),
        },
        {
          key: 'my-offers',
          title: '我的供给',
          desc: '管理上架状态、查看曝光与接单',
          icon: '🧾',
          accent: '#389e0d',
          onPress: () => navigation.navigate('MyOffers'),
        },
        {
          key: 'my-drones',
          title: '我的无人机',
          desc: '维护设备、资质与可用状态',
          icon: '🚁',
          accent: '#36cfc9',
          onPress: () => navigation.navigate('MyDrones'),
        },
      );
    }

    if (effectiveRoleSummary.has_pilot_role) {
      actions.push({
        key: 'candidate-market',
        title: '候选需求',
        desc: '查看可报名的公开需求，提前进入候选池',
        icon: '📍',
        accent: '#fa8c16',
        onPress: () => navigation.navigate('DemandList', {mode: 'pilot'}),
      });
    }

    return actions;
  }, [effectiveRoleSummary, navigation]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>市场</Text>
          <Text style={styles.heroTitle}>重载吊运撮合入口</Text>
          <Text style={styles.heroDesc}>
            这里专门处理需求、供给、报价和候选，不再混订单与派单任务。
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{getRoleDisplayText(roleSummary, user)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>核心市场动作</Text>
          <Text style={styles.sectionDesc}>
            先在市场里完成撮合与下单，成交后的执行统一去「履约」处理。
          </Text>
          <View style={styles.grid}>
            {marketActions.map(action => (
              <ActionCard key={action.key} action={action} width={actionCardLayout.itemWidth} />
            ))}
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>边界提醒</Text>
          <Text style={styles.tipText}>
            需求、供给、订单、派单任务是四类不同对象。市场页只展示需求与供给，不再直接堆订单卡片。
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
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  heroEyebrow: {
    fontSize: 13,
    color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: theme.isDark ? theme.text : '#FFFFFF',
    fontWeight: '700',
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)',
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.14)',
  },
  rolePillText: {
    fontSize: 13,
    color: theme.isDark ? theme.primaryText : '#FFFFFF',
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
    backgroundColor: theme.warning + '22',
    borderWidth: 1,
    borderColor: theme.warning + '55',
    padding: 16,
  },
  tipTitle: {
    fontSize: 15,
    color: theme.warning,
    fontWeight: '700',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.warning,
  },
});
