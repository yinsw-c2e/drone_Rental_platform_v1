import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
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
import {useDispatch, useSelector} from 'react-redux';
import {ownerService} from '../../services/owner';
import {orderFinanceV2Service} from '../../services/orderFinanceV2';
import {orderV2Service} from '../../services/orderV2';
import {RootState} from '../../store/store';
import {setHaulRoleMode} from '../../store/slices/roleSlice';
import {V2SettlementSummary} from '../../types';
import {canUseProviderWorkbench, getEffectiveRoleSummary} from '../../utils/roleSummary';
import {friendlyErrorMessage} from '../../utils/errorMessage';

type DesignTextProps = React.PropsWithChildren<{
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}>;

type InfoRow = {
  key: string;
  label: string;
  value: string;
  icon: CleanIconName;
  iconColor: string;
  iconSize: [number, number];
  onPress?: () => void;
};

type ScheduleRow = {
  key: string;
  title: string;
  desc: string;
  icon: CleanIconName;
  iconColor: string;
  iconSize: [number, number];
  tag: string;
  tone: 'green' | 'orange';
  onPress: () => void;
};

type CleanIconName =
  | 'back'
  | 'chevron'
  | 'headset'
  | 'more'
  | 'clock'
  | 'pin'
  | 'weight'
  | 'note'
  | 'drone'
  | 'executor'
  | 'shield'
  | 'info'
  | 'phone'
  | 'tabHome'
  | 'tabOrder'
  | 'tabMessage'
  | 'tabProfile';

type CleanIconProps = {
  name: CleanIconName;
  color?: string;
  fill?: string;
  stroke?: number;
  style?: ViewStyle;
};

const DESIGN_WIDTH = 853;
const DESIGN_HEIGHT = 1844;

const getWebParam = (key: string) => {
  if (typeof window === 'undefined' || !(window as any).location?.search) {
    return '';
  }
  return new URLSearchParams((window as any).location.search).get(key) || '';
};

const firstWorkbenchOrderId = (workbench: any) =>
  Number(
    workbench?.pending_provider_confirmation_orders?.[0]?.id ||
      workbench?.pending_dispatch_orders?.[0]?.id ||
      0,
  );

const formatMoney = (amount?: number | null) => {
  const value = Number(amount || 0) / 100;
  return `¥${value.toLocaleString('zh-CN', {maximumFractionDigits: 0})}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '--';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 16);
  }
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const prefix =
    date.toDateString() === now.toDateString()
      ? '今天'
      : date.toDateString() === tomorrow.toDateString()
        ? '明天'
        : `${date.getMonth() + 1}-${date.getDate()}`;
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${prefix} ${hour}:${minute}`;
};

const statusTitleOf = (status?: string) => {
  if (status === 'pending_provider_confirmation') {
    return '待确认接单';
  }
  if (status === 'pending_payment') {
    return '待客户支付';
  }
  if (status === 'pending_dispatch') {
    return '待开始履约';
  }
  if (['assigned', 'preparing'].includes(String(status))) {
    return '履约准备中';
  }
  if (['loading', 'in_transit'].includes(String(status))) {
    return '履约进行中';
  }
  if (status === 'delivered') {
    return '待客户确认';
  }
  if (status === 'completed') {
    return '履约已完成';
  }
  if (status === 'cancelled') {
    return '订单已取消';
  }
  return '履约安排';
};

const statusDescOf = (detail: any) => {
  const status = detail?.status;
  if (status === 'pending_provider_confirmation') {
    return '客户已选择方案，等待您确认是否承接';
  }
  if (status === 'pending_payment') {
    return '您已确认承接，等待客户完成支付';
  }
  if (status === 'pending_dispatch') {
    return '订单已付款，请服务商开始履约';
  }
  if (['assigned', 'preparing'].includes(String(status))) {
    return '服务商正在准备本次履约';
  }
  if (['loading', 'in_transit'].includes(String(status))) {
    return '吊运作业正在进行';
  }
  if (status === 'delivered') {
    return '作业已送达，等待客户确认';
  }
  if (status === 'completed') {
    return '本次履约已完成';
  }
  if (status === 'cancelled') {
    return '订单已结束，无法继续安排履约';
  }
  return '正在同步订单履约状态';
};

const clientPhoneOf = (detail: any) =>
  detail?.participants?.client?.phone || detail?.client?.phone || '';

const clientNameOf = (detail: any) =>
  detail?.participants?.client?.nickname || detail?.client?.nickname || '客户';

const executorNameOf = (detail: any) =>
  detail?.participants?.executor?.nickname || detail?.executor?.nickname || '';

const providerNameOf = (detail: any) =>
  detail?.participants?.provider?.nickname || detail?.provider?.nickname || '';

const fulfillmentStatusMetaOf = (detail: any) => {
  const status = String(detail?.status || '').toLowerCase();
  if (status === 'pending_dispatch') return {label: '待开始', tone: 'orange' as const};
  if (['assigned', 'preparing', 'loading', 'in_transit'].includes(status)) {
    return {label: '履约中', tone: 'green' as const};
  }
  if (['delivered', 'completed'].includes(status)) return {label: '已送达', tone: 'green' as const};
  if (status === 'pending_payment') return {label: '待支付', tone: 'orange' as const};
  return {label: '已接单', tone: 'green' as const};
};

const airspaceMetaOf = (detail: any) => {
  const siteSafetyCheck = detail?.site_safety_check;
  if (siteSafetyCheck?.id) {
    const count = Number(siteSafetyCheck?.photos?.length || 0);
    const photoText = count > 0 ? `，已上传 ${count} 张照片` : '';
    return {tag: '已复核', tone: 'green' as const, desc: `现场安全复核已完成${photoText}`};
  }

  const status = String(detail?.airspace_status || '').toLowerCase();
  const orderStatus = String(detail?.status || '').toLowerCase();
  const started = ['preparing', 'loading', 'in_transit', 'delivered', 'completed'].includes(orderStatus);
  const inProgress = ['assigned', 'pending_dispatch'].includes(orderStatus);

  if (status === 'approved' || status === 'airspace_approved') {
    return {tag: '已复核', tone: 'green' as const, desc: '空域许可已通过，现场复核可继续'};
  }
  if (status === 'not_required') {
    return started
      ? {tag: '已复核', tone: 'green' as const, desc: '空域无需单独申请，现场已进入执行流程'}
      : {tag: '无需申请', tone: 'green' as const, desc: '当前订单未要求单独空域申请'};
  }
  if (status === 'pending' || status === 'pending_review' || status === 'airspace_applying') {
    return {tag: '审核中', tone: 'orange' as const, desc: '空域报备正在审核或存证'};
  }
  if (status === 'rejected') {
    return {tag: '需处理', tone: 'orange' as const, desc: '空域审核未通过，请调整后重新提交'};
  }
  if (started) {
    return {tag: '已复核', tone: 'green' as const, desc: '执行状态已推进，现场复核已完成'};
  }
  if (inProgress) {
    return {tag: '待复核', tone: 'orange' as const, desc: '等待服务商到场进行安全复核'};
  }
  return {tag: '待确认', tone: 'orange' as const, desc: '暂无空域或现场复核状态'};
};

const insuranceMetaOf = (detail: any) => {
  const drone = detail?.drone || {};
  const verified = String(drone.insurance_verified || '').toLowerCase();
  const expireDate = drone.insurance_expire_date ? new Date(String(drone.insurance_expire_date)) : null;
  const hasValidDate = expireDate && !Number.isNaN(expireDate.getTime());
  const expired = Boolean(hasValidDate && expireDate!.getTime() < Date.now());
  const coverage = Number(drone.insurance_coverage || 0);
  const coverageText = coverage > 0 ? `，保额 ${formatMoney(coverage)}` : '';

  if (verified === 'verified' && !expired) {
    const dateText = hasValidDate ? `有效期至 ${expireDate!.toLocaleDateString('zh-CN')}` : '保险审核已通过';
    return {tag: '已保障', tone: 'green' as const, desc: `${dateText}${coverageText}`};
  }
  if (verified === 'verified' && expired) {
    return {tag: '已过期', tone: 'orange' as const, desc: '无人机保险已过期，请更新保单'};
  }
  if (verified === 'pending') {
    return {tag: '审核中', tone: 'orange' as const, desc: '无人机保险资料正在审核'};
  }
  if (verified === 'rejected') {
    const reason = String(drone.insurance_reject_reason || '').trim();
    return {tag: '未通过', tone: 'orange' as const, desc: reason ? `未通过：${reason}` : '无人机保险资料未通过审核'};
  }
  if (detail?.contract?.payment_ready) {
    return {tag: '待核验', tone: 'orange' as const, desc: '合同已就绪，暂无无人机保单状态'};
  }
  return {tag: '待确认', tone: 'orange' as const, desc: '暂无无人机保单信息'};
};

const droneDescOf = (detail: any) => {
  const drone = detail?.drone;
  if (drone?.brand || drone?.model) {
    const name = [drone.brand, drone.model].filter(Boolean).join(' ');
    const payload = Number(drone.max_payload_kg || 0);
    return payload > 0 ? `${name}，载重 ${payload}kg` : name;
  }
  const supply = detail?.source_info?.snapshots?.supply;
  if (supply?.drone_id) {
    return `供给无人机 #${supply.drone_id}`;
  }
  return '暂无无人机信息';
};

const settlementStatusLabelOf = (status?: string) => {
  if (status === 'pending') {
    return '待计算';
  }
  if (status === 'calculated') {
    return '已计算';
  }
  if (status === 'confirmed') {
    return '已确认';
  }
  if (status === 'settled') {
    return '已入账';
  }
  if (status === 'disputed') {
    return '争议中';
  }
  return '待生成';
};

const financialOf = (detail: any, settlement?: V2SettlementSummary | null) => {
  if (settlement?.id) {
    const total = Number(settlement.final_amount || settlement.total_amount || 0);
    const commission = Number(settlement.platform_fee || 0);
    const pilotFee = Number(settlement.pilot_fee || 0);
    const ownerFee = Number(settlement.owner_fee || 0);
    return {
      total,
      commission,
      ownerAmount: pilotFee + ownerFee,
      pilotFee,
      ownerFee,
      source: 'settlement' as const,
      statusLabel: settlementStatusLabelOf(settlement.status),
    };
  }

  const total = Number(detail?.financial_summary?.total_amount ?? detail?.total_amount ?? 0);
  const commission = Number(detail?.financial_summary?.platform_commission ?? 0);
  const ownerAmount = Number(detail?.financial_summary?.owner_amount ?? Math.max(total - commission, 0));
  return {
    total,
    commission,
    ownerAmount,
    pilotFee: 0,
    ownerFee: ownerAmount,
    source: 'estimate' as const,
    statusLabel: '待生成',
  };
};

const addressPointOf = (detail: any, type: 'pickup' | 'dropoff') => {
  const snapshots = detail?.source_info?.snapshots || {};
  const candidates =
    type === 'pickup'
      ? [snapshots.departure_address, snapshots.pickup_address, snapshots.demand?.departure_address]
      : [snapshots.destination_address, snapshots.dropoff_address, snapshots.demand?.destination_address];
  return candidates.find((item: any) => Number(item?.latitude) && Number(item?.longitude));
};

function DesignText({children, style, numberOfLines}: DesignTextProps) {
  return (
    <Text allowFontScaling={false} numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );
}

function CleanIcon({name, color = '#6B778C', fill, stroke = 2, style}: CleanIconProps) {
  const line = (extra: ViewStyle) => (
    <View style={[cleanIconStyles.line, {backgroundColor: color, height: stroke, borderRadius: stroke}, extra]} />
  );
  const vline = (extra: ViewStyle) => (
    <View style={[cleanIconStyles.line, {backgroundColor: color, width: stroke, borderRadius: stroke}, extra]} />
  );
  const outline = (extra: ViewStyle) => (
    <View style={[cleanIconStyles.outline, {borderColor: color, borderWidth: stroke}, extra]} />
  );
  const dot = (extra: ViewStyle, dotColor = color) => (
    <View style={[cleanIconStyles.dot, {backgroundColor: dotColor}, extra]} />
  );

  let content: React.ReactNode = null;
  switch (name) {
    case 'back':
      content = (
        <>
          {line({left: '20%', top: '32%', width: '62%', transform: [{rotate: '-45deg'}]})}
          {line({left: '20%', top: '67%', width: '62%', transform: [{rotate: '45deg'}]})}
        </>
      );
      break;
    case 'chevron':
      content = (
        <>
          {line({left: '24%', top: '34%', width: '58%', transform: [{rotate: '45deg'}]})}
          {line({left: '24%', top: '66%', width: '58%', transform: [{rotate: '-45deg'}]})}
        </>
      );
      break;
    case 'more':
      content = (
        <>
          {outline({left: '9%', top: '8%', width: '82%', height: '82%', borderRadius: 999})}
          {dot({left: '27%', top: '43%', width: '9%', height: '9%', borderRadius: 999})}
          {dot({left: '46%', top: '43%', width: '9%', height: '9%', borderRadius: 999})}
          {dot({left: '65%', top: '43%', width: '9%', height: '9%', borderRadius: 999})}
        </>
      );
      break;
    case 'headset':
      content = (
        <>
          {outline({left: '18%', top: '9%', width: '64%', height: '48%', borderBottomWidth: 0, borderTopLeftRadius: 999, borderTopRightRadius: 999})}
          {outline({left: '12%', top: '45%', width: '18%', height: '28%', borderRadius: 6})}
          {outline({right: '12%', top: '45%', width: '18%', height: '28%', borderRadius: 6})}
          {line({right: '18%', top: '76%', width: '26%', transform: [{rotate: '-20deg'}]})}
          {dot({left: '52%', top: '79%', width: '9%', height: '9%', borderRadius: 999})}
        </>
      );
      break;
    case 'clock':
      content = (
        <>
          {fill ? <View style={[cleanIconStyles.fillCircle, {backgroundColor: fill}]} /> : outline({left: '10%', top: '10%', width: '80%', height: '80%', borderRadius: 999})}
          {vline({left: '50%', top: '25%', height: '27%', backgroundColor: fill ? '#FFFFFF' : color})}
          {line({left: '49%', top: '51%', width: '25%', backgroundColor: fill ? '#FFFFFF' : color, transform: [{rotate: '35deg'}]})}
        </>
      );
      break;
    case 'pin':
      content = (
        <>
          <View style={[cleanIconStyles.pinBody, {backgroundColor: fill || color}]} />
          {dot({left: '40%', top: '22%', width: '20%', height: '20%', borderRadius: 999}, '#FFFFFF')}
        </>
      );
      break;
    case 'weight':
      content = (
        <>
          {outline({left: '18%', top: '30%', width: '64%', height: '54%', borderRadius: 4})}
          {outline({left: '35%', top: '14%', width: '30%', height: '22%', borderBottomWidth: 0, borderTopLeftRadius: 999, borderTopRightRadius: 999})}
          {line({left: '34%', top: '54%', width: '32%'})}
          {line({left: '34%', top: '67%', width: '32%'})}
        </>
      );
      break;
    case 'note':
      content = (
        <>
          {outline({left: '18%', top: '14%', width: '60%', height: '70%', borderRadius: 3})}
          {line({left: '34%', top: '40%', width: '30%'})}
          {line({left: '34%', top: '55%', width: '26%'})}
          {line({left: '56%', top: '18%', width: '24%', transform: [{rotate: '45deg'}]})}
        </>
      );
      break;
    case 'drone':
      content = (
        <>
          {line({left: '22%', top: '49%', width: '56%'})}
          {vline({left: '49%', top: '22%', height: '56%'})}
          {dot({left: '41%', top: '41%', width: '18%', height: '18%', borderRadius: 999})}
          {outline({left: '5%', top: '5%', width: '24%', height: '24%', borderRadius: 999})}
          {outline({right: '5%', top: '5%', width: '24%', height: '24%', borderRadius: 999})}
          {outline({left: '5%', bottom: '5%', width: '24%', height: '24%', borderRadius: 999})}
          {outline({right: '5%', bottom: '5%', width: '24%', height: '24%', borderRadius: 999})}
        </>
      );
      break;
    case 'executor':
      content = (
        <>
          {outline({left: '35%', top: '8%', width: '30%', height: '30%', borderRadius: 999})}
          {outline({left: '22%', top: '50%', width: '56%', height: '38%', borderBottomWidth: 0, borderTopLeftRadius: 999, borderTopRightRadius: 999})}
          {outline({right: '8%', bottom: '5%', width: '26%', height: '26%', borderRadius: 999})}
          {line({right: '13%', bottom: '16%', width: '17%', transform: [{rotate: '35deg'}]})}
        </>
      );
      break;
    case 'shield':
      content = (
        <>
          {outline({left: '16%', top: '8%', width: '68%', height: '78%', borderRadius: 10})}
          {line({left: '35%', top: '50%', width: '18%', transform: [{rotate: '45deg'}]})}
          {line({left: '48%', top: '47%', width: '30%', transform: [{rotate: '-45deg'}]})}
        </>
      );
      break;
    case 'info':
      content = (
        <>
          {outline({left: '12%', top: '12%', width: '76%', height: '76%', borderRadius: 999})}
          <Text allowFontScaling={false} style={[cleanIconStyles.infoText, {color, fontSize: 16 + stroke * 2}]}>i</Text>
        </>
      );
      break;
    case 'phone':
      content = (
        <>
          {outline({left: '20%', top: '18%', width: '58%', height: '64%', borderRadius: 999, transform: [{rotate: '-32deg'}]})}
          <View style={cleanIconStyles.phoneMaskTop} />
          <View style={cleanIconStyles.phoneMaskMid} />
        </>
      );
      break;
    case 'tabHome':
      content = (
        <>
          {line({left: '18%', top: '41%', width: '34%', transform: [{rotate: '-42deg'}]})}
          {line({right: '18%', top: '41%', width: '34%', transform: [{rotate: '42deg'}]})}
          {outline({left: '24%', top: '42%', width: '52%', height: '42%', borderTopWidth: 0, borderRadius: 3})}
          {outline({left: '45%', top: '62%', width: '12%', height: '20%', borderBottomWidth: 0, borderRadius: 2})}
        </>
      );
      break;
    case 'tabOrder':
      content = (
        <>
          <View style={[cleanIconStyles.docFill, {backgroundColor: fill || color}]} />
          {line({left: '34%', top: '30%', width: '32%', backgroundColor: '#FFFFFF'})}
          {line({left: '34%', top: '47%', width: '32%', backgroundColor: '#FFFFFF'})}
          {line({left: '34%', top: '64%', width: '32%', backgroundColor: '#FFFFFF'})}
        </>
      );
      break;
    case 'tabMessage':
      content = (
        <>
          {outline({left: '16%', top: '20%', width: '68%', height: '46%', borderRadius: 7})}
          {line({left: '30%', top: '69%', width: '15%', transform: [{rotate: '-45deg'}]})}
          {dot({left: '33%', top: '40%', width: '7%', height: '7%', borderRadius: 999})}
          {dot({left: '47%', top: '40%', width: '7%', height: '7%', borderRadius: 999})}
          {dot({left: '61%', top: '40%', width: '7%', height: '7%', borderRadius: 999})}
        </>
      );
      break;
    case 'tabProfile':
      content = (
        <>
          {outline({left: '36%', top: '12%', width: '28%', height: '28%', borderRadius: 999})}
          {outline({left: '20%', top: '54%', width: '60%', height: '32%', borderBottomWidth: 0, borderTopLeftRadius: 999, borderTopRightRadius: 999})}
        </>
      );
      break;
  }

  return <View pointerEvents="none" style={[cleanIconStyles.icon, style]}>{content}</View>;
}

export default function FulfillmentHubScreen({navigation, route}: any) {
  const reduxDispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const canUseProvider = canUseProviderWorkbench(getEffectiveRoleSummary(roleSummary));
  const {width, height} = useWindowDimensions();
  const screenWidth = width || 390;
  const scale = screenWidth / DESIGN_WIDTH;
  const contentHeight = Math.max(height || 0, DESIGN_HEIGHT * scale);
  const [orderId, setOrderId] = useState(0);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [settlement, setSettlement] = useState<V2SettlementSummary | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!isAuthenticated) {
      setDetail(null);
      setOrderId(0);
      setSettlement(null);
      setErrorText('请先登录服务商账号后查看履约安排');
      setLoading(false);
      return;
    }
    if (!canUseProvider) {
      setDetail(null);
      setOrderId(0);
      setSettlement(null);
      setErrorText('服务商资质审核通过后才能查看履约安排');
      setLoading(false);
      return;
    }

    setLoading(true);
    setSettlement(null);
    setErrorText('');
    try {
      let nextOrderId = Number(
        route?.params?.orderId ||
          route?.params?.id ||
          getWebParam('orderId') ||
          getWebParam('id') ||
          0,
      );
      if (!nextOrderId) {
        const workbenchRes = await ownerService.getWorkbench();
        nextOrderId = firstWorkbenchOrderId((workbenchRes as any)?.data || workbenchRes);
      }
      if (!nextOrderId) {
        setDetail(null);
        setOrderId(0);
        setSettlement(null);
        setErrorText('暂无待确认或待履约订单');
        return;
      }

      const res = await orderV2Service.get(nextOrderId);
      const nextDetail = (res as any)?.data || res;
      if (!nextDetail?.id) {
        setDetail(null);
        setOrderId(nextOrderId);
        setSettlement(null);
        setErrorText('订单不存在或当前账号无权查看');
        return;
      }

      setOrderId(Number(nextDetail.id));
      setDetail(nextDetail);
      if (String(nextDetail.status) === 'completed') {
        setSettlementLoading(true);
        try {
          const settlementRes = await orderFinanceV2Service.getSettlement(Number(nextDetail.id));
          setSettlement(((settlementRes as any)?.data || settlementRes) as V2SettlementSummary);
        } catch {
          setSettlement(null);
        } finally {
          setSettlementLoading(false);
        }
      }
    } catch (error: any) {
      setDetail(null);
      setSettlement(null);
      setErrorText(friendlyErrorMessage(error, '订单履约信息加载失败'));
    } finally {
      setLoading(false);
    }
  }, [canUseProvider, isAuthenticated, route?.params]);

  useFocusEffect(
    useCallback(() => {
      reduxDispatch(setHaulRoleMode('provider'));
      loadDetail();
    }, [loadDetail, reduxDispatch]),
  );

  const dp = (value: number) => Number((value * scale).toFixed(2));
  const frame = (x: number, y: number, w: number, h: number): ViewStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dp(y),
    width: dp(w),
    height: dp(h),
  });
  const iconFrame = (x: number, y: number, w: number, h: number): ViewStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dp(y),
    width: dp(w),
    height: dp(h),
  });
  const textFrame = (
    x: number,
    y: number,
    w: number,
    h: number,
    fontSize: number,
    lineHeight: number,
    fontWeight: TextStyle['fontWeight'],
    color: string,
    textAlign: TextStyle['textAlign'] = 'left',
  ): TextStyle => ({
    position: 'absolute',
    left: dp(x),
    top: dp(y),
    width: dp(w),
    height: dp(h),
    color,
    fontSize: dp(fontSize),
    lineHeight: dp(lineHeight),
    fontWeight,
    textAlign,
  });
  const labelType = (
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

  const goBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', {screen: 'Home'});
  };

  const openMainTab = (screen: 'Home' | 'Orders' | 'Messages' | 'Profile') => {
    navigation.navigate('MainTabs', {screen});
  };

  const openService = () => openMainTab('Messages');
  const copyOrderNo = () => {
    const orderNo = detail?.order_no;
    if (!orderNo) {
      Alert.alert('订单号', '暂无订单号');
      return;
    }
    Alert.alert('订单号', `${orderNo}\n\n已准备复制到剪贴板。`);
  };
  const openMore = () => {
    Alert.alert('更多操作', undefined, [
      {text: '复制订单号', onPress: copyOrderNo},
      {text: '查看/更新保险', onPress: () => openInsuranceAction()},
      {text: '确认现场复核', onPress: () => confirmSafetyCheck()},
      {text: '取消', style: 'cancel'},
    ]);
  };
  const openLocation = (type: 'pickup' | 'dropoff') => {
    const point = addressPointOf(detail, type);
    const address = type === 'pickup' ? detail?.service_address : detail?.dest_address;
    const name = type === 'pickup' ? '起吊点' : '落放点';
    const coordinateText = point ? `\n坐标：${point.latitude}, ${point.longitude}` : '';
    Alert.alert(name, `${address || '地址待确认'}${coordinateText}`);
  };
  const contactCustomer = () => {
    const phone = clientPhoneOf(detail);
    if (!phone || phone.includes('*')) {
      Alert.alert('联系客户', `${clientNameOf(detail)}的电话当前为脱敏展示，请先通过消息或客服联系。`, [
        {text: '去消息', onPress: openService},
        {text: '取消', style: 'cancel'},
      ]);
      return;
    }
    Alert.alert('联系客户', `是否拨打客户电话 ${phone}？`, [
      {text: '取消', style: 'cancel'},
      {text: '拨打', onPress: () => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('提示', '无法发起电话'))},
    ]);
  };

  const confirmSafetyCheck = () => {
    if (!detail || !orderId) {
      Alert.alert('现场复核', '暂无可复核订单');
      return;
    }
    if (['pending_provider_confirmation', 'pending_payment'].includes(String(detail.status))) {
      Alert.alert('现场复核', '订单尚未进入复核阶段');
      return;
    }
    navigation.navigate('SafetyCheck', {orderId, id: orderId});
  };

  const openInsuranceAction = () => {
    if (!detail || !orderId) {
      Alert.alert('保险状态', '暂无订单保单信息');
      return;
    }
    const drone = detail?.drone || {};
    const droneId = Number(drone.id || detail?.drone_id || 0);
    const policyNo = drone.insurance_policy_no || '未填写';
    const company = drone.insurance_company || '未填写';
    const coverage = Number(drone.insurance_coverage || 0);
    const coverageText = coverage > 0 ? formatMoney(coverage) : '未填写';
    const expireText = drone.insurance_expire_date
      ? new Date(String(drone.insurance_expire_date)).toLocaleDateString('zh-CN')
      : '未填写';
    Alert.alert(
      '保险状态',
      `保单号：${policyNo}\n保险公司：${company}\n保额：${coverageText}\n有效期：${expireText}`,
      droneId
        ? [
            {text: '更新保单', onPress: () => navigation.navigate('DroneCertification', {id: droneId, droneId, tab: 'insurance', orderId})},
            {text: '关闭', style: 'cancel'},
          ]
        : [{text: '关闭'}],
    );
  };

  const submitArrangement = () => {
    if (!detail || !orderId) {
      Alert.alert('安排履约', '暂无可安排订单');
      return;
    }
    if (detail.status === 'pending_dispatch') {
      Alert.alert('开始履约', '确认由当前服务商开始履约？确认后订单会进入履约推进。', [
        {text: '取消', style: 'cancel'},
        {
          text: '开始履约',
          onPress: async () => {
            setSubmitting(true);
            try {
              await orderV2Service.startSelfFulfillment(orderId);
              Alert.alert('已开始履约', '订单已进入履约推进。');
              loadDetail();
            } catch (error: any) {
              Alert.alert('开始履约失败', error?.message || '请稍后重试');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]);
      return;
    }
    if (detail.status === 'pending_payment') {
      Alert.alert('安排履约', '等待客户支付后再开始履约');
      return;
    }
    if (detail.status !== 'pending_provider_confirmation') {
      Alert.alert('安排履约', '当前状态无需确认接单');
      return;
    }
    Alert.alert('确认接单', '确认承接该直达订单？确认后客户将进入合同与支付流程。', [
      {text: '取消', style: 'cancel'},
      {
        text: '确认接单',
        onPress: async () => {
          setSubmitting(true);
          try {
            await orderV2Service.providerConfirm(orderId);
            Alert.alert('已确认接单', '订单已进入客户合同与支付流程。');
            loadDetail();
          } catch (error: any) {
            Alert.alert('操作失败', error?.message || '请稍后重试');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const finance = detail
    ? financialOf(detail, settlement)
    : {total: 0, commission: 0, ownerAmount: 0, pilotFee: 0, ownerFee: 0, source: 'estimate' as const, statusLabel: '待生成'};
  const feeTip = settlementLoading
    ? '正在同步结算明细'
    : finance.source === 'settlement'
      ? `结算${finance.statusLabel} · 履约服务 ${formatMoney(finance.pilotFee)} · 设备服务 ${formatMoney(finance.ownerFee)}`
      : '完成后生成结算明细，当前为订单预估金额';
  const fulfillmentMeta = detail ? fulfillmentStatusMetaOf(detail) : {label: '待开始', tone: 'orange' as const};
  const airspaceMeta = detail ? airspaceMetaOf(detail) : {tag: '待确认', tone: 'orange' as const, desc: '暂无空域或现场复核状态'};
  const insuranceMeta = detail ? insuranceMetaOf(detail) : {tag: '待确认', tone: 'orange' as const, desc: '暂无无人机保单信息'};
  const submitText = (() => {
    if (submitting) {
      return '提交中...';
    }
    if (detail?.status === 'pending_provider_confirmation') {
      return '确认接单';
    }
    if (detail?.status === 'pending_dispatch') {
      return '开始履约';
    }
    if (detail?.status === 'pending_payment') {
      return '等待支付';
    }
    return '履约推进';
  })();

  const orderRows: InfoRow[] = detail ? [
    {
      key: 'pickup',
      label: '起吊点',
      value: detail?.service_address || '--',
      icon: 'pin',
      iconColor: '#1FBF62',
      iconSize: [25, 54],
      onPress: () => openLocation('pickup'),
    },
    {
      key: 'dropoff',
      label: '落放点',
      value: detail?.dest_address || '--',
      icon: 'pin',
      iconColor: '#FF6A15',
      iconSize: [25, 56],
      onPress: () => openLocation('dropoff'),
    },
    {key: 'weight', label: '货物重量', value: detail?.cargo_weight_kg ? `${detail.cargo_weight_kg}kg` : '--', icon: 'weight', iconColor: '#6B778C', iconSize: [24, 55]},
    {key: 'time', label: '作业时间', value: formatDateTime(detail?.start_time), icon: 'clock', iconColor: '#6B778C', iconSize: [24, 55]},
    {
      key: 'note',
      label: '客户备注',
      value: detail?.source_info?.snapshots?.cargo?.cargo_special_requirements || detail?.description || '暂无备注',
      icon: 'note',
      iconColor: '#6B778C',
      iconSize: [27, 54],
    },
  ] : [];

  const scheduleRows: ScheduleRow[] = detail ? [
    {
      key: 'drone',
      title: '选择无人机',
      desc: droneDescOf(detail),
      icon: 'drone',
      iconColor: '#0B4AA2',
      iconSize: [48, 48],
      tag: detail?.drone?.availability_status === 'available' ? '可用' : '待确认',
      tone: detail?.drone?.availability_status === 'available' ? 'green' : 'orange',
      onPress: () => Alert.alert('选择无人机', '无人机由服务商负责履约。'),
    },
    {
      key: 'service',
      title: '服务商履约',
      desc: providerNameOf(detail) || executorNameOf(detail) || '当前服务商负责本单履约',
      icon: 'executor',
      iconColor: '#0B4AA2',
      iconSize: [48, 50],
      tag: fulfillmentMeta.label,
      tone: fulfillmentMeta.tone,
      onPress: () => Alert.alert('服务商履约', '本单由当前服务商履约。'),
    },
    {
      key: 'safety',
      title: '空域 / 安全检查',
      desc: airspaceMeta.desc,
      icon: 'shield',
      iconColor: '#0B4AA2',
      iconSize: [51, 51],
      tag: airspaceMeta.tag,
      tone: airspaceMeta.tone,
      onPress: confirmSafetyCheck,
    },
    {
      key: 'insurance',
      title: '保险状态',
      desc: insuranceMeta.desc,
      icon: 'shield',
      iconColor: '#0B4AA2',
      iconSize: [51, 51],
      tag: insuranceMeta.tag,
      tone: insuranceMeta.tone,
      onPress: openInsuranceAction,
    },
  ] : [];

  const renderInfoRow = (row: InfoRow, index: number) => {
    const y = 441 + index * 70;
    return (
      <TouchableOpacity key={row.key} activeOpacity={row.onPress ? 0.82 : 1} onPress={row.onPress} style={frame(49, y, 755, 70)}>
        {index < orderRows.length - 1 && <View style={[styles.line, frame(0, 69, 755, 1)]} />}
        <CleanIcon name={row.icon} color={row.iconColor} fill={row.icon === 'pin' ? row.iconColor : undefined} style={iconFrame(18, 8, row.iconSize[0], row.iconSize[1])} stroke={dp(3)} />
        <DesignText style={textFrame(63, 18, 160, 32, 22, 32, '500', '#1B2442')}>{row.label}</DesignText>
        <DesignText numberOfLines={1} style={textFrame(340, 18, row.onPress ? 380 : 400, 32, 22, 32, '400', '#1B2442')}>
          {row.value}
        </DesignText>
        {row.onPress && <CleanIcon name="chevron" color="#6B778C" style={iconFrame(725, 21, 20, 29)} stroke={dp(3)} />}
      </TouchableOpacity>
    );
  };

  const renderScheduleRow = (row: ScheduleRow, index: number) => {
    const y = 890 + index * 96.5;
    const tagWidth = Math.min(132, Math.max(74, row.tag.length * 28 + 28));
    return (
      <TouchableOpacity key={row.key} activeOpacity={0.82} onPress={row.onPress} style={frame(49, y, 755, 96.5)}>
        {index < scheduleRows.length - 1 && <View style={[styles.line, frame(0, 95.5, 755, 1)]} />}
        <CleanIcon name={row.icon} color={row.iconColor} style={iconFrame(18, 18, row.iconSize[0], row.iconSize[1])} stroke={dp(3)} />
        <DesignText style={textFrame(93, 14, 320, 34, 22, 32, '700', '#111C3E')}>{row.title}</DesignText>
        <DesignText numberOfLines={1} style={textFrame(93, 49, 430, 28, 18, 28, '400', '#7A869E')}>
          {row.desc}
        </DesignText>
        <View style={[styles.statusTag, styles[`${row.tone}Tag`], frame(630, 25, tagWidth, 45)]}>
          <DesignText style={[styles.statusTagText, styles[`${row.tone}TagText`], {fontSize: dp(20), lineHeight: dp(28)}]}>
            {row.tag}
          </DesignText>
        </View>
        <CleanIcon name="chevron" color="#6B778C" style={iconFrame(725, 34, 20, 29)} stroke={dp(3)} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={styles.root}>
        <View style={[styles.canvas, {width: screenWidth, height: contentHeight}]}>
          <LinearGradient colors={['#005AD8', '#003C9F']} start={{x: 0.1, y: 0}} end={{x: 1, y: 1}} style={frame(0, 0, 853, 254)} />
          <View style={[styles.curve, frame(0, 230, 853, 116), {borderTopLeftRadius: dp(24), borderTopRightRadius: dp(24)}]} />

          <TouchableOpacity activeOpacity={0.82} onPress={goBack} style={frame(22, 96, 58, 66)}>
            <CleanIcon name="back" color="#FFFFFF" style={iconFrame(6, 7, 30, 50)} stroke={dp(4)} />
          </TouchableOpacity>
          <DesignText style={textFrame(0, 88, 853, 56, 32, 56, '700', '#FFFFFF', 'center')}>履约安排</DesignText>
          <TouchableOpacity activeOpacity={0.82} onPress={openService} style={frame(709, 92, 62, 84)}>
            <CleanIcon name="headset" color="#FFFFFF" style={iconFrame(9, 0, 44, 45)} stroke={dp(3)} />
            <DesignText style={textFrame(0, 45, 62, 28, 18, 28, '500', '#FFFFFF', 'center')}>客服</DesignText>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.82} onPress={openMore} style={frame(781, 92, 62, 84)}>
            <CleanIcon name="more" color="#FFFFFF" style={iconFrame(9, 0, 44, 45)} stroke={dp(3)} />
            <DesignText style={textFrame(0, 45, 62, 28, 18, 28, '500', '#FFFFFF', 'center')}>更多</DesignText>
          </TouchableOpacity>

          {!detail ? (
            <View style={[styles.card, frame(24, 166, 805, 246), {borderRadius: dp(22)}]}>
              {loading && <ActivityIndicator color="#005BFF" size="large" style={frame(372, 42, 60, 60)} />}
              <DesignText style={textFrame(42, loading ? 112 : 58, 720, 42, 28, 42, '700', '#111C3E', 'center')}>
                {loading ? '正在同步履约订单' : '暂无可安排订单'}
              </DesignText>
              <DesignText style={textFrame(72, loading ? 164 : 114, 660, 64, 21, 32, '400', '#7A869E', 'center')}>
                {loading ? '加载中...' : errorText || '暂无待履约订单。'}
              </DesignText>
            </View>
          ) : (
            <>
              <View style={[styles.card, frame(24, 166, 805, 180), {borderRadius: dp(22)}]}>
                <CleanIcon name="clock" color="#FF5A12" fill="#FF5A12" style={iconFrame(34, 33, 25, 25)} stroke={dp(2.5)} />
                <DesignText style={textFrame(78, 25, 210, 37, 26, 37, '700', '#FF5A12')}>{statusTitleOf(detail.status)}</DesignText>
                <DesignText style={textFrame(34, 78, 72, 32, 21, 32, '500', '#1B2442')}>订单号</DesignText>
                <DesignText style={textFrame(126, 76, 230, 35, 25, 35, '500', '#1B2442')} numberOfLines={1}>
                  {detail?.order_no || '--'}
                </DesignText>
                <TouchableOpacity activeOpacity={0.82} onPress={copyOrderNo} style={[styles.copyButton, frame(356, 78, 64, 40), {borderRadius: dp(10)}]}>
                  <DesignText style={labelType(18, 26, '600', '#677489')}>复制</DesignText>
                </TouchableOpacity>
                <DesignText style={textFrame(34, 130, 620, 32, 21, 32, '400', '#7A869E')} numberOfLines={1}>
                  {statusDescOf(detail)}
                </DesignText>
              </View>

              <View style={[styles.card, frame(24, 366, 805, 430), {borderRadius: dp(22)}]}>
                <DesignText style={textFrame(25, 22, 150, 40, 28, 40, '700', '#111C3E')}>订单信息</DesignText>
                <View style={[styles.innerBox, frame(25, 75, 755, 350), {borderRadius: dp(12)}]} />
              </View>
              {orderRows.map(renderInfoRow)}

              <View style={[styles.card, frame(24, 815, 805, 492), {borderRadius: dp(22)}]}>
                <DesignText style={textFrame(25, 22, 150, 40, 28, 40, '700', '#111C3E')}>履约安排</DesignText>
                <View style={[styles.innerBox, frame(25, 75, 755, 386), {borderRadius: dp(12)}]} />
              </View>
              {scheduleRows.map(renderScheduleRow)}

              <View style={[styles.card, frame(24, 1325, 805, 321), {borderRadius: dp(22)}]}>
                <DesignText style={textFrame(25, 22, 170, 40, 28, 40, '700', '#111C3E')}>费用与报价</DesignText>
                <View style={[styles.innerBox, frame(25, 77, 755, 162), {borderRadius: dp(12)}]}>
                  <DesignText style={textFrame(19, 15, 170, 34, 22, 34, '500', '#1B2442')}>
                    {finance.source === 'settlement' ? '客户实付' : '客户报价'}
                  </DesignText>
                  <DesignText style={textFrame(540, 15, 178, 34, 22, 34, '500', '#1B2442', 'right')}>{formatMoney(finance.total)}</DesignText>
                  <DesignText style={textFrame(19, 62, 130, 34, 22, 34, '500', '#1B2442')}>平台服务费</DesignText>
                  <CleanIcon name="info" color="#7A869E" style={iconFrame(124, 66, 25, 27)} stroke={dp(2)} />
                  <DesignText style={textFrame(540, 62, 178, 34, 22, 34, '500', '#1B2442', 'right')}>{formatMoney(finance.commission)}</DesignText>
                  <View style={[styles.dash, frame(19, 105, 717, 1)]} />
                  <DesignText style={textFrame(19, 113, 170, 38, 22, 34, '700', '#1B2442')}>
                    {finance.source === 'settlement' ? '服务方分账' : '预计结算'}
                  </DesignText>
                  <DesignText style={textFrame(510, 107, 208, 48, 37, 43, '700', '#FF5A12', 'right')}>{formatMoney(finance.ownerAmount)}</DesignText>
                </View>
                <CleanIcon name="info" color="#7A869E" style={iconFrame(25, 257, 25, 27)} stroke={dp(2)} />
                <DesignText style={textFrame(60, 255, 620, 30, 18, 30, '400', '#7A869E')} numberOfLines={1}>{feeTip}</DesignText>
              </View>

              <View style={[styles.actionArea, frame(0, 1613, 853, 98)]}>
                <TouchableOpacity activeOpacity={0.86} onPress={contactCustomer} style={[styles.contactButton, frame(49, 15, 360, 78), {borderRadius: dp(10)}]}>
                  <CleanIcon name="phone" color="#0B4AA2" style={iconFrame(84, 24, 30, 29)} stroke={dp(3)} />
                  <DesignText style={textFrame(0, 20, 360, 38, 26, 38, '700', '#0B4AA2', 'center')}>联系客户</DesignText>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.86} disabled={submitting} onPress={submitArrangement} style={frame(443, 15, 360, 78)}>
                  <LinearGradient colors={['#FF6D12', '#FF5200']} start={{x: 0, y: 0.5}} end={{x: 1, y: 0.5}} style={[styles.submitButton, submitting && styles.submitButtonDisabled, {borderRadius: dp(10)}]}>
                    <DesignText style={labelType(26, 38, '700', '#FFFFFF')}>{submitText}</DesignText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={[styles.tabbar, frame(0, 1710, 853, 134)]}>
            <TouchableOpacity activeOpacity={0.82} onPress={() => openMainTab('Home')} style={frame(54, 19, 100, 74)}>
              <CleanIcon name="tabHome" color="#7F8AA9" style={iconFrame(24, 0, 51, 52)} stroke={dp(3)} />
              <DesignText style={textFrame(0, 56, 100, 26, 20, 26, '500', '#7F8AA9', 'center')}>工作台</DesignText>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.82} onPress={() => openMainTab('Orders')} style={frame(274, 19, 100, 74)}>
              <CleanIcon name="tabOrder" color="#005BFF" fill="#005BFF" style={iconFrame(24, 0, 51, 54)} stroke={dp(3)} />
              <DesignText style={textFrame(0, 56, 100, 26, 20, 26, '700', '#005BFF', 'center')}>接单</DesignText>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.82} onPress={() => openMainTab('Messages')} style={frame(497, 19, 100, 74)}>
              <CleanIcon name="tabMessage" color="#7F8AA9" style={iconFrame(24, 0, 52, 54)} stroke={dp(3)} />
              <DesignText style={textFrame(0, 56, 100, 26, 20, 26, '500', '#7F8AA9', 'center')}>消息</DesignText>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.82} onPress={() => openMainTab('Profile')} style={frame(715, 19, 100, 74)}>
              <CleanIcon name="tabProfile" color="#7F8AA9" style={iconFrame(24, 0, 53, 54)} stroke={dp(3)} />
              <DesignText style={textFrame(0, 56, 100, 26, 20, 26, '500', '#7F8AA9', 'center')}>我的</DesignText>
            </TouchableOpacity>
            <View style={[styles.homeIndicator, frame(292, 111, 269, 9), {borderRadius: dp(9)}]} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const cleanIconStyles = StyleSheet.create({
  icon: {
    position: 'absolute',
    overflow: 'visible',
  },
  line: {
    position: 'absolute',
  },
  dot: {
    position: 'absolute',
  },
  outline: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  fillCircle: {
    position: 'absolute',
    left: '5%',
    top: '5%',
    width: '90%',
    height: '90%',
    borderRadius: 999,
  },
  pinBody: {
    position: 'absolute',
    left: '18%',
    top: '8%',
    width: '64%',
    height: '64%',
    borderRadius: 999,
    transform: [{rotate: '45deg'}],
  },
  infoText: {
    position: 'absolute',
    left: 0,
    top: '4%',
    width: '100%',
    height: '92%',
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: 22,
  },
  phoneMaskTop: {
    position: 'absolute',
    left: '10%',
    top: '-4%',
    width: '80%',
    height: '44%',
    backgroundColor: '#FFFFFF',
  },
  phoneMaskMid: {
    position: 'absolute',
    left: '30%',
    top: '24%',
    width: '40%',
    height: '52%',
    backgroundColor: '#FFFFFF',
    transform: [{rotate: '-32deg'}],
  },
  docFill: {
    position: 'absolute',
    left: '24%',
    top: '9%',
    width: '52%',
    height: '78%',
    borderRadius: 5,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },
  canvas: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F6F8FC',
  },
  curve: {
    position: 'absolute',
    backgroundColor: '#F6F8FC',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    shadowColor: '#112959',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 5,
  },
  innerBox: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E7F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  line: {
    position: 'absolute',
    backgroundColor: '#E2E7F0',
  },
  copyButton: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#B9C4D8',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTag: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenTag: {
    backgroundColor: '#CFF3D6',
  },
  orangeTag: {
    backgroundColor: '#FFEADC',
  },
  statusTagText: {
    fontWeight: '700',
  },
  greenTagText: {
    color: '#09A943',
  },
  orangeTagText: {
    color: '#FF5A12',
  },
  dash: {
    position: 'absolute',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderTopColor: '#D7DFEC',
  },
  actionArea: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  contactButton: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#0B4AA2',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  tabbar: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E9F2',
  },
  homeIndicator: {
    position: 'absolute',
    backgroundColor: '#000000',
  },
});
