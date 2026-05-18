import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Button, Textarea } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { getTonePalette } from '../../../components/business/visuals';
import { dispatchV2Service } from '../../../services/dispatchV2';
import { V2DispatchTaskDetail } from '../../../types';
import { formatUnknownEnumLabel, getObjectStatusMeta } from '../../../utils';
import './index.scss';

const formatMoney = (value?: number | null) => `¥${(((value || 0) as number) / 100).toFixed(2)}`;
const DISPATCH_SOURCE_LABELS: Record<string, string> = {
  manual: '人工指派',
  auto: '自动派单',
  reassign: '重新指派',
  order_owner: '机主指派',
  platform: '平台安排',
};

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <View className='detail-row'>
      <Text className='detail-row-label'>{label}</Text>
      <Text className='detail-row-value'>{value || '-'}</Text>
    </View>
  );
}

export default function DispatchDetailPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const params = Taro.getCurrentInstance().router?.params || {};
  const dispatchId = Number(params.id || params.dispatchId || 0);

  const [detail, setDetail] = useState<V2DispatchTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectSheet, setShowRejectSheet] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    if (!dispatchId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res: any = await dispatchV2Service.get(dispatchId);
      setDetail(res.data || res || null);
    } catch (error) {
      console.error('获取派单详情失败:', error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [dispatchId]);

  useDidShow(() => {
    loadData();
  });

  if (loading) {
    return (
      <View className='dispatch-detail-loading'>
        <Text className='empty-state-text'>加载中...</Text>
      </View>
    );
  }

  if (!detail?.dispatch_task) {
    return (
      <View className='dispatch-detail-empty'>
        <Text className='empty-state-text'>正式派单不存在或当前账号没有查看权限。</Text>
      </View>
    );
  }

  const task = detail.dispatch_task;
  const order = detail.order || task.order;
  const taskStatusMeta = getObjectStatusMeta('dispatch', task.status);
  const taskStatusPalette = getTonePalette(taskStatusMeta.tone as any, false);
  const orderStatusMeta = getObjectStatusMeta('order', order?.status || '-');
  const currentUserId = Number(user?.id || 0);
  const isPilot = currentUserId > 0 && currentUserId === Number(task.target_pilot?.user_id || 0);
  const canRespond = String(task.status || '').toLowerCase() === 'pending_response' && isPilot;

  const handleAccept = async () => {
    const res = await Taro.showModal({ title: '接受正式派单', content: '确认接受这条正式派单吗？' });
    if (!res.confirm) return;
    setActionLoading(true);
    try {
      await dispatchV2Service.accept(task.id);
      Taro.showToast({ title: '已接受', icon: 'success' });
      loadData();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '请稍后重试', icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!task?.id) return;
    setActionLoading(true);
    try {
      await dispatchV2Service.reject(task.id, rejectReason.trim() || undefined);
      setShowRejectSheet(false);
      setRejectReason('');
      Taro.showToast({ title: '已拒绝', icon: 'success' });
      loadData();
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '请稍后重试', icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View className='dispatch-detail-wrap'>
      <ScrollView
        scrollY
        className='dispatch-detail-scroll'
    >
        {/* Hero */}
        <View className='page-hero dispatch-detail-hero'>
          <View className='page-hero-top'>
            <View className='dispatch-hero-tags'>
              <Text
                className='status-badge dispatch-hero-status-badge'
                style={{ backgroundColor: taskStatusPalette.bg, color: taskStatusPalette.text, borderColor: taskStatusPalette.border }}
              >
                {taskStatusMeta.label}
              </Text>
            </View>
            <Text className='page-hero-no'>{task.dispatch_no}</Text>
          </View>
          <Text className='page-hero-title'>{order?.title || '正式派单详情'}</Text>
          <Text className='page-hero-sub'>正式派单只表达执行指令：派给谁、为何派、是否已响应。</Text>
        </View>

        {/* 操作区 */}
        {canRespond && (
          <View className='card'>
            <Text className='section-title'>操作</Text>
            <View className='dispatch-action-buttons'>
              <Button
                className='dispatch-btn dispatch-btn-primary'
                onClick={handleAccept}
                loading={actionLoading}

              >
                接受派单
              </Button>
              <Button
                className='dispatch-btn dispatch-btn-danger'
                onClick={() => setShowRejectSheet(true)}

              >
                拒绝派单
              </Button>
            </View>
          </View>
        )}

        {/* 拒绝原因输入框 */}
        {showRejectSheet && (
          <View className='card dispatch-reject-card'>
            <Text className='section-title'>拒绝原因（选填）</Text>
            <Textarea
              className='dispatch-reject-input'
              placeholder='补充拒绝原因，方便机主判断是否需要重派或调整'
              value={rejectReason}
              onInput={e => setRejectReason(e.detail.value)}
              maxlength={-1}
            />
            <View className='dispatch-reject-actions'>
              <Button
                className='dispatch-btn-ghost'
                onClick={() => setShowRejectSheet(false)}
              >
                取消
              </Button>
              <Button
                className='dispatch-btn dispatch-btn-danger'
                onClick={handleReject}
                loading={actionLoading}

              >
                确认拒绝
              </Button>
            </View>
          </View>
        )}

        {/* 派单摘要 */}
        <View className='card'>
          <Text className='section-title'>派单摘要</Text>
          <DetailRow label='派单状态' value={taskStatusMeta.label} />
          <DetailRow label='派单来源' value={DISPATCH_SOURCE_LABELS[String(task.dispatch_source || '').toLowerCase()] || formatUnknownEnumLabel(task.dispatch_source, '-')} />
          <DetailRow label='目标飞手' value={task.target_pilot?.nickname || '-'} />
          <DetailRow label='机主' value={task.provider?.nickname || '-'} />
          <DetailRow label='重派次数' value={String(task.retry_count || 0)} />
          <DetailRow label='发出时间' value={task.sent_at || '-'} />
          <DetailRow label='响应时间' value={task.responded_at || '-'} />
          {task.reason ? <DetailRow label='派单说明' value={task.reason} /> : null}
        </View>

        {/* 订单上下文 */}
        <View className='card'>
          <Text className='section-title'>订单上下文</Text>
          <DetailRow label='订单号' value={order?.order_no} />
          <DetailRow label='订单状态' value={orderStatusMeta.label} />
          <DetailRow label='起始地址' value={order?.service_address || '-'} />
          <DetailRow label='目的地址' value={order?.dest_address || '-'} />
          <DetailRow label='订单金额' value={formatMoney(order?.total_amount)} />
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      {order?.id ? (
        <View className='action-bar'>
          <Button
            className='dispatch-btn-ghost'
            onClick={() => Taro.navigateTo({ url: `/pages/orders/detail/index?orderId=${order.id}` })}
          >
            查看关联订单
          </Button>
        </View>
      ) : null}
    </View>
  );
}
