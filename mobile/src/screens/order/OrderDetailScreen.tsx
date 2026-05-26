import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Linking,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {orderProgressAssets} from '../../assets/haul/orderProgress';
import {orderFinanceV2Service} from '../../services/orderFinanceV2';
import {confirmReceipt, orderV2Service} from '../../services/orderV2';
import {store} from '../../store/store';
import {V2SettlementSummary} from '../../types';

const DESIGN_WIDTH = 941;
const DESIGN_HEIGHT = 1672;

type DesignTextProps = React.PropsWithChildren<{
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>;

type SummaryRow = {
  key: string;
  icon: ImageSourcePropType;
  label: string;
  value: string;
  clickable?: boolean;
};

const DesignText = ({style, numberOfLines, children}: DesignTextProps) => (
  <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
    {children}
  </Text>
);

const formatFullDateTime = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const h = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
};

const providerNameOf = (detail: any) =>
  detail?.participants?.provider?.nickname ||
  detail?.provider?.nickname ||
  detail?.provider_nickname ||
  '服务商待确认';

const providerPhoneOf = (detail: any) =>
  detail?.participants?.provider?.phone ||
  detail?.provider?.phone ||
  detail?.provider_phone ||
  '';

const sourceSupplyIdOf = (detail: any) =>
  Number(detail?.source_info?.source_supply_id || detail?.source_supply_id || detail?.supply_id || 0);

const cargoWeightTextOf = (detail: any) => {
  const value = detail?.cargo_weight_kg || detail?.cargo_weight || detail?.payload_weight_kg || detail?.current_dispatch?.cargo_weight;
  return value ? `${value}kg` : '--';
};

const serviceLevelOf = (detail: any) => {
  const weight = Number(String(cargoWeightTextOf(detail)).replace(/[^\d.]/g, '')) || 0;
  if (detail?.estimated_service) return detail.estimated_service;
  if (!weight) return '--';
  if (weight <= 50) return '50kg 级服务';
  if (weight <= 100) return '100kg 级服务';
  if (weight <= 300) return '300kg 级服务';
  return '300kg+ 级服务';
};

const getStepState = (detail: any) => {
  const status = detail?.status || '';
  if (status === 'completed') return 6;
  if (status === 'delivered' || status === 'in_transit') return 5;
  if (['preparing', 'assigned', 'pending_dispatch'].includes(status)) return 3;
  if (['pending_payment', 'paid'].includes(status)) return 2;
  return 1;
};

const statusTitleOf = (status: string) => {
  if (status === 'completed') return '订单已完成';
  if (status === 'delivered') return '等待客户确认';
  if (status === 'cancelled') return '订单已取消';
  if (status === 'pending_provider_confirmation') return '等待服务商接单';
  if (status === 'pending_payment') return '等待支付';
  if (status === 'pending_dispatch') return '等待派单';
  if (['loading', 'in_transit'].includes(status)) return '吊运进行中';
  if (!status) return '订单状态未知';
  return '服务商已接单';
};

const statusDescOf = (status: string) => {
  if (status === 'completed') return '本次吊运服务已完成';
  if (status === 'delivered') return '货物已送达，请确认完成';
  if (status === 'cancelled') return '订单已结束';
  if (status === 'pending_provider_confirmation') return '服务商正在确认方案，请耐心等待';
  if (status === 'pending_payment') return '请完成支付后继续履约流程';
  if (status === 'pending_dispatch') return '服务商正在安排执行团队';
  if (['loading', 'in_transit'].includes(status)) return '吊运作业正在进行';
  if (!status) return '正在等待订单状态同步';
  return '服务商正在安排准备，请耐心等待';
};

const statusLabelOf = (status?: string) => {
  if (status === 'pending_provider_confirmation') return '待服务商确认';
  if (status === 'pending_payment') return '待支付';
  if (status === 'pending_dispatch') return '待派单';
  if (status === 'assigned') return '已派单';
  if (status === 'preparing') return '准备中';
  if (status === 'loading') return '装载中';
  if (status === 'in_transit') return '吊运中';
  if (status === 'delivered') return '待确认收货';
  if (status === 'completed') return '已完成';
  if (status === 'cancelled') return '已取消';
  return status || '状态已更新';
};

const formatMoney = (amount?: number | null) => {
  const value = Number(amount || 0) / 100;
  return `¥${value.toLocaleString('zh-CN', {maximumFractionDigits: 0})}`;
};

const settlementStatusLabelOf = (status?: string) => {
  if (status === 'pending') return '待计算';
  if (status === 'calculated') return '已计算';
  if (status === 'confirmed') return '已确认';
  if (status === 'settled') return '已入账';
  if (status === 'disputed') return '争议中';
  return '待生成';
};

export default function OrderDetailScreen({route, navigation}: any) {
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const screenWidth = width || 390;
  const screenHeight = height || 844;
  const scaleX = screenWidth / DESIGN_WIDTH;
  const scaleY = screenHeight / DESIGN_HEIGHT;
  const [remoteDetail, setRemoteDetail] = useState<any | null>(null);
  const [remoteTimeline, setRemoteTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(route?.params?.orderId || route?.params?.id));
  const [errorText, setErrorText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [settlement, setSettlement] = useState<V2SettlementSummary | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const orderId = Number(route?.params?.orderId || route?.params?.id || 0);

  const x = (value: number) => Number((value * scaleX).toFixed(2));
  const y = (value: number) => Number((value * scaleY).toFixed(2));
  const frame = (left: number, top: number, w: number, h: number): ViewStyle => ({
    position: 'absolute',
    left: x(left),
    top: y(top),
    width: x(w),
    height: y(h),
  });
  const type = (
    fontSize: number,
    lineHeight: number,
    fontWeight: TextStyle['fontWeight'],
    color: string,
  ): TextStyle => ({
    color,
    fontSize: x(fontSize),
    lineHeight: y(lineHeight),
    fontWeight,
  });

  const load = useCallback(async () => {
    if (!orderId) {
      setRemoteDetail(null);
      setRemoteTimeline([]);
      setSettlement(null);
      setErrorText('缺少订单ID，无法展示订单进度');
      setLoading(false);
      return;
    }
    if (!store.getState().auth.accessToken) {
      setRemoteDetail(null);
      setRemoteTimeline([]);
      setSettlement(null);
      setErrorText('请先登录后查看订单进度');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText('');
    setSettlement(null);
    try {
      const res = await orderV2Service.get(orderId);
      const nextDetail = (res as any)?.data || res;
      if (!nextDetail?.id) {
        setRemoteDetail(null);
        setRemoteTimeline([]);
        setSettlement(null);
        setErrorText('订单不存在或当前账号无权查看');
        return;
      }
      setRemoteDetail(nextDetail);
      if (String(nextDetail.status) === 'completed') {
        setSettlementLoading(true);
        try {
          const settlementRes = await orderFinanceV2Service.getSettlement(orderId);
          setSettlement(((settlementRes as any)?.data || settlementRes) as V2SettlementSummary);
        } catch {
          setSettlement(null);
        } finally {
          setSettlementLoading(false);
        }
      }
      try {
        const timelineRes = await orderV2Service.getTimeline(orderId);
        const timelineData = (timelineRes as any)?.data || timelineRes;
        setRemoteTimeline(Array.isArray(timelineData?.items) ? timelineData.items : []);
      } catch {
        setRemoteTimeline(Array.isArray(nextDetail?.timeline) ? nextDetail.timeline : []);
      }
    } catch (error: any) {
      setRemoteDetail(null);
      setRemoteTimeline([]);
      setSettlement(null);
      setErrorText(error?.message || '订单加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const detail = useMemo(() => remoteDetail, [remoteDetail]);
  const orderNo = detail?.order_no || '';
  const createdAt = formatFullDateTime(detail?.created_at);
  const providerConfirmedAt = detail?.provider_confirmed_at ? formatFullDateTime(detail?.provider_confirmed_at) : '等待确认';
  const teamArrangedAt = detail?.current_dispatch?.created_at ? formatFullDateTime(detail?.current_dispatch?.created_at) : '待安排';
  const stepState = detail ? getStepState(detail) : 0;
  const canConfirm = detail?.status === 'delivered';
  const canPay = detail?.status === 'pending_payment';
  const canReview = detail?.status === 'completed';
  const needsContractSign = canPay && !(detail?.payment_ready || detail?.contract?.payment_ready);
  const supplyId = detail ? sourceSupplyIdOf(detail) : 0;
  const demandId = Number(detail?.source_info?.demand_id || detail?.demand_id || 0);
  const providerPhone = detail ? providerPhoneOf(detail) : '';

  const openService = () => {
    navigation.navigate('MainTabs', {screen: 'Messages'});
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', {screen: 'Orders'});
  };

  const viewPlan = () => {
    if (supplyId) {
      navigation.navigate('OfferDetail', {id: supplyId});
      return;
    }
    if (demandId) {
      navigation.navigate('DemandDetail', {id: demandId, demandId});
      return;
    }
    Alert.alert('暂无方案详情', '当前订单没有可打开的服务方案。');
  };

  const copyOrderNo = () => {
    if (!orderNo) return;
    Alert.alert('订单号', `${orderNo}\n\n已复制入口待接入系统剪贴板能力。`);
  };

  const contactProvider = async () => {
    if (providerPhone) {
      const url = `tel:${providerPhone}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        Linking.openURL(url);
        return;
      }
    }
    Alert.alert('联系服务商', '当前服务商暂无电话，可先通过消息联系客服。', [
      {text: '取消', style: 'cancel'},
      {text: '去消息', onPress: openService},
    ]);
  };

  const submitConfirm = () => {
    if (canPay) {
      navigation.navigate(needsContractSign ? 'Contract' : 'Payment', {orderId, id: orderId});
      return;
    }
    if (canReview) {
      navigation.navigate('Review', {orderId, id: orderId});
      return;
    }
    if (!canConfirm) return;
    Alert.alert('确认完成', '确认货物已完成吊运并签收？', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认',
        onPress: async () => {
          if (!orderId) return;
          setActionLoading(true);
          try {
            await confirmReceipt(orderId);
            Alert.alert('已确认', '订单已完成确认。');
            load();
          } catch (error: any) {
            Alert.alert('操作失败', error?.message || '请稍后重试');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const summaryRows: SummaryRow[] = detail ? [
    {key: 'provider', icon: orderProgressAssets.providerAnyi, label: '服务商', value: providerNameOf(detail), clickable: true},
    {key: 'weight', icon: orderProgressAssets.summaryWeightGray, label: '货物重量', value: cargoWeightTextOf(detail)},
    {key: 'pickup', icon: orderProgressAssets.pickupPinGreen, label: '起吊点', value: detail?.service_address || '-'},
    {key: 'dropoff', icon: orderProgressAssets.dropoffPinOrange, label: '落放点', value: detail?.dest_address || '-'},
    {key: 'service', icon: orderProgressAssets.droneServiceBlue, label: '预计服务', value: serviceLevelOf(detail)},
    {key: 'team', icon: orderProgressAssets.teamBlue, label: '服务团队', value: stepState >= 3 ? '服务团队已安排' : '等待服务团队安排'},
  ] : [];

  const timeline = detail ? [
    {idx: 1, title: '已提交吊运需求', time: createdAt, desc: '您已提交吊运需求', icon: orderProgressAssets.timelineCheck, done: stepState >= 1},
    {idx: 2, title: '服务商已确认方案', time: providerConfirmedAt, desc: '服务商已确认并提交方案', icon: orderProgressAssets.timelineCheck, done: stepState >= 2},
    {idx: 3, title: '服务团队已安排', time: teamArrangedAt, desc: '服务团队已安排完毕', icon: orderProgressAssets.timelineActive3, active: stepState === 3, done: stepState >= 3},
    {idx: 4, title: '到场安全评估', time: '服务团队到达现场后进行', desc: '待开始', icon: orderProgressAssets.timelinePending4, done: stepState >= 4},
    {idx: 5, title: '开始吊运', time: '吊运作业进行中', desc: '待开始', icon: orderProgressAssets.timelinePending5, done: stepState >= 5},
    {
      idx: 6,
      title: '已完成，等待确认',
      time: '作业完成，请您确认',
      desc: settlement?.id ? `结算${settlementStatusLabelOf(settlement.status)}` : stepState >= 6 ? '已完成' : '待完成',
      icon: orderProgressAssets.timelinePending6,
      done: stepState >= 6,
    },
  ] : [];
  const timelineRows = remoteTimeline.length > 0
    ? remoteTimeline.slice(0, 6).map((event, index) => {
        const status = event?.status || event?.payload?.status || '';
        const desc = event?.description && event.description !== status
          ? event.description
          : statusLabelOf(status);
        return {
          idx: index + 1,
          title: event?.title || statusLabelOf(status),
          time: formatFullDateTime(event?.occurred_at || event?.created_at),
          desc,
          icon: index < 2
            ? orderProgressAssets.timelineCheck
            : index === 2
              ? orderProgressAssets.timelineActive3
              : [orderProgressAssets.timelinePending4, orderProgressAssets.timelinePending5, orderProgressAssets.timelinePending6][Math.min(index - 3, 2)],
          done: true,
        };
      })
    : timeline;
  const primaryActionText = needsContractSign
    ? '签署合同'
    : canPay
      ? '去支付'
      : canConfirm
        ? (actionLoading ? '确认中...' : '确认完成')
        : canReview
          ? '评价订单'
          : '完成后可确认';
  const statusDescription = loading ? '正在同步订单信息...' : statusDescOf(detail?.status || '');
  const settlementHint = settlement?.id
    ? `结算${settlementStatusLabelOf(settlement.status)} · 实付${formatMoney(settlement.final_amount || settlement.total_amount)}`
    : settlementLoading
      ? '正在同步结算明细...'
      : '';

  const renderImage = (
    source: ImageSourcePropType,
    left: number,
    top: number,
    w: number,
    h: number,
    extra?: StyleProp<any>,
  ) => <Image source={source} resizeMode="contain" style={[frame(left, top, w, h) as any, extra] as any} />;

  const renderSummaryRow = (row: SummaryRow, index: number) => {
    const rowTop = 434 + index * 64.8;
    const imageFrame =
      row.key === 'provider'
        ? [60, rowTop + 18, 52, 49]
        : row.key === 'weight'
          ? [70, rowTop + 18, 29, 29]
          : row.key === 'pickup' || row.key === 'dropoff'
          ? [70, rowTop + 16, 30, 33]
            : [65, rowTop + 16, 41, 38];
    return (
      <React.Fragment key={row.key}>
        {index < summaryRows.length - 1 ? <View style={[styles.line, frame(49, rowTop + 64.8, 843, 1)]} /> : null}
        {renderImage(row.icon, imageFrame[0], imageFrame[1], imageFrame[2], imageFrame[3])}
        <DesignText style={[frame(128, rowTop + 18, 220, 32), type(24, 32, '500', '#0B1836')]}>{row.label}</DesignText>
        <DesignText numberOfLines={1} style={[frame(420, rowTop + 18, 380, 32), type(24, 32, '400', '#0B1836')]}>{row.value}</DesignText>
        {row.clickable ? renderImage(orderProgressAssets.summaryChevronRight, 858, rowTop + 22, 15, 26) : null}
        {row.clickable ? (
          <TouchableOpacity activeOpacity={0.75} onPress={viewPlan} style={frame(49, rowTop, 843, 64.8)} />
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={['#00407C', '#004A87', '#003D78']}
        locations={[0, 0.42, 1]}
        style={frame(0, 0, DESIGN_WIDTH, 225)}
      />
      <View style={[styles.blueCurve, {top: y(183), height: y(84)}]} />

      {renderImage(orderProgressAssets.navBack, 31, 86, 27, 38)}
      <TouchableOpacity activeOpacity={0.75} onPress={goBack} style={frame(12, 72, 72, 72)} />
      <DesignText style={[frame(0, 84, DESIGN_WIDTH, 40), type(31, 39, '700', '#FFFFFF'), styles.centerText]}>
        订单进度
      </DesignText>
      {renderImage(orderProgressAssets.navServiceHeadset, 852, 70, 50, 38)}
      <DesignText style={[frame(870, 107, 50, 28), type(21, 28, '500', '#FFFFFF')]}>客服</DesignText>
      <TouchableOpacity activeOpacity={0.75} onPress={openService} style={frame(835, 65, 88, 78)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{height: screenHeight + Math.max(insets.bottom, 0)}}
      >
        <View style={{width: screenWidth, height: screenHeight + Math.max(insets.bottom, 0)}}>
          {!detail ? (
            <View style={[styles.card, frame(24, 142, 893, 240), {borderRadius: x(22)}]}>
              {loading ? <ActivityIndicator color="#003B93" size="large" style={frame(430, 42, 80, 80)} /> : null}
              <DesignText style={[frame(60, loading ? 126 : 62, 820, 42), type(30, 40, '700', '#0B1836'), styles.centerText]}>
                {loading ? '正在同步订单信息' : '无法展示订单进度'}
              </DesignText>
              <DesignText style={[frame(96, loading ? 182 : 124, 748, 64), type(23, 32, '400', '#5D6B85'), styles.centerText]}>
                {loading ? '请稍候，正在读取真实订单数据。' : errorText || '订单不存在或当前账号无权查看。'}
              </DesignText>
            </View>
          ) : (
            <>
          <View style={[styles.card, frame(24, 142, 893, 210), {borderRadius: x(22)}]} />
          {renderImage(orderProgressAssets.statusAcceptedGreen, 49, 164, 62, 62)}
          <DesignText style={[frame(129, 166, 360, 40), type(32, 40, '700', '#0B1836')]}>
            {statusTitleOf(detail?.status)}
          </DesignText>
          <DesignText numberOfLines={1} style={[frame(129, 207, 520, 28), type(21, 28, '400', '#5D6B85')]}>
            {settlementHint || statusDescription}
          </DesignText>
          <TouchableOpacity activeOpacity={0.76} onPress={viewPlan} style={[frame(758, 166, 130, 48), styles.planButton, {borderRadius: x(11)}]}>
            <DesignText style={type(23, 30, '700', '#003B93')}>查看方案</DesignText>
          </TouchableOpacity>
          <View style={[styles.line, frame(49, 245, 839, 1)]} />
          <DesignText style={[frame(50, 265, 88, 32), type(24, 32, '500', '#0B1836')]}>订单号</DesignText>
          <DesignText style={[frame(138, 265, 210, 32), type(24, 32, '400', '#0B1836')]}>{orderNo}</DesignText>
          <TouchableOpacity activeOpacity={0.76} onPress={copyOrderNo} style={[frame(354, 260, 61, 36), styles.copyButton, {borderRadius: x(6)}]}>
            <DesignText style={type(21, 28, '500', '#5D6B85')}>复制</DesignText>
          </TouchableOpacity>
          <DesignText style={[frame(50, 307, 380, 32), type(24, 32, '400', '#5D6B85')]}>下单时间：{createdAt}</DesignText>

          <View style={[styles.card, frame(24, 366, 893, 476), {borderRadius: x(18)}]} />
          <DesignText style={[frame(50, 390, 180, 36), type(28, 36, '700', '#0B1836')]}>订单摘要</DesignText>
          <View style={[frame(49, 434, 843, 389), styles.summaryTable, {borderRadius: x(6)}]} />
          {summaryRows.map(renderSummaryRow)}

          <View style={[styles.card, frame(24, 859, 893, 586), {borderRadius: x(18)}]} />
          <DesignText style={[frame(50, 883, 180, 36), type(28, 36, '700', '#0B1836')]}>订单进度</DesignText>
          {stepState === 3 ? <View style={[frame(50, 1098, 842, 76), styles.activeStep, {borderRadius: x(8)}]} /> : null}
          <View style={[frame(74, 958, 4, 418), styles.timelineLine]} />
          {timelineRows.map((item, index) => {
            const rowTop = [929, 1016, 1098, 1190, 1278, 1366][index];
            const iconTop = [929, 1016, 1102, 1190, 1278, 1366][index];
            return (
              <React.Fragment key={item.idx}>
                {renderImage(item.icon, 56, iconTop, 40, 40)}
                <DesignText style={[frame(122, rowTop + 6, 360, 31), type(24, 31, '700', '#0B1836')]}>
                  {item.title}
                </DesignText>
                <DesignText style={[frame(122, rowTop + 37, 380, 29), type(22, 29, '400', '#5D6B85')]}>
                  {item.time}
                </DesignText>
                <DesignText
                  numberOfLines={1}
                  style={[frame(650, rowTop + 18, 230, 29), type(22, 29, '400', item.done ? '#004CAA' : '#5D6B85'), styles.rightText]}
                >
                  {item.desc}
                </DesignText>
              </React.Fragment>
            );
          })}
            </>
          )}
        </View>
      </ScrollView>

      {detail ? <View style={[frame(0, 1454, DESIGN_WIDTH, 95), styles.actionbar]} /> : null}
      {detail ? (
        <>
      <TouchableOpacity activeOpacity={0.78} onPress={contactProvider} style={[frame(37, 1458, 416, 69), styles.contactButton, {borderRadius: x(6)}]}>
        <Image source={orderProgressAssets.phoneOutline} resizeMode="contain" style={{width: x(26), height: x(27), marginRight: x(16)}} />
        <DesignText style={type(26, 34, '700', '#003B93')}>联系服务商</DesignText>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={(canPay || canConfirm || canReview) ? 0.78 : 1}
        onPress={submitConfirm}
        style={[
          frame(484, 1458, 418, 69),
          styles.confirmButton,
          (canPay || canConfirm || canReview) ? styles.confirmButtonEnabled : styles.confirmButtonDisabled,
          {borderRadius: x(6)},
        ]}
      >
        <DesignText style={type(26, 34, '700', '#FFFFFF')}>
          {primaryActionText}
        </DesignText>
      </TouchableOpacity>
        </>
      ) : null}

      <View style={[frame(0, 1549, DESIGN_WIDTH, 123), styles.tabbar, {paddingBottom: insets.bottom}]} />
      {[
        {label: '首页', icon: orderProgressAssets.tabHomeInactive, screen: 'Home'},
        {label: '订单', icon: orderProgressAssets.tabOrderActive, screen: 'Orders', active: true},
        {label: '消息', icon: orderProgressAssets.tabMessageInactive, screen: 'Messages', badge: true},
        {label: '我的', icon: orderProgressAssets.tabProfileInactive, screen: 'Profile'},
      ].map((item, index) => (
        <TouchableOpacity
          key={item.label}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('MainTabs', {screen: item.screen})}
          style={[frame((DESIGN_WIDTH / 4) * index, 1549, DESIGN_WIDTH / 4, 123), styles.tabItem]}
        >
          <Image source={item.icon} resizeMode="contain" style={{width: x(42), height: x(44)}} />
          {item.badge ? (
            <Image source={orderProgressAssets.badgeMessageRed3} resizeMode="contain" style={[styles.badge, {width: x(28), height: x(28), top: y(-2), right: x(72)}]} />
          ) : null}
          <DesignText style={[type(22, 27, item.active ? '700' : '400', item.active ? '#003B93' : '#5D6B85'), {marginTop: y(8)}]}>
            {item.label}
          </DesignText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F6F8FC',
    overflow: 'hidden',
  },
  blueCurve: {
    position: 'absolute',
    left: -30,
    right: -30,
    backgroundColor: '#F6F8FC',
    borderBottomLeftRadius: 500,
    borderBottomRightRadius: 500,
    zIndex: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B2850',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  centerText: {
    textAlign: 'center',
  },
  rightText: {
    textAlign: 'right',
  },
  planButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#003B93',
    backgroundColor: '#FFFFFF',
  },
  copyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7CED9',
    backgroundColor: '#F8FAFC',
  },
  line: {
    position: 'absolute',
    backgroundColor: '#E4EAF2',
  },
  summaryTable: {
    position: 'absolute',
    backgroundColor: '#FEFFFF',
    borderWidth: 1,
    borderColor: '#E4EAF2',
  },
  timelineLine: {
    position: 'absolute',
    backgroundColor: '#9FB7D6',
    zIndex: 2,
  },
  activeStep: {
    backgroundColor: '#F7FBFF',
    zIndex: 1,
  },
  actionbar: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EEF5',
  },
  contactButton: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#003B93',
    backgroundColor: '#FFFFFF',
  },
  confirmButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonEnabled: {
    backgroundColor: '#FF5A12',
  },
  confirmButtonDisabled: {
    backgroundColor: '#BFC4CC',
  },
  tabbar: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EEF5',
  },
  tabItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  badge: {
    position: 'absolute',
  },
});
