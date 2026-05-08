import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components';
import { dispatchV2Service } from '../../../services/dispatchV2';
import { orderV2Service } from '../../../services/orderV2';
import './index.scss';

const MODE_OPTIONS = [
  { key: 'bound_pilot', title: '合作飞手', desc: '优先联系你已建立长期合作的飞手', accent: '#1677FF' },
  { key: 'candidate_pool', title: '优先候选', desc: '优先从更匹配当前任务的候选执行方里继续安排', accent: '#722ED1' },
  { key: 'general_pool', title: '平台协调', desc: '由平台继续协调当前可用的执行团队', accent: '#FA8C16' },
];

export default function CreateDispatchPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || 0);
  const dispatchId = Number(params.dispatchId || 0);
  const isReassign = dispatchId > 0;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMode, setSelectedMode] = useState('candidate_pool');
  const [pilotUserId, setPilotUserId] = useState('');
  const [reason, setReason] = useState('');

  useDidShow(() => {
    if (!orderId) { setLoading(false); return; }
    orderV2Service.get(orderId).then(res => {
      setOrder(res);
    }).catch(() => {}).finally(() => setLoading(false));
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        dispatch_mode: selectedMode,
        target_pilot_user_id: selectedMode === 'bound_pilot' ? Number(pilotUserId) || undefined : undefined,
        reason: reason.trim() || undefined,
      };
      if (isReassign) {
        await dispatchV2Service.reassign(dispatchId, payload);
      } else {
        await orderV2Service.dispatch(orderId, payload);
      }
      Taro.showToast({ title: isReassign ? '重派已发起' : '派单已创建', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch (e: any) { Taro.showToast({ title: e.message || '操作失败', icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return <View className="dc-wrap"><View className="empty-state"><Text className="empty-state-text">加载中...</Text></View></View>;
  }

  if (!order) {
    return (
      <View className="dc-wrap">
        <View className="empty-state">
          <Text className="empty-state-icon">📋</Text>
          <Text className="empty-state-text">订单不存在，或无法发起正式派单</Text>
        </View>
      </View>
    );
  }

  const orderNo = order.order_no || '-';
  const orderTitle = order.title || '-';
  const orderStatus = order.status || '-';

  return (
    <ScrollView scrollY className="dc-wrap">
      {/* ── Hero ── */}
      <View className="page-hero dc-hero">
        <Text className="page-hero-title">{isReassign ? '正式派单重派' : '发起正式派单'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '6px', display: 'block' }}>
          {isReassign ? '切换执行来源' : '从订单发出执行指令'}
        </Text>
      </View>

      {/* ── 订单上下文 ── */}
      <View className="card">
        <Text className="section-title">订单上下文</Text>
        <View className="detail-row">
          <Text className="detail-row-label">订单号</Text>
          <Text className="detail-row-value">{orderNo}</Text>
        </View>
        <View className="detail-row">
          <Text className="detail-row-label">订单标题</Text>
          <Text className="detail-row-value">{orderTitle}</Text>
        </View>
        <View className="detail-row">
          <Text className="detail-row-label">当前状态</Text>
          <Text className="detail-row-value">{orderStatus}</Text>
        </View>
        <View className="detail-row" style={{ borderBottomWidth: 0 }}>
          <Text className="detail-row-label">金额</Text>
          <Text className="detail-row-value" style={{ color: '#F5222D' }}>¥{((order.total_amount || 0) / 100).toFixed(2)}</Text>
        </View>
      </View>

      {/* ── 选择派单来源 ── */}
      <View className="card">
        <Text className="section-title">选择派单来源</Text>
        {MODE_OPTIONS.map(option => {
          const active = option.key === selectedMode;
          return (
            <View key={option.key} className={`dc-mode-card ${active ? 'dc-mode-active' : ''}`}
              style={active ? { borderColor: option.accent, backgroundColor: `${option.accent}12` } : {}}
              onClick={() => setSelectedMode(option.key)}>
              <View className="dc-mode-top">
                <Text className="dc-mode-title" style={active ? { color: option.accent } : {}}>{option.title}</Text>
                <View className="dc-mode-dot" style={{ backgroundColor: option.accent }} />
              </View>
              <Text className="dc-mode-desc">{option.desc}</Text>
            </View>
          );
        })}
      </View>

      {/* ── 合作飞手选择 ── */}
      {selectedMode === 'bound_pilot' && (
        <View className="card">
          <Text className="section-title">指定飞手</Text>
          <Input className="dc-input" type="number" placeholder="目标飞手用户ID" value={pilotUserId} onInput={e => setPilotUserId(e.detail.value)} />
        </View>
      )}

      {/* ── 派单说明 ── */}
      <View className="card">
        <Text className="section-title">派单说明</Text>
        <Text className="dc-hint">这段说明会进入正式派单日志，便于飞手理解本次调度原因。</Text>
        <Textarea
          className="dc-textarea"
          value={reason}
          onInput={e => setReason(e.detail.value)}
          placeholder={selectedMode === 'bound_pilot' ? '例如：优先联系熟悉该山区吊运线路的合作飞手' : '例如：按平台协调方式继续安排执行'}
        />
      </View>

      {/* ── 提交按钮 ── */}
      <View className="action-bar">
        <View className={`dc-submit-btn ${submitting ? 'dc-submit-disabled' : ''}`} onClick={handleSubmit}>
          <Text className="dc-submit-text">{submitting ? '提交中...' : isReassign ? '确认重派' : '确认发起正式派单'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
