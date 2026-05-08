import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { orderFinanceV2Service } from '../../services/orderFinanceV2';
import { formatUnknownEnumLabel } from '../../utils';
import './index.scss';

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: '退款处理中',
  processing: '退款处理中',
  completed: '已退款',
  rejected: '退款被拒绝',
  cancelled: '退款已取消',
};

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: '处理中',
  pending: '处理中',
  investigating: '调查中',
  resolved: '已解决',
  rejected: '未支持',
  closed: '已关闭',
};

export default function AfterSalePage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeSummary, setDisputeSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (!orderId) { setLoading(false); return; }
    Promise.all([
      orderFinanceV2Service.listRefunds(orderId).catch(() => ({ items: [] } as any)),
      orderFinanceV2Service.listDisputes(orderId).catch(() => ({ items: [] } as any)),
    ]).then(([r, d]) => {
      setRefunds((r as any).items || []);
      setDisputes((d as any).items || []);
    }).finally(() => setLoading(false));
  });

  const handleRefund = async () => {
    setSubmitting(true);
    try { await orderFinanceV2Service.refund(orderId); Taro.showToast({ title: '退款申请已提交', icon: 'success' }); }
    catch (e: any) { Taro.showToast({ title: e.message || '退款失败', icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const handleDispute = async () => {
    if (!disputeSummary.trim()) { Taro.showToast({ title: '请输入争议原因', icon: 'none' }); return; }
    setSubmitting(true);
    try {
      await orderFinanceV2Service.createDispute(orderId, { summary: disputeSummary.trim() });
      setShowDispute(false);
      setDisputeSummary('');
      Taro.showToast({ title: '争议已提交', icon: 'success' });
    }
    catch (e: any) { Taro.showToast({ title: e.message || '提交失败', icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const formatAmount = (v: number) => `¥${(v / 100).toFixed(2)}`;

  return (
    <View className="after-sale-wrap">
      {/* ── 退款记录 ── */}
      <View className="card">
        <Text className="section-title">退款记录</Text>
        {loading ? <Text className="empty-state-text">加载中...</Text> :
         refunds.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-icon">💰</Text>
            <Text className="empty-state-text">暂无退款记录</Text>
          </View>
        ) : (
          refunds.map(r => (
            <View key={r.id} className="detail-row">
              <Text className="detail-row-label">{formatAmount(r.amount || 0)}</Text>
              <View className="after-sale-status-row">
                <Text className="status-badge" style={{ backgroundColor: r.status === 'completed' ? '#52C41A' : '#FA8C16' }}>
                  {REFUND_STATUS_LABELS[String(r.status || '').toLowerCase()] || formatUnknownEnumLabel(r.status, '处理中')}
                </Text>
              </View>
            </View>
          ))
        )}
        <View className="after-sale-action-btn after-sale-action-danger" onClick={handleRefund}>
          <Text className="after-sale-action-text">{submitting ? '处理中...' : '申请退款'}</Text>
        </View>
      </View>

      {/* ── 争议记录 ── */}
      <View className="card">
        <Text className="section-title">争议记录</Text>
        {disputes.length === 0 ? (
          <View className="empty-state">
            <Text className="empty-state-icon">📋</Text>
            <Text className="empty-state-text">暂无争议</Text>
          </View>
        ) : (
          disputes.map(d => (
            <View key={d.id} className="after-sale-dispute-item">
              <Text className="after-sale-dispute-summary">{d.summary}</Text>
              <Text className="status-badge" style={{ backgroundColor: '#9CA3AF' }}>
                {DISPUTE_STATUS_LABELS[String(d.status || '').toLowerCase()] || formatUnknownEnumLabel(d.status, '处理中')}
              </Text>
            </View>
          ))
        )}
        {showDispute ? (
          <View className="after-sale-dispute-form">
            <Input
              className="after-sale-input"
              value={disputeSummary}
              onInput={e => setDisputeSummary(e.detail.value)}
              placeholder="描述争议原因、时间线和期望处理方式..."
            />
            <View className="after-sale-dispute-actions">
              <View className="after-sale-action-btn after-sale-action-ghost" onClick={() => setShowDispute(false)}>
                <Text className="after-sale-action-ghost-text">取消</Text>
              </View>
              <View className="after-sale-action-btn after-sale-action-primary" onClick={handleDispute}>
                <Text className="after-sale-action-text">{submitting ? '提交中...' : '提交争议'}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="after-sale-action-btn after-sale-action-primary" onClick={() => setShowDispute(true)}>
            <Text className="after-sale-action-text">发起争议</Text>
          </View>
        )}
      </View>
    </View>
  );
}
