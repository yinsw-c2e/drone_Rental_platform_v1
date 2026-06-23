import Taro, { useDidShow } from '@tarojs/taro';
import { openLocationCompat } from '../../../utils/locationCompat';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { orderV2Service } from '../../../services/orderV2';
import { orderFinanceV2Service } from '../../../services/orderFinanceV2';
import { ownerService } from '../../../services/owner';
import { RootState } from '../../../store/store';
import { syncCustomTabBar } from '../../../utils/tabBar';
import { getMenuButtonRectSafe } from '../../../utils/menuButton';
import { switchToOrdersTab } from '../../../utils/ordersEntry';
import { canUseProviderWorkbench, getEffectiveRoleSummary } from '../../../utils/roleSummary';
import { V2SettlementSummary } from '../../../types';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

type CleanIconName =
  | 'back'
  | 'headset'
  | 'more'
  | 'statusClock'
  | 'chevron'
  | 'pickup'
  | 'dropoff'
  | 'weight'
  | 'clock'
  | 'note'
  | 'drone'
  | 'executor'
  | 'shield'
  | 'info'
  | 'noticeInfo'
  | 'phone'
  | 'tabWorkbench'
  | 'tabOrder'
  | 'tabMessage'
  | 'tabProfile';

type CleanIconProps = {
  name: CleanIconName;
  className?: string;
};

function CleanIcon({ name, className = '' }: CleanIconProps) {
  return (
    <View className={`fs-clean-icon fs-icon-${name} ${className}`}>
      <View className="fs-icon-part p1" />
      <View className="fs-icon-part p2" />
      <View className="fs-icon-part p3" />
      <View className="fs-icon-part p4" />
      <View className="fs-icon-part p5" />
      <View className="fs-icon-part p6" />
    </View>
  );
}

type InfoRow = {
  key: string;
  label: string;
  value: string;
  icon: CleanIconName;
  clickable?: boolean;
  onClick?: () => void;
};

type ScheduleRow = {
  key: string;
  title: string;
  desc: string;
  icon: CleanIconName;
  tag: string;
  tone: 'green' | 'orange';
  onClick: () => void;
};

const openUrl = (url: string, fallback = '当前入口暂不可用') => {
  Taro.navigateTo({ url }).catch(() => {
    Taro.showToast({ title: fallback, icon: 'none' });
  });
};

const formatMoney = (amount?: number | null) => {
  const value = Number(amount || 0) / 100;
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const prefix = date.toDateString() === now.toDateString()
    ? '今天'
    : date.toDateString() === tomorrow.toDateString()
      ? '明天'
      : `${date.getMonth() + 1}-${date.getDate()}`;
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${prefix} ${hour}:${minute}`;
};

const firstWorkbenchOrderId = (workbench: any) =>
  Number(
    workbench?.pending_provider_confirmation_orders?.[0]?.id ||
    workbench?.pending_dispatch_orders?.[0]?.id ||
    0,
  );

const statusTitleOf = (status?: string) => {
  if (status === 'pending_provider_confirmation') return '待确认接单';
  if (status === 'pending_payment') return '待客户支付';
  if (status === 'pending_dispatch') return '待开始履约';
  if (['assigned', 'preparing'].includes(String(status))) return '履约准备中';
  if (['loading', 'in_transit'].includes(String(status))) return '履约进行中';
  if (status === 'delivered') return '待客户确认';
  if (status === 'completed') return '履约已完成';
  if (status === 'cancelled') return '订单已取消';
  return '履约安排';
};

const statusDescOf = (detail: any) => {
  const status = detail?.status;
  if (status === 'pending_provider_confirmation') return '客户已选择方案，等待您确认是否承接';
  if (status === 'pending_payment') return '您已确认承接，等待客户完成支付';
  if (status === 'pending_dispatch') return '订单已付款，请服务商开始履约';
  if (['assigned', 'preparing'].includes(String(status))) return '服务商正在准备本次履约';
  if (['loading', 'in_transit'].includes(String(status))) return '吊运作业正在进行';
  if (status === 'delivered') return '作业已送达，等待客户确认';
  if (status === 'completed') return '本次履约已完成';
  if (status === 'cancelled') return '订单已结束，无法继续安排履约';
  return '正在同步订单履约状态';
};

const clientPhoneOf = (detail: any) =>
  detail?.participants?.client?.phone ||
  detail?.client?.phone ||
  '';

const clientNameOf = (detail: any) =>
  detail?.participants?.client?.nickname ||
  detail?.client?.nickname ||
  '客户';

const executorNameOf = (detail: any) =>
  detail?.participants?.executor?.nickname ||
  detail?.executor?.nickname ||
  '';

const providerNameOf = (detail: any) =>
  detail?.participants?.provider?.nickname ||
  detail?.provider?.nickname ||
  '';

const fulfillmentStatusMetaOf = (detail: any) => {
  const status = String(detail?.status || '').toLowerCase();
  if (status === 'pending_dispatch') return { label: '待开始', tone: 'orange' as const };
  if (['assigned', 'preparing', 'loading', 'in_transit'].includes(status)) {
    return { label: '履约中', tone: 'green' as const };
  }
  if (['delivered', 'completed'].includes(status)) return { label: '已送达', tone: 'green' as const };
  if (status === 'pending_payment') return { label: '待支付', tone: 'orange' as const };
  return { label: '已接单', tone: 'green' as const };
};

const airspaceMetaOf = (detail: any) => {
  const siteSafetyCheck = detail?.site_safety_check;
  if (siteSafetyCheck?.id) {
    const count = Number(siteSafetyCheck?.photos?.length || 0);
    const photoText = count > 0 ? `，已上传 ${count} 张照片` : '';
    return { tag: '已复核', tone: 'green' as const, desc: `现场安全复核已完成${photoText}` };
  }

  const status = String(detail?.airspace_status || '').toLowerCase();
  const orderStatus = String(detail?.status || '').toLowerCase();
  const started = ['preparing', 'loading', 'in_transit', 'delivered', 'completed'].includes(orderStatus);
  const inProgress = ['assigned', 'pending_dispatch'].includes(orderStatus);

  if (status === 'approved' || status === 'airspace_approved') {
    return { tag: '已复核', tone: 'green' as const, desc: '空域许可已通过，现场复核可继续' };
  }
  if (status === 'not_required') {
    return started
      ? { tag: '已复核', tone: 'green' as const, desc: '空域无需单独申请，现场已进入执行流程' }
      : { tag: '无需申请', tone: 'green' as const, desc: '当前订单未要求单独空域申请' };
  }
  if (status === 'pending' || status === 'pending_review' || status === 'airspace_applying') {
    return { tag: '审核中', tone: 'orange' as const, desc: '空域报备正在审核或存证' };
  }
  if (status === 'rejected') {
    return { tag: '需处理', tone: 'orange' as const, desc: '空域审核未通过，请调整后重新提交' };
  }
  if (started) {
    return { tag: '已复核', tone: 'green' as const, desc: '执行状态已推进，现场复核已完成' };
  }
  if (inProgress) {
    return { tag: '待复核', tone: 'orange' as const, desc: '等待服务商到场进行安全复核' };
  }
  return { tag: '待确认', tone: 'orange' as const, desc: '暂无空域或现场复核状态' };
};

const insuranceMetaOf = (detail: any) => {
  const drone = detail?.drone || {};
  const verified = String(drone.insurance_verified || '').toLowerCase();
  const expireDate = drone.insurance_expire_date ? new Date(String(drone.insurance_expire_date)) : null;
  const hasValidDate = expireDate && !Number.isNaN(expireDate.getTime());
  const expired = Boolean(hasValidDate && expireDate!.getTime() < Date.now());
  const coverage = Number(drone.insurance_coverage || 0);
  const coverageText = coverage > 0 ? `，保额 ¥${Math.round(coverage / 100).toLocaleString('zh-CN')}` : '';

  if (verified === 'verified' && !expired) {
    const dateText = hasValidDate ? `有效期至 ${expireDate!.toLocaleDateString('zh-CN')}` : '保险审核已通过';
    return { tag: '已保障', tone: 'green' as const, desc: `${dateText}${coverageText}` };
  }
  if (verified === 'verified' && expired) {
    return { tag: '已过期', tone: 'orange' as const, desc: '无人机保险已过期，请更新保单' };
  }
  if (verified === 'pending') {
    return { tag: '审核中', tone: 'orange' as const, desc: '无人机保险资料正在审核' };
  }
  if (verified === 'rejected') {
    const reason = String(drone.insurance_reject_reason || '').trim();
    return { tag: '未通过', tone: 'orange' as const, desc: reason ? `未通过：${reason}` : '无人机保险资料未通过审核' };
  }
  if (detail?.contract?.payment_ready) {
    return { tag: '待核验', tone: 'orange' as const, desc: '合同已就绪，暂无无人机保单状态' };
  }
  return { tag: '待确认', tone: 'orange' as const, desc: '暂无无人机保单信息' };
};

const insuranceCertificationUrlOf = (detail: any, nextOrderId: number) => {
  const droneId = Number(detail?.drone?.id || detail?.drone_id || 0);
  return droneId ? `/pages/drone/certification/index?id=${droneId}&tab=insurance&orderId=${nextOrderId}` : '';
};

const droneDescOf = (detail: any) => {
  const drone = detail?.drone;
  if (drone?.brand || drone?.model) {
    const name = [drone.brand, drone.model].filter(Boolean).join(' ');
    const payload = Number(drone.max_payload_kg || 0);
    return payload > 0 ? `${name}，载重 ${payload}kg` : name;
  }
  const supply = detail?.source_info?.snapshots?.supply;
  if (supply?.drone_id) return `供给无人机 #${supply.drone_id}`;
  return '暂无无人机信息';
};

const settlementStatusLabelOf = (status?: string) => {
  if (status === 'pending') return '待计算';
  if (status === 'calculated') return '已计算';
  if (status === 'confirmed') return '已确认';
  if (status === 'settled') return '已入账';
  if (status === 'disputed') return '争议中';
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
  const candidates = type === 'pickup'
    ? [snapshots.departure_address, snapshots.pickup_address, snapshots.demand?.departure_address]
    : [snapshots.destination_address, snapshots.dropoff_address, snapshots.demand?.destination_address];
  return candidates.find((item: any) => Number(item?.latitude) && Number(item?.longitude));
};

export default function FulfillmentHubPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary);
  const canUseProvider = canUseProviderWorkbench(effectiveRoleSummary);
  const [navActionRight, setNavActionRight] = useState({ service: '158rpx', more: '86rpx' });
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
      const params = Taro.getCurrentInstance().router?.params || {};
      let nextOrderId = Number(params.orderId || params.id || 0);
      if (!nextOrderId) {
        const workbenchRes = await ownerService.getWorkbench();
        nextOrderId = firstWorkbenchOrderId((workbenchRes as any)?.data || workbenchRes);
      }
      if (!nextOrderId) {
        setDetail(null);
        setOrderId(0);
        setSettlement(null);
        setErrorText('暂无待履约订单');
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
  }, [canUseProvider, isAuthenticated]);

  useDidShow(() => {
    // 仅同步 TabBar 选中态，不强制改写全局角色身份。
    syncCustomTabBar(1);
    loadDetail();
  });

  useEffect(() => {
    try {
      const menu = getMenuButtonRectSafe();
      const system = Taro.getSystemInfoSync();
      const windowWidth = system.windowWidth || 375;
      const rpxRatio = 750 / windowWidth;

      if (menu?.left) {
        const capsuleRight = (windowWidth - menu.left) * rpxRatio;
        const more = Math.max(24, Math.round(capsuleRight + 24));
        setNavActionRight({ service: `${more + 76}rpx`, more: `${more}rpx` });
      }
    } catch {
      setNavActionRight({ service: '158rpx', more: '86rpx' });
    }
  }, []);

  const goBack = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/home/index' }).catch(() => null);
  };

  const openService = () => {
    Taro.switchTab({ url: '/pages/messages/index' }).catch(() => {
      Taro.showToast({ title: '客服入口暂不可用', icon: 'none' });
    });
  };

  const openMore = () => {
    Taro.showActionSheet({ itemList: ['复制订单号', '查看/更新保险', '确认现场复核'] }).then((res) => {
      if (res.tapIndex === 0) copyOrderNo();
      if (res.tapIndex === 1) openInsuranceAction();
      if (res.tapIndex === 2) confirmSafetyCheck();
    }).catch(() => null);
  };

  const copyOrderNo = () => {
    const orderNo = detail?.order_no;
    if (!orderNo) {
      Taro.showToast({ title: '暂无订单号', icon: 'none' });
      return;
    }
    Taro.setClipboardData({
      data: orderNo,
      success: () => Taro.showToast({ title: '订单号已复制', icon: 'success' }),
    });
  };

  const openLocation = (type: 'pickup' | 'dropoff') => {
    const point = addressPointOf(detail, type);
    const address = type === 'pickup' ? detail?.service_address : detail?.dest_address;
    if (!point) {
      Taro.showToast({ title: '暂无地点坐标', icon: 'none' });
      return;
    }
    openLocationCompat({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      scale: 15,
      name: point.name || point.text || address || (type === 'pickup' ? '起吊点' : '落放点'),
      address: point.text || point.address || address || '',
    }).catch(() => {
      Taro.showToast({ title: type === 'pickup' ? '起吊点地图暂不可用' : '落放点地图暂不可用', icon: 'none' });
    });
  };

  const contactCustomer = () => {
    const phone = clientPhoneOf(detail);
    if (!phone || phone.includes('*')) {
      Taro.showModal({
        title: '联系客户',
        content: `${clientNameOf(detail)}的电话当前为脱敏展示，请先通过消息或客服联系。`,
        confirmText: '去消息',
        success: (res) => {
          if (res.confirm) openService();
        },
      });
      return;
    }
    Taro.showModal({
      title: '联系客户',
      content: `是否拨打客户电话 ${phone}？`,
      confirmText: '拨打',
    }).then((res) => {
      if (!res.confirm) return;
      Taro.makePhoneCall({ phoneNumber: phone }).catch(() => {
        Taro.showToast({ title: '无法发起电话', icon: 'none' });
      });
    });
  };

  const confirmSafetyCheck = () => {
    if (!detail || !orderId) {
      Taro.showToast({ title: '暂无可复核订单', icon: 'none' });
      return;
    }
    if (['pending_provider_confirmation', 'pending_payment'].includes(String(detail.status))) {
      Taro.showToast({ title: '订单尚未进入复核阶段', icon: 'none' });
      return;
    }
    openUrl(`/pages/fulfillment/safety-check/index?orderId=${orderId}`, '现场复核页面暂不可用');
  };

  const openInsuranceAction = () => {
    if (!detail || !orderId) {
      Taro.showToast({ title: '暂无订单保单信息', icon: 'none' });
      return;
    }
    const url = insuranceCertificationUrlOf(detail, orderId);
    if (!url) {
      Taro.showToast({ title: '暂无无人机信息', icon: 'none' });
      return;
    }
    const drone = detail?.drone || {};
    const policyNo = drone.insurance_policy_no || '未填写';
    const company = drone.insurance_company || '未填写';
    const coverage = Number(drone.insurance_coverage || 0);
    const coverageText = coverage > 0 ? `¥${Math.round(coverage / 100).toLocaleString('zh-CN')}` : '未填写';
    const expireText = drone.insurance_expire_date
      ? new Date(String(drone.insurance_expire_date)).toLocaleDateString('zh-CN')
      : '未填写';
    const verified = String(drone.insurance_verified || '').toLowerCase();
    if (verified === 'verified') {
      Taro.showModal({
        title: '保险状态',
        content: `保单号：${policyNo}\n保险公司：${company}\n保额：${coverageText}\n有效期：${expireText}`,
        confirmText: '更新保单',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) openUrl(url, '保险信息页面暂不可用');
        },
      });
      return;
    }
    openUrl(url, '保险信息页面暂不可用');
  };

  const submitArrangement = () => {
    if (!detail || !orderId) {
      Taro.showToast({ title: '暂无可履约订单', icon: 'none' });
      return;
    }
    if (detail.status === 'pending_dispatch') {
      Taro.showModal({
        title: '开始履约',
        content: '确认由当前服务商开始履约？确认后订单会进入履约推进。',
        confirmText: '开始履约',
        success: async (res) => {
          if (!res.confirm) return;
          setSubmitting(true);
          try {
            await orderV2Service.startSelfFulfillment(orderId);
            Taro.showToast({ title: '已开始履约', icon: 'success' });
            loadDetail();
          } catch (error: any) {
            Taro.showToast({ title: friendlyErrorMessage(error, '开始履约失败'), icon: 'none' });
          } finally {
            setSubmitting(false);
          }
        },
      });
      return;
    }
    if (detail.status === 'pending_payment') {
      Taro.showToast({ title: '等待客户支付后再开始履约', icon: 'none' });
      return;
    }
    if (detail.status !== 'pending_provider_confirmation') {
      Taro.showToast({ title: '当前状态无需确认接单', icon: 'none' });
      return;
    }
    Taro.showModal({
      title: '确认接单',
      content: '确认承接该直达订单？确认后客户将进入合同与支付流程。',
      confirmText: '确认接单',
      success: async (res) => {
        if (!res.confirm) return;
        setSubmitting(true);
        try {
          await orderV2Service.providerConfirm(orderId);
          Taro.showToast({ title: '已确认接单', icon: 'success' });
          loadDetail();
        } catch (error: any) {
          Taro.showToast({ title: friendlyErrorMessage(error, '确认失败'), icon: 'none' });
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const switchTab = (key: 'workbench' | 'orders' | 'messages' | 'profile') => {
    if (key === 'orders') {
      switchToOrdersTab('provider').catch(() => null);
      return;
    }
    const urlMap = {
      workbench: '/pages/home/index',
      messages: '/pages/messages/index',
      profile: '/pages/profile/index',
    };
    Taro.switchTab({ url: urlMap[key] }).catch(() => null);
  };

  const finance = detail ? financialOf(detail, settlement) : { total: 0, commission: 0, ownerAmount: 0, pilotFee: 0, ownerFee: 0, source: 'estimate' as const, statusLabel: '待生成' };
  const feeTip = settlementLoading
    ? '正在同步结算明细'
    : finance.source === 'settlement'
      ? `结算${finance.statusLabel} · 履约服务 ${formatMoney(finance.pilotFee)} · 设备服务 ${formatMoney(finance.ownerFee)}`
      : '完成后生成结算明细，当前为订单预估金额';
  const fulfillmentMeta = detail ? fulfillmentStatusMetaOf(detail) : { label: '待开始', tone: 'orange' as const };
  const airspaceMeta = detail ? airspaceMetaOf(detail) : { tag: '待确认', tone: 'orange' as const, desc: '暂无空域或现场复核状态' };
  const insuranceMeta = detail ? insuranceMetaOf(detail) : { tag: '待确认', tone: 'orange' as const, desc: '暂无无人机保单信息' };
  const orderRows: InfoRow[] = detail ? [
    {
      key: 'pickup',
      label: '起吊点',
      value: detail?.service_address || '--',
      icon: 'pickup',
      clickable: true,
      onClick: () => openLocation('pickup'),
    },
    {
      key: 'dropoff',
      label: '落放点',
      value: detail?.dest_address || '--',
      icon: 'dropoff',
      clickable: true,
      onClick: () => openLocation('dropoff'),
    },
    { key: 'weight', label: '货物重量', value: detail?.cargo_weight_kg ? `${detail.cargo_weight_kg}kg` : '--', icon: 'weight' },
    { key: 'time', label: '作业时间', value: formatDateTime(detail?.start_time), icon: 'clock' },
    { key: 'note', label: '客户备注', value: detail?.source_info?.snapshots?.cargo?.cargo_special_requirements || detail?.description || '暂无备注', icon: 'note' },
  ] : [];

  const scheduleRows: ScheduleRow[] = detail ? [
    {
      key: 'drone',
      title: '选择无人机',
      desc: droneDescOf(detail),
      icon: 'drone',
      tag: detail?.drone?.availability_status === 'available' ? '可用' : '待确认',
      tone: detail?.drone?.availability_status === 'available' ? 'green' : 'orange',
      onClick: () => Taro.showToast({ title: '无人机由服务商负责履约', icon: 'none' }),
    },
    {
      key: 'service',
      title: '服务商履约',
      desc: providerNameOf(detail) || executorNameOf(detail) || '当前服务商负责本单履约',
      icon: 'executor',
      tag: fulfillmentMeta.label,
      tone: fulfillmentMeta.tone,
      onClick: () => Taro.showToast({ title: '本单由当前服务商履约', icon: 'none' }),
    },
    {
      key: 'safety',
      title: '空域 / 安全检查',
      desc: airspaceMeta.desc,
      icon: 'shield',
      tag: airspaceMeta.tag,
      tone: airspaceMeta.tone,
      onClick: confirmSafetyCheck,
    },
    {
      key: 'insurance',
      title: '保险状态',
      desc: insuranceMeta.desc,
      icon: 'shield',
      tag: insuranceMeta.tag,
      tone: insuranceMeta.tone,
      onClick: openInsuranceAction,
    },
  ] : [];

  const submitText = (() => {
    if (submitting) return '提交中...';
    if (detail?.status === 'pending_provider_confirmation') return '确认接单';
    if (detail?.status === 'pending_dispatch') return '开始履约';
    if (detail?.status === 'pending_payment') return '等待支付';
    return '履约推进';
  })();

  return (
    <View className="fs-page">
      <ScrollView scrollY className="fs-scroll" enhanced showScrollbar={false}>
        <View className="fs-canvas">
          <View className="fs-top-bg" />
          <View className="fs-content-curve" />

          <View className="fs-nav-back" onClick={goBack}>
            <CleanIcon name="back" className="fs-nav-back-icon" />
          </View>
          <Text className="fs-nav-title">履约安排</Text>
          <View className="fs-nav-action fs-nav-service" style={{ right: navActionRight.service }} onClick={openService}>
            <CleanIcon name="headset" className="fs-nav-action-icon" />
            <Text className="fs-nav-action-label">客服</Text>
          </View>
          <View className="fs-nav-action fs-nav-more" style={{ right: navActionRight.more }} onClick={openMore}>
            <CleanIcon name="more" className="fs-nav-action-icon" />
            <Text className="fs-nav-action-label">更多</Text>
          </View>

          {!detail ? (
            <View className="fs-empty-card">
              <Text className="fs-empty-title">{loading ? '正在同步履约订单' : '暂无可安排订单'}</Text>
              <Text className="fs-empty-desc">{loading ? '加载中…' : errorText || '暂无待履约订单'}</Text>
            </View>
          ) : (
            <>
          <View className="fs-status-card">
            <CleanIcon name="statusClock" className="fs-status-icon" />
            <Text className="fs-status-title">{statusTitleOf(detail?.status)}</Text>
            <Text className="fs-order-label">订单号</Text>
            <Text className="fs-order-no">{detail?.order_no || '--'}</Text>
            <View className="fs-copy-btn" onClick={copyOrderNo}>
              <Text className="fs-copy-text">复制</Text>
            </View>
            <Text className="fs-status-desc">{statusDescOf(detail)}</Text>
          </View>

          <View className="fs-card fs-order-card">
            <Text className="fs-card-title">订单信息</Text>
            <View className="fs-table fs-order-table">
              {orderRows.map((row, index) => (
                <View
                  key={row.key}
                  className={`fs-info-row ${index === orderRows.length - 1 ? 'last' : ''}`}
                  onClick={row.clickable ? row.onClick : undefined}
                >
                  <CleanIcon name={row.icon} className={`fs-info-icon fs-info-icon-${row.key}`} />
                  <Text className="fs-info-label">{row.label}</Text>
                  <Text className="fs-info-value" numberOfLines={1}>{row.value}</Text>
                  {row.clickable && <CleanIcon name="chevron" className="fs-row-chevron" />}
                </View>
              ))}
            </View>
          </View>

          <View className="fs-card fs-schedule-card">
            <Text className="fs-card-title">履约安排</Text>
            <View className="fs-table fs-schedule-table">
              {scheduleRows.map((row, index) => (
                <View
                  key={row.key}
                  className={`fs-schedule-row ${index === scheduleRows.length - 1 ? 'last' : ''}`}
                  onClick={row.onClick}
                >
                  <CleanIcon name={row.icon} className={`fs-schedule-icon fs-schedule-icon-${row.key}`} />
                  <Text className="fs-schedule-title">{row.title}</Text>
                  <Text className="fs-schedule-desc">{row.desc}</Text>
                  <View className={`fs-status-tag ${row.tone}`}>
                    <Text className={`fs-status-tag-text ${row.tone}`}>{row.tag}</Text>
                  </View>
                  <CleanIcon name="chevron" className="fs-schedule-chevron" />
                </View>
              ))}
            </View>
          </View>

          <View className="fs-card fs-fee-card">
            <Text className="fs-card-title">费用与报价</Text>
            <View className="fs-fee-box">
              <View className="fs-fee-line fs-fee-line-1">
                <Text className="fs-fee-label">{finance.source === 'settlement' ? '客户实付' : '客户报价'}</Text>
                <Text className="fs-fee-value">{formatMoney(finance.total)}</Text>
              </View>
              <View className="fs-fee-line fs-fee-line-2">
                <Text className="fs-fee-label">平台服务费</Text>
                <CleanIcon name="info" className="fs-info-mark" />
                <Text className="fs-fee-value">{formatMoney(finance.commission)}</Text>
              </View>
              <View className="fs-fee-dash" />
              <View className="fs-fee-line fs-fee-line-3">
                <Text className="fs-settle-label">{finance.source === 'settlement' ? '服务方分账' : '预计结算'}</Text>
                <Text className="fs-settle-value">{formatMoney(finance.ownerAmount)}</Text>
              </View>
            </View>
            <View className="fs-fee-tip-row">
              <CleanIcon name="noticeInfo" className="fs-fee-tip-icon" />
              <Text className="fs-fee-tip" numberOfLines={1}>{feeTip}</Text>
            </View>
          </View>

          <View className="fs-action-area">
            <View className="fs-contact-btn" onClick={contactCustomer}>
              <CleanIcon name="phone" className="fs-phone-icon" />
              <Text className="fs-contact-text">联系客户</Text>
            </View>
            <View className="fs-submit-btn" onClick={submitArrangement}>
              <Text className="fs-submit-text">{submitText}</Text>
            </View>
          </View>
            </>
          )}

          <View className="fs-tabbar">
            <View className="fs-tab-item fs-tab-workbench" onClick={() => switchTab('workbench')}>
              <CleanIcon name="tabWorkbench" className="fs-tab-icon workbench" />
              <Text className="fs-tab-text">工作台</Text>
            </View>
            <View className="fs-tab-item fs-tab-order" onClick={() => switchTab('orders')}>
              <CleanIcon name="tabOrder" className="fs-tab-icon accept" />
              <Text className="fs-tab-text active">接单</Text>
            </View>
            <View className="fs-tab-item fs-tab-message" onClick={() => switchTab('messages')}>
              <CleanIcon name="tabMessage" className="fs-tab-icon message" />
              <Text className="fs-tab-text">消息</Text>
            </View>
            <View className="fs-tab-item fs-tab-profile" onClick={() => switchTab('profile')}>
              <CleanIcon name="tabProfile" className="fs-tab-icon profile" />
              <Text className="fs-tab-text">我的</Text>
            </View>
            <View className="fs-home-indicator" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
