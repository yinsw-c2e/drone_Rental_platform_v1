import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  ImageStyle,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import {homeService} from '../../services/home';
import {dispatchV2Service} from '../../services/dispatchV2';
import {ownerService} from '../../services/owner';
import {
  HomeDashboard,
  OwnerWorkbenchOrderItem,
  OwnerWorkbenchView,
  V2DispatchTaskSummary,
} from '../../types';
import {RootState} from '../../store/store';
import {providerWorkbenchAssets} from '../../assets/haul/providerWorkbench';
import {
  canUseProviderWorkbench,
  getEffectiveRoleSummary,
  resolveProviderCapabilities,
} from '../../utils/roleSummary';
import {setHaulRoleMode} from '../../store/slices/roleSlice';

type DesignTextProps = React.PropsWithChildren<{
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>;

type MetricItem = {
  key: string;
  label: string;
  value: string;
  icon: ImageSourcePropType;
  color: string;
  money?: boolean;
  onPress: () => void;
};

type QuickEntry = {
  key: string;
  label: string;
  icon: ImageSourcePropType;
  iconSize: [number, number];
  onPress: () => void;
};

type TodoItem = {
  key: string;
  title: string;
  subtitle: string;
  status: string;
  icon: ImageSourcePropType;
  tone: 'orange' | 'blue' | 'red';
  statusWidth: number;
  onPress: () => void;
};

const DESIGN_WIDTH = 941;
const DESIGN_CONTENT_BOTTOM = 1532;

const formatMoney = (amount: number) =>
  amount.toLocaleString('zh-CN', {maximumFractionDigits: 0});

const firstFulfillmentOrderOf = (workbench?: OwnerWorkbenchView | null): OwnerWorkbenchOrderItem | null =>
  workbench?.pending_provider_confirmation_orders?.[0] ||
  workbench?.pending_dispatch_orders?.[0] ||
  null;

const ACTIVE_EXECUTION_STATUSES = ['accepted', 'executing', 'assigned', 'preparing'];

const isPendingExecutionTask = (task: V2DispatchTaskSummary) =>
  String(task.status || '').toLowerCase() === 'pending_response';

const isActiveExecutionTask = (task: V2DispatchTaskSummary) =>
  ACTIVE_EXECUTION_STATUSES.includes(String(task.status || '').toLowerCase());

const firstExecutionTaskOf = (tasks: V2DispatchTaskSummary[]) =>
  tasks.find(isPendingExecutionTask) || tasks.find(isActiveExecutionTask) || tasks[0] || null;

const formatOrderTodoSubtitle = (item: OwnerWorkbenchOrderItem) => {
  const route = [item.service_address, item.dest_address].filter(Boolean).join(' → ') || '待补地址';
  return `${route} · ${formatMoney(Math.round(Number(item.total_amount || 0) / 100))}元`;
};

const formatDispatchTodoSubtitle = (task: V2DispatchTaskSummary) => {
  const order = task.order;
  const route = [order?.service_address, order?.dest_address].filter(Boolean).join(' → ') || '待补地址';
  const amount = Number(order?.total_amount || 0);
  return `${route} · ${formatMoney(Math.round(amount / 100))}元`;
};

const todoStatusWidth = (status: string) => {
  if (status.length >= 5) return 142;
  if (status.length >= 4) return 119;
  return 93;
};

function DesignText({children, style, numberOfLines}: DesignTextProps) {
  return (
    <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );
}

function HeaderMessageGlyph({
  style,
  dp,
}: {
  style: StyleProp<ViewStyle>;
  dp: (value: number) => number;
}) {
  return (
    <View style={[styles.headerGlyph, style]}>
      <View
        style={[
          styles.messageBubble,
          {
            left: dp(2),
            top: dp(5),
            width: dp(42),
            height: dp(30),
            borderRadius: dp(8),
            borderWidth: dp(3),
          },
        ]}
      />
      <View
        style={[
          styles.messageTail,
          {
            left: dp(12),
            top: dp(31),
            width: dp(13),
            height: dp(12),
            borderLeftWidth: dp(3),
            borderBottomWidth: dp(3),
            transform: [{rotate: '-18deg'}],
          },
        ]}
      />
      {[15, 24, 33].map(left => (
        <View
          key={left}
          style={[
            styles.messageDotInline,
            {
              left: dp(left),
              top: dp(18),
              width: dp(4),
              height: dp(4),
              borderRadius: dp(2),
            },
          ]}
        />
      ))}
    </View>
  );
}

function HeaderSettingsGlyph({
  style,
  dp,
}: {
  style: StyleProp<ViewStyle>;
  dp: (value: number) => number;
}) {
  const teeth = [
    {left: 27, top: 1, width: 5, height: 11},
    {left: 27, top: 48, width: 5, height: 11},
    {left: 1, top: 27, width: 11, height: 5},
    {left: 47, top: 27, width: 11, height: 5},
    {left: 9, top: 10, width: 10, height: 5, rotate: '45deg'},
    {left: 40, top: 10, width: 10, height: 5, rotate: '-45deg'},
    {left: 9, top: 45, width: 10, height: 5, rotate: '-45deg'},
    {left: 40, top: 45, width: 10, height: 5, rotate: '45deg'},
  ];
  return (
    <View style={[styles.headerGlyph, style]}>
      {teeth.map((item, index) => (
        <View
          key={index}
          style={[
            styles.settingsTooth,
            {
              left: dp(item.left),
              top: dp(item.top),
              width: dp(item.width),
              height: dp(item.height),
              borderRadius: dp(3),
              transform: item.rotate ? [{rotate: item.rotate}] : undefined,
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.settingsCore,
          {
            left: dp(13),
            top: dp(13),
            width: dp(33),
            height: dp(33),
            borderRadius: dp(17),
            borderWidth: dp(4),
          },
        ]}>
        <View
          style={[
            styles.settingsInner,
            {
              left: dp(8),
              top: dp(8),
              width: dp(9),
              height: dp(9),
              borderRadius: dp(5),
              borderWidth: dp(3),
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function ProviderWorkbenchScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const dispatch = useDispatch();
  const screenWidth = width || 390;
  const scale = screenWidth / DESIGN_WIDTH;
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [openedOnboardingOnce, setOpenedOnboardingOnce] = useState(false);

  const dp = (value: number) => Number((value * scale).toFixed(2));
  const frame = (x: number, y: number, w: number, h: number): ViewStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dp(y),
    width: dp(w),
    height: dp(h),
  });
  const relFrame = frame;
  const imageFrame = (x: number, y: number, w: number, h: number): ImageStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dp(y),
    width: dp(w),
    height: dp(h),
  });
  const type = (
    fontSize: number,
    lineHeight: number,
    fontWeight: TextStyle['fontWeight'],
    color: string,
  ): TextStyle => ({
    color,
    fontSize: dp(fontSize),
    lineHeight: dp(lineHeight),
    fontWeight,
  });
  const cardShadow = (
    opacity: number,
    radius: number,
    offsetY: number,
    elevation: number,
  ): ViewStyle => ({
    shadowColor: '#071F58',
    shadowOpacity: opacity,
    shadowRadius: dp(radius),
    shadowOffset: {width: 0, height: dp(offsetY)},
    elevation,
  });
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = useMemo(() => getEffectiveRoleSummary(roleSummary), [roleSummary]);
  const providerCapabilities = useMemo(() => resolveProviderCapabilities(effectiveRoleSummary), [effectiveRoleSummary]);
  const canUseProvider = canUseProviderWorkbench(effectiveRoleSummary);
  const providerBrandName = useMemo(() => {
    const nickname = String(user?.nickname || '').trim();
    return nickname || '服务商工作台';
  }, [user?.nickname]);
  const providerCertLabel = useMemo(() => {
    if (providerCapabilities.canSelfExecute) return '综合就绪';
    if (providerCapabilities.canPublishSupply) return '设备就绪';
    if (providerCapabilities.canAcceptDispatch) return '执行就绪';
    return '待入驻';
  }, [providerCapabilities.canAcceptDispatch, providerCapabilities.canPublishSupply, providerCapabilities.canSelfExecute]);
  const providerGateCopy = useMemo(() => {
    if (!isAuthenticated) {
      return {
        title: '登录后进入接单工作台',
        desc: '接单工作台只展示真实订单、派单和结算数据，请先登录服务商账号。',
        primary: '去登录',
      };
    }
    if (providerCapabilities.nextAction === 'wait_review') {
      return {
        title: '服务商资质审核中',
        desc: '你的服务商资料、设备资质或执行人员认证正在审核，通过后才能正式接单、派单和管理履约。',
        primary: '查看入驻进度',
      };
    }
    if (providerCapabilities.nextAction === 'fix_rejected') {
      return {
        title: '服务商资质需补充',
        desc: '当前服务商资质未通过或已暂停，请补充资料后重新提交审核。',
        primary: '补充服务商资质',
      };
    }
    return {
      title: '服务商能力未开通',
      desc: '先完善服务商资料、设备资质或执行人员认证，审核通过后才能接单、派单和管理履约。',
      primary: '开始服务商入驻',
    };
  }, [isAuthenticated, providerCapabilities.nextAction]);
  const [workbench, setWorkbench] = useState<OwnerWorkbenchView | null>(null);
  const [executionTasks, setExecutionTasks] = useState<V2DispatchTaskSummary[]>([]);

  const refreshDashboard = useCallback(() => {
    if (!isAuthenticated || !canUseProvider) {
      setDashboard(null);
      setWorkbench(null);
      setExecutionTasks([]);
      return;
    }
    Promise.all([
      homeService.getDashboard().catch(() => null),
      ownerService.getWorkbench().catch(() => null),
      dispatchV2Service.list({role: 'pilot', page: 1, page_size: 50}).catch(() => null),
    ])
      .then(([dashboardRes, workbenchRes, dispatchRes]) => {
        setDashboard((dashboardRes as any)?.data || dashboardRes || null);
        setWorkbench((workbenchRes as any)?.data || workbenchRes || null);
        setExecutionTasks(((dispatchRes as any)?.data?.items || (dispatchRes as any)?.items || []) as V2DispatchTaskSummary[]);
      })
      .catch(() => null);
  }, [canUseProvider, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      dispatch(setHaulRoleMode('provider'));
      if (isAuthenticated && !canUseProvider && !openedOnboardingOnce) {
        setOpenedOnboardingOnce(true);
        navigation.navigate('ProviderOnboarding', {from: 'workbench'});
        return;
      }
      refreshDashboard();
    }, [canUseProvider, dispatch, isAuthenticated, navigation, openedOnboardingOnce, refreshDashboard]),
  );

  const stats = useMemo(() => {
    const owner = dashboard?.role_views?.owner;
    const pilot = dashboard?.role_views?.pilot;
    const summary = dashboard?.summary;
    const workbenchSummary = workbench?.summary;
    const pendingProviderCount = Number(
      workbenchSummary?.pending_provider_confirmation_order_count ??
      owner?.pending_provider_confirmation_order_count ??
      0,
    );
    const pendingDispatchCount = Number(
      workbenchSummary?.pending_dispatch_order_count ??
      owner?.pending_dispatch_order_count ??
      0,
    );
    const pendingExecutionCount = Number(
      pilot?.pending_response_dispatch_count ??
      executionTasks.filter(isPendingExecutionTask).length,
    );
    const activeExecutionCount = Number(
      pilot?.active_dispatch_count ??
      executionTasks.filter(isActiveExecutionTask).length,
    );
    return {
      todayPending: pendingProviderCount + pendingDispatchCount + pendingExecutionCount,
      pendingQuote:
        Number(owner?.pending_quote_count ?? 0) +
        Number(owner?.recommended_demand_count ?? workbenchSummary?.recommended_demand_count ?? 0),
      pendingFulfillment: pendingDispatchCount + pendingExecutionCount + activeExecutionCount,
      monthIncome: Number(summary?.today_income_amount ?? 0),
    };
  }, [dashboard, executionTasks, workbench]);

  const firstFulfillmentOrder = useMemo(() => firstFulfillmentOrderOf(workbench), [workbench]);
  const firstExecutionTask = useMemo(() => firstExecutionTaskOf(executionTasks), [executionTasks]);

  const openFulfillment = useCallback((orderId?: number) => {
    const nextOrderId = Number(orderId || firstFulfillmentOrder?.id || 0);
    navigation.navigate('Fulfillment', nextOrderId ? {orderId: nextOrderId, id: nextOrderId} : undefined);
  }, [firstFulfillmentOrder?.id, navigation]);

  const openCurrentExecutionTask = useCallback((taskId?: number) => {
    const nextTaskId = Number(taskId || firstExecutionTask?.id || 0);
    if (nextTaskId) {
      navigation.navigate('DispatchTaskDetail', {id: nextTaskId, role: 'pilot'});
      return;
    }
    navigation.navigate('PilotTaskList');
  }, [firstExecutionTask?.id, navigation]);

  const openFulfillmentOrExecution = useCallback(() => {
    if (firstFulfillmentOrder?.id) {
      openFulfillment(firstFulfillmentOrder.id);
      return;
    }
    if (firstExecutionTask?.id || providerCapabilities.hasExecutorRole || dashboard?.role_summary?.has_pilot_role) {
      openCurrentExecutionTask();
      return;
    }
    openFulfillment();
  }, [
    dashboard?.role_summary?.has_pilot_role,
    firstExecutionTask?.id,
    firstFulfillmentOrder?.id,
    openCurrentExecutionTask,
    openFulfillment,
    providerCapabilities.hasExecutorRole,
  ]);

  const openDeviceStaff = () => {
    Alert.alert('设备与人员', undefined, [
      {text: '设备管理', onPress: () => navigation.navigate('MyDrones')},
      {text: '人员绑定', onPress: () => navigation.navigate('OwnerPilotBindings')},
      {text: '取消', style: 'cancel'},
    ]);
  };

  const openProviderOnboarding = () => {
    if (!isAuthenticated) {
      navigation.navigate('ProviderOnboarding', {from: 'workbench'});
      return;
    }
    navigation.navigate('ProviderOnboarding', {from: 'workbench'});
  };

  const openDemandTab = () => {
    navigation.navigate('Orders');
  };

  const metrics: MetricItem[] = [
    {
      key: 'pending',
      label: '今日待处理',
      value: String(stats.todayPending),
      icon: providerWorkbenchAssets.metricPending,
      color: '#096BFF',
      onPress: openFulfillmentOrExecution,
    },
    {
      key: 'quote',
      label: '待报价需求',
      value: String(stats.pendingQuote),
      icon: providerWorkbenchAssets.metricQuote,
      color: '#FF5B0A',
      onPress: openDemandTab,
    },
    {
      key: 'contract',
      label: '待履约订单',
      value: String(stats.pendingFulfillment),
      icon: providerWorkbenchAssets.metricContract,
      color: '#12B64B',
      onPress: openFulfillmentOrExecution,
    },
    {
      key: 'income',
      label: '本月收入',
      value: `¥${formatMoney(stats.monthIncome)}`,
      icon: providerWorkbenchAssets.metricIncome,
      color: '#5A31E8',
      money: true,
      onPress: () => navigation.navigate('Wallet'),
    },
  ];

  const quickEntries: QuickEntry[] = [
    {
      key: 'new-demand',
      label: '查看新需求',
      icon: providerWorkbenchAssets.quickNewDemand,
      iconSize: [76, 75],
      onPress: openDemandTab,
    },
    {
      key: 'my-quote',
      label: '我的报价',
      icon: providerWorkbenchAssets.quickMyQuote,
      iconSize: [78, 78],
      onPress: () => navigation.navigate('MyQuotes'),
    },
    {
      key: 'fulfillment',
      label: '履约执行',
      icon: providerWorkbenchAssets.quickFulfillment,
      iconSize: [75, 76],
      onPress: openFulfillmentOrExecution,
    },
    {
      key: 'device-staff',
      label: '设备与人员',
      icon: providerWorkbenchAssets.quickDeviceStaff,
      iconSize: [88, 76],
      onPress: openDeviceStaff,
    },
    {
      key: 'qualification',
      label: '服务资质',
      icon: providerWorkbenchAssets.quickQualification,
      iconSize: [80, 82],
      onPress: openProviderOnboarding,
    },
  ];

  const todoItems: TodoItem[] = useMemo(() => {
    const items: TodoItem[] = [];
    (workbench?.recommended_demands || []).slice(0, 1).forEach(item => {
      const budgetMin = formatMoney(Math.round(Number(item.budget_min || 0) / 100));
      const budgetMax = formatMoney(Math.round(Number(item.budget_max || 0) / 100));
      items.push({
        key: `demand-${item.id}`,
        title: item.title || '新需求待报价',
        subtitle: `${item.service_address_text || '待补地址'} · 预算 ${budgetMin}-${budgetMax}元`,
        status: '待报价',
        icon: providerWorkbenchAssets.todoNewDemand,
        tone: 'orange',
        statusWidth: todoStatusWidth('待报价'),
        onPress: () => navigation.navigate('DemandDetail', {id: item.id}),
      });
    });
    (workbench?.pending_provider_confirmation_orders || []).slice(0, 2).forEach(item => {
      items.push({
        key: `confirm-${item.id}`,
        title: item.title || item.order_no || '直达订单待确认',
        subtitle: formatOrderTodoSubtitle(item),
        status: '待确认',
        icon: providerWorkbenchAssets.todoOrderSchedule,
        tone: 'orange',
        statusWidth: todoStatusWidth('待确认'),
        onPress: () => openFulfillment(item.id),
      });
    });
    executionTasks.filter(isPendingExecutionTask).slice(0, 2).forEach(task => {
      const status = '待确认执行';
      items.push({
        key: `execution-${task.id}`,
        title: task.order?.title || task.dispatch_no || '执行任务待确认',
        subtitle: formatDispatchTodoSubtitle(task),
        status,
        icon: providerWorkbenchAssets.todoOrderSchedule,
        tone: 'orange',
        statusWidth: todoStatusWidth(status),
        onPress: () => openCurrentExecutionTask(task.id),
      });
    });
    (workbench?.pending_dispatch_orders || []).slice(0, 2).forEach(item => {
      items.push({
        key: `dispatch-${item.id}`,
        title: item.title || item.order_no || '订单待安排执行',
        subtitle: formatOrderTodoSubtitle(item),
        status: '待派单',
        icon: providerWorkbenchAssets.todoAirspace,
        tone: 'blue',
        statusWidth: todoStatusWidth('待派单'),
        onPress: () => openFulfillment(item.id),
      });
    });
    executionTasks.filter(isActiveExecutionTask).slice(0, 1).forEach(task => {
      items.push({
        key: `active-execution-${task.id}`,
        title: task.order?.title || task.dispatch_no || '执行任务进行中',
        subtitle: formatDispatchTodoSubtitle(task),
        status: '执行中',
        icon: providerWorkbenchAssets.todoAirspace,
        tone: 'blue',
        statusWidth: todoStatusWidth('执行中'),
        onPress: () => openCurrentExecutionTask(task.id),
      });
    });
    if (items.length === 0) {
      return [{
        key: 'empty',
        title: '暂无待处理事项',
        subtitle: '当前没有后端返回的待办订单或需求',
        status: '已同步',
        icon: providerWorkbenchAssets.todoInsurance,
        tone: 'blue',
        statusWidth: todoStatusWidth('已同步'),
        onPress: openFulfillmentOrExecution,
      }];
    }
    return items.slice(0, 4);
  }, [executionTasks, navigation, openCurrentExecutionTask, openFulfillment, openFulfillmentOrExecution, workbench]);

  const statusTone = {
    orange: {bg: '#FFF1EA', text: '#FF4B18'},
    blue: {bg: '#EAF2FF', text: '#005BFF'},
    red: {bg: '#FFECEB', text: '#E61616'},
  };

  const canvasHeight = dp(DESIGN_CONTENT_BOTTOM);

  if (!isAuthenticated || !canUseProvider) {
    return (
      <View style={styles.root}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {height: canvasHeight + Math.max(0, insets.bottom - 10)},
          ]}>
          <View style={[styles.canvas, {width: screenWidth, height: canvasHeight}]}>
            <LinearGradient
              colors={['#00386C', '#034A88']}
              start={{x: 0.08, y: 0}}
              end={{x: 0.94, y: 1}}
              style={frame(0, 0, 941, 455)}
            />
            <View
              style={[
                styles.topCurve,
                {
                  left: dp(-106),
                  top: dp(420),
                  width: screenWidth + dp(212),
                  height: dp(88),
                  borderTopLeftRadius: dp(577),
                  borderTopRightRadius: dp(577),
                },
              ]}
            />
            <DesignText style={[frame(42, 234, 146, 58), type(45, 58, '700', '#FFFFFF')]}>
              工作台
            </DesignText>
            <View style={[frame(35, 336, 870, 430), styles.card, {borderRadius: dp(24)}, cardShadow(0.1, 28, 12, 5)]}>
              <DesignText style={[relFrame(54, 66, 760, 52), type(40, 52, '700', '#061E4F'), styles.centerText]}>
                {providerGateCopy.title}
              </DesignText>
              <DesignText style={[relFrame(74, 145, 720, 84), type(28, 42, '400', '#4C6090'), styles.centerText]}>
                {providerGateCopy.desc}
              </DesignText>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={openProviderOnboarding}
                style={[relFrame(180, 266, 510, 78), styles.gatePrimary, {borderRadius: dp(12)}]}>
                <DesignText style={[type(30, 38, '700', '#FFFFFF'), styles.centerText]}>
                  {providerGateCopy.primary}
                </DesignText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {height: canvasHeight + Math.max(0, insets.bottom - 10)},
        ]}>
        <View style={[styles.canvas, {width: screenWidth, height: canvasHeight}]}>
          <LinearGradient
            colors={['#00386C', '#034A88']}
            start={{x: 0.08, y: 0}}
            end={{x: 0.94, y: 1}}
            style={frame(0, 0, 941, 455)}
          />
          <View
            style={[
              styles.topCurve,
              {
                left: dp(-106),
                top: dp(420),
                width: screenWidth + dp(212),
                height: dp(88),
                borderTopLeftRadius: dp(577),
                borderTopRightRadius: dp(577),
              },
            ]}
          />

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => navigation.navigate('OwnerProfile')}
            style={frame(42, 109, 488, 91)}>
            <Image source={providerWorkbenchAssets.logo} style={imageFrame(0, 0, 91, 91)} resizeMode="contain" />
            <DesignText numberOfLines={1} style={[frame(112, 21, 246, 48), type(39, 48, '700', '#FFFFFF')]}>
              {providerBrandName}
            </DesignText>
            <View style={[frame(367, 18, 120, 41), styles.certBadge, {borderRadius: dp(8)}]}>
              <DesignText style={type(25, 32, '500', '#FFFFFF')}>{providerCertLabel}</DesignText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.84} onPress={() => navigation.navigate('Messages')} style={frame(696, 103, 103, 103)}>
            <View style={[frame(70, 6, 20, 20), styles.messageDot, {borderRadius: dp(10)}]} />
            <HeaderMessageGlyph style={frame(28, 16, 51, 45)} dp={dp} />
            <DesignText style={[frame(0, 70, 103, 34), type(26, 34, '400', '#FFFFFF'), styles.centerText]}>消息</DesignText>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.84} onPress={() => navigation.navigate('Settings')} style={frame(811, 103, 94, 103)}>
            <HeaderSettingsGlyph style={frame(21, 12, 59, 60)} dp={dp} />
            <DesignText style={[frame(0, 70, 94, 34), type(26, 34, '400', '#FFFFFF'), styles.centerText]}>设置</DesignText>
          </TouchableOpacity>

          <DesignText style={[frame(42, 234, 146, 58), type(45, 58, '700', '#FFFFFF')]}>
            工作台
          </DesignText>

          <View style={[frame(35, 304, 870, 360), styles.card, {borderRadius: dp(24)}, cardShadow(0.1, 28, 12, 5)]}>
            <View style={[relFrame(34, 175, 801, 1), styles.divider]} />
            <View style={[relFrame(431, 26, 1, 306), styles.divider]} />
            {metrics.map((item, index) => {
              const x = index % 2 === 0 ? 23 : 443;
              const y = index < 2 ? 24 : 199;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.84}
                  onPress={item.onPress}
                  style={relFrame(x, y, 390, 140)}>
                  <Image source={item.icon} style={imageFrame(11, 12, 102, 104)} resizeMode="contain" />
                  <DesignText style={[frame(137, 23, 190, 38), type(29, 38, '500', '#061E4F')]}>
                    {item.label}
                  </DesignText>
                  <DesignText
                    style={[
                      frame(item.money ? 126 : 137, item.money ? 58 : 62, item.money ? 224 : 110, item.money ? 60 : 64),
                      type(item.money ? 51 : 57, item.money ? 60 : 64, '700', item.color),
                    ]}>
                    {item.value}
                  </DesignText>
                  <Image source={providerWorkbenchAssets.chevronRight} style={imageFrame(354, 49, 22, 32)} resizeMode="contain" />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[frame(35, 687, 870, 294), styles.card, {borderRadius: dp(24)}, cardShadow(0.08, 26, 10, 4)]}>
            <DesignText style={[frame(28, 30, 127, 44), type(34, 44, '700', '#061E4F')]}>
              快捷入口
            </DesignText>
            {quickEntries.map((item, index) => {
              const left = [28, 198, 367, 534, 703][index];
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.84}
                  onPress={item.onPress}
                  style={relFrame(left, 86, 130, 170)}>
                  <View
                    style={[
                      relFrame(0, 0, 130, 126),
                      styles.quickIconBox,
                      {borderRadius: dp(16), borderWidth: StyleSheet.hairlineWidth},
                    ]}>
                    <Image
                      source={item.icon}
                      style={{width: dp(item.iconSize[0]), height: dp(item.iconSize[1])}}
                      resizeMode="contain"
                    />
                  </View>
                  <DesignText style={[frame(-6, 149, 142, 31), type(25, 31, '500', '#061E4F'), styles.centerText]}>
                    {item.label}
                  </DesignText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[frame(35, 1005, 870, 526), styles.card, {borderRadius: dp(24)}, cardShadow(0.08, 26, 10, 4)]}>
            <DesignText style={[frame(28, 28, 166, 44), type(34, 44, '700', '#061E4F')]}>
              待处理事项
            </DesignText>
            <TouchableOpacity activeOpacity={0.84} onPress={() => navigation.navigate('Fulfillment')} style={relFrame(683, 14, 160, 62)}>
              <DesignText style={[frame(0, 10, 118, 34), type(26, 34, '400', '#51658F'), styles.rightText]}>
                全部事项
              </DesignText>
              <Image source={providerWorkbenchAssets.chevronRight} style={imageFrame(132, 14, 22, 32)} resizeMode="contain" />
            </TouchableOpacity>
            <View style={[relFrame(28, 78, 811, 431), styles.todoBox, {borderRadius: dp(10), borderWidth: StyleSheet.hairlineWidth}]}>
              {todoItems.map((item, index) => {
                const tone = statusTone[item.tone];
                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.84}
                    onPress={item.onPress}
                    style={[
                      relFrame(0, 108 * index, 811, 108),
                      index < todoItems.length - 1 ? styles.todoRowBorder : null,
                    ]}>
                    <Image source={item.icon} style={imageFrame(19, 20, 76, 75)} resizeMode="contain" />
                    <DesignText style={[frame(120, 21, 310, 35), type(29, 35, '700', '#061E4F')]}>
                      {item.title}
                    </DesignText>
                    <DesignText
                      numberOfLines={1}
                      style={[frame(121, 65, 430, 28), type(24, 28, '400', '#4C6090')]}>
                      {item.subtitle}
                    </DesignText>
                    <View
                      style={[
                        frame(811 - 66 - item.statusWidth, 32, item.statusWidth, 42),
                        styles.todoStatus,
                        {backgroundColor: tone.bg, borderRadius: dp(8)},
                      ]}>
                      <DesignText style={type(25, 32, '500', tone.text)}>{item.status}</DesignText>
                    </View>
                    <Image source={providerWorkbenchAssets.chevronRight} style={imageFrame(765, 38, 22, 32)} resizeMode="contain" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollContent: {
    backgroundColor: '#F4F7FB',
  },
  canvas: {
    position: 'relative',
    backgroundColor: '#F4F7FB',
    overflow: 'hidden',
  },
  topCurve: {
    position: 'absolute',
    backgroundColor: '#F4F7FB',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  certBadge: {
    position: 'absolute',
    backgroundColor: '#00896F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageDot: {
    position: 'absolute',
    backgroundColor: '#FF3B30',
    zIndex: 2,
  },
  headerGlyph: {
    position: 'absolute',
  },
  messageBubble: {
    position: 'absolute',
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  messageTail: {
    position: 'absolute',
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  messageDotInline: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  settingsTooth: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  settingsCore: {
    position: 'absolute',
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  settingsInner: {
    position: 'absolute',
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  centerText: {
    textAlign: 'center',
  },
  rightText: {
    textAlign: 'right',
  },
  divider: {
    position: 'absolute',
    backgroundColor: '#E1E7F0',
  },
  quickIconBox: {
    position: 'absolute',
    borderColor: '#DDE5F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoBox: {
    position: 'absolute',
    borderColor: '#DFE6F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  todoRowBorder: {
    borderBottomColor: '#E4EAF2',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  todoStatus: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimary: {
    position: 'absolute',
    backgroundColor: '#005BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
