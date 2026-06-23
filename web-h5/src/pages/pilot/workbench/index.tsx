import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { orderV2Service, updateExecutionStatus } from '../../../services/orderV2';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const EXECUTION_STEPS = [
  { status: 'preparing', label: '现场准备', desc: '完成装货、自检、天气与空域复核', icon: '🔧' },
  { status: 'in_transit', label: '飞行执行', desc: '起飞后持续监控航线、载荷与通讯状态', icon: '🚁' },
  { status: 'delivered', label: '完成投送', desc: '确认卸载完成，等待客户签收', icon: '✅' },
];

const EXECUTION_ORDER = EXECUTION_STEPS.map(step => step.status);

export default function PilotWorkbenchPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || 0);
  const taskId = Number(params.taskId || 0);
  const [currentStatus, setCurrentStatus] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (orderId > 0) {
      orderV2Service.get(orderId).then(res => {
        const o: any = res;
        setOrder(o);
        setCurrentStatus(o?.status || '');
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  });

  const currentStepIndex = currentStatus === 'completed'
    ? EXECUTION_ORDER.length - 1
    : EXECUTION_ORDER.indexOf(currentStatus);
  const currentStep = EXECUTION_STEPS.find(s => s.status === currentStatus);

  const handleExecute = async (status: string) => {
    if (!orderId) { Taro.showToast({ title: '缺少订单信息', icon: 'none' }); return; }
    setSubmitting(true);
    try {
      await updateExecutionStatus(orderId, status);
      setCurrentStatus(status);
      Taro.showToast({ title: `状态已更新`, icon: 'success' });
    } catch (e: any) { Taro.showToast({ title: friendlyErrorMessage(e, '操作失败'), icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return <View className="pw-wrap"><View className="empty-state"><Text className="empty-state-text">加载中...</Text></View></View>;
  }

  return (
    <ScrollView scrollY className="pw-wrap">
      {/* ── Hero ── */}
      <View className="page-hero pw-hero">
        <Text className="page-hero-title">执行工作台</Text>
        <Text className="pw-hero-sub">
          {order?.title || '飞行任务执行'}
        </Text>
        <Text className="pw-hero-order-no">{order?.order_no || ''}</Text>
      </View>

      {/* ── 当前状态 ── */}
      <View className="card">
        <Text className="section-title">当前执行状态</Text>
        <View className="pw-current-status">
          <Text className="pw-current-label">
            {currentStatus === 'completed' ? '订单已完成' : currentStep?.label || '未开始执行'}
          </Text>
          <Text className="pw-current-desc">
            {currentStatus === 'completed' ? '客户已确认签收，本次运输已闭环。' : currentStep?.desc || '客户已完成支付，等待执行人开始现场准备。'}
          </Text>
        </View>
      </View>

      {/* ── 执行步骤 ── */}
      <View className="card">
        <Text className="section-title">执行步骤</Text>
        {EXECUTION_STEPS.map((step, idx) => {
          const isActive = EXECUTION_ORDER.indexOf(step.status) <= currentStepIndex;
          const isNext = EXECUTION_ORDER.indexOf(step.status) === currentStepIndex + 1;
          const isCurrent = currentStatus === step.status;
          const isDone = currentStatus === 'completed';
          return (
            <View key={step.status} className={`pw-step ${isActive ? 'pw-step-active' : ''}`}>
              <View className="pw-step-left">
                <View className={`pw-step-icon-wrap ${isActive ? 'pw-step-icon-wrap-active' : ''}`}>
                  <Text className="pw-step-icon">{step.icon}</Text>
                </View>
                {idx < EXECUTION_STEPS.length - 1 && (
                  <View className={`pw-step-line ${isActive ? 'pw-step-line-active' : ''}`} />
                )}
              </View>
              <View className="pw-step-content">
                <Text className="pw-step-label">{step.label}</Text>
                <Text className="pw-step-desc">{step.desc}</Text>
                {!isDone && (isNext || currentStatus === 'assigned' && idx === 0) ? (
                  <View className={`pw-step-btn ${submitting ? 'pw-step-btn-disabled' : ''}`}
                    onClick={() => handleExecute(step.status)}>
                    <Text className="pw-step-btn-text">{submitting && isCurrent ? '处理中...' : '执行此步骤'}</Text>
                  </View>
                ) : !isDone && isCurrent && currentStatus !== 'delivered' ? (
                  <View className={`pw-step-btn pw-step-btn-next ${submitting ? 'pw-step-btn-disabled' : ''}`}
                    onClick={() => handleExecute(EXECUTION_ORDER[Math.min(idx + 1, EXECUTION_ORDER.length - 1)])}>
                    <Text className="pw-step-btn-text">标记下一步</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
