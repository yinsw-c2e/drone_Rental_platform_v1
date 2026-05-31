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
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';

import {RootState} from '../../store/store';
import {setHaulRoleMode} from '../../store/slices/roleSlice';
import {getEffectiveRoleSummary, resolveProviderCapabilities} from '../../utils/roleSummary';
import type {ProviderReviewStatus} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

type StatusTone = 'gray' | 'blue' | 'orange' | 'green' | 'red';

type StatusMeta = {
  label: string;
  tone: StatusTone;
  desc: string;
};

type FlowStep = {
  title: string;
  desc: string;
  status: string;
  tone: StatusTone;
};

type StatusOverviewRow = {
  key: string;
  label: string;
  title: string;
  status: string;
  tone: StatusTone;
  desc: string;
};

const STATUS_META: Record<ProviderReviewStatus, StatusMeta> = {
  none: {
    label: '未开始',
    tone: 'gray',
    desc: '提交资料后进入后台审核。',
  },
  pending_review: {
    label: '审核中',
    tone: 'orange',
    desc: '资料已进入审核，暂不能进入正式工作台。',
  },
  approved: {
    label: '已通过',
    tone: 'green',
    desc: '能力已开通，可使用对应接单和履约功能。',
  },
  rejected: {
    label: '需补充',
    tone: 'red',
    desc: '资料未通过，请按要求补充后重新提交。',
  },
  suspended: {
    label: '已暂停',
    tone: 'red',
    desc: '当前能力被暂停，请联系平台处理。',
  },
};

const statusMetaOf = (status?: ProviderReviewStatus | null) =>
  STATUS_META[status || 'none'] || STATUS_META.none;

const buildStep = (
  title: string,
  desc: string,
  status: ProviderReviewStatus,
  fallbackStatus = '待完善',
): FlowStep => {
  const meta = statusMetaOf(status);
  return {
    title,
    desc,
    status: status === 'none' ? fallbackStatus : meta.label,
    tone: status === 'none' ? 'gray' : meta.tone,
  };
};

export default function ProviderOnboardingScreen({navigation}: any) {
  const {theme} = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(
    () => getEffectiveRoleSummary(roleSummary, user),
    [roleSummary, user],
  );
  const capabilities = useMemo(
    () => resolveProviderCapabilities(effectiveRoleSummary),
    [effectiveRoleSummary],
  );
  const providerMeta = statusMetaOf(capabilities.providerStatus);
  const assetMeta = statusMetaOf(capabilities.assetStatus);
  const executorMeta = statusMetaOf(capabilities.executorStatus);

  useFocusEffect(
    React.useCallback(() => {
      dispatch(setHaulRoleMode('provider'));
    }, [dispatch]),
  );

  const headerCopy = useMemo(() => {
    if (!isAuthenticated) {
      return {
        label: '待登录',
        tone: 'blue' as StatusTone,
        title: '登录后开始服务商入驻',
        desc: '我要接单面向服务商，登录后可以提交设备能力、执行人员能力或两者组合。',
        action: '去登录',
      };
    }
    if (capabilities.canUseWorkbench) {
      return {
        label: '已通过',
        tone: 'green' as StatusTone,
        title: '服务商能力已开通',
        desc: '你的账号已具备正式接单能力，可进入工作台查看需求、履约和结算信息。',
        action: '进入工作台',
      };
    }
    if (capabilities.nextAction === 'wait_review') {
      return {
        label: providerMeta.label,
        tone: providerMeta.tone,
        title: '服务商资质审核中',
        desc: '审核通过后即可进入正式工作台，查看需求、履约和结算信息。',
        action: '查看可补充资料',
      };
    }
    if (capabilities.nextAction === 'fix_rejected') {
      return {
        label: providerMeta.label,
        tone: providerMeta.tone,
        title: '服务商资质需补充',
        desc: '请补充被驳回或暂停的资料，重新通过后台审核后才能正式接单。',
        action: '补充服务商资料',
      };
    }
    return {
      label: '未开通',
      tone: 'gray' as StatusTone,
      title: '开始服务商入驻',
      desc: '你可以选择设备服务能力、执行人员能力，或两种能力都开通。审核通过后才能进入正式工作台。',
      action: '完善服务商资料',
    };
  }, [
    capabilities.canUseWorkbench,
    capabilities.nextAction,
    isAuthenticated,
    providerMeta.label,
    providerMeta.tone,
  ]);

  const statusOverviewRows = useMemo<StatusOverviewRow[]>(
    () => [
      {
        key: 'overall',
        label: '整体',
        title: '整体服务商状态',
        status: providerMeta.label,
        tone: providerMeta.tone,
        desc: providerMeta.desc,
      },
      {
        key: 'asset',
        label: '资产',
        title: '设备服务能力',
        status: assetMeta.label,
        tone: assetMeta.tone,
        desc: assetMeta.desc,
      },
      {
        key: 'executor',
        label: '执行',
        title: '履约资质',
        status: executorMeta.label,
        tone: executorMeta.tone,
        desc: executorMeta.desc,
      },
    ],
    [assetMeta.desc, assetMeta.label, assetMeta.tone, executorMeta.desc, executorMeta.label, executorMeta.tone, providerMeta.desc, providerMeta.label, providerMeta.tone],
  );

  const assetSteps = useMemo<FlowStep[]>(
    () => [
      buildStep('服务商资料', '维护联系人、服务范围和基础履约信息。', capabilities.assetStatus),
      buildStep('无人机设备与资质', '提交设备、证照、适航、保险和 UOM 相关材料。', capabilities.assetStatus),
      buildStep('平台审核', '审核通过后可报价、发布服务并承接订单。', capabilities.assetStatus, '待提交'),
    ],
    [capabilities.assetStatus],
  );

  const executorSteps = useMemo<FlowStep[]>(
    () => [
      buildStep('履约资料', '填写履约负责人、服务区域和联系方式。', capabilities.executorStatus),
      buildStep('履约资质审核', '提交履约资质，平台确认后开通订单推进能力。', capabilities.executorStatus),
      {
        title: '服务商履约',
        desc: '审核通过后由服务商主体开始履约并推进订单状态。',
        status: capabilities.canAcceptDispatch || capabilities.canUseWorkbench ? '可履约' : '待开通',
        tone: capabilities.canAcceptDispatch || capabilities.canUseWorkbench ? 'green' : 'gray',
      },
    ],
    [capabilities.canAcceptDispatch, capabilities.canUseWorkbench, capabilities.executorStatus],
  );

  const runPrimaryAction = () => {
    if (!isAuthenticated) {
      Alert.alert('请先登录', '请返回登录页后用服务商账号登录或注册。');
      return;
    }
    if (capabilities.canUseWorkbench) {
      dispatch(setHaulRoleMode('provider'));
      navigation.navigate('MainTabs', {screen: 'Home'});
      return;
    }
    navigation.navigate('OwnerProfile');
  };

  const openAccountProfile = () => {
    dispatch(setHaulRoleMode('provider'));
    navigation.navigate('MainTabs', {screen: 'Profile'});
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={theme.isDark ? ['#0B2D54', '#0A4D85'] : ['#063B8F', '#0B63D8', '#1189F5']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.hero}>
          <View style={[styles.statusPill, (styles as any)[`statusPill_${headerCopy.tone}`]]}>
            <Text style={styles.statusPillText}>{headerCopy.label}</Text>
          </View>
          <Text style={styles.heroTitle}>{headerCopy.title}</Text>
          <Text style={styles.heroDesc}>{headerCopy.desc}</Text>
          <View style={styles.heroActions}>
            <TouchableOpacity activeOpacity={0.86} style={styles.primaryBtn} onPress={runPrimaryAction}>
              <Text style={styles.primaryBtnText}>{headerCopy.action}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.86} style={styles.secondaryBtn} onPress={openAccountProfile}>
              <Text style={styles.secondaryBtnText}>查看账号资料</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <StatusOverviewCard
          rows={statusOverviewRows}
          actionLabel={headerCopy.action}
          onAction={runPrimaryAction}
          styles={styles}
        />

        <CapabilityCard
          title="设备服务能力"
          desc="适合自有或可调度无人机的服务商。"
          note={assetMeta.desc}
          status={assetMeta.label}
          tone={assetMeta.tone}
          steps={assetSteps}
          actions={[
            {label: '服务商资料', onPress: () => navigation.navigate('OwnerProfile')},
            {label: '设备与资质', onPress: () => navigation.navigate('MyDrones'), highlighted: true},
          ]}
          styles={styles}
        />

        <CapabilityCard
          title="履约资质"
          desc="用于证明服务商具备现场履约和订单推进能力。"
          note={executorMeta.desc}
          status={executorMeta.label}
          tone={executorMeta.tone}
          steps={executorSteps}
          actions={[
            {label: '履约资质认证', onPress: () => navigation.navigate('PilotRegister'), highlighted: true},
          ]}
          styles={styles}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>基础资料</Text>
          <BasicRow
            title="实名认证"
            desc="账号实名是服务商审核的基础条件之一。"
            action="去完善"
            onPress={() => navigation.navigate('Verification')}
            styles={styles}
          />
          <BasicRow
            title="账号资料"
            desc="查看手机号、昵称、客户资料和当前身份状态。"
            action="查看"
            onPress={openAccountProfile}
            styles={styles}
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusOverviewCard({
  rows,
  actionLabel,
  onAction,
  styles,
}: {
  rows: StatusOverviewRow[];
  actionLabel: string;
  onAction: () => void;
  styles: ReturnType<typeof getStyles>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>资质审核状态</Text>
          <Text style={styles.cardDesc}>资产、执行和整体服务商状态会共同决定工作台能力。</Text>
        </View>
      </View>
      <View style={styles.overviewList}>
        {rows.map(row => (
          <View key={row.key} style={styles.overviewRow}>
            <View style={[styles.overviewBadge, (styles as any)[`overviewBadge_${row.tone}`]]}>
              <Text style={[styles.overviewBadgeText, (styles as any)[`overviewBadgeText_${row.tone}`]]}>{row.label}</Text>
            </View>
            <View style={styles.overviewMain}>
              <Text style={styles.overviewTitle}>{row.title}</Text>
              <Text style={styles.overviewDesc}>{row.desc}</Text>
            </View>
            <Text style={[styles.overviewStatus, (styles as any)[`stepStatus_${row.tone}`]]}>{row.status}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity activeOpacity={0.86} style={styles.overviewAction} onPress={onAction}>
        <Text style={styles.overviewActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CapabilityCard({
  title,
  desc,
  note,
  status,
  tone,
  steps,
  actions,
  styles,
}: {
  title: string;
  desc: string;
  note: string;
  status: string;
  tone: StatusTone;
  steps: FlowStep[];
  actions: Array<{label: string; onPress: () => void; highlighted?: boolean}>;
  styles: ReturnType<typeof getStyles>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
        <View style={[styles.pill, (styles as any)[`pill_${tone}`]]}>
          <Text style={[styles.pillText, (styles as any)[`pillText_${tone}`]]}>{status}</Text>
        </View>
      </View>
      <Text style={styles.cardNote}>{note}</Text>
      <View style={styles.stepList}>
        {steps.map((step, index) => (
          <View key={step.title} style={[styles.stepRow, index === steps.length - 1 && styles.stepRowLast]}>
            <View style={[styles.stepDot, (styles as any)[`dot_${step.tone}`]]} />
            <View style={styles.stepMain}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
            <Text style={[styles.stepStatus, (styles as any)[`stepStatus_${step.tone}`]]}>{step.status}</Text>
          </View>
        ))}
      </View>
      <View style={styles.cardActions}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.label}
            activeOpacity={0.86}
            style={[styles.linkBtn, action.highlighted && styles.linkBtnHighlighted]}
            onPress={action.onPress}>
            <Text style={[styles.linkBtnText, action.highlighted && styles.linkBtnTextHighlighted]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function BasicRow({
  title,
  desc,
  action,
  onPress,
  styles,
  last,
}: {
  title: string;
  desc: string;
  action: string;
  onPress: () => void;
  styles: ReturnType<typeof getStyles>;
  last?: boolean;
}) {
  return (
    <TouchableOpacity activeOpacity={0.84} style={[styles.basicRow, last && styles.basicRowLast]} onPress={onPress}>
      <View style={styles.basicCopy}>
        <Text style={styles.basicTitle}>{title}</Text>
        <Text style={styles.basicDesc}>{desc}</Text>
      </View>
      <Text style={styles.basicAction}>{action}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 112,
  },
  hero: {
    borderRadius: 18,
    padding: 22,
    shadowColor: '#09449D',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: theme.isDark ? 0 : 0.22,
    shadowRadius: 21,
    elevation: 5,
  },
  statusPill: {
    alignSelf: 'flex-start',
    minWidth: 62,
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill_blue: {backgroundColor: 'rgba(221,235,255,0.24)'},
  statusPill_green: {backgroundColor: 'rgba(211,248,224,0.25)'},
  statusPill_orange: {backgroundColor: 'rgba(255,230,198,0.27)'},
  statusPill_red: {backgroundColor: 'rgba(255,222,220,0.28)'},
  statusPill_gray: {backgroundColor: 'rgba(255,255,255,0.18)'},
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  heroTitle: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
  },
  heroDesc: {
    marginTop: 9,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  primaryBtn: {
    flex: 1.15,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  primaryBtnText: {
    color: '#0756C7',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#0B1F3A',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: theme.isDark ? 0 : 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  cardDesc: {
    marginTop: 3,
    color: theme.textSub,
    fontSize: 13,
    lineHeight: 19,
  },
  cardNote: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : '#F6F8FC',
    color: theme.textSub,
    fontSize: 13,
    lineHeight: 20,
  },
  overviewList: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  overviewRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
    backgroundColor: theme.card,
  },
  overviewBadge: {
    width: 42,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewBadge_gray: {backgroundColor: theme.isDark ? 'rgba(255,255,255,0.07)' : '#EEF2F7'},
  overviewBadge_blue: {backgroundColor: theme.primaryBg},
  overviewBadge_orange: {backgroundColor: theme.isDark ? 'rgba(255,179,64,0.12)' : '#FFF0DB'},
  overviewBadge_green: {backgroundColor: theme.isDark ? 'rgba(0,229,122,0.12)' : '#DCF7E5'},
  overviewBadge_red: {backgroundColor: theme.isDark ? 'rgba(255,107,107,0.12)' : '#FFE7E5'},
  overviewBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  overviewBadgeText_gray: {color: theme.textSub},
  overviewBadgeText_blue: {color: theme.primaryText},
  overviewBadgeText_orange: {color: theme.warning},
  overviewBadgeText_green: {color: theme.success},
  overviewBadgeText_red: {color: theme.danger},
  overviewMain: {
    flex: 1,
    minWidth: 0,
  },
  overviewTitle: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  overviewDesc: {
    marginTop: 3,
    color: theme.textSub,
    fontSize: 12,
    lineHeight: 18,
  },
  overviewStatus: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '900',
  },
  overviewAction: {
    height: 42,
    marginTop: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primaryBg,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  overviewActionText: {
    color: theme.primaryText,
    fontSize: 14,
    fontWeight: '900',
  },
  pill: {
    minWidth: 58,
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill_gray: {backgroundColor: theme.isDark ? 'rgba(255,255,255,0.07)' : '#EEF2F7'},
  pill_blue: {backgroundColor: theme.primaryBg},
  pill_orange: {backgroundColor: theme.isDark ? 'rgba(255,179,64,0.12)' : '#FFF0DB'},
  pill_green: {backgroundColor: theme.isDark ? 'rgba(0,229,122,0.12)' : '#DCF7E5'},
  pill_red: {backgroundColor: theme.isDark ? 'rgba(255,107,107,0.12)' : '#FFE7E5'},
  pillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  pillText_gray: {color: theme.textSub},
  pillText_blue: {color: theme.primaryText},
  pillText_orange: {color: theme.warning},
  pillText_green: {color: theme.success},
  pillText_red: {color: theme.danger},
  stepList: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
    backgroundColor: theme.card,
  },
  stepRowLast: {
    borderBottomWidth: 0,
  },
  stepDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 11,
  },
  dot_gray: {backgroundColor: theme.textHint},
  dot_blue: {backgroundColor: theme.primary},
  dot_orange: {backgroundColor: theme.warning},
  dot_green: {backgroundColor: theme.success},
  dot_red: {backgroundColor: theme.danger},
  stepMain: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  stepDesc: {
    marginTop: 3,
    color: theme.textSub,
    fontSize: 12,
    lineHeight: 18,
  },
  stepStatus: {
    marginLeft: 10,
    fontSize: 12,
    fontWeight: '800',
  },
  stepStatus_gray: {color: theme.textSub},
  stepStatus_blue: {color: theme.primaryText},
  stepStatus_orange: {color: theme.warning},
  stepStatus_green: {color: theme.success},
  stepStatus_red: {color: theme.danger},
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  linkBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.btnGhostBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnHighlighted: {
    backgroundColor: theme.primaryBg,
    borderColor: theme.primary,
  },
  linkBtnText: {
    color: theme.btnGhostText,
    fontSize: 14,
    fontWeight: '800',
  },
  linkBtnTextHighlighted: {
    color: theme.primaryText,
  },
  basicRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  basicRowLast: {
    borderBottomWidth: 0,
  },
  basicCopy: {
    flex: 1,
  },
  basicTitle: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  basicDesc: {
    marginTop: 4,
    color: theme.textSub,
    fontSize: 12,
    lineHeight: 18,
  },
  basicAction: {
    color: theme.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
});
