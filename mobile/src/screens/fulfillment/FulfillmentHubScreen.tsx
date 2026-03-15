import React, {useMemo} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary, getRoleDisplayText} from '../../utils/roleSummary';

type FulfillmentAction = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  accent: string;
  onPress: () => void;
};

function ActionCard({action}: {action: FulfillmentAction}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, {borderColor: action.accent}]}
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
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary, user), [roleSummary, user]);

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
        title: '派单任务',
        desc: '给绑定飞手或候选飞手发起正式派单',
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
      desc: '从订单详情或任务详情进入，避免脱离上下文',
      icon: '📍',
      accent: '#eb2f96',
      onPress: () =>
        Alert.alert('飞行监控入口', '请从订单详情或派单任务详情进入飞行监控。'),
    });

    return actions;
  }, [effectiveRoleSummary, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>履约</Text>
          <Text style={styles.heroTitle}>成交后的执行中心</Text>
          <Text style={styles.heroDesc}>
            这里专门处理订单、正式派单、飞行监控和飞行记录，不再混市场撮合信息。
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{getRoleDisplayText(roleSummary, user)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>核心履约动作</Text>
          <Text style={styles.sectionDesc}>
            订单是成交结果，派单任务是执行指令，飞行记录是执行留痕。
          </Text>
          <View style={styles.grid}>
            {fulfillmentActions.map(action => (
              <ActionCard key={action.key} action={action} />
            ))}
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>履约规则提醒</Text>
          <Text style={styles.tipText}>
            订单页只看订单，派单页只看派单，飞行记录只看真实执行结果。这样后面再做监控和售后时，状态口径才不会再打架。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f4f7fb'},
  content: {padding: 16, paddingBottom: 28},
  hero: {
    backgroundColor: '#0f766e',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 13,
    color: '#ccfbf1',
    marginBottom: 8,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#ccfbf1',
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
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#1f1f1f',
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8c8c8c',
    marginTop: 6,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    minHeight: 148,
    borderRadius: 18,
    backgroundColor: '#fff',
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
    color: '#1f1f1f',
    fontWeight: '700',
    marginBottom: 6,
  },
  actionDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8c8c8c',
  },
  tipCard: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
    padding: 16,
  },
  tipTitle: {
    fontSize: 15,
    color: '#237804',
    fontWeight: '700',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#3f8600',
  },
});
