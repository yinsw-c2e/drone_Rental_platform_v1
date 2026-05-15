// @ts-nocheck
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import { Image, View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { orderV2Service, confirmReceipt } from '../../../services/orderV2';
import { V2OrderDetail } from '../../../types';
import { getObjectStatusMeta } from '../../../utils';
import heroBgImage from '../../../assets/order-detail/images/order_detail_hero_bg_750x360.jpg';
import calendarIcon from '../../../assets/order-detail/icons/calendar_line.png';
import chevronIcon from '../../../assets/order-detail/icons/chevron_right.png';
import locationIcon from '../../../assets/order-detail/icons/location_line.png';
import timelineClockIcon from '../../../assets/order-detail/icons/timeline_clock.png';
import './index.scss';

const STATUS_LABELS: Record<string, string> = {
  pending_provider_confirmation: '待机主确认', pending_payment: '待付款', paid: '已支付',
  pending_dispatch: '待派单', assigned: '已分配', preparing: '准备中', in_transit: '运输中',
  delivered: '已投送', completed: '已完成', cancelled: '已取消', provider_rejected: '机主已拒绝',
};

const formatMoney = (v?: number | null) => `¥${(((v || 0) / 100)).toFixed(2)}`;
const summarizeParty = (p: any, fb: string) => p?.nickname || (p?.user_id ? `${fb} #${p.user_id}` : fb);
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '等待支付',
  processing: '支付处理中',
  paid: '支付成功',
  failed: '支付失败',
  refunded: '已退款',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: '退款处理中',
  processing: '退款处理中',
  completed: '已退款',
  rejected: '退款被拒绝',
  cancelled: '退款已取消',
};

const TIMELINE_SOURCE_LABELS: Record<string, string> = {
  order: '订单',
  payment: '支付',
  refund: '退款',
  dispatch: '执行',
  dispatch_task: '执行',
  dispute: '争议',
};

const looksLikeBackendCode = (value?: string) => /^[a-z0-9_:-]+$/i.test(String(value || '').trim());

const getProgressInfo = (status: string, isClient: boolean, isProvider: boolean) => {
  switch (status) {
    case 'pending_provider_confirmation':
      return {
        eyebrow: isProvider ? '当前在等你' : '当前在等机主',
        title: isProvider ? '请确认是否承接' : '机主正在确认是否承接',
        desc: isProvider ? '确认后客户即可继续支付，订单会进入执行安排。' : '对方确认承接后，平台会继续推进合同与支付。',
        eta: '等待确认',
      };
    case 'pending_payment':
      return {
        eyebrow: isClient ? '下一步是支付' : '等待客户支付',
        title: isClient ? '请尽快支付' : '等待支付',
        desc: '双方合同已确认完成，支付成功后平台会继续推进执行安排。',
        eta: '支付后推进',
      };
    case 'delivered':
      return {
        eyebrow: isClient ? '当前在等你' : '等待客户确认签收',
        title: isClient ? '请确认签收' : '已完成投送',
        desc: isClient ? '确认无误后完成签收，订单会进入收尾归档。' : '客户确认签收后，本次订单会进入完成状态。',
        eta: '等待签收',
      };
    case 'completed':
      return {
        eyebrow: '订单已完成',
        title: '本次运输已经闭环完成',
        desc: '合同、支付、执行留痕和评价都会继续保留在当前订单里。',
        eta: '可随时查看记录',
      };
    case 'cancelled':
    case 'provider_rejected':
      return {
        eyebrow: '订单已结束',
        title: getObjectStatusMeta('order', status).label,
        desc: '当前没有继续推进的动作，订单记录会保留在本页。',
        eta: '无需额外操作',
      };
    default:
      return {
        eyebrow: '订单进度',
        title: getObjectStatusMeta('order', status).label,
        desc: '当前订单正在推进中，后续重要动作都会汇总在下方时间线里。',
        eta: '查看订单时间线',
      };
  }
};

const getTimelineTitle = (item: any) => {
  const sourceType = String(item.source_type || '').toLowerCase();
  const rawTitle = String(item.title || '').trim();
  const rawStatus = String(item.status || '').trim();
  const fallbackTitle = rawTitle && !looksLikeBackendCode(rawTitle) ? rawTitle : '';

  if (fallbackTitle) return fallbackTitle;

  if (sourceType === 'payment') {
    return PAYMENT_STATUS_LABELS[rawStatus.toLowerCase()] || '支付进度更新';
  }
  if (sourceType === 'refund') {
    return REFUND_STATUS_LABELS[rawStatus.toLowerCase()] || '退款进度更新';
  }
  if (sourceType === 'dispatch' || sourceType === 'dispatch_task') {
    return getObjectStatusMeta('dispatch_task', rawStatus).label;
  }
  if (sourceType === 'order') {
    return getObjectStatusMeta('order', rawStatus).label;
  }
  const statusLabel = getObjectStatusMeta('order', rawStatus).label;
  if (statusLabel !== rawStatus) return statusLabel;
  return TIMELINE_SOURCE_LABELS[sourceType] ? `${TIMELINE_SOURCE_LABELS[sourceType]}更新` : '订单状态更新';
};

function SectionGlyph({ type }: { type: 'progress' | 'action' | 'task' }) {
  if (type === 'action') {
    return (
      <View className="section-glyph section-glyph-action">
        <View className="section-glyph-action-handle" />
        <View className="section-glyph-action-body" />
        <View className="section-glyph-action-lock" />
      </View>
    );
  }

  return (
    <View className={`section-glyph section-glyph-${type}`}>
      {type === 'progress' && <View className="section-glyph-clip" />}
      {type === 'task' && <View className="section-glyph-corner" />}
      <View className="section-glyph-line section-glyph-line-a" />
      <View className="section-glyph-line section-glyph-line-b" />
      <View className="section-glyph-line section-glyph-line-c" />
    </View>
  );
}

function DetailRow({ label, value, highlight, long, icon }: { label: string; value?: string; highlight?: boolean; long?: boolean; icon?: string }) {
  return (
    <View className={`detail-row${long ? ' detail-row-long' : ''}`}>
      <View className="detail-row-label-wrap">
        {icon ? <Image className="detail-row-icon" src={icon} mode="aspectFit" /> : null}
        <Text className="detail-row-label">{label}</Text>
      </View>
      <Text className={`detail-row-value${highlight ? ' detail-row-value-highlight' : ''}`}>{value || '-'}</Text>
    </View>
  );
}

export default function OrderDetailPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [detail, setDetail] = useState<V2OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [scrollTarget, setScrollTarget] = useState('');

  const load = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    setLoading(true);
    try { setDetail(await orderV2Service.get(orderId) as any); } catch { setDetail(null); }
    finally { setLoading(false); }
  }, [orderId]);

  useDidShow(() => { load(); });

  if (loading) return <View style={{ padding: '60px', textAlign: 'center' }}><Text>加载中...</Text></View>;
  if (!detail) return <View style={{ padding: '60px', textAlign: 'center' }}><Text>订单不存在</Text></View>;

  const uid = Number(user?.id || 0);
  const client = (detail as any).participants?.client || (detail as any).client;
  const provider = (detail as any).participants?.provider || (detail as any).provider;
  const isClient = uid > 0 && uid === Number(client?.user_id || 0);
  const isProvider = uid > 0 && uid === Number(provider?.user_id || 0);
  const status = detail.status || '';
  const fin = (detail as any).financial_summary || {};
  const progress = getProgressInfo(status, isClient, isProvider);
  const canConfirmProvider = status === 'pending_provider_confirmation' && isProvider;
  const canPay = status === 'pending_payment' && isClient;
  const canConfirmReceipt = status === 'delivered' && isClient;
  const canCancelOrder = !['completed', 'cancelled', 'provider_rejected', 'in_transit', 'delivered'].includes(status) && (isClient || isProvider);
  const hasOrderActions = canConfirmProvider || canPay || canConfirmReceipt || canCancelOrder;
  const timelineItems = ((detail as any).timeline || []);

  const doAction = async (fn: () => Promise<any>, msg: string) => {
    setActionLoading(true);
    try { await fn(); Taro.showToast({ title: msg, icon: 'success' }); load(); }
    catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); }
    finally { setActionLoading(false); }
  };

  const handleConfirm = () => Taro.showModal({ title: '确认承接', content: '确认承接这笔订单？' }).then(r => r.confirm && doAction(() => orderV2Service.providerConfirm(orderId), '已确认'));
  const handleReject = () => Taro.showModal({ title: '拒绝订单', content: '确认拒绝？' }).then(r => r.confirm && doAction(() => orderV2Service.providerReject(orderId, '机主拒绝'), '已拒绝'));
  const handleCancel = () => Taro.showModal({ title: '取消订单', content: '确定取消？' }).then(r => r.confirm && doAction(() => orderV2Service.cancel(orderId, '用户取消'), '已取消'));
  const handleReceipt = () => Taro.showModal({ title: '确认签收', content: '确认已收到货物？' }).then(r => r.confirm && doAction(() => confirmReceipt(orderId), '签收成功'));
  const handleTimelineJump = () => {
    if (!timelineItems.length) return;
    setScrollTarget('');
    setTimeout(() => setScrollTarget('order-timeline-section'), 0);
  };

  return (
    <View className="order-detail-page">
      <ScrollView scrollY scrollWithAnimation scrollIntoView={scrollTarget} className="order-detail-scroll">
        {/* Hero */}
        <View className="order-detail-hero">
          <Image className="order-detail-hero-bg" src={heroBgImage} mode="aspectFill" />
          <View className="order-detail-hero-top">
            <Text className="order-detail-hero-no">{detail.order_no}</Text>
            <Text className="order-detail-status-pill">
              {STATUS_LABELS[status] || getObjectStatusMeta('order', status).label}
            </Text>
          </View>
          <Text className="order-detail-hero-title">{detail.title}</Text>
          <View className="order-detail-hero-route">
            <View className="order-detail-hero-route-pin" />
            <View className="order-detail-hero-route-texts">
              <Text>{detail.service_address || '未设置起点'} →</Text>
              <Text>{detail.dest_address || '未设置终点'}</Text>
            </View>
          </View>
          <View className="order-detail-hero-divider" />
          <View className="order-detail-hero-summary">
            <View className="order-detail-hero-metric">
              <Text className="order-detail-hero-metric-label">订单金额</Text>
              <Text className="order-detail-hero-metric-value">{formatMoney(detail.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Progress Focus */}
        <View className="progress-focus-card">
          <View className="progress-focus-header">
            <View className="progress-focus-title-wrap">
              <SectionGlyph type="progress" />
              <Text className="section-title section-title-inline">订单进度</Text>
            </View>
            <View className="focus-eta-pill" onClick={handleTimelineJump}>
              <Text className="focus-eta-text">查看订单时间线</Text>
              <Image className="focus-eta-icon" src={chevronIcon} mode="aspectFit" />
            </View>
          </View>
          <View className="progress-focus-main">
            <Image className="progress-main-icon" src={timelineClockIcon} mode="aspectFit" />
            <View className="progress-main-content">
              <Text className="focus-title">{progress.title}</Text>
              <Text className="focus-desc">{progress.desc}</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        {hasOrderActions && <View className="card action-card">
          <View className="section-head-left">
            <SectionGlyph type="action" />
            <Text className="section-title section-title-inline">操作</Text>
          </View>
          <View className="order-action-list">
            {canConfirmProvider && <View className="order-action-btn order-action-btn-primary" onClick={handleConfirm}><Text className="order-action-btn-text order-action-btn-text-primary">{actionLoading ? '处理中...' : '确认承接'}</Text></View>}
            {canConfirmProvider && <View className="order-action-btn order-action-btn-danger" onClick={handleReject}><Text className="order-action-btn-text order-action-btn-text-danger">拒绝订单</Text></View>}
            {canPay && <View className="order-action-btn order-action-btn-primary" onClick={() => Taro.navigateTo({ url: `/pages/payment/index?orderId=${orderId}` })}><Text className="order-action-btn-text order-action-btn-text-primary">去支付</Text></View>}
            {canConfirmReceipt && <View className="order-action-btn order-action-btn-primary" onClick={handleReceipt}><Text className="order-action-btn-text order-action-btn-text-primary">确认签收</Text></View>}
            {canCancelOrder && <View className="order-action-btn order-action-btn-danger" onClick={handleCancel}><Text className="order-action-btn-text order-action-btn-text-danger">取消订单</Text></View>}
          </View>
        </View>}

        {/* Task info */}
        <View className="card">
          <View className="section-head-left">
            <SectionGlyph type="task" />
            <Text className="section-title section-title-inline">任务信息</Text>
          </View>
          <View className="detail-list">
            <DetailRow label="起始地址" value={detail.service_address} icon={locationIcon} />
            <DetailRow label="目的地址" value={detail.dest_address} icon={locationIcon} />
            <DetailRow label="计划开始" value={formatDateTime(detail.start_time)} icon={calendarIcon} />
            <DetailRow label="计划结束" value={formatDateTime(detail.end_time)} icon={calendarIcon} />
          </View>
        </View>

        {/* Participants */}
        <View className="card">
          <Text className="section-title">参与方</Text>
          <View className="participant-card">
            <View className="participant-avatar participant-avatar-blue"><Text className="participant-avatar-text">{summarizeParty(client, '客').charAt(0)}</Text></View>
            <View className="participant-body">
              <Text className="participant-label">客户</Text>
              <Text className="participant-name">{summarizeParty(client, '客户')}</Text>
              <Text className="participant-meta">{isClient ? '当前账号 · 我' : '等待补充联系方式'}</Text>
            </View>
            <Image className="participant-chevron" src={chevronIcon} mode="aspectFit" />
          </View>
          <View className="participant-card">
            <View className="participant-avatar participant-avatar-green"><Text className="participant-avatar-text">{summarizeParty(provider, '承').charAt(0)}</Text></View>
            <View className="participant-body">
              <Text className="participant-label">承接方</Text>
              <Text className="participant-name">{summarizeParty(provider, '待确认机主')}</Text>
              <Text className="participant-meta">{isProvider ? '当前账号 · 我' : '等待补充联系方式'}</Text>
            </View>
            <Image className="participant-chevron" src={chevronIcon} mode="aspectFit" />
          </View>
        </View>

        {/* Cost */}
        <View className="card">
          <Text className="section-title">费用明细</Text>
          <View className="cost-grid">
            <View className="cost-row"><Text className="cost-label">运输服务费</Text><Text className="cost-value">{formatMoney(detail.total_amount)}</Text></View>
            <View className="cost-row"><Text className="cost-label">履约保证金</Text><Text className="cost-value">{formatMoney(fin.deposit_amount || 0)}</Text></View>
            <View className="cost-divider" />
            <View className="cost-row"><Text className="cost-total-label">总计金额</Text><Text className="cost-total-value">{formatMoney(Number(detail.total_amount || 0) + Number(fin.deposit_amount || 0))}</Text></View>
          </View>
          <DetailRow label="已支付总额" value={formatMoney(fin.paid_amount)} highlight />
          <DetailRow label="已退款金额" value={formatMoney(fin.refunded_amount)} />
        </View>

        {/* Timeline */}
        {timelineItems.length > 0 && (
          <View className="card timeline-card" id="order-timeline-section">
            <View className="timeline-card-head">
              <Text className="section-title section-title-inline">订单动态汇总</Text>
              <Text className="timeline-count">{timelineItems.length} 条记录</Text>
            </View>
            <View className="timeline-list">
              {timelineItems.map((item: any, i: number) => {
                const isCurrent = i === timelineItems.length - 1;
                return (
                <View key={i} className={`timeline-item ${isCurrent ? 'timeline-item-current' : ''}`}>
                  <View className="timeline-axis">
                    <View className={`timeline-dot ${isCurrent ? 'timeline-dot-current' : ''}`} />
                    {i < (timelineItems.length - 1) && <View className="timeline-line" />}
                  </View>
                  <View className={`timeline-body ${isCurrent ? 'timeline-body-current' : ''}`}>
                    <View className="timeline-title-row">
                      <Text className="timeline-title">{getTimelineTitle(item)}</Text>
                      <Text className="timeline-time">{formatDateTime(item.occurred_at || item.created_at)}</Text>
                    </View>
                    <View className="timeline-bottom-row">
                      {(item.description || item.note) && <Text className="timeline-desc">{item.description || item.note}</Text>}
                      {isCurrent && <Text className="timeline-current-pill">当前进度</Text>}
                    </View>
                  </View>
                </View>
              )})}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
